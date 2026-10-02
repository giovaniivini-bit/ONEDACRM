/**
 * Oneda CRM - Servidor Local de Controle de Atividades e Métricas
 * Confecções Oneda & Equipe
 * Zero dependências externas - utiliza Node.js nativo (http, https, fs, path)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createDriveImageProxy } = require('./drive-image-cache');
const alertsEngine = require('./alerts-engine');
const { createAdminAuth } = require('./admin-auth');
const {
    readRequestBody,
    requestIsSameOrigin,
    applySecurityHeaders
} = require('./server-security');

const PORT = process.env.PORT || 3000;
const ALT_PORT = 8080;
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const CURRENT_DATA_PATH = path.join(DATA_DIR, 'current_data.csv');
const FULL_DATA_PATH = path.join(DATA_DIR, 'full_dataset.csv');
const DRIVE_IMAGES_PATH = path.join(DATA_DIR, 'drive_images.json');
const STATIC_IMAGES_DIR = path.join(BASE_DIR, 'images');
const STATIC_IMAGE_MAP_PATH = path.join(BASE_DIR, 'image_map.json');
const ADMIN_TOKEN = String(process.env.CRM_ADMIN_TOKEN || '').trim();
const ADMIN_PASSWORD_HASH = String(process.env.CRM_ADMIN_PASSWORD_HASH || '').trim();
const CRM_PUBLIC_ORIGIN = String(process.env.CRM_PUBLIC_ORIGIN || '').trim();
const CRM_TRUST_PROXY = process.env.CRM_TRUST_PROXY === '1';
const CRM_TRUSTED_PROXY_IPS = String(process.env.CRM_TRUSTED_PROXY_IPS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
const sameOriginRequest = req => requestIsSameOrigin(req, {
    publicOrigin: CRM_PUBLIC_ORIGIN,
    trustProxy: CRM_TRUST_PROXY
});
const adminAuth = createAdminAuth({
    passwordHash: ADMIN_PASSWORD_HASH,
    legacyToken: ADMIN_TOKEN,
    publicOrigin: CRM_PUBLIC_ORIGIN,
    trustProxy: CRM_TRUST_PROXY,
    trustedProxyAddresses: CRM_TRUSTED_PROXY_IPS
});
const EXTERNAL_CACHE_TTL_MS = Math.max(60_000, Number(process.env.EXTERNAL_CACHE_TTL_MS) || 5 * 60_000);
const PUBLIC_FILES = new Set(['index.html', 'style.css', 'light-theme.css', 'app.js', 'alerts-engine.js']);

if (!ADMIN_PASSWORD_HASH) {
    console.warn('⚠️  CRM_ADMIN_PASSWORD_HASH não configurado: login administrativo por senha está indisponível.');
}
const WRITE_BODY_LIMIT = 10 * 1024 * 1024;

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1CWbwOq6tgkVFLTdHfU30Q50K7iXmhNoqnvRfTijkuEQ/export?format=csv';
const GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1YA-gpBhY3zDeooquzzY5Vl4HK-DirjzA';

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extraHeaders
    });
    res.end(JSON.stringify(payload));
}

function requireAdmin(req, res) {
    if (adminAuth.isAuthorized(req)) return true;
    sendJson(res, 401, {
        success: false,
        code: 'ADMIN_AUTH_REQUIRED',
        error: 'Esta ação administrativa exige autorização.'
    });
    return false;
}

function atomicWriteFileSync(targetPath, content, encoding = 'utf8') {
    const tempPath = `${targetPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, content, encoding);
    try {
        fs.renameSync(tempPath, targetPath);
    } catch (error) {
        // Windows não substitui sempre um arquivo existente via rename. O
        // fallback mantém o desenvolvimento local funcional; produção Linux
        // utiliza o rename atômico acima.
        fs.copyFileSync(tempPath, targetPath);
        fs.unlinkSync(tempPath);
    }
}

function loadAlertRules() {
    // As regras operacionais são código versionado. Não carregamos mais regras
    // editáveis da VPS, evitando divergência silenciosa entre ambientes.
    return alertsEngine.cloneDefaults();
}

function validateCalendarRecords(records) {
    if (!Array.isArray(records) || records.length < 40) {
        throw new Error('Calendário Industrial incompleto: são esperadas ao menos 40 semanas.');
    }
    const normalizeHeader = value => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const firstRow = records[0] || {};
    const keys = Object.keys(firstRow);
    const expectedHeaders = [
        ['semana', 0],
        ['datalimiteparasetor13', 1],
        ['quantidadediasaceitaveisparaficarpendentesetor01', 4]
    ];
    expectedHeaders.forEach(([expected, index]) => {
        if (normalizeHeader(keys[index]) !== expected) {
            throw new Error(`Calendário Industrial inválido: coluna ${index + 1} não corresponde ao formato esperado.`);
        }
    });
    const currentYear = new Date().getFullYear();
    const cycleYears = new Set();
    const weekNumbers = [];
    const seenWeeks = new Set();
    const contentRows = records.filter(row => Object.values(row).some(value => String(value || '').trim()));
    const validRows = contentRows.filter(row => {
        const values = Object.values(row);
        const week = String(values[0] || '').trim();
        const weekMatch = week.match(/^(\d{2})(\d{2})$/);
        if (!weekMatch || seenWeeks.has(week)) return false;
        const cycleYear = 2000 + Number(weekMatch[1]);
        const weekNumber = Number(weekMatch[2]);
        if (cycleYear < currentYear - 2 || cycleYear > currentYear + 2 || weekNumber < 1 || weekNumber > 53) return false;

        const deadline = alertsEngine.parseIndustrialDate(String(values[1] || '').trim(), week);
        const limitMatch = String(values[4] || '').trim().match(/^(\d{1,2})\s*(?:dias?)?$/i);
        const limit = limitMatch ? Number(limitMatch[1]) : NaN;
        if (!deadline || !Number.isInteger(limit) || limit < 0 || limit > 30) return false;

        seenWeeks.add(week);
        cycleYears.add(cycleYear);
        weekNumbers.push(weekNumber);
        return true;
    });
    const coversAnnualCycle = weekNumbers.length > 0 && Math.min(...weekNumbers) <= 2 && Math.max(...weekNumbers) >= 40;
    if (validRows.length < 40 || validRows.length !== contentRows.length || cycleYears.size !== 1 || !coversAnnualCycle) {
        throw new Error('Calendário Industrial inválido: semanas, datas ou limites estão ausentes.');
    }
    return validRows;
}

// O mesmo modelo comprovado do Studeoneda: imagens versionadas em /images e
// um mapa local disponível imediatamente, sem aguardar Google Drive ou rede.
function loadBundledImageIndex() {
    if (!fs.existsSync(STATIC_IMAGES_DIR)) {
        return { count: 0, map: {}, list: [] };
    }

    try {
        const filenameMap = fs.existsSync(STATIC_IMAGE_MAP_PATH)
            ? JSON.parse(fs.readFileSync(STATIC_IMAGE_MAP_PATH, 'utf8')) : {};
        const entriesByFilename = new Map();
        const map = {};

        // Todo arquivo versionado fica disponível pelo próprio nome, mesmo
        // quando ainda não possui um alias curado no image_map.json.
        fs.readdirSync(STATIC_IMAGES_DIR).forEach(rawFilename => {
            const filename = path.basename(String(rawFilename || ''));
            if (!filename || !/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename)) return;

            const fullPath = path.join(STATIC_IMAGES_DIR, filename);
            const encodedFilename = encodeURIComponent(filename);
            const base = path.basename(filename, path.extname(filename));
            const entry = {
                id: null,
                filename,
                base,
                isLocal: true,
                fullPath,
                thumbUrl: `/images/${encodedFilename}`,
                largeUrl: `/images/${encodedFilename}`,
                driveUrl: GOOGLE_DRIVE_FOLDER_URL
            };

            entriesByFilename.set(filename.toUpperCase(), entry);
            map[filename.toUpperCase()] = entry;
            map[base.toUpperCase()] = entry;
        });

        // Os aliases do Studeoneda são aplicados por último e têm prioridade
        // sobre a inferência automática pelo nome do arquivo.
        Object.entries(filenameMap).forEach(([key, rawFilename]) => {
            const filename = path.basename(String(rawFilename || ''));
            if (!filename || !/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename)) return;

            const fullPath = path.join(STATIC_IMAGES_DIR, filename);
            if (!fs.existsSync(fullPath)) return;

            const entry = entriesByFilename.get(filename.toUpperCase());
            if (!entry) return;

            map[String(key).toUpperCase()] = entry;
            map[filename.toUpperCase()] = entry;
        });

        const list = Array.from(entriesByFilename.values());
        return {
            count: list.length,
            timestamp: new Date().toISOString(),
            source: 'bundled-static-images',
            map,
            list
        };
    } catch (e) {
        console.warn('[IMG] Erro ao carregar mapa estático de imagens:', e.message);
        return { count: 0, map: {}, list: [] };
    }
}

let driveImagesCache = loadBundledImageIndex();
try {
    const saved = JSON.parse(fs.readFileSync(DRIVE_IMAGES_PATH, 'utf8'));
    if (saved.map && saved.list) {
        const mergedMap = { ...saved.map };
        Object.entries(driveImagesCache.map).forEach(([key, bundledEntry]) => {
            const remoteEntry = saved.map[key];
            mergedMap[key] = {
                ...remoteEntry,
                ...bundledEntry,
                id: remoteEntry?.id || null,
                driveUrl: remoteEntry?.driveUrl || bundledEntry.driveUrl
            };
        });
        driveImagesCache = { ...saved, map: mergedMap };
    }
} catch (_) { /* First boot: the local index is already available. */ }

