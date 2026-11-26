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

    const PARTS = Object.freeze([
        Object.freeze({ code: 'F6', sectors: Object.freeze(['17x', '17', 'D9x', 'B8x', 'D11', 'B9x', 'E7x', 'E8x', 'E9x', 'E5x']) }),
        Object.freeze({ code: 'F7', sectors: Object.freeze(['EN', 'IS', '17', 'D9', 'B8', 'D10', 'B9', 'E7', 'E8', 'E9', 'E5']) })
    ]);
    const SOURCE_COLUMNS = { 1: 'NUMERO', 2: 'SETOR', 4: 'CODIGO', 5: 'DESCRICAO', 6: 'PARTE', 10: 'SIT_AMOSTRA', 12: 'OF_PEND_ALMOXARIFADO' };

    function parseMatrix(matrix) {
        const [header = [], ...rows] = matrix;
        if (!Object.entries(SOURCE_COLUMNS).every(([index, name]) => header[index] === name)) {
            throw new Error('Cabeçalhos da planilha Prog CQ inválidos. Confira as colunas B, C, E, F, G, K e M.');
        }

        const records = [];
        for (const row of rows) {
            const part = (row[6] || '').trim().toUpperCase();
            if (!PARTS.some(entry => entry.code === part)) continue;

            const sector = (row[2] || '').trim().toUpperCase().replace(/X$/, 'x');
            const codigo = (row[4] || '').trim();
            if (!sector || !codigo) throw new Error(`Linha da Parte ${part} sem setor ou código na planilha Prog CQ.`);

            records.push({ part, sector, codigo, numero: (row[1] || '').trim(), descricao: (row[5] || '').trim(),
                andamentoPedido: (row[10] || '').trim(), aviamentoPendente: Boolean((row[12] || '').trim()) });
        }
        return records;
    }

    function partsFor(items = []) {
        return PARTS.map(({ code, sectors }) => {
            const available = new Set(sectors);
            for (const item of items) {
                if (item.part === code) available.add(item.sector);
            }
            return { code, sectors: [...available] };
        });
    }

    function sectorKey(part, sector) { return `${part}:${sector}`; }
    function toggleSector(selected, key, items = []) {
        const valid = partsFor(items).some(part => part.sectors.some(sector => sectorKey(part.code, sector) === key));
        if (!valid) return [...selected];
        return selected.includes(key) ? selected.filter(value => value !== key) : [...selected, key];
    }
    function meshStatus(andamentoPedido) {
        const sectors = String(andamentoPedido || '').split(/\r?\n/).map(line =>
            line.replace(/^\s*\d+\s*-\s*\d+\s*-\s*\d*\s*-\s*/, '')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
        ).filter(sector => sector && !/^(?:[-—–]+|nao informado|sem informacao)$/.test(sector));
        if (!sectors.length) return 'unknown';

        const blocked = sectors.some(sector =>
            /\b(?:tecelagem|tinturaria)\b/.test(sector) &&
            !/\b(?:lab|laboratorio|deposito)\b/.test(sector)
        );
        return blocked ? 'missing' : 'available';
    }

    function filterAvailability(items, { mesh = 'all', trims = 'all' } = {}) {
        return items.filter(item =>
            (mesh === 'all' || meshStatus(item.andamentoPedido) === mesh) &&
            (trims === 'all' || (trims === 'missing' ? item.aviamentoPendente : item.aviamentoPendente === false))
        );
    }

    function groups(items = [], { part = 'all', sectors = [], search = '' } = {}) {
        const term = String(search).trim().toLocaleLowerCase('pt-BR');
        return partsFor(items).filter(entry => part === 'all' || entry.code === part).flatMap(entry => entry.sectors
            .filter(sector => !sectors.length || sectors.includes(sectorKey(entry.code, sector)))
            .map(sector => ({ part: entry.code, sector, key: sectorKey(entry.code, sector),
                items: items.filter(item => item.part === entry.code && item.sector === sector &&
                    (!term || [item.codigo, item.numero].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term))))
            })));
    }
    return { SOURCE, PARTS, parseMatrix, filterAvailability, partsFor, sectorKey, toggleSector, groups };
});
