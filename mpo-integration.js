const http = require('http');
const MPO_ORIGIN = 'http://127.0.0.1:8085';
const PUBLIC_ORIGIN = 'https://mpo.136-248-111-213.sslip.io';
function readMpo(route) {
    return new Promise((resolve, reject) => {
        const req = http.get(MPO_ORIGIN + route, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; if (body.length > 8 * 1024 * 1024) req.destroy(new Error('Resposta MPO muito grande')); });
            res.on('end', () => { try { if (res.statusCode !== 200) throw new Error('MPO indisponível'); resolve(JSON.parse(body)); } catch (error) { reject(error); } });
            res.on('error', reject);
        });
        req.setTimeout(15000, () => req.destroy(new Error('Tempo de consulta MPO excedido')));
        req.on('error', reject);
    });
}
function validPrograms(data) {
    return (data.workspaces || []).filter(w => /^B\d+$/i.test(String(w.nome || '').trim()))
        .map(w => ({ ...w, nome: w.nome.trim().toUpperCase() })).sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
}
function publicImage(value) {
    return typeof value === 'string' && /^\/workspaces\/[A-Za-z0-9_-]+\/images\//.test(value) && !value.includes('..') ? PUBLIC_ORIGIN + value : '';
}
async function getMpoData(workspace) {
    const programs = validPrograms(await readMpo('/api/crm/workspaces'));
    if (!workspace) return { programs };
    if (!programs.some(p => p.id === workspace)) { const error = new Error('Programação não disponível'); error.status = 404; throw error; }
    const summary = await readMpo('/api/crm/summary?workspace=' + encodeURIComponent(workspace));
    if (summary.workspace?.id !== workspace) throw new Error('MPO retornou outra programação');
    summary.todas_pecas = (summary.todas_pecas || []).map(item => ({ ...item, image_full_url: publicImage(item.image_url), folha_full_url: publicImage(item.folha_url) }));
    return { programs, summary, fetchedAt: new Date().toISOString() };
}
module.exports = { getMpoData, validPrograms, publicImage };
