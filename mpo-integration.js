const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const MPO_ORIGIN = 'http://127.0.0.1:8085';
const PUBLIC_ORIGIN = 'https://mpo.136-248-111-213.sslip.io';

function readMpo(route) {
    return new Promise((resolve, reject) => {
        const req = http.get(MPO_ORIGIN + route, res => {
            let body = '';
            let size = 0;
            res.setEncoding('utf8');
            res.on('data', chunk => {
                size += Buffer.byteLength(chunk);
                if (size > 8 * 1024 * 1024) req.destroy(new Error('Resposta MPO muito grande'));
                else body += chunk;
            });
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) throw new Error('MPO indisponível');
                    resolve(JSON.parse(body));
                } catch (error) { reject(error); }
            });
            res.on('error', reject);
        });
        const deadline = setTimeout(() => req.destroy(new Error('Tempo de consulta MPO excedido')), 15000);
        req.on('close', () => clearTimeout(deadline));
        req.on('error', reject);
    });
}

function publicImage(value) {
    if (typeof value !== 'string') return '';
    try {
        let decoded = value;
        for (let i = 0; i < 3 && decoded.includes('%'); i++) decoded = decodeURIComponent(decoded);
        if (/[\\\s?#%\x00-\x1f]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) return '';
        if (!/^\/(?:workspaces\/[A-Za-z0-9_-]+\/)?images\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif)$/i.test(decoded)) return '';
        return PUBLIC_ORIGIN + decoded;
    } catch { return ''; }
}

function validateSummaries(data) {
    if (!data || !data.workspaces || Array.isArray(data.workspaces) || typeof data.workspaces !== 'object') throw new Error('Resposta MPO inválida');
    const summaries = Object.entries(data.workspaces).map(([id, summary]) => {
        if (!summary || summary.workspace?.id !== id || !Array.isArray(summary.todas_pecas) || !summary.por_responsavel || typeof summary.por_responsavel !== 'object') throw new Error('Resumo MPO inválido');
        for (const item of summary.todas_pecas) {
            if (!item || typeof item.ref !== 'string' || !item.ref.trim() || item.id == null || typeof item.tem_pendencia !== 'boolean' || !Array.isArray(item.pendencias) || item.pendencias.some(p => typeof p !== 'string') || !item.previsoes || typeof item.previsoes !== 'object' || Array.isArray(item.previsoes)) throw new Error('Ficha MPO inválida');
        }
        for (const group of Object.values(summary.por_responsavel)) {
            if (!group || !Array.isArray(group.itens) || group.itens.some(item => !item || item.id == null || typeof item.ref !== 'string')) throw new Error('Grupo MPO inválido');
        }
        return summary;
    });
    if (!summaries.length) throw new Error('MPO não informou as fontes');
    return summaries;
}

function consolidate(summaries) {
    const items = new Map();
    const groups = Object.create(null);
    let rawCount = 0;
    for (const summary of summaries) {
        const ws = summary.workspace;
        const keys = new Map();
        for (const item of summary.todas_pecas) {
            rawCount++;
            // Identical copies collapse; different content for the same reference remains visible.
            const fingerprint = JSON.stringify([item.ref, item.cliente || '', item.folha ?? '', item.fase || '', item.data_entrega || '', item.tem_pendencia, [...item.pendencias].sort(), Object.entries(item.previsoes).sort(([a], [b]) => a.localeCompare(b)), item.obs_gerais || '']);
            const key = createHash('sha256').update(fingerprint).digest('hex');
            keys.set(JSON.stringify([String(item.id), item.ref]), key);
            const source = { id: ws.id, name: ws.nome !== ws.id ? ws.nome : '', updatedAt: ws.updated_at || '' };
            const image = publicImage(item.image_url);
            const sheet = publicImage(item.folha_url);
            const existing = items.get(key);
            if (existing) {
                existing.sources.push(source);
                if (image && !existing.image_urls.includes(image)) existing.image_urls.push(image);
                if (sheet && !existing.folha_urls.includes(sheet)) existing.folha_urls.push(sheet);
                existing.image_full_url ||= image;
                existing.folha_full_url ||= sheet;
            } else items.set(key, { ...item, key, sources: [source], image_urls: image ? [image] : [], folha_urls: sheet ? [sheet] : [], image_full_url: image, folha_full_url: sheet });
        }
        for (const [name, group] of Object.entries(summary.por_responsavel)) {
            groups[name] ||= { responsavel: group.responsavel, keys: new Set() };
            for (const item of group.itens) {
                const key = keys.get(JSON.stringify([String(item.id), item.ref]));
                if (!key) throw new Error('Grupo MPO referencia ficha ausente');
                groups[name].keys.add(key);
            }
        }
    }
    const cards = [...items.values()];
    const pending = cards.filter(item => item.tem_pendencia).length;
    return {
        workspace: { nome: 'Memória disponível do MPO', total_pecas: cards.length, total_com_pendencia: pending, total_sem_pendencia: cards.length - pending },
        todas_pecas: cards,
        por_responsavel: Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, { responsavel: group.responsavel, total_pecas: group.keys.size, itens: [...group.keys].map(key => ({ key })) }])),
        sourceCount: summaries.length,
        identicalCopies: rawCount - cards.length
    };
}

function createMpoService({ read = readMpo, snapshotPath = path.join(__dirname, 'data', 'mpo_snapshot.json') } = {}) {
    let last = null;
    let inflight = null;
    async function sync() {
        try {
            const summary = consolidate(validateSummaries(await read('/api/crm/all-summaries')));
            last = { summary, fetchedAt: new Date().toISOString() };
        } catch (error) {
            if (!last) {
                try {
                    const saved = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
                    if (saved.summary?.todas_pecas && saved.summary?.por_responsavel && saved.fetchedAt) last = saved;
                } catch { /* No previous successful snapshot. */ }
            }
            if (!last) throw error;
            return { ...last, stale: true, warning: 'MPO indisponível ou resposta incompleta. Exibindo a última sincronização bem-sucedida.' };
        }
        try {
            await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
            await fs.writeFile(snapshotPath + '.tmp', JSON.stringify(last), 'utf8');
            await fs.rename(snapshotPath + '.tmp', snapshotPath);
        } catch {
            return { ...last, stale: false, warning: 'Dados atualizados, mas não foi possível salvar a consulta para uso após reiniciar o CRM.' };
        }
        return { ...last, stale: false };
    }
    return () => {
        if (!inflight) inflight = sync().finally(() => { inflight = null; });
        return inflight;
    };
}
const getMpoData = createMpoService();
module.exports = { getMpoData, createMpoService, publicImage, consolidate, validateSummaries };
