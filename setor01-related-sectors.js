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

    return { buildMap, resolve };
}));
