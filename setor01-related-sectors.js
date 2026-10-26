(function initSetor01RelatedSectors(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMSetor01RelatedSectors = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSetor01RelatedSectors() {
    function normalize(value) {
        return String(value || '').trim().toUpperCase();
    }

    function buildMap(records) {
        const sectorsByOp = new Map();
        (records || []).forEach(record => {
            const op = normalize(record && record.op);
            const setor = normalize(record && record.setor);
            if (!op || !setor) return;
            if (!sectorsByOp.has(op)) sectorsByOp.set(op, new Set());
            sectorsByOp.get(op).add(setor);
        });
        return sectorsByOp;
    }

    function resolve(item, sectorsByOp) {
        const sectors = sectorsByOp.get(normalize(item && item.op)) || new Set();
        return {
            setoresAviamento: ['X01', 'X02'].filter(setor => sectors.has(setor)),
            setoresCor: ['D01', 'D02'].filter(setor => sectors.has(setor))
        };
    }

    function matchesPending(item, filter) {
        const cor = (item.setoresCor || []).includes('D01');
        const aviamento = (item.setoresAviamento || []).includes('X01');
        switch (filter) {
            case 'cor': return cor && !aviamento;
            case 'aviamento': return aviamento && !cor;
            case 'ambas': return cor && aviamento;
            case 'nenhuma': return !cor && !aviamento;
            default: return true;
        }
    }

    function styleStatusGroup(value) {
        const status = normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
        if (['PENDENTE DESENVOLVIMENTO', 'AGUAR. APROV. LIC./CONCEITO', 'AGUAR. APROV. LIC./PP SAMPLE', 'PEDIDO CANCELADO'].includes(status)) return 'pendentes';
        if (['PP SAMPL APROVADA', 'PP SAMPLE APROVADA', 'LIBERADO PARA PRODUCAO'].includes(status)) return 'liberados';
        return 'outros';
    }

    return { buildMap, resolve, matchesPending, styleStatusGroup };
}));
