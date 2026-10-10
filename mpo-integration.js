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
    if (!workspace) {
        const summaries = [];
        for (const program of programs) {
            const summary = await readMpo('/api/crm/summary?workspace=' + encodeURIComponent(program.id));
            if (summary.workspace?.id !== program.id) throw new Error('MPO retornou outra programação');
            summaries.push(summary);
        }
        return { programs, summary: consolidate(summaries), fetchedAt: new Date().toISOString() };
    }
    if (!programs.some(p => p.id === workspace)) { const error = new Error('Programação não disponível'); error.status = 404; throw error; }
    const summary = await readMpo('/api/crm/summary?workspace=' + encodeURIComponent(workspace));
    if (summary.workspace?.id !== workspace) throw new Error('MPO retornou outra programação');
    return { programs, summary: consolidate([summary]), fetchedAt: new Date().toISOString() };
}
function consolidate(summaries) {
    const items = [];
    const groups = {};
    for (const summary of summaries) {
        const ws = summary.workspace;
        const keys = new Map();
        for (const item of summary.todas_pecas || []) {
            const key = JSON.stringify([ws.id, String(item.id), item.ref]);
            keys.set(JSON.stringify([String(item.id), item.ref]), key);
            items.push({ ...item, key, program: ws.nome, programId: ws.id, image_full_url: publicImage(item.image_url), folha_full_url: publicImage(item.folha_url) });
        }
        for (const [name, group] of Object.entries(summary.por_responsavel || {})) {
            groups[name] ||= { responsavel: group.responsavel, itens: [] };
            for (const item of group.itens || []) {
                const key = keys.get(JSON.stringify([String(item.id), item.ref]));
                if (key) groups[name].itens.push({ key });
            }
            groups[name].total_pecas = groups[name].itens.length;
        }
    }
    const pending = items.filter(i => i.tem_pendencia).length;
    return { workspace: { nome: summaries.length === 1 ? summaries[0].workspace.nome : 'Todas as programações', total_pecas: items.length, total_com_pendencia: pending, total_sem_pendencia: items.length - pending }, todas_pecas: items, por_responsavel: groups };
}
module.exports = { getMpoData, validPrograms, publicImage, consolidate };
