(function(root) {
    'use strict';
    root.CRMProgCQView = {
        render(container, { filters, search, escape: esc, onPart, onSector, onClear }) {
            const api = root.CRMProgCQ;
            const selected = filters.sectors;
            const visible = api.groups([], { ...filters, search });
            container.innerHTML = `<section class="prog-feira-view prog-cq-view">
                <header class="module-view-header"><h2>Prog CQ</h2><p>Andamento das amostras de controle de qualidade • Partes F6 e F7</p></header>
                <div class="table-card prog-cq-source" role="status"><strong>Aguardando configuração da planilha</strong><p>Fonte definida: ${esc(api.SOURCE.title)} • ${esc(api.SOURCE.sheetName)}. A leitura será conectada após a definição das colunas e dos cruzamentos.</p><a class="exec-action-btn" href="${esc(api.SOURCE.url)}" target="_blank" rel="noopener noreferrer">Abrir planilha Prog CQ</a></div>
                <div class="prog-feira-toolbar">
                    <label class="prog-feira-parallel-filter"><span>Parte</span><select data-cq-part aria-label="Parte Prog CQ"><option value="all" ${filters.part === 'all' ? 'selected' : ''}>Todas as partes</option>${api.PARTS.map(part => `<option value="${part.code}" ${filters.part === part.code ? 'selected' : ''}>Parte ${part.code}</option>`).join('')}</select></label>
                    <div class="prog-feira-sector-selection"><strong>Setores:</strong><span>${selected.length ? selected.map(esc).join(', ') : 'Todos'}</span></div>
                    <button type="button" class="filter-clear-btn" data-cq-clear>Limpar setores e parte</button>
                </div>
                ${api.PARTS.filter(part => filters.part === 'all' || filters.part === part.code).map(part => `
                    <section class="prog-feira-distribution prog-cq-distribution" aria-label="Produtos por setor da Parte ${part.code}">
                        <header><h3>Produtos por setor • Parte ${part.code}</h3><span>Quantidades ainda não disponíveis</span></header>
                        <p>Selecione um ou mais setores para filtrar os grupos abaixo. Sem seleção, todos são apresentados.</p>
                        <div class="prog-feira-chart-scroll"><div class="prog-feira-flow" style="--sector-columns:${part.sectors.length}">
                            ${part.sectors.map(sector => {
                                const key = api.sectorKey(part.code, sector);
                                return `<button type="button" class="prog-feira-flow-step ${selected.includes(key) ? 'active' : ''}" data-cq-sector="${key}" aria-pressed="${selected.includes(key)}" aria-label="Parte ${part.code} setor ${sector}"><div class="prog-feira-sector-plot" aria-hidden="true"><span class="prog-cq-unavailable">—</span></div><strong>${sector}</strong><small>Sem dados</small><span>Parte ${part.code}</span><span class="prog-feira-sector-flag" aria-hidden="true"><i class="fa-solid fa-check"></i></span></button>`;
                            }).join('')}
                        </div></div>
                    </section>`).join('')}
                <section class="prog-cq-groups" aria-label="Produtos agrupados por parte e setor">
                    <h3>Produtos por parte e setor</h3>
                    ${visible.length ? visible.map(group => `<section class="prog-feira-sector" data-cq-group="${group.key}"><header><div><strong>Parte ${group.part} · ${group.sector}</strong></div><em>Aguardando dados</em></header><div class="prog-cq-empty">As imagens e os cards deste setor aparecerão aqui após a conexão da planilha.</div></section>`).join('') : '<div class="empty-state">Nenhum setor selecionado pertence à parte exibida. Limpe a seleção ou escolha outra parte.</div>'}
                </section>
            </section>`;
            container.querySelector('[data-cq-part]').addEventListener('change', event => onPart(event.target.value));
            container.querySelector('[data-cq-clear]').addEventListener('click', onClear);
            container.querySelectorAll('[data-cq-sector]').forEach(button => button.addEventListener('click', () => onSector(button.dataset.cqSector)));
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
