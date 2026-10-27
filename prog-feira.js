(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMProgFeira = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const FLOW = [
        ['01A', 'Pré-cadastramento/Desenho'],
        ['01B', 'Estilo'],
        ['1B2', 'Aprovação cliente'],
        ['02A', 'Engenharia'],
        ['02E', 'Consumo'],
        ['02M', '02M'],
        ['02B', 'Corte amostras'],
        ['01C', 'Estilo/Desenho/Arte final'],
        ['01E', 'Estamparia de amostras'],
        ['1E2', 'Bordado de amostras'],
        ['02C', 'Costura de amostras'],
        ['01F', 'Peças prontas / Em viabilidade'],
        ['01Z', 'Peças canceladas']
    ].map(([code, label], index) => ({ code, label, order: index + 1 }));

    const FLOW_BY_CODE = new Map(FLOW.map(item => [item.code, item]));
    const TINGIMENTO = {
        M00: { label: 'Sem avaliação', color: '#111827' },
        M01: { label: 'Tingimento OK', color: '#2563eb' },
        M02: { label: 'Malha em tingimento', color: '#ef4444' },
        M03: { label: 'Malha tinta', color: '#facc15' }
    };

    function text(value) {
        return String(value == null ? '' : value).trim();
    }

    function field(record, name) {
        if (!record || typeof record !== 'object') return '';
        if (Object.prototype.hasOwnProperty.call(record, name)) return text(record[name]);
        const target = name.toUpperCase();
        const key = Object.keys(record).find(item => text(item).toUpperCase() === target);
        return key ? text(record[key]) : '';
    }

    function normalizeSector(value) {
        const raw = text(value).toUpperCase().replace(/\s+/g, '');
        if (/^1(?:[,.]0+)?E\+?0?2$/.test(raw) || raw === '100') return '1E2';
        return raw;
    }

    function getKey(record) {
        return `${field(record, 'NUMERO')}|${field(record, 'CODIGO').toUpperCase()}`;
    }

    function parseDelivery(value, now = new Date()) {
        const raw = text(value);
        const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
        if (!match) return null;
        const day = Number(match[1]);
        const month = Number(match[2]);
        let year = match[3] ? Number(match[3]) : now.getFullYear();
        if (year < 100) year += 2000;
        let date = new Date(year, month - 1, day, 12, 0, 0);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
        if (!match[3]) {
            const halfYearMs = 183 * 24 * 60 * 60 * 1000;
            const distance = date.getTime() - now.getTime();
            if (distance < -halfYearMs) date = new Date(year + 1, month - 1, day, 12, 0, 0);
            else if (distance > halfYearMs) date = new Date(year - 1, month - 1, day, 12, 0, 0);
        }
        return date;
    }

    function parseMovementDate(value, now = new Date()) {
        const raw = text(value);
        let day;
        let month;
        let year;
        let match = raw.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
        if (match) {
            day = Number(match[1]);
            month = Number(match[2]);
            year = match[3] ? Number(match[3]) : now.getFullYear();
        } else {
            match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (!match) return null;
            year = Number(match[1]);
            month = Number(match[2]);
            day = Number(match[3]);
        }
        if (year < 100) year += 2000;
        let date = new Date(year, month - 1, day, 12, 0, 0);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
        return date;
    }

    function calculateDaysInSector(value, now = new Date()) {
        const movement = parseMovementDate(value, now);
        if (!movement || Number.isNaN(now?.getTime?.())) return null;
        const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const movementUtc = Date.UTC(movement.getFullYear(), movement.getMonth(), movement.getDate());
        return Math.max(0, Math.floor((todayUtc - movementUtc) / 86400000));
    }

    const PARALLEL_FLOWS = [
        { part: 'D6', flow: 'D35', label: 'Custos', pending: ['DES', 'PCO', 'ENG', 'CTO'] },
        { part: 'TF', flow: 'D43', label: 'Tingimento', pending: ['M00', 'M02'] },
        { part: 'AV', flow: 'D47', label: 'Aviamento', pending: ['X01'] },
        { part: 'CO', flow: 'D41', label: 'Cor', pending: ['D01'] }
    ];

    function sourceField(record, name) {
        const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ _]/g, '').toUpperCase();
        const key = Object.keys(record || {}).find(key => normalize(key) === normalize(name));
        return key == null ? '' : text(record[key]);
    }

    function normalizeSourceRecords(records) {
        return (Array.isArray(records) ? records : []).map(record => {
            // Only the raw ERP export has Parte/Fluxo without the canonical TIPO.
            if (field(record, 'TIPO') || !sourceField(record, 'Fluxo') || !sourceField(record, 'Parte')) return record;
            const read = name => sourceField(record, name);
            return {
                NUMERO: read('Número'), CODIGO: read('Código'), IMG_PRODUTO: read('Código'),
                PARTE: read('Parte').toUpperCase(), FLUXO: read('Fluxo').toUpperCase(),
                OP: normalizeSector(read('Setor')), SETOR: read('Desc Setor'),
                ORDEM: read('Ord Setor'), DT_SAIDA: read('Data Saída'), TIPO: '1',
                QTDE_PEND: read('Qtde Pend'), COR: read('Cor'), TAMANHO: read('Tamanho'),
                ESTAMPAS: [read('Comp1'), read('Comp2')].filter(Boolean).join(' • '),
                OBS: [read('Obs'), read('Observação OF2')].filter(Boolean).join(' • '),
                FICHA: read('Ficha'), COD_CLIENTE: read('Descrição2')
            };
        });
    }

    function quantityOf(record) {
        return Math.max(0, Number(field(record, 'QTDE_PEND').replace(',', '.')) || 0);
    }

    function buildParallelProducts(records, now) {
        const byProduct = new Map();
        for (const record of records) {
            if (!field(record, 'NUMERO') || !field(record, 'CODIGO')) continue;
            const key = getKey(record);
            if (!byProduct.has(key)) byProduct.set(key, []);
            byProduct.get(key).push(record);
        }
        const canonical = [];
        const complements = new Map();
        for (const [key, rows] of byProduct) {
            const main = rows.filter(row => field(row, 'PARTE') === 'FE' && field(row, 'FLUXO') === 'D36' && quantityOf(row) > 0 && FLOW_BY_CODE.has(normalizeSector(field(row, 'OP'))) && normalizeSector(field(row, 'OP')) !== '01Z')
                .sort((a, b) => FLOW_BY_CODE.get(normalizeSector(field(a, 'OP'))).order - FLOW_BY_CODE.get(normalizeSector(field(b, 'OP'))).order);
            if (!main.length) continue;
            const primary = main[0];
            const dimensions = new Map();
            main.forEach(row => {
                const dimension = JSON.stringify([field(row, 'COR'), field(row, 'TAMANHO')]);
                dimensions.set(dimension, Math.max(dimensions.get(dimension) || 0, quantityOf(row)));
            });
            const pending = [];
            const missing = [];
            let ting = '';
            let costSector = '';
            for (const spec of PARALLEL_FLOWS) {
                const parallel = rows.filter(row => field(row, 'PARTE') === spec.part && field(row, 'FLUXO') === spec.flow);
                if (!parallel.length) missing.push(spec.label);
                const states = [...new Set(parallel.map(row => normalizeSector(field(row, 'OP'))))];
                const pendingStates = states.filter(state => spec.pending.includes(state) && parallel.some(row => normalizeSector(field(row, 'OP')) === state && quantityOf(row) > 0));
                if (spec.part === 'TF') ting = pendingStates[0] || states[0] || '';
                if (spec.part === 'D6') costSector = states.join(' / ');
                pendingStates.forEach(state => {
                    const row = parallel.find(row => normalizeSector(field(row, 'OP')) === state);
                    pending.push({ flow: spec.flow, part: spec.part, label: spec.label, sector: state, description: field(row, 'SETOR'), date: field(row, 'DT_SAIDA'), days: calculateDaysInSector(field(row, 'DT_SAIDA'), now) });
                });
            }
            canonical.push({ ...primary, PARTE: '', FLUXO: '', QTDE_PEND: String([...dimensions.values()].reduce((a,b) => a+b, 0)), SETOR_TING: ting, SETOR_FLUXO_EM: costSector });
            complements.set(key, { pending, missing, ting, mainSectors: [...new Set(main.map(row => normalizeSector(field(row, 'OP'))))] });
        }
        return buildProducts(canonical, now).map(product => {
            const parallel = complements.get(product.key);
            return { ...product, parallelPending: parallel.pending, missingParallel: parallel.missing, mainSectors: parallel.mainSectors, ting: parallel.ting,
                tingInfo: TINGIMENTO[parallel.ting] || { label: 'Não informado', color: '#64748b' },
                isDes: parallel.pending.some(item => item.part === 'D6' && item.sector === 'DES'), sourceFormat: 'parallel' };
        });
    }

    function buildProducts(records, now = new Date()) {
        const rows = normalizeSourceRecords(Array.isArray(records) ? records.filter(Boolean) : []);
        if (rows.some(row => field(row, 'PARTE') && field(row, 'FLUXO'))) return buildParallelProducts(rows, now);
        const current = new Map();
        const groups = new Map();
        const history = new Map();

        rows.forEach(record => {
            const key = getKey(record);
            const code = field(record, 'CODIGO');
            if (!code || key === '|') return;
            const type = Number(field(record, 'TIPO'));
            if (type === 1) current.set(key, record);
            else if (type === 2) groups.set(key, field(record, 'ORDEM'));
            else if (type === 3) {
                if (!history.has(key)) history.set(key, []);
                history.get(key).push({
                    sector: normalizeSector(field(record, 'OP')),
                    label: field(record, 'SETOR'),
                    date: field(record, 'DT_SAIDA'),
                    pending: Number(field(record, 'QTDE_PEND')) > 0
                });
            }
        });

        return Array.from(current.entries()).map(([key, record]) => {
            const sector = normalizeSector(field(record, 'OP'));
            const deliveryRaw = field(record, 'FICHA');
            const deliveryDate = parseDelivery(deliveryRaw, now);
            const deliverySort = deliveryDate ? deliveryDate.getTime() : Number.MAX_SAFE_INTEGER;
            const ting = normalizeSector(field(record, 'SETOR_TING')) || 'M00';
            const flowInfo = FLOW_BY_CODE.get(sector);
            const itemHistory = (history.get(key) || []).sort((a, b) => {
                return (FLOW_BY_CODE.get(a.sector)?.order || 999) - (FLOW_BY_CODE.get(b.sector)?.order || 999);
            });
            const movementDate = field(record, 'DT_SAIDA');
            return {
                key,
                numero: field(record, 'NUMERO'),
                codigo: field(record, 'CODIGO'),
                imageCode: field(record, 'IMG_PRODUTO') || field(record, 'CODIGO'),
                sector,
                sectorLabel: field(record, 'SETOR') || flowInfo?.label || sector,
                sectorOrder: flowInfo?.order || Number(field(record, 'ORDEM')) || 999,
                movementDate,
                daysInSector: calculateDaysInSector(movementDate, now),
                delivery: deliveryRaw,
                deliverySort,
                isDes: field(record, 'SETOR_FLUXO_EM').toUpperCase() === 'DES',
                costSector: field(record, 'SETOR_FLUXO_EM').toUpperCase(),
                ting,
                tingInfo: TINGIMENTO[ting] || { label: ting || 'Não informado', color: '#64748b' },
                program: groups.get(key) || '',
                customerProgram: normalizeProgram(field(record, 'COD_CLIENTE') || field(record, 'COD CLIENTE')),
                prints: field(record, 'ESTAMPAS'),
                notes: field(record, 'OBS'),
                quantity: Number(field(record, 'QTDE_PEND')) || 0,
                history: itemHistory,
                raw: record
            };
        }).sort((a, b) => a.sectorOrder - b.sectorOrder || a.deliverySort - b.deliverySort || a.codigo.localeCompare(b.codigo, 'pt-BR'));
    }

    function normalizeProgram(value) {
        return String(value ?? '').trim().toUpperCase();
    }

    function getProgramOptions(products, selected = []) {
        const counts = new Map([['', 0], ...selected.map(value => [normalizeProgram(value), 0])]);
        (products || []).forEach(product => {
            const value = normalizeProgram(product.customerProgram);
            counts.set(value, (counts.get(value) || 0) + 1);
        });
        return Array.from(counts, ([value, count]) => ({ value, count }))
            .sort((a, b) => a.value === '' ? 1 : b.value === '' ? -1 : a.value.localeCompare(b.value, 'pt-BR', { numeric: true }));
    }

    function filterByPrograms(products, selected = [], available = true) {
        const values = new Set(selected.map(normalizeProgram));
        return (products || []).filter(product => !available || !values.size || values.has(normalizeProgram(product.customerProgram)));
    }

    function getSectorDistribution(products = []) {
        const groups = groupBySector(products);
        const counts = new Map(groups.map(group => [group.sector, group.items.length]));
        const sectors = [...FLOW, ...groups.filter(group => !FLOW_BY_CODE.has(group.sector)).map(group => ({ code: group.sector, label: group.label }))];
        const total = products.length;
        return sectors.map(sector => ({ ...sector, count: counts.get(sector.code) || 0,
            percent: total ? (counts.get(sector.code) || 0) * 100 / total : 0 }));
    }

    function groupBySector(products) {
        const groups = new Map();
        (products || []).forEach(product => {
            if (!groups.has(product.sector)) groups.set(product.sector, []);
            groups.get(product.sector).push(product);
        });
        return Array.from(groups.entries()).map(([sector, items]) => ({
            sector,
            label: FLOW_BY_CODE.get(sector)?.label || items[0]?.sectorLabel || sector,
            order: FLOW_BY_CODE.get(sector)?.order || items[0]?.sectorOrder || 999,
            items
        })).sort((a, b) => a.order - b.order);
    }

    return { normalizeSourceRecords, sourceField, getSectorDistribution, normalizeProgram, getProgramOptions, filterByPrograms, FLOW, TINGIMENTO, normalizeSector, parseDelivery, parseMovementDate, calculateDaysInSector, buildProducts, groupBySector };
});
