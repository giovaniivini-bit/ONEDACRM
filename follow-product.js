(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMFollowProduct = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const text = value => String(value == null ? '' : value).trim();
    const norm = value => text(value).toUpperCase();
    const folded = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const header = value => folded(value).replace(/[\s_.]/g, '');
    const filled = value => text(value) && !/^[-—–]+$/.test(text(value));
    function field(row, names) {
        for (const name of names) {
            const key = Object.keys(row || {}).find(key => header(key) === header(name));
            if (key != null && filled(row[key])) return text(row[key]);
        }
        return '';
    }
    const unique = values => [...new Set(values.map(text).filter(filled))];
    const sourceRows = value => Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : null;
    const keyOf = (op, code) => JSON.stringify([norm(op), norm(code)]);
    const FLOW = [{ code: 'D35', label: 'Custos' }, { code: 'D41', label: 'Cor' }, { code: 'D43', label: 'Tingimento' }];
    const SHEET_LABELS = {
        cor:'Cor', pantone:'Pantone', tipoaviamento:'Tipo de aviamento', tipodeaviamento:'Tipo de aviamento',
        descricao:'Descrição', fornecedor:'Fornecedor', solicitado:'Solicitado', solicitacao:'Solicitação',
        previsao:'Previsão', dataprevisao:'Previsão', envcliente:'Enviado ao cliente', enviadocliente:'Enviado ao cliente',
        enviadoaocliente:'Enviado ao cliente', enviocliente:'Enviado ao cliente', recebido:'Recebido',
        dataaprovado:'Aprovação', aprovado:'Aprovação', observacao:'Observação', observacoes:'Observações', obs:'Observação',
        arquivoaprov:'Arquivo aprovado', preventcilindro:'Previsão de entrega do cilindro', mesaenviada:'Mesa enviada',
        prevmesa:'Previsão da mesa', statusrecebimento:'Situação de recebimento', dias:'Dias'
    };
    function sheetIndex(source) {
        const records = sourceRows(source);
        const index = new Map();
        for (const row of records || []) {
            const code = norm(field(row, ['PRODUTO', 'PRODUTO / REF', 'PRODUTO / REFERÊNCIA', 'CODIGO']));
            if (!code) continue;
            // Keep each original sheet item, including distinct forecasts and observations.
            const details = Object.entries(row).filter(([name, value]) =>
                SHEET_LABELS[header(name)] &&
                value != null && typeof value !== 'object' && filled(value)
            ).map(([label, value]) => ({ label: SHEET_LABELS[header(label)], value: typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : text(value) }));
            if (!index.has(code)) index.set(code, []);
            index.get(code).push({ details });
        }
        return { available: records !== null, index };
    }
    function build({ main = [], progFeira, colors, trims, rotativos } = {}) {
        const groups = new Map();
        const mainAliases = new Map();
        for (const row of sourceRows(main) || []) {
            if (!filled(row?.op) || !filled(row?.codigo) || !/^\d+$/.test(text(row.op))) continue;
            const alias = keyOf(text(row.op).replace(/^0+(?=\d)/, ''), row.codigo);
            if (!mainAliases.has(alias)) mainAliases.set(alias, new Set());
            mainAliases.get(alias).add(text(row.op));
        }
        function add(row, source, processed) {
            if (!row || typeof row !== 'object') return;
            let op = processed ? text(row.op) : field(row, ['NUMERO', 'OF']);
            const codigo = processed ? text(row.codigo) : field(row, ['CODIGO']);
            if (!filled(op) || !filled(codigo)) return;
            if (!processed && !groups.has(keyOf(op, codigo)) && /^\d+$/.test(op)) {
                const candidates = mainAliases.get(keyOf(op.replace(/^0+(?=\d)/, ''), codigo));
                // Reconcile only verified numeric formatting with one unambiguous main OF.
                if (candidates?.size === 1) op = [...candidates][0];
            }
            const key = keyOf(op, codigo);
            if (!groups.has(key)) groups.set(key, { key, op, codigo, rows: [], sources: new Set() });
            const group = groups.get(key);
            group.sources.add(source);
            if (processed) {
                const raws = Array.isArray(row.rawRows) ? row.rawRows : Array.isArray(row.sourceRows) ? row.sourceRows : [row.raw || {}];
                for (const raw of raws) group.rows.push({ ...row, raw: raw || {}, processed: true });
            } else group.rows.push({ raw: row, processed: false });
        }
        for (const row of sourceRows(main) || []) add(row, 'ERP principal', true);
        for (const row of sourceRows(progFeira) || []) add(row, 'Prog Feira', false);
        const sheets = { colorSheet: sheetIndex(colors), trimSheet: sheetIndex(trims), rotativosSheet: sheetIndex(rotativos) };
        return [...groups.values()].map(group => {
            const values = (props, rawNames) => unique(group.rows.flatMap(row => [
                ...props.map(prop => row[prop]), field(row.raw, rawNames)
            ]));
            const sectors = [];
            for (const row of group.rows) {
                const setor = (row.processed ? text(row.setor) || field(row.raw, ['Setor']) : field(row.raw, ['OP', 'Setor']));
                const fluxo = field(row.raw, ['Fluxo']) || text(row.fluxo);
                const parte = field(row.raw, ['Parte']) || text(row.parte);
                const descricao = field(row.raw, ['Desc Setor', 'SETOR']) || text(row.descSetor);
                if (!setor && !fluxo && !parte) continue;
                const item = { setor, fluxo, parte, descricao };
                if (!sectors.some(other => JSON.stringify(other) === JSON.stringify(item))) sectors.push(item);
            }
            const product = {
                key: group.key, op: group.op, codigo: group.codigo, sources: [...group.sources],
                descriptions: values(['descricao'], ['Produto Descrição', 'Desc Produto', 'DESCRICAO']),
                weeks: values(['semanaPedido', 'pedDescPeriodo'], ['Ped Desc Período', 'SEMANA PEDIDO']),
                labels: values(['etiqueta'], ['ETIQUETA']),
                programs: values(['progAmostras'], ['Descrição2', 'COD_CLIENTE', 'COD CLIENTE']),
                observation1: values([], ['Comp1']), observation2: values([], ['Comp2']),
                productStatuses: values(['statusProd', 'statusEstilo'], ['Produto Status', 'Status Estilo', 'Status Prod']),
                modelingStatuses: values(['statusModelagem'], ['Descrição do Local', 'Desc Local', 'Status Modelagem', 'Local Produto']),
                sectors, mainSectors: sectors.filter(item => !FLOW.some(flow => norm(item.fluxo) === flow.code)),
                flows: FLOW.map(flow => ({ ...flow, sectors: sectors.filter(item => norm(item.fluxo) === flow.code) }))
            };
            for (const [name, sheet] of Object.entries(sheets)) product[name] = { available: sheet.available, items: sheet.index.get(norm(group.codigo)) || [] };
            return product;
        });
    }
    function filter(products, query = '') {
        const q = folded(typeof query === 'object' ? query?.search : query);
        if (!q) return products || [];
        return (products || []).filter(product => folded([
            product.codigo, product.op, ...(product.descriptions || []), ...(product.weeks || []),
            ...(product.labels || []), ...(product.programs || []), ...(product.observation1 || []), ...(product.observation2 || [])
        ].join(' ')).includes(q));
    }
    const FILTER_FIELDS = {labels:'Etiqueta',programs:'Prog. amostra',weeks:'Semana do pedido',productStatuses:'Status produto',modelingStatuses:'Status modelagem'};
    function filterFixed(products, selections = {}) {
        return (products || []).filter(product => Object.keys(FILTER_FIELDS).every(key => {
            const chosen=selections[key];
            if (!chosen) return true;
            const values=product[key] || [];
            return chosen==='__follow_missing__' ? !values.length : values.some(value=>norm(value)===norm(chosen));
        }));
    }
    function filterOptions(products) {
        return Object.fromEntries(Object.keys(FILTER_FIELDS).map(key=>[key,unique((products || []).flatMap(p=>p[key] || [])).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}))]));
    }
    const escape = value => text(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    function safeUrl(value) {
        const url = text(value);
        return /^(?:https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(url) && !/[\u0000-\u0020\\]/.test(url) ? url : '';
    }
    function render(products, { getImage = () => null, escapeHtml = escape } = {}) {
        const e = value => escapeHtml(text(value));
        const show = values => values?.length ? values.map(e).join('<br>') : '<span class="follow-missing">Não informado</span>';
        const line = (label, values) => `<div class="follow-field"><dt>${e(label)}</dt><dd>${show(values)}</dd></div>`;
        const cell = (label, className, content) => `<section class="follow-product-cell ${className}"><h4 class="follow-column-title">${e(label)}</h4>${content}</section>`;
        const sectorText = item => [item.setor, item.descricao, item.parte ? `Parte ${item.parte}` : ''].filter(Boolean).join(' · ');
        const sheet = (label, value) => `<section class="follow-sheet"><h4>${e(label)}</h4>${!value?.available
            ? '<p class="follow-missing">Fonte indisponível</p>' : !value.items.length
                ? '<p class="follow-missing">Sem registro na planilha</p>' : value.items.map(item => `<dl class="follow-sheet-item">${item.details.length ? item.details.map(detail => line(detail.label, [detail.value])).join('') : '<div class="follow-missing">Dados não informados</div>'}</dl>`).join('')}</section>`;
        if (!products?.length) return '<div class="follow-empty">Nenhum produto encontrado.</div>';
        return `<div class="follow-product-list">${products.map(product => {
            const image = getImage(product.codigo, product.op) || {};
            const src = safeUrl(typeof image === 'string' ? image : image.thumbUrl);
            const fallback = safeUrl(image.proxyUrl || image.fallbackUrl);
            const large = safeUrl(image.largeUrl) || src;
            const photo = src ? `<img class="follow-product-image" src="${e(src)}" alt="${e(product.codigo)}" loading="lazy" decoding="async" data-fallback="${e(fallback)}" data-large="${e(large)}" data-large-fallback="${e(safeUrl(image.largeFallbackUrl) || fallback)}">` : '<span class="follow-missing">Imagem não disponível</span>';
            const identity = `<h3>${e(product.codigo)}</h3><p class="follow-of">OF ${e(product.op)}</p><p>${show(product.descriptions)}</p><dl>${line('Etiqueta', product.labels)}${line('Programação', product.programs)}${line('Origem', product.sources)}</dl>`;
            const observations = `<dl>${line('Observação 1 · Comp1', product.observation1)}${line('Observação 2 · Comp2', product.observation2)}</dl>${sheet('Rotativos', product.rotativosSheet)}`;
            const sectors = `<dl>${line('Setores principais', (product.mainSectors || []).map(sectorText))}${(product.flows || []).map(flow => line(`${flow.label} · ${flow.code}`, flow.sectors.map(sectorText))).join('')}</dl>`;
            const status = `<dl>${line('Status produto', product.productStatuses)}${line('Status modelagem', product.modelingStatuses)}</dl>`;
            return `<article class="follow-product-card" data-follow-key="${e(product.key)}">${cell('Semana', 'follow-week', `<strong>${show(product.weeks)}</strong>`)}${cell('Imagem', 'follow-product-photo', `<div class="follow-product-media">${photo}</div>`)}${cell('Produto / OF', 'follow-product-identity', identity)}${cell('Observações', 'follow-product-details', observations)}${cell('Cor / Aviamentos', 'follow-product-sheets', `${sheet('Cor', product.colorSheet)}${sheet('Aviamentos', product.trimSheet)}`)}${cell('Setores / Fluxos', 'follow-product-sectors', sectors)}${cell('Status', 'follow-product-status', status)}</article>`;
        }).join('')}</div>`;
    }
    return { build, filter, render, filterFixed, filterOptions, FILTER_FIELDS };
}));
