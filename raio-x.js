(function (root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./alerts-engine') : root.CRMAlertsEngine);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMRaioX = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (sheetHelpers) {
    const SECTORS = ['01', '02', '03', '04', '05G', '43', 'CM1', '05', '06', '12', '13', '20', '26', '31', '106'];
    const norm = value => String(value || '').trim().toUpperCase();
    const sector = value => /^\d+$/.test(norm(value)) ? norm(value).replace(/^0+(?=\d)/, '').padStart(2, '0') : norm(value);
    const keyOf = row => JSON.stringify([norm(row.op), norm(row.codigo)]);

    function build(records) {
        const groups = new Map();
        for (const row of records || []) {
            // Do not join missing identifiers across unrelated products.
            if (!norm(row.op) || !norm(row.codigo)) continue;
            const key = keyOf(row);
            if (!groups.has(key)) groups.set(key, { rows: [], main: [] });
            const group = groups.get(key);
            group.rows.push(row);
            if (SECTORS.includes(sector(row.setor))) group.main.push(row);
        }
        const products = [];
        for (const [key, group] of groups) {
            if (!group.main.length) continue;
            const sectors = SECTORS.filter(s => group.main.some(r => sector(r.setor) === s));
            const statuses = field => [...new Set(group.main.map(r => String(r[field] || '').trim()).filter(Boolean))];
            const malotes = [...new Set(group.rows.filter(r => {
                const parts = Array.isArray(r.partes) ? r.partes : [r.parte];
                return ['83', '88'].includes(sector(r.setor)) && parts.some(p => norm(p) === 'D7');
            }).map(r => sector(r.setor)))].sort();
            products.push({
                ...group.main[0], key, sectors,
                setorDias: sectors.map(s => ({ setor: s, dias: Math.max(0, ...group.main.filter(r => sector(r.setor) === s).map(r => Number(r.diasParado) || 0)) })),
                // A product can be present in several sectors; never add its quantity again for each sector.
                qtdeOriginal: Math.max(0, ...group.main.map(r => Number(r.qtdeOriginal) || 0)),
                modelagem: statuses('statusModelagem'),
                estilo: [...new Set(group.main.map(r => r.statusEstilo || r.statusProd || '').map(String).map(s => s.trim()).filter(Boolean))],
                setoresCor: group.rows.some(r => sector(r.setor) === 'D01') ? ['D01'] : [],
                setoresAviamento: group.rows.some(r => sector(r.setor) === 'X01') ? ['X01'] : [],
                malotes
            });
        }
        return products;
    }

    function sheetValue(record, names) {
        const value = sheetHelpers.getRecordField(record, names);
        // Dashes and spreadsheet errors are missing information, never proof of shipment.
        return !value || /^[-—–]+$/.test(value) || /^#(?:REF|VALUE|VALOR|N\/A|N\/D|DIV\/0|NAME|NOME|NUM|NÚM|ERROR|ERRO)[!?]?$/i.test(value) ? '' : value;
    }

    function buildSheetDetailsIndex(records, kind) {
        const index = new Map();
        for (const row of Array.isArray(records) ? records : []) {
            const code = norm(sheetValue(row, ['PRODUTO', 'PRODUTO / REF', 'PRODUTO / REFERÊNCIA', 'CODIGO', 'CÓDIGO']));
            if (!code) continue;
            const sent = sheetValue(row, ['ENV CLIENTE', 'ENV. CLIENTE', 'ENVIADO CLIENTE', 'ENVIADO AO CLIENTE', 'ENVIO CLIENTE']);
            const forecast = sheetValue(row, ['PREVISÃO', 'PREVISAO', 'DATA PREVISÃO']);
            const item = {
                name: sheetValue(row, kind === 'color' ? ['COR'] : ['TIPO AVIAMENTO', 'TIPO DE AVIAMENTO']),
                description: sheetValue(row, kind === 'color' ? ['PANTONE'] : ['DESCRIÇÃO', 'DESCRICAO']),
                delivery: sent ? { kind:'sent', label:'Enviado ao cliente', value:sent }
                    : forecast ? { kind:'forecast', label:'Previsão', value:forecast }
                    : { kind:'missing', label:'Envio / previsão', value:'Não informados' }
            };
            if (!item.name && !item.description && item.delivery.kind === 'missing') continue;
            if (!index.has(code)) index.set(code, []);
            index.get(code).push(item);
        }
        return index;
    }

    function enrichWithSheets(products, colorRecords, trimRecords) {
        const colors = buildSheetDetailsIndex(colorRecords, 'color');
        const trims = buildSheetDetailsIndex(trimRecords, 'trim');
        return (products || []).map(product => ({ ...product,
            colorSheet: product.setoresCor?.includes('D01') ? { available:Array.isArray(colorRecords), items:colors.get(norm(product.codigo)) || [] } : null,
            trimSheet: product.setoresAviamento?.includes('X01') ? { available:Array.isArray(trimRecords), items:trims.get(norm(product.codigo)) || [] } : null
        }));
    }

    function filter(products, filters, helpers) {
        const q = norm(filters.search);
        return products.filter(p => {
            if (filters.sectors?.length && !p.sectors.some(s => filters.sectors.includes(s))) return false;
            if (filters.client !== 'all' && p.cliente !== filters.client) return false;
            if (!helpers.matchesPending(p, filters.pending, true)) return false;
            if (filters.style !== 'all' && !p.estilo.some(s => helpers.styleStatusGroup(s) === filters.style)) return false;
            if (filters.model !== 'all' && !p.modelagem.includes(filters.model)) return false;
            if (filters.malote === 'pending' && !p.malotes.length) return false;
            if (filters.malote === 'none' && p.malotes.length) return false;
            if (['83', '88'].includes(filters.malote) && !p.malotes.includes(filters.malote)) return false;
            if (q && !norm([p.op, p.codigo, p.descricao, p.cliente, p.marca, p.etiqueta, p.pedDescPeriodo, ...p.sectors, ...p.estilo, ...p.modelagem].join(' ')).includes(q)) return false;
            return true;
        });
    }
    function sectorNames(records) {
        const names = {};
        for (const row of records || []) {
            const code = sector(row.setor);
            const description = String(row.descSetor || '').trim();
            if (!SECTORS.includes(code) || !description) continue;
            if (!names[code]) names[code] = new Set();
            names[code].add(description);
        }
        return Object.fromEntries(Object.entries(names).map(([code, values]) => [code, [...values].sort().join(' / ')]));
    }

    return { SECTORS, build, filter, sectorNames, buildSheetDetailsIndex, enrichWithSheets };
}));