let knownDriveImageIds = new Set();
function refreshKnownDriveImageIds() {
    knownDriveImageIds = new Set([
        ...(driveImagesCache.list || []),
        ...Object.values(driveImagesCache.map || {})
    ].map(entry => entry && entry.id).filter(Boolean));
}
function toPublicDriveImages(indexData) {
    const cleanEntry = entry => {
        if (!entry || typeof entry !== 'object') return entry;
        const { fullPath, ...publicEntry } = entry;
        return publicEntry;
    };
    return {
        ...indexData,
        map: Object.fromEntries(Object.entries(indexData.map || {}).map(([key, entry]) => [key, cleanEntry(entry)])),
        list: (indexData.list || []).map(cleanEntry)
    };
}
refreshKnownDriveImageIds();

// MIME types
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

// Simple & robust CSV Parser
function parseCSV(csvText) {
    if (!csvText) return [];
    
    // Remove BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.slice(1);
    }
    
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++; // skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentField.trim());
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentLine.push(currentField.trim());
            currentField = '';
            if (currentLine.some(f => f.length > 0)) {
                lines.push(currentLine);
            }
            currentLine = [];
        } else {
            currentField += char;
        }
    }
    
    if (currentField.length > 0 || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        if (currentLine.some(f => f.length > 0)) {
            lines.push(currentLine);
        }
    }
    
    if (lines.length < 2) return [];
    
    // Clean headers
    const rawHeaders = lines[0];
    const headers = rawHeaders.map(h => h.replace(/\uFFFD/g, '').trim());
    
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = row[j] !== undefined ? row[j] : '';
        }
        records.push(obj);
    }
    
    return records;
}

// Download live CSV from Google Sheets com suporte a múltiplos redirecionamentos (301, 302, 307)
function fetchGoogleSheetCSV(url = GOOGLE_SHEET_CSV_URL, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error('Muitos redirecionamentos ao baixar a planilha do Google Sheets.'));
        }

        const client = url.startsWith('http://') ? http : https;
        const req = client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const nextUrl = new URL(res.headers.location, url).toString();
                console.log(`[SYNC] Redirecionando (${res.statusCode}) para: ${nextUrl.slice(0, 80)}...`);
                return fetchGoogleSheetCSV(nextUrl, maxRedirects - 1).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`Erro HTTP ${res.statusCode} ao acessar o Google Sheets.`));
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (!data || data.trim().length < 500) {
                    return reject(new Error('Conteúdo CSV vazio ou muito curto retornado pelo Google Sheets.'));
                }
                resolve(data);
            });
        });

        req.on('error', (err) => {
            reject(new Error(`Erro de rede ao conectar no Google Sheets: ${err.message}`));
        });

        req.setTimeout(25000, () => {
            req.destroy();
            reject(new Error('Tempo limite (timeout de 25s) excedido ao baixar a planilha do Google Sheets.'));
        });
    });
}

