const https = require('https');

function parseEmbeddedFolder(html) {
    const entries = [];
    for (const block of String(html).split(/<div class="flip-entry"/).slice(1)) {
        const id = block.match(/id="entry-([\w-]+)"/)?.[1];
        const raw = block.match(/class="flip-entry-title">([^<]+)</)?.[1];
        const filename = raw?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        if (id && filename && /\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) entries.push({ id, filename });
    }
    return entries;
}

function fetchDriveHtml(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, res => {
            if (res.statusCode !== 200) { res.resume(); reject(new Error(`Drive: HTTP ${res.statusCode}`)); return; }
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; if (body.length > 20 * 1024 * 1024) req.destroy(new Error('Listagem do Drive excedeu o limite')); });
            res.on('error', reject);
            res.on('aborted', () => reject(new Error('Listagem interrompida')));
            res.on('end', () => resolve(body));
        });
        const deadline = setTimeout(() => req.destroy(new Error('Tempo limite ao listar fotos do Drive')), 15000);
        req.on('close', () => clearTimeout(deadline));
        req.on('error', reject);
    });
}

async function fetchEmbeddedFolder(folderId) {
    return parseEmbeddedFolder(await fetchDriveHtml(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`));
}
module.exports = { parseEmbeddedFolder, fetchEmbeddedFolder, fetchDriveHtml };
