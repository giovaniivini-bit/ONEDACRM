(function(root) {
    'use strict';
    root.CRMProgCQView = {
        render(container, { filters, search, escape: esc, onFlow, onSector, onClear }) {
            const api = root.CRMProgCQ;
            const selected = filters.sectors;
            const visible = api.groups([], { ...filters, search });
            container.innerHTML = `<section class="prog-feira-view prog-cq-view">
                <header class="module-view-header"><h2>Prog CQ</h2><p>Andamento das amostras de controle de qualidade • Fluxos C32 e D32</p></header>
                <div class="table-card prog-cq-source" role="status"><strong>Aguardando configuração da planilha</strong><p>Fonte definida: ${esc(api.SOURCE.title)} • ${esc(api.SOURCE.sheetName)}. A leitura será conectada após a definição das colunas e dos cruzamentos.</p><a class="exec-action-btn" href="${esc(api.SOURCE.url)}" target="_blank" rel="noopener noreferrer">Abrir planilha Prog CQ</a></div>
                <div class="prog-feira-toolbar">
                    <label class="prog-feira-parallel-filter"><span>Fluxo</span><select data-cq-flow aria-label="Fluxo Prog CQ"><option value="all" ${filters.flow === 'all' ? 'selected' : ''}>Todos os fluxos</option>${api.FLOWS.map(flow => `<option value="${flow.code}" ${filters.flow === flow.code ? 'selected' : ''}>${flow.code}</option>`).join('')}</select></label>
                    <div class="prog-feira-sector-selection"><strong>Setores:</strong><span>${selected.length ? selected.map(esc).join(', ') : 'Todos'}</span></div>
                    <button type="button" class="filter-clear-btn" data-cq-clear>Limpar setores e fluxo</button>
                </div>
                ${api.FLOWS.filter(flow => filters.flow === 'all' || filters.flow === flow.code).map(flow => `
                    <section class="prog-feira-distribution prog-cq-distribution" aria-label="Produtos por setor do fluxo ${flow.code}">
                        <header><h3>Produtos por setor • ${flow.code}</h3><span>Quantidades ainda não disponíveis</span></header>
                        <p>Selecione um ou mais setores para filtrar os grupos abaixo. Sem seleção, todos são apresentados.</p>
                        <div class="prog-feira-chart-scroll"><div class="prog-feira-flow" style="--sector-columns:${flow.sectors.length}">
                            ${flow.sectors.map(sector => {
                                const key = api.sectorKey(flow.code, sector);
                                return `<button type="button" class="prog-feira-flow-step ${selected.includes(key) ? 'active' : ''}" data-cq-sector="${key}" aria-pressed="${selected.includes(key)}" aria-label="${flow.code} setor ${sector}"><div class="prog-feira-sector-plot" aria-hidden="true"><span class="prog-cq-unavailable">—</span></div><strong>${sector}</strong><small>Sem dados</small><span>${flow.code}</span><span class="prog-feira-sector-flag" aria-hidden="true"><i class="fa-solid fa-check"></i></span></button>`;
                            }).join('')}
                        </div></div>
                    </section>`).join('')}
                <section class="prog-cq-groups" aria-label="Produtos agrupados por fluxo e setor">
                    <h3>Produtos por fluxo e setor</h3>
                    ${visible.length ? visible.map(group => `<section class="prog-feira-sector" data-cq-group="${group.key}"><header><div><strong>${group.flow} · ${group.sector}</strong></div><em>Aguardando dados</em></header><div class="prog-cq-empty">As imagens e os cards deste setor aparecerão aqui após a conexão da planilha.</div></section>`).join('') : '<div class="empty-state">Nenhum setor selecionado pertence ao fluxo exibido. Limpe a seleção ou escolha outro fluxo.</div>'}
                </section>
            </section>`;
            container.querySelector('[data-cq-flow]').addEventListener('change', event => onFlow(event.target.value));
            container.querySelector('[data-cq-clear]').addEventListener('click', onClear);
            container.querySelectorAll('[data-cq-sector]').forEach(button => button.addEventListener('click', () => onSector(button.dataset.cqSector)));
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