const KNOWN_LOCAL_IMAGE_DIRS = [
    '//192.168.0.6/ti/Arquivos/Imagens/Produto',
    '//192.168.0.6/ti/Arquivos/Imagens',
    'T:/Arquivos/Imagens/Produto',
    'T:/Arquivos/Imagens',
    'G:/Meu Drive/APP Pendencias centralizadas',
    'G:/Meu Drive/ONEDA/APP ONEDA FICHA PRO/IMAGENS PARA o APP',
    'G:/Meu Drive/Fotos Oneda Price Pro',
    path.join(BASE_DIR, 'images'),
    path.join(BASE_DIR, '..', 'Studeoneda', 'images'),
    path.join(BASE_DIR, '..', 'oneda-ficha-pro', 'images'),
    path.join(BASE_DIR, '..', 'oneda-top-dashboard', 'images')
];

// In-memory local file path lookup
const localImageFilesMap = new Map();
// Diretório de Cache Local de Imagens para Carregamento Ultrarrápido (Zero Flicker)
const IMAGE_CACHE_DIR = path.join(__dirname, 'data', 'images_cache');
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    try { fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true }); } catch (e) {}
}
const localImageRamCache = new Map(); // upperFilename -> { buffer, contentType, etag, mtimeMs, size }
const MAX_RAM_CACHE_ENTRIES = 600;


