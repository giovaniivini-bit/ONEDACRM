(function(root) {
    'use strict';
    root.CRMProgCQView = {
        render(container, { filters, search, escape: esc, source, loading, image = () => ({}), onPart, onAvailability, onSector, onClear }) {
            const api = root.CRMProgCQ;
            const selected = filters.sectors;
            const items = source?.records || [];
            const parts = api.partsFor(items);
            const filtered = api.filterAvailability(items, filters);
            const visible = api.groups(items, { ...filters, search }).map(group => ({
                ...group, items: api.filterAvailability(group.items, filters)
            }));
            const counts = new Map(api.groups(filtered, { search }).map(group => [group.key, group.items.length]));
            const availabilitySelect = (key, label, options) => `<label class="prog-feira-parallel-filter"><span>${label}</span><select data-cq-availability="${key}">${options.map(([value, text]) => `<option value="${value}" ${(filters[key] || 'all') === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
            const status = loading ? 'Carregando planilha' : !source ? 'Planilha indisponível'
                : source.isLive === false ? 'Exibindo última sincronização' : 'Dados sincronizados';
            const card = item => {
                const photo = image(item.codigo, item.numero);
                const andamento = item.andamentoPedido?.trim();
                return `<article class="prog-feira-card prog-cq-card">
                    <div class="prog-feira-card-top"><strong>${esc(item.codigo)}</strong>${item.numero ? `<span>OF ${esc(item.numero)}</span>` : ''}</div>
                    <div class="prog-feira-media">${photo.hasImage ? `<img class="prog-feira-image" src="${esc(photo.thumbUrl)}" data-cq-image-fallback="${esc(photo.proxyUrl || '')}" alt="${esc(item.codigo)}" loading="lazy"><span class="prog-feira-image-empty" hidden>Imagem indisponível</span>` : '<span class="prog-feira-image-empty">Imagem indisponível</span>'}</div>
                    <div class="prog-feira-card-body">
                        ${item.aviamentoPendente ? '<strong class="prog-cq-trim-pending">AV. PENDENTE CQ</strong>' : ''}
                        ${item.descricao ? `<strong>${esc(item.descricao)}</strong>` : ''}
                        <p class="prog-cq-order-progress${andamento ? '' : ' prog-cq-order-missing'}"><strong>Andamento do pedido</strong><span>${esc(andamento || 'Não informado')}</span></p>
                    </div>
                </article>`;
            };
            container.innerHTML = `<section class="prog-feira-view prog-cq-view">
                <header class="module-view-header"><h2>Prog CQ</h2><p>Andamento das amostras de controle de qualidade • Partes F6 e F7</p></header>
                <div class="table-card prog-cq-source" role="status"><strong>${status}</strong> <a class="exec-action-btn" href="${esc(api.SOURCE.url)}" target="_blank" rel="noopener noreferrer">Abrir planilha Prog CQ</a></div>
                <div class="prog-feira-toolbar">
                    <label class="prog-feira-parallel-filter"><span>Parte</span><select data-cq-part aria-label="Parte Prog CQ"><option value="all" ${filters.part === 'all' ? 'selected' : ''}>Todas as partes</option>${parts.map(part => `<option value="${part.code}" ${filters.part === part.code ? 'selected' : ''}>Parte ${part.code}</option>`).join('')}</select></label>
                    ${availabilitySelect('mesh', 'Situação malha', [['all','Todas'],['available','Tem malha'],['missing','Sem malha'],['unknown','Não informada']])}
                    ${availabilitySelect('trims', 'Aviamento', [['all','Todos'],['available','Com aviamento'],['missing','Sem aviamento']])}
                    <div class="prog-feira-sector-selection"><strong>Setores:</strong><span>${selected.length ? selected.map(esc).join(', ') : 'Todos'}</span></div>
                    <button type="button" class="filter-clear-btn" data-cq-clear>Limpar filtros</button>
                </div>
                ${parts.filter(part => filters.part === 'all' || filters.part === part.code).map(part => {
                    const max = Math.max(1, ...part.sectors.map(sector => counts.get(api.sectorKey(part.code, sector)) || 0));
                    return `
                    <section class="prog-feira-distribution prog-cq-distribution" aria-label="Produtos por setor da Parte ${part.code}">
                        <header><h3>Produtos por setor • Parte ${part.code}</h3><span>${source ? `${part.sectors.reduce((sum, sector) => sum + (counts.get(api.sectorKey(part.code, sector)) || 0), 0)} registros` : 'Quantidades ainda não disponíveis'}</span></header>
                        <p>Selecione um ou mais setores para filtrar os grupos abaixo. Sem seleção, todos são apresentados.</p>
                        <div class="prog-feira-chart-scroll"><div class="prog-feira-flow" style="--sector-columns:${part.sectors.length}">
                            ${part.sectors.map(sector => {
                                const key = api.sectorKey(part.code, sector);
                                const count = counts.get(key) || 0;
                                const height = count ? Math.max(3, Math.round(count / max * 72)) : 0;
                                return `<button type="button" class="prog-feira-flow-step ${selected.includes(key) ? 'active' : ''}" data-cq-sector="${esc(key)}" aria-pressed="${selected.includes(key)}" aria-label="Parte ${part.code} setor ${esc(sector)}, ${source ? count + ' registros' : 'sem dados'}"><div class="prog-feira-sector-plot"><span class="prog-cq-bar-count">${source ? count : '—'}</span>${height ? `<span class="prog-cq-bar" aria-hidden="true" style="height:${height}px"></span>` : ''}</div><strong>${esc(sector)}</strong><small>${source ? 'Registros' : 'Sem dados'}</small><span>Parte ${part.code}</span><span class="prog-feira-sector-flag" aria-hidden="true"><i class="fa-solid fa-check"></i></span></button>`;
                            }).join('')}
                        </div></div>
                    </section>`;
                }).join('')}
                <section class="prog-cq-groups" aria-label="Produtos agrupados por parte e setor">
                    <h3>Produtos por parte e setor</h3>
                    ${visible.length ? visible.map(group => `<section class="prog-feira-sector" data-cq-group="${esc(group.key)}"><header><div><strong>Parte ${group.part} · ${esc(group.sector)}</strong></div><em>${source ? `${group.items.length} registros` : 'Aguardando dados'}</em></header>${group.items.length
                        ? `<div class="prog-feira-grid">${group.items.map(card).join('')}</div>`
                        : `<div class="prog-cq-empty">${source ? 'Nenhum registro neste setor.' : status}</div>`}</section>`).join('') : '<div class="empty-state">Nenhum setor selecionado pertence à parte exibida. Limpe a seleção ou escolha outra parte.</div>'}
                </section>
            </section>`;
            container.querySelector('[data-cq-part]').addEventListener('change', event => onPart(event.target.value));
            container.querySelectorAll('[data-cq-availability]').forEach(select => {
                if (select.dataset.cqAvailability) {
                    select.addEventListener('change', () => onAvailability(select.dataset.cqAvailability, select.value));
                }
            });
            container.querySelector('[data-cq-clear]').addEventListener('click', onClear);
            container.querySelectorAll('[data-cq-sector]').forEach(button => button.addEventListener('click', () => onSector(button.dataset.cqSector)));
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
