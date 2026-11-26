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
        Object.freeze({ code: 'F6', sectors: Object.freeze(['EN', 'IS', '17', 'D9', 'B8', 'D10', 'B9', 'E7', 'E8', 'E9', 'E5']) }),
        Object.freeze({ code: 'F7', sectors: Object.freeze(['17x', 'D9x', 'B8x', 'D11', 'B9x', 'E7x', 'E8x', 'E9x', 'E5x']) })
    ]);
    const SOURCE_COLUMNS = { 1: 'NUMERO', 2: 'SETOR', 4: 'CODIGO', 5: 'DESCRICAO', 6: 'PARTE', 10: 'SIT_AMOSTRA', 11: 'OC', 12: 'OF_PEND_ALMOXARIFADO' };

    function parseMatrix(matrix) {
        const [header = [], ...rows] = matrix;
        if (!Object.entries(SOURCE_COLUMNS).every(([index, name]) => header[index] === name)) {
            throw new Error('Cabeçalhos da planilha Prog CQ inválidos. Confira as colunas B, C, E, F, G, K, L e M.');
        }

        const records = [];
        for (const row of rows) {
            const part = (row[6] || '').trim().toUpperCase();
            if (!PARTS.some(entry => entry.code === part)) continue;

            const sector = (row[2] || '').trim().toUpperCase().replace(/X$/, 'x');
            const codigo = (row[4] || '').trim();
            if (!sector || !codigo) throw new Error(`Linha da Parte ${part} sem setor ou código na planilha Prog CQ.`);

            const oc = (row[11] || '').trim();
            records.push({ part, sector, codigo, numero: (row[1] || '').trim(), descricao: (row[5] || '').trim(),
                andamentoPedido: (row[10] || '').trim(),
                purchaseOrder: !oc.startsWith('#') && /\d/.test(oc) ? oc : '',
                aviamentoPendente: Boolean((row[12] || '').trim()) });
        }
        return records;
    }

    const FEIRA_DAY_COLUMNS = { part: 4, numero: 5, codigo: 40, sector: 81, days: 105 };
    const FEIRA_DAY_HEADERS = ['PARTE', 'NUMERO', 'CODIGO', 'SETOR', 'DIAS PARADO'];

    function sanitizeFeiraDays(records = []) {
        const result = [];
        for (const row of records) {
            if (!row) continue;
            const { part, numero, codigo, sector, days } = row;
            if (PARTS.some(entry => entry.code === part) &&
                [numero, codigo, sector].every(value => typeof value === 'string' && value.trim()) &&
                Number.isSafeInteger(days) && days >= 0) {
                result.push({ part, numero, codigo, sector, days });
            }
        }
        return result;
    }

    function parseFeiraDays([header = [], ...rows]) {
        const columns = Object.values(FEIRA_DAY_COLUMNS);
        const headersAreValid = columns.every((column, index) =>
            header[column]?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === FEIRA_DAY_HEADERS[index]
        );
        if (!headersAreValid) return null;

        const { part, numero, codigo, sector, days } = FEIRA_DAY_COLUMNS;
        return sanitizeFeiraDays(rows.map(row => ({
            part: row[part]?.toUpperCase(), numero: row[numero], codigo: row[codigo], sector: row[sector],
            days: /^\d+(?:[.,]0+)?$/.test(row[days] || '') ? Number(row[days].replace(',', '.')) : null
        })));
    }

    function sectorDaysKey({ part, sector, numero, codigo }) {
        return JSON.stringify([
            part, sector?.trim().toUpperCase(), numero?.trim().replace(/^0+(?=\d+$)/, ''), codigo?.trim().toUpperCase()
        ]);
    }

    function indexSectorDays(records = []) {
        const index = new Map();
        for (const item of records) {
            const key = sectorDaysKey(item);
            if (!index.has(key)) index.set(key, item.days);
            else if (index.get(key) !== item.days) index.set(key, null);
        }
        return index;
    }

    function sectorKey(part, sector) { return `${part}:${sector}`; }
    function toggleSector(selected, key) {
        const valid = PARTS.some(part => part.sectors.some(sector => sectorKey(part.code, sector) === key));
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

    function filterAvailability(items, { mesh = 'all', trims = 'all', purchaseOrder = 'all' } = {}) {
        return items.filter(item =>
            (mesh === 'all' || meshStatus(item.andamentoPedido) === mesh) &&
            (trims === 'all' || (trims === 'missing' ? item.aviamentoPendente : item.aviamentoPendente === false)) &&
            (purchaseOrder === 'all' || (typeof item.purchaseOrder === 'string' &&
                (purchaseOrder === 'with' ? Boolean(item.purchaseOrder) : item.purchaseOrder === '')))
        );
    }

    function orderLines(andamentoPedido) {
        return String(andamentoPedido || '').split(/\r?\n/).map(line => ({
            line, week: line.match(/^\s*(\d{4})\s*(?:[-–—]|$)/)?.[1]
        }));
    }

    function firstOrderWeek(andamentoPedido) {
        return orderLines(andamentoPedido).find(order => order.week)?.week || '';
    }

    function availableWeeks(items) {
        const weeks = items.flatMap(item => orderLines(item.andamentoPedido).map(order => order.week).filter(Boolean));
        return [...new Set(weeks)].sort((a, b) => Number(a) - Number(b));
    }

    function orderProgressForWeeks(andamentoPedido, weeks) {
        if (!weeks.length) return andamentoPedido || '';
        return orderLines(andamentoPedido).filter(order => weeks.includes(order.week)).map(order => order.line).join('\n');
    }

    function groups(items = [], { part = 'all', sectors = [], search = '', weeks = [] } = {}) {
        const term = String(search).trim().toLocaleLowerCase('pt-BR');
        const matchingItems = weeks.length ? items.filter(item => orderProgressForWeeks(item.andamentoPedido, weeks)) : items;
        return PARTS.filter(entry => part === 'all' || entry.code === part).flatMap(entry => entry.sectors
            .filter(sector => !sectors.length || sectors.includes(sectorKey(entry.code, sector)))
            .map(sector => ({ part: entry.code, sector, key: sectorKey(entry.code, sector),
                items: matchingItems.filter(item => item.part === entry.code && item.sector === sector &&
                    (!term || [item.codigo, item.numero].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term))))
            })));
    }
    return { SOURCE, PARTS, parseMatrix, parseFeiraDays, sanitizeFeiraDays, sectorDaysKey, indexSectorDays, filterAvailability, firstOrderWeek, availableWeeks, orderProgressForWeeks, sectorKey, toggleSector, groups };
});
