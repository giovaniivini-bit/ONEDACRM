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
    const PARTS = Object.freeze([
        Object.freeze({ code: 'F6', sectors: Object.freeze(['17x', 'D9x', 'B8x', 'D11', 'B9x', 'E7x', 'E8x', 'E9x', 'E5x']) }),
        Object.freeze({ code: 'F7', sectors: Object.freeze(['EN', 'IS', '17', 'D9', 'B8', 'D10', 'B9', 'E7', 'E8', 'E9', 'E5']) })
    ]);
    function sectorKey(part, sector) { return `${part}:${sector}`; }
    function toggleSector(selected, key) {
        const valid = PARTS.some(part => part.sectors.some(sector => sectorKey(part.code, sector) === key));
        if (!valid) return [...selected];
        return selected.includes(key) ? selected.filter(value => value !== key) : [...selected, key];
    }
    // Internal display contract, not a parser for the future spreadsheet.
    // Keep the full product code and part+sector identity; do not consolidate rows yet.
    function groups(items = [], { part = 'all', sectors = [], search = '' } = {}) {
        const term = String(search).trim().toLocaleLowerCase('pt-BR');
        return PARTS.filter(entry => part === 'all' || entry.code === part).flatMap(entry => entry.sectors
            .filter(sector => !sectors.length || sectors.includes(sectorKey(entry.code, sector)))
            .map(sector => ({ part: entry.code, sector, key: sectorKey(entry.code, sector),
                items: items.filter(item => item.part === entry.code && item.sector === sector &&
                    (!term || [item.codigo, item.numero].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term))))
            })));
    }
    return { SOURCE, PARTS, sectorKey, toggleSector, groups };
});
