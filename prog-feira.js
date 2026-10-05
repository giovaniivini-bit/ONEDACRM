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

    function buildProducts(records, now = new Date()) {
        const rows = Array.isArray(records) ? records.filter(Boolean) : [];
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
            return {
                key,
                numero: field(record, 'NUMERO'),
                codigo: field(record, 'CODIGO'),
                imageCode: field(record, 'IMG_PRODUTO') || field(record, 'CODIGO'),
                sector,
                sectorLabel: field(record, 'SETOR') || flowInfo?.label || sector,
                sectorOrder: flowInfo?.order || Number(field(record, 'ORDEM')) || 999,
                movementDate: field(record, 'DT_SAIDA'),
                delivery: deliveryRaw,
                deliverySort,
                isDes: field(record, 'SETOR_FLUXO_EM').toUpperCase() === 'DES',
                costSector: field(record, 'SETOR_FLUXO_EM').toUpperCase(),
                ting,
                tingInfo: TINGIMENTO[ting] || { label: ting || 'Não informado', color: '#64748b' },
                program: groups.get(key) || '',
                prints: field(record, 'ESTAMPAS'),
                notes: field(record, 'OBS'),
                quantity: Number(field(record, 'QTDE_PEND')) || 0,
                history: itemHistory,
                raw: record
            };
        }).sort((a, b) => a.sectorOrder - b.sectorOrder || a.deliverySort - b.deliverySort || a.codigo.localeCompare(b.codigo, 'pt-BR'));
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

    return { FLOW, TINGIMENTO, normalizeSector, parseDelivery, buildProducts, groupBySector };
});
