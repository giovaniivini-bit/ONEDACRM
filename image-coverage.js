(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMImageCoverage = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function text(value) {
        return String(value == null ? '' : value).trim();
    }

    function normalizeImageIdentity(value) {
        return text(value)
            .toUpperCase()
            .replace(/\.(JPE?G|PNG|WEBP|GIF|SVG)$/i, '')
            .replace(/[^A-Z0-9]/g, '');
    }

    function imageEntryMatchesKey(key, entry) {
        if (!entry || typeof entry !== 'object') return false;
        const entryIdentity = normalizeImageIdentity(entry.base || entry.filename);
        return Boolean(entryIdentity) && normalizeImageIdentity(key) === entryIdentity;
    }

    function sanitizeImageMap(imageMap) {
        const map = imageMap && typeof imageMap === 'object' ? imageMap : {};
        return Object.fromEntries(
            Object.entries(map).filter(([key, entry]) => imageEntryMatchesKey(key, entry))
        );
    }

    function resolveImageEntry(imageMap, code, op) {
        const map = imageMap && typeof imageMap === 'object' ? imageMap : {};
        const upper = text(code).toUpperCase();
        const stripped = upper.replace(/[^A-Z0-9]/g, '');
        const opValue = text(op).toUpperCase();
        const opClean = opValue.replace(/^0+/, '');
        const candidates = [
            upper,
            stripped,
            upper ? `${upper}.JPG` : '',
            upper ? `${upper}.PNG` : '',
            upper ? `${upper}.JPEG` : '',
            opValue,
            opClean,
            opValue ? `OP${opValue}` : '',
            opValue ? `OP_${opValue}` : ''
        ];

        for (const key of new Set(candidates.filter(Boolean))) {
            if (map[key] && imageEntryMatchesKey(key, map[key])) return map[key];
        }
        return null;
    }

    function buildImageCoverageProducts(sources = {}, options = {}) {
        const products = new Map();
        const checkImage = typeof options.checkImage === 'function' ? options.checkImage : () => false;

        const register = ({ code, imageCode, description, client, brand, sector, op }) => {
            const codigo = text(code);
            const requiredImageCode = text(imageCode) || codigo;
            if (!codigo || ['—', '-', 'N/A'].includes(codigo.toUpperCase())) return;
            const key = `${codigo.toUpperCase()}|${requiredImageCode.toUpperCase()}`;
            if (!products.has(key)) {
                products.set(key, {
                    codigo,
                    imageCode: requiredImageCode,
                    descricao: text(description) || 'Sem descrição',
                    cliente: text(client) || 'Não informado',
                    marca: text(brand) || 'Não informada',
                    setores: new Set(),
                    ops: new Set(),
                    hasImage: false
                });
            }
            const product = products.get(key);
            if (sector) product.setores.add(text(sector));
            if (op) product.ops.add(text(op));
            if (description && product.descricao === 'Sem descrição') product.descricao = text(description);
            if (client && product.cliente === 'Não informado') product.cliente = text(client);
            if (!product.hasImage) product.hasImage = Boolean(checkImage(requiredImageCode, text(op)));
        };

        (sources.main || []).forEach(item => register({
            code: item.codigo,
            imageCode: item.codigo,
            description: item.descricao || item.descGrupoProd,
            client: item.cliente,
            brand: item.marca,
            sector: item.setor,
            op: item.op
        }));

        (sources.cq || []).forEach(item => register({
            code: item.CODIGO || item.IMG_PRODUTO || item.ART_CLI,
            imageCode: item.IMG_PRODUTO || item.CODIGO || item.ART_CLI,
            description: `Amostra CQ: ${item.DESC_AMOSTRA || item.STATUS || ''}`,
            client: item.REPRESENTANTE || 'CQ',
            brand: 'CQ',
            sector: 'Andamento CQ',
            op: item.NUMERO || item.OFS || item.ORDEM
        }));

        (sources.rotativos || []).forEach(item => register({
            code: item.produto || item.PRODUTO || item.CODIGO || item.REFERENCIA,
            description: item.obs || item.DESCRICAO || 'Rotativo',
            client: item.CLIENTE || 'Rotativos',
            brand: 'Rotativo',
            sector: '43 (Rotativos)',
            op: item.OP || item.ORDEM || item.NUMERO
        }));

        const progBuilder = typeof options.buildProgProducts === 'function' ? options.buildProgProducts : null;
        const progProducts = progBuilder
            ? progBuilder(sources.progFeira || [])
            : (sources.progFeira || []).filter(record => Number(record?.TIPO) === 1).map(record => ({
                codigo: record.CODIGO,
                imageCode: record.IMG_PRODUTO || record.CODIGO,
                numero: record.NUMERO,
                sector: record.OP,
                sectorLabel: record.SETOR,
                program: ''
            }));
        progProducts.forEach(item => register({
            code: item.codigo,
            imageCode: item.imageCode || item.codigo,
            description: `Prog Feira: ${item.sectorLabel || item.sector || 'Amostra'}`,
            client: item.program || 'Prog Feira',
            brand: 'Prog Feira',
            sector: `${item.sector || '—'} (Prog Feira)`,
            op: item.numero
        }));

        return Array.from(products.values()).map(product => ({
            ...product,
            setores: Array.from(product.setores).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            ops: Array.from(product.ops).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        })).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }) || a.imageCode.localeCompare(b.imageCode, undefined, { numeric: true }));
    }

    return {
        buildImageCoverageProducts,
        resolveImageEntry,
        normalizeImageIdentity,
        imageEntryMatchesKey,
        sanitizeImageMap
    };
});
