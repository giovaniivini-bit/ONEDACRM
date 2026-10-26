(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMRaioX = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

    function filter(products, filters, helpers) {
        const q = norm(filters.search);
        return products.filter(p => {
            if (filters.sectors?.length && !p.sectors.some(s => filters.sectors.includes(s))) return false;
            if (filters.client !== 'all' && p.cliente !== filters.client) return false;
            if (!helpers.matchesPending(p, filters.pending)) return false;
            if (filters.style !== 'all' && !p.estilo.some(s => helpers.styleStatusGroup(s) === filters.style)) return false;
            if (filters.model !== 'all' && !p.modelagem.includes(filters.model)) return false;
            if (filters.malote === 'pending' && !p.malotes.length) return false;
            if (filters.malote === 'none' && p.malotes.length) return false;
            if (['83', '88'].includes(filters.malote) && !p.malotes.includes(filters.malote)) return false;
            if (q && !norm([p.op, p.codigo, p.descricao, p.cliente, p.marca, p.etiqueta, p.pedDescPeriodo, ...p.sectors, ...p.estilo, ...p.modelagem].join(' ')).includes(q)) return false;
            return true;
        });
    }
    return { SECTORS, build, filter };
}));