// Scan local folders for images with newest mtime priority
async function scanLocalImageFolders() {
    localImageFilesMap.clear();
    let localCount = 0;
    for (const dir of KNOWN_LOCAL_IMAGE_DIRS) {
        try {
            const files = await fs.promises.readdir(dir);
            for (const f of files) {
                if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f)) {
                    const fullPath = path.join(dir, f);
                    const upper = f.toUpperCase();
                    if (!localImageFilesMap.has(upper)) {
                        localImageFilesMap.set(upper, fullPath);
                        localCount++;
                    } else {
                        try {
                            const existingPath = localImageFilesMap.get(upper);
                            const [curStat, existingStat] = await Promise.all([
                                fs.promises.stat(fullPath),
                                fs.promises.stat(existingPath)
                            ]);
                            if (curStat.mtimeMs > existingStat.mtimeMs) {
                                localImageFilesMap.set(upper, fullPath);
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {
            console.warn('[IMG] Aviso ao ler pasta local:', dir, e.message);
        }
    }
    return localCount;
}

// Download/index images from Google Drive folder + local folders (Hybrid Sync)
async function fetchGoogleDriveImages(folderUrl = GOOGLE_DRIVE_FOLDER_URL) {
    console.log('[DRIVE] Iniciando sincronização profunda de imagens (Local + Google Drive Cloud)...');
    
    // 1. Escanear diretórios locais / Google Drive Desktop / Compartilhamento de Rede
    await scanLocalImageFolders();
    const allFiles = new Map();

    for (const [upperFilename, fullPath] of localImageFilesMap.entries()) {
        const baseName = path.basename(fullPath).replace(/\.(?:jpg|jpeg|png|webp|gif|svg)$/i, '').trim();
        const origFilename = path.basename(fullPath);
        const relativeStaticPath = path.relative(STATIC_IMAGES_DIR, fullPath);
        const isBundledStatic = relativeStaticPath &&
            relativeStaticPath !== '..' &&
            !relativeStaticPath.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relativeStaticPath);
        let mtime = 0;
        try { mtime = Math.round((await fs.promises.stat(fullPath)).mtimeMs); } catch(e) {}
        const vParam = mtime ? `&v=${mtime}` : `&v=${Date.now()}`;
        const localAssetUrl = isBundledStatic
            ? `/images/${encodeURIComponent(origFilename)}`
            : `/api/image-file?file=${encodeURIComponent(origFilename)}${vParam}`;
        allFiles.set(upperFilename, {
            id: null,
            filename: origFilename,
            base: baseName,
            isLocal: true,
            fullPath: fullPath,
            thumbUrl: localAssetUrl,
            largeUrl: localAssetUrl,
            driveUrl: `https://drive.google.com/drive/folders/1YA-gpBhY3zDeooquzzY5Vl4HK-DirjzA`
        });
    }

    // 2. Escanear Google Drive Cloud (caso existam novos arquivos não sincronizados localmente)
    const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    const folderId = folderIdMatch ? folderIdMatch[1] : '1YA-gpBhY3zDeooquzzY5Vl4HK-DirjzA';
    const sortParams = ['', '?sort=13&direction=d', '?sort=13&direction=a', '?sort=7&direction=d', '?sort=7&direction=a'];

    for (const sp of sortParams) {
        const targetUrl = `https://drive.google.com/drive/folders/${folderId}${sp}`;
        try {
            const html = await new Promise((resolve, reject) => {
                https.get(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                }, (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        return https.get(res.headers.location, r2 => {
                            let d = '';
                            r2.on('data', c => d += c);
                            r2.on('end', () => resolve(d));
                        }).on('error', reject);
                    }
                    let d = '';
                    res.on('data', c => d += c);
                    res.on('end', () => resolve(d));
                }).on('error', reject);
            });

            const s36Match = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'([\s\S]*?)';/);
            if (s36Match) {
                const decoded = s36Match[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                try {
                    const parsed = JSON.parse(decoded);
                    if (Array.isArray(parsed[0])) {
                        parsed[0].forEach(item => {
                            if (Array.isArray(item) && typeof item[0] === 'string' && typeof item[2] === 'string') {
                                const fileId = item[0];
                                const filename = item[2];
                                const upper = filename.toUpperCase();
                                const baseName = filename.replace(/\.(?:jpg|jpeg|png|webp|gif|svg)$/i, '').trim();
                                if (!allFiles.has(upper)) {
                                    allFiles.set(upper, {
                                        id: fileId,
                                        filename: filename,
                                        base: baseName,
                                        isLocal: false,
                                        thumbUrl: `/api/proxy-image?id=${encodeURIComponent(fileId)}&sz=w600`,
                                        largeUrl: `/api/proxy-image?id=${encodeURIComponent(fileId)}&sz=w1200`,
                                        driveUrl: `https://drive.google.com/file/d/${fileId}/view`
                                    });
                                } else {
                                    // Adiciona ID do Drive ao item local se disponível
                                    const existing = allFiles.get(upper);
                                    if (!existing.id) existing.id = fileId;
                                    existing.driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
                                }
                            }
                        });
                    }
                } catch (e) {}
            }
        } catch (err) {
            console.warn(`[DRIVE] Aviso ao consultar ordenação ${sp}:`, err.message);
        }
    }

    const list = Array.from(allFiles.values());

    const index = {};
    list.forEach(entry => {
        const upper = entry.base.toUpperCase();
        const stripped = upper.replace(/[^A-Z0-9]/g, '');
        index[upper] = entry;
        index[stripped] = entry;
        index[entry.filename.toUpperCase()] = entry;

        // Variações estritas de sufixo no nome do arquivo (ex: 01.18.00.7861-1 -> 01.18.00.7861)
        const rootDash = upper.replace(/-\d+$/, '');
        if (rootDash && !index[rootDash]) {
            index[rootDash] = entry;
            index[rootDash.replace(/[^A-Z0-9]/g, '')] = entry;
        }

        const rootLetter = upper.replace(/[A-Z]$/, '');
        if (rootLetter && !index[rootLetter]) {
            index[rootLetter] = entry;
            index[rootLetter.replace(/[^A-Z0-9]/g, '')] = entry;
        }
    });

    // Descobertas de rede/Drive complementam o mapa versionado, mas nunca
    // substituem aliases curados nem as imagens estáticas comprovadas.
    const bundledIndex = loadBundledImageIndex();
    const mergedMap = { ...index };
    Object.entries(bundledIndex.map).forEach(([key, bundledEntry]) => {
        const remoteEntry = index[key];
        mergedMap[key] = {
            ...remoteEntry,
            ...bundledEntry,
            id: remoteEntry?.id || null,
            driveUrl: remoteEntry?.driveUrl || bundledEntry.driveUrl
        };
    });
    const mergedListByFilename = new Map();
    [...list, ...bundledIndex.list].forEach(entry => {
        mergedListByFilename.set(String(entry.filename || '').toUpperCase(), entry);
    });
    const mergedList = Array.from(mergedListByFilename.values());

    const result = {
        count: mergedList.length,
        timestamp: new Date().toISOString(),
        source: 'bundled-static-images+drive',
        map: mergedMap,
        list: mergedList
    };

    driveImagesCache = result;
    refreshKnownDriveImageIds();
    try {
        fs.writeFileSync(DRIVE_IMAGES_PATH, JSON.stringify(result, null, 2), 'utf8');
    } catch (e) {
        console.warn('[DRIVE] Aviso ao salvar drive_images.json:', e.message);
    }

    console.log(`[DRIVE] Sincronização profunda concluída: ${mergedList.length} fotos indexadas com sucesso!`);
    return result;
}

// Proxy para thumbnails do Google Drive (evita bloqueios ou restrições de terceiros)
const proxyGoogleDriveImage = createDriveImageProxy(path.join(DATA_DIR, 'drive_thumbnail_cache'));

// Servir imagem local com alta performance e cabeçalhos de cache
// Servir imagem local com alta performance, cache em memória RAM, cache em SSD local e cabeçalhos HTTP 304/ETag
function serveLocalImageFile(filename, req, res) {
    if (!filename) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Nome de arquivo não informado');
        return;
    }

    const cleanFilename = path.basename(filename);
    const upper = cleanFilename.toUpperCase();

    // Original files win over old disk copies. Validate RAM against the file,
    // so replacing a photo is visible without restarting the process.
    const localCachedPath = path.join(IMAGE_CACHE_DIR, cleanFilename);
    const candidates = [path.join(STATIC_IMAGES_DIR, cleanFilename),
        localImageFilesMap.get(upper),
        ...KNOWN_LOCAL_IMAGE_DIRS.map(dir => path.join(dir, cleanFilename)), localCachedPath];
    const targetPath = candidates.find(candidate => candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!targetPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Imagem não encontrada localmente');
        return;
    }
    const currentStat = fs.statSync(targetPath);
    const previous = localImageRamCache.get(upper);
    if (previous && (previous.path !== targetPath || previous.mtimeMs !== Math.round(currentStat.mtimeMs) || previous.size !== currentStat.size)) {
        localImageRamCache.delete(upper);
    }
    const fromLocalCache = targetPath === localCachedPath;

    // 1. Checagem no Cache em Memória RAM (0.1ms)
    const ramEntry = localImageRamCache.get(upper);
    if (ramEntry) {
        // Validação de ETag / If-None-Match para 304 Not Modified
        const ifNoneMatch = req.headers['if-none-match'];
        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifNoneMatch && ifNoneMatch === ramEntry.etag) {
            res.writeHead(304, {
                'ETag': ramEntry.etag,
                'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*'
            });
            res.end();
            return;
        }

        res.writeHead(200, {
            'Content-Type': ramEntry.contentType,
            'Content-Length': ramEntry.size,
            'ETag': ramEntry.etag,
            'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
            'Last-Modified': new Date(ramEntry.mtimeMs).toUTCString(),
            'Access-Control-Allow-Origin': '*'
        });
        res.end(ramEntry.buffer);
        return;
    }

    try {
        const stat = fs.statSync(targetPath);
        const mtimeMs = Math.round(stat.mtimeMs);
        const size = stat.size;
        const etag = `W/"${mtimeMs.toString(36)}-${size.toString(36)}"`;
        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'image/jpeg';

        // Checar ETag antes de ler o arquivo
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch === etag) {
            res.writeHead(304, {
                'ETag': etag,
                'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*'
            });
            res.end();
            return;
        }

        const buffer = fs.readFileSync(targetPath);

        // Se veio da rede, salva assincronamente no cache local para requisições futuras ultrarrápidas
        if (!fromLocalCache) {
            fs.writeFile(localCachedPath, buffer, () => {});
        }

        // Salva na memória RAM (com limite de tamanho para evitar consumo excessivo)
        if (size < 4 * 1024 * 1024) { // Menor que 4MB
            if (localImageRamCache.size >= MAX_RAM_CACHE_ENTRIES) {
                const firstKey = localImageRamCache.keys().next().value;
                localImageRamCache.delete(firstKey);
            }
            localImageRamCache.set(upper, { buffer, contentType, etag, mtimeMs, size, path: targetPath });
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': size,
            'ETag': etag,
            'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
            'Last-Modified': new Date(mtimeMs).toUTCString(),
            'Access-Control-Allow-Origin': '*'
        });
        res.end(buffer);
    } catch (err) {
        console.warn('[IMG] Erro ao servir imagem:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erro ao ler imagem');
    }
}
async function requestHandler(req, res) {
    applySecurityHeaders(res);
    const origin = req.headers.origin;
    if (origin && sameOriginRequest(req)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CRM-Admin-Token');
    
    if (req.method === 'OPTIONS') {
        if (origin && !sameOriginRequest(req)) {
            res.writeHead(403);
            res.end();
            return;
        }
        res.writeHead(204);
        res.end();
        return;
    }
    
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/health') {
        sendJson(res, 200, { ok: true, service: 'oneda-crm', timestamp: new Date().toISOString() });
        return;
    }

    if (pathname === '/api/admin/session') {
        if (req.method !== 'GET') {
            res.writeHead(405, { Allow: 'GET' });
            res.end();
            return;
        }
        sendJson(res, 200, { success: true, ...adminAuth.status(req) });
        return;
    }

    if (pathname === '/api/admin/login') {
        if (req.method !== 'POST') {
            res.writeHead(405, { Allow: 'POST' });
            res.end();
            return;
        }
        if (!sameOriginRequest(req)) {
            sendJson(res, 403, { success: false, error: 'Origem da solicitação não autorizada.' });
            return;
        }
        try {
            const body = JSON.parse(await readRequestBody(req, 16 * 1024) || '{}');
            const result = adminAuth.login(req, body.password);
            if (!result.ok) {
                const headers = result.retryAfterSeconds ? { 'Retry-After': String(result.retryAfterSeconds) } : {};
                sendJson(res, result.statusCode, {
                    success: false,
                    error: result.statusCode === 429
                        ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
                        : 'Senha administrativa inválida.'
                }, headers);
                return;
            }
            sendJson(res, 200, {
                success: true,
                authenticated: true,
                expiresAt: new Date(result.expiresAt).toISOString()
            }, { 'Set-Cookie': result.cookie });
        } catch (error) {
            sendJson(res, error.statusCode || 400, { success: false, error: 'Solicitação de login inválida.' });
        }
        return;
    }

    if (pathname === '/api/admin/logout') {
        if (req.method !== 'POST') {
            res.writeHead(405, { Allow: 'POST' });
            res.end();
            return;
        }
        if (!sameOriginRequest(req)) {
            sendJson(res, 403, { success: false, error: 'Origem da solicitação não autorizada.' });
            return;
        }
        sendJson(res, 200, { success: true, authenticated: false }, { 'Set-Cookie': adminAuth.logout(req) });
        return;
    }

    if (pathname === '/api/alert-rules') {
        if (req.method === 'GET') {
            sendJson(res, 200, { success: true, data: loadAlertRules() });
            return;
        }
        sendJson(res, 405, {
            success: false,
            error: 'As regras de alerta são versionadas no código e não podem ser alteradas pelo aplicativo.'
        }, { Allow: 'GET' });
        return;
    }
    
    // API: Obter Dados do CRM
    if (pathname === '/api/data') {
        const source = parsedUrl.searchParams.get('source') || 'full'; // 'full' ou 'raw'
        const targetPath = source === 'raw' ? CURRENT_DATA_PATH : FULL_DATA_PATH;
        
        try {
            if (!fs.existsSync(targetPath)) {
                // Fallback se não existir
                const altPath = fs.existsSync(FULL_DATA_PATH) ? FULL_DATA_PATH : CURRENT_DATA_PATH;
                if (!fs.existsSync(altPath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Arquivo de dados não encontrado.' }));
                    return;
                }
            }
            
            const fileToRead = fs.existsSync(targetPath) ? targetPath : CURRENT_DATA_PATH;
            const content = fs.readFileSync(fileToRead, 'utf8');
            const records = parseCSV(content);
            const stat = fs.statSync(fileToRead);
            
            sendJson(res, 200, {
                success: true,
                count: records.length,
                source: path.basename(fileToRead),
                lastModified: stat.mtime.toISOString(),
                data: records
            });
        } catch (err) {
            console.error('Erro ao ler dados:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }
    
    // API: Obter Mapeamento de Imagens do Google Drive
    if (pathname === '/api/drive-images') {
        const force = parsedUrl.searchParams.get('refresh') === '1';
        if (force && req.method !== 'POST') {
            res.writeHead(405, { Allow: 'GET, POST' });
            res.end();
            return;
        }
        if (force && !requireAdmin(req, res)) return;
        if (force || !driveImagesCache || driveImagesCache.count === 0) {
            fetchGoogleDriveImages().then(indexData => {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, count: indexData.count, data: toPublicDriveImages(indexData) }));
            }).catch(err => {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: err.message, data: toPublicDriveImages(driveImagesCache) }));
            });
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            success: true,
            count: driveImagesCache.count,
            timestamp: driveImagesCache.timestamp,
            data: toPublicDriveImages(driveImagesCache)
        }));
        return;
    }

    // API: Proxy para imagens individuais do Drive
    if (pathname === '/api/proxy-image') {
        const fileId = parsedUrl.searchParams.get('id');
        const size = parsedUrl.searchParams.get('sz') || 'w600';
        if (!fileId) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing file id');
            return;
        }
        if (!knownDriveImageIds.has(fileId)) {
            res.writeHead(404, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Imagem não encontrada no índice');
            return;
        }
        proxyGoogleDriveImage(fileId, res, size, req);
        return;
    }

    // API: Servir Imagem Local do Computador / Google Drive Desktop
    if (pathname === '/api/image-file' || pathname.startsWith('/images/')) {
        let filename = parsedUrl.searchParams.get('file');
        if (!filename && pathname.startsWith('/images/')) {
            try {
                filename = decodeURIComponent(pathname.replace(/^\/images\//, ''));
            } catch (_) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end('400 - URL de imagem inválida');
                return;
            }
        }
        serveLocalImageFile(filename, req, res);
        return;
    }

    // API: Obter Dados de Planilhas Externas (Cores e Aviamentos do Drive)
    if (pathname === '/api/external-sheet') {
        const type = (parsedUrl.searchParams.get('type') || 'aviamentos').toLowerCase();
        const force = parsedUrl.searchParams.get('refresh') === '1' && req.method === 'POST';
        if (!['GET', 'POST'].includes(req.method)) {
            res.writeHead(405, { Allow: 'GET, POST' });
            res.end();
            return;
        }
        if (req.method === 'POST' && !requireAdmin(req, res)) return;
        
        const configs = {
            cores: {
                name: 'Cores Pendentes',
                id: '1j7k8WWvE9m4YZrw7qadANIcx_XtOzAlwYfWnm0AC5sA',
                gid: '722944309',
                url: 'https://docs.google.com/spreadsheets/d/1j7k8WWvE9m4YZrw7qadANIcx_XtOzAlwYfWnm0AC5sA/export?format=csv&gid=722944309',
                cacheFile: path.join(DATA_DIR, 'cores_external.json'),
                targetColIndex: 1 // Coluna B (Responsável)
            },
            aviamentos: {
                name: 'Aviamentos Pendentes',
                id: '1aAsiicOY0vu5MgQjeeBCsqcAZwGn3JQmj8drYrVaZtc',
                gid: '0',
                url: 'https://docs.google.com/spreadsheets/d/1aAsiicOY0vu5MgQjeeBCsqcAZwGn3JQmj8drYrVaZtc/export?format=csv&gid=0',
                cacheFile: path.join(DATA_DIR, 'aviamentos_external.json'),
                targetColIndex: 2 // Coluna C (Responsável)
            },
            cq: {
                name: 'Andamento do CQ',
                id: '10VlV3p7FRn36dnsLM45wUkkiLGUVRkBTdMFGE5dkgX4',
                gid: '0',
                url: 'https://docs.google.com/spreadsheets/d/10VlV3p7FRn36dnsLM45wUkkiLGUVRkBTdMFGE5dkgX4/export?format=csv&gid=0',
                cacheFile: path.join(DATA_DIR, 'andamento_cq_external.json'),
                targetColIndex: 8 // Coluna I (Situação de Amostra)
            },
            
            aproveitamento: {
                name: 'Aproveitamento de Amostras (760)',
                id: '1gUzTqx6VOuRMBiMlAvyqsyRzVtOy5SaI7ORCeaUG36k',
                gid: '0',
                url: 'https://docs.google.com/spreadsheets/d/1gUzTqx6VOuRMBiMlAvyqsyRzVtOy5SaI7ORCeaUG36k/gviz/tq?tqx=out:csv&sheet=Aproveitamento+Amostras+(760)',
                cacheFile: path.join(DATA_DIR, 'aproveitamento_external.json'),
                targetColIndex: 0
            },
            leadtime: {
                name: 'Leadtime Produtivo',
                id: '14eFcBm3glH1H04dG7UKoLvIXf0QithHrNXnscGxyvdw',
                gid: '0',
                url: 'https://docs.google.com/spreadsheets/d/14eFcBm3glH1H04dG7UKoLvIXf0QithHrNXnscGxyvdw/export?format=csv&gid=0',
                cacheFile: path.join(DATA_DIR, 'leadtime_external.json'),
                targetColIndex: 20 // Coluna U (DT_FINAL)
            },
            rotativos: {
                name: 'Rotativos - Mesas Pendentes',
                id: '1uQGFBQjMI4Gnyq8eIMxRqFArmr00bEazGQVrHRD9vlY',
                gid: '0',
                url: 'https://docs.google.com/spreadsheets/d/1uQGFBQjMI4Gnyq8eIMxRqFArmr00bEazGQVrHRD9vlY/export?format=csv&gid=0',
                cacheFile: path.join(DATA_DIR, 'rotativos_external.json'),
                targetColIndex: 0 // Coluna A (Produto)
            },
            calendar: {
                name: 'Calendário Industrial',
                id: '1T9u4hGeKPPJyKix62u--mudStz3R22RlIrDkqk0ViBg',
                gid: '0',
                url: 'https://docs.google.com/spreadsheets/d/1T9u4hGeKPPJyKix62u--mudStz3R22RlIrDkqk0ViBg/export?format=csv&gid=0',
                cacheFile: path.join(DATA_DIR, 'calendar_external.json'),
                targetColIndex: 4 // Coluna E (limite de dias do Setor 01)
            }
        };

        const cfg = configs[type] || configs.leadtime;

        // Função de busca com cache inteligente
        (async () => {
            let cachedData = null;
            if (fs.existsSync(cfg.cacheFile)) {
                try {
                    cachedData = JSON.parse(fs.readFileSync(cfg.cacheFile, 'utf8'));
                    if (type === 'calendar') {
                        const validCachedRows = validateCalendarRecords(cachedData?.records);
                        cachedData = { ...cachedData, count: validCachedRows.length, records: validCachedRows };
                    }
                } catch (e) {
                    if (type === 'calendar') console.warn(`[CALENDÁRIO] Cache ignorado: ${e.message}`);
                    cachedData = null;
                }
            }

            const cachedAt = cachedData && Date.parse(cachedData.timestamp || '');
            if (!force && cachedData && Number.isFinite(cachedAt) && Date.now() - cachedAt < EXTERNAL_CACHE_TTL_MS) {
                sendJson(res, 200, { ...cachedData, cacheAgeMs: Date.now() - cachedAt });
                return;
            }

            try {
                // Tenta baixar da nuvem Google Sheets
                const csvText = await fetchGoogleSheetCSV(cfg.url);
                const records = parseCSV(csvText);

                if (type === 'calendar') {
                    const calendarRows = validateCalendarRecords(records);
                    const payload = {
                        success: true,
                        type: 'calendar',
                        title: cfg.name,
                        count: calendarRows.length,
                        records: calendarRows,
                        timestamp: new Date().toISOString(),
                        isLive: true
                    };

                    atomicWriteFileSync(cfg.cacheFile, JSON.stringify(payload, null, 2), 'utf8');
                    sendJson(res, 200, payload);
                    return;
                }

                if (type === 'rotativos') {
                    let totalPendentes = 0;
                    let faltaReceber = 0;
                    let recebidos = 0;
                    const rotRows = [];

                    records.forEach(r => {
                        const keys = Object.keys(r);
                        if (keys.length === 0) return;
                        const produto = (r[keys[0]] || r['PRODUTO'] || r['Produto'] || '').trim();
                        if (!produto || produto.toUpperCase() === 'PRODUTO') return;

                        const recebidoRaw = (r[keys[8]] || r['RECEBIDO'] || r['Recebido'] || '').trim();
                        const isRecebido = recebidoRaw.length > 2 && !recebidoRaw.match(/^[\.\s\-_]+$/);

                        const row = {
                            produto: produto,
                            arquivoAprov: (r[keys[1]] || r['ARQUIVO APROV'] || '').trim(),
                            fid: (r[keys[2]] || r['FID'] || '').trim(),
                            prevEntCilindro: (r[keys[3]] || r['PREV. ENT. CILINDRO'] || '').trim(),
                            solicitacao: (r[keys[4]] || r['SOLICITAÇÃO'] || '').trim(),
                            mesaEnviada: (r[keys[5]] || r['MESA ENVIADA'] || '').trim(),
                            prevMesa: (r[keys[6]] || r['PREV. MESA'] || '').trim(),
                            dias: (r[keys[7]] || r['DIAS'] || '').trim(),
                            recebido: recebidoRaw,
                            envCliente: (r[keys[9]] || r['ENV. CLIENTE'] || '').trim(),
                            obs: (r[keys[10]] || r['OBS'] || '').trim(),
                            isRecebido: isRecebido,
                            statusRecebimento: isRecebido ? 'Já Recebido' : 'Falta Receber'
                        };

                        rotRows.push(row);
                        totalPendentes++;
                        if (isRecebido) recebidos++;
                        else faltaReceber++;
                    });

                    const payload = {
                        success: true,
                        type: 'rotativos',
                        title: cfg.name,
                        count: totalPendentes,
                        faltaReceberCount: faltaReceber,
                        recebidosCount: recebidos,
                        byStatus: {
                            'Falta Receber': faltaReceber,
                            'Já Recebido': recebidos
                        },
                        records: rotRows,
                        timestamp: new Date().toISOString(),
                        isLive: true
                    };

                    atomicWriteFileSync(cfg.cacheFile, JSON.stringify(payload, null, 2), 'utf8');
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify(payload));
                    return;
                }

                // Agrupamento por Responsável
                const respMap = {};
                let validCount = 0;
                const rows = [];

                records.forEach(r => {
                    const keys = Object.keys(r);
                    if (keys.length === 0) return;
                    
                    // Coluna específica (B para Cores, C para Aviamentos)
                    const targetColKey = keys[cfg.targetColIndex] || keys[1] || 'RESPONSÁVEL';
                    const respRaw = (r[targetColKey] || r['RESPONSÁVEL'] || r['Responsável'] || '').trim();
                    const resp = respRaw || 'NÃO INFORMADO';

                    // Regra Atualizada (Setor D01 - Cores): Contar baseado na Coluna F (PANTONE)
                    // Ignorar se o Pantone estiver vazio ou for apenas um tra�o.
                    if (type === 'cores') {
                        const pantoneKey = keys.find(k => k.toUpperCase().includes('PANTONE')) || keys[5];
                        const pantone = (r[pantoneKey] || '').trim();
                        if (!pantone || pantone === '-' || pantone === '�') return;
                    } else {
                        // Para aviamentos e outros, checa se a linha possui algum conte�do
                        const hasContent = Object.values(r).some(v => v && String(v).trim().length > 0);
                        if (!hasContent) return;
                    }

                    validCount++;
                    respMap[resp] = (respMap[resp] || 0) + 1;
                    rows.push(r);
                });

                const payload = {
                    success: true,
                    type,
                    title: cfg.name,
                    count: validCount,
                    byResponsavel: respMap,
                    records: rows,
                    timestamp: new Date().toISOString(),
                    isLive: true
                };

                atomicWriteFileSync(cfg.cacheFile, JSON.stringify(payload, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(payload));
            } catch (err) {
                console.warn(`[EXTERNAL SHEET] Aviso ao buscar ${type} da nuvem (${err.message}). Utilizando cache.`);
                if (cachedData) {
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        ...cachedData,
                        isLive: false,
                        warning: `Usando cache local (${err.message})`
                    }));
                } else {
                    // Nunca inventar indicadores operacionais. Sem cache válido,
                    // a interface recebe indisponibilidade explícita.
                    const fallbackPayload = {
                        success: false,
                        type,
                        title: cfg.name,
                        count: 0,
                        byResponsavel: {},
                        records: [],
                        timestamp: null,
                        isLive: false,
                        error: `Fonte indisponível e nenhum cache válido encontrado (${err.message})`
                    };

                    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify(fallbackPayload));
                }
            }
        })();
        return;
    }

    // API: Importar dados CSV / TSV colados diretamente para planilhas externas
    if (pathname === '/api/external-sheet/import' && req.method === 'POST') {
        if (!requireAdmin(req, res)) return;
        try {
                const body = await readRequestBody(req, WRITE_BODY_LIMIT);
                const parsed = JSON.parse(body || '{}');
                const type = parsed.type || 'cq';
                const rawData = parsed.csvText || '';
                
                const cacheMap = {
                    cores: path.join(DATA_DIR, 'cores_external.json'),
                    aviamentos: path.join(DATA_DIR, 'aviamentos_external.json'),
                    cq: path.join(DATA_DIR, 'andamento_cq_external.json'),
                    leadtime: path.join(DATA_DIR, 'leadtime_external.json')
                };
                const cacheFile = cacheMap[type] || cacheMap.cq;

                let records = [];
                if (Array.isArray(parsed.records)) {
                    records = parsed.records;
                } else if (rawData.trim().length > 0) {
                    records = parseCSV(rawData);
                }

                const payload = {
                    success: true,
                    type,
                    title: type === 'cq' ? 'Andamento do CQ' : (type === 'leadtime' ? 'Leadtime Produtivo' : (type === 'cores' ? 'Cores Pendentes' : 'Aviamentos Pendentes')),
                    count: records.length,
                    records,
                    timestamp: new Date().toISOString(),
                    isLive: true,
                    isImported: true
                };

                atomicWriteFileSync(cacheFile, JSON.stringify(payload, null, 2), 'utf8');

                sendJson(res, 200, payload);
        } catch (err) {
            sendJson(res, err.statusCode || 400, { success: false, error: err.message });
        }
        return;
    }

    // API: Sincronização ao vivo com o Google Sheets & Google Drive
    if (pathname === '/api/sync') {
        if (req.method !== 'POST') {
            res.writeHead(405, { Allow: 'POST' });
            res.end();
            return;
        }
        if (!requireAdmin(req, res)) return;
        try {
            console.log('[SYNC] Sincronizando diretamente com o Google Sheets e Google Drive...');
            const liveCSV = await fetchGoogleSheetCSV();
            
            // Salva no current_data.csv e no full_dataset.csv
            atomicWriteFileSync(CURRENT_DATA_PATH, liveCSV, 'utf8');
            atomicWriteFileSync(FULL_DATA_PATH, liveCSV, 'utf8');
            
            // Salva também no data.js (para modo offline/standalone)
            const originalRecords = parseCSV(liveCSV);
            const dataJsContent = `// Gerado automaticamente pelo sync do CRM\nwindow.CRM_EMBEDDED_DATA = ${JSON.stringify(originalRecords)};\n`;
            atomicWriteFileSync(path.join(BASE_DIR, 'data.js'), dataJsContent, 'utf8');

            // Sincroniza também as imagens da pasta do Drive em segundo plano
            fetchGoogleDriveImages().catch(e => console.warn('[SYNC DRIVE IMG ERROR]', e.message));
            
            console.log(`[SYNC] Sincronização concluída com sucesso! ${originalRecords.length} registros atualizados.`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true,
                message: 'Planilha e Imagens sincronizadas com sucesso diretamente da nuvem!',
                count: originalRecords.length,
                imagesCount: driveImagesCache.count,
                timestamp: new Date().toISOString()
            }));
        } catch (err) {
            console.error('[SYNC] Erro ao sincronizar com o Google Sheets:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }
    
    // API: Upload de CSV Local
    if (pathname === '/api/upload' && req.method === 'POST') {
        if (!requireAdmin(req, res)) return;
        try {
            const body = await readRequestBody(req, WRITE_BODY_LIMIT);
            if (!body || body.trim().length === 0) {
                sendJson(res, 400, { success: false, error: 'Conteúdo CSV vazio.' });
                return;
            }

            atomicWriteFileSync(CURRENT_DATA_PATH, body, 'utf8');
            const records = parseCSV(body);

            sendJson(res, 200, {
                success: true,
                count: records.length,
                message: 'Planilha enviada e carregada com sucesso!'
            });
        } catch (err) {
            sendJson(res, err.statusCode || 500, { success: false, error: err.message });
        }
        return;
    }
    
    // Servir Arquivos Estáticos do Frontend
    let publicName;
    try {
        publicName = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    } catch (_) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('400 - URL inválida');
        return;
    }
    if (!PUBLIC_FILES.has(publicName)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('404 - Não Encontrado');
        return;
    }
    const filePath = path.join(BASE_DIR, publicName);
    
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 - Não Encontrado');
            return;
        }
        
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        res.setHeader('Cache-Control', ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600');
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
}

