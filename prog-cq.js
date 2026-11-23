(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMProgCQ = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    const SOURCE = Object.freeze({
        title: 'Prog CQ',
        spreadsheetId: '1QMegrgLwnsXnOyOrkUK_XELhL6Tji_WARdZXu3WSlKg',
        sheetName: 'Página1',
        gid: 0,
        url: 'https://docs.google.com/spreadsheets/d/1QMegrgLwnsXnOyOrkUK_XELhL6Tji_WARdZXu3WSlKg/edit#gid=0'
    });

    // This defines the display order only. Spreadsheet mapping is still pending.
    const FLOWS = Object.freeze([
        Object.freeze({ code: 'C32', sectors: Object.freeze(['17x', 'D9x', 'B8x', 'D11', 'B9x', 'E7x', 'E8x', 'E9x', 'E5x']) }),
        Object.freeze({ code: 'D32', sectors: Object.freeze(['EN', 'IS', '17', 'D9', 'B8', 'D10', 'B9', 'E7', 'E8', 'E9', 'E5']) })
    ]);
    function sectorKey(flow, sector) { return `${flow}:${sector}`; }
    function toggleSector(selected, key) {
        const valid = FLOWS.some(flow => flow.sectors.some(sector => sectorKey(flow.code, sector) === key));
        if (!valid) return [...selected];
        return selected.includes(key) ? selected.filter(value => value !== key) : [...selected, key];
    }
    // Internal display contract, not a parser for the future spreadsheet.
    // Keep the full product code and flow+sector identity; do not consolidate rows yet.
    function groups(items = [], { flow = 'all', sectors = [], search = '' } = {}) {
        const term = String(search).trim().toLocaleLowerCase('pt-BR');
        return FLOWS.filter(entry => flow === 'all' || entry.code === flow).flatMap(entry => entry.sectors
            .filter(sector => !sectors.length || sectors.includes(sectorKey(entry.code, sector)))
            .map(sector => ({ flow: entry.code, sector, key: sectorKey(entry.code, sector),
                items: items.filter(item => item.flow === entry.code && item.sector === sector &&
                    (!term || [item.codigo, item.numero].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term))))
            })));
    }
    return { SOURCE, FLOWS, sectorKey, toggleSector, groups };
});