function startServers() {
    const server1 = http.createServer(requestHandler);
    server1.listen(PORT, '0.0.0.0', () => {
        console.log(`\n======================================================`);
        console.log(`🚀 ONEDA CRM rodando na porta ${PORT}`);
        console.log(`👉 Link Principal: http://localhost:${PORT}`);
        console.log(`👉 Link Direto IP:  http://127.0.0.1:${PORT}`);
        console.log(`======================================================\n`);

        // Sincronizar imagens do Drive em segundo plano na inicialização
        fetchGoogleDriveImages().catch(e => console.warn('[DRIVE] Aviso no sync inicial:', e.message));
    });

    // Iniciar servidor secundário na porta 8080
    try {
        const server2 = http.createServer(requestHandler);
        server2.listen(ALT_PORT, '0.0.0.0', () => {
            console.log(`🚀 Porta alternativa ${ALT_PORT} pronta: http://localhost:${ALT_PORT}`);
        });
        server2.on('error', (err) => {
            console.warn(`[AVISO] Porta ${ALT_PORT} indisponível, usando apenas ${PORT}:`, err.message);
        });
        return { server1, server2 };
    } catch (e) {
        console.warn(`[AVISO] Não foi possível iniciar na porta alternativa:`, e.message);
        return { server1, server2: null };
    }
}

if (require.main === module) startServers();

module.exports = { requestHandler, startServers, validateCalendarRecords };
