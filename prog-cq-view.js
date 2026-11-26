(function(root) {
    'use strict';
    function watchImage(img) {
        const recover = () => {
            const fallback = img.dataset.fallbackSrc;
            if (fallback && new URL(fallback, img.ownerDocument.baseURI).href !== img.src) {
                img.src = fallback;
                return;
            }
            img.hidden = true;
            img.nextElementSibling.hidden = false;
        };
        img.addEventListener('error', recover);
        if (img.complete && !img.naturalWidth) recover();
    }

    function preparePrint(view) {
        if (view.querySelector('.prog-cq-print-report')) return;
        const doc = view.ownerDocument;
        const report = doc.createElement('div');
        report.className = 'prog-cq-print-report';
        for (const group of view.querySelectorAll('[data-cq-group]')) {
            const cards = [...group.querySelectorAll('.prog-cq-card')];
            const [part, sector] = group.dataset.cqGroup.split(':');
            for (let offset = 0; offset < cards.length; offset += 8) {
                const page = doc.createElement('section');
                page.className = 'prog-feira-print-page prog-cq-print-page';
                const sheet = doc.createElement('div');
                sheet.className = 'prog-feira-sector prog-cq-print-sheet';
                const header = doc.createElement('header');
                const title = doc.createElement('strong');
                title.textContent = `Prog CQ • Parte ${part} • Setor ${sector}${offset ? ' • continuação' : ''}`;
                const count = doc.createElement('em');
                const batch = cards.slice(offset, offset + 8);
                count.textContent = `${batch.length} ${batch.length === 1 ? 'produto' : 'produtos'}`;
                header.append(title, count);

                const grid = doc.createElement('div');
                grid.className = 'prog-feira-grid';
                for (const card of batch) {
                    const copy = card.cloneNode(true);
                    const img = copy.querySelector('img[data-fallback-src]');
                    if (img && !img.hidden) {
                        img.loading = 'eager';
                        watchImage(img);
                    }
                    grid.appendChild(copy);
                }
                sheet.append(header, grid);
                page.appendChild(sheet);
                report.appendChild(page);
            }
        }
        if (!report.childElementCount) report.textContent = 'Prog CQ • Nenhum produto para os filtros selecionados.';
        view.appendChild(report);
    }

    root.CRMProgCQView = {
        preparePrint,
        render(container, { filters, search, escape: esc, source, feiraDays, loading, image = () => ({}), onPart, onFilter, onSector, onClear }) {
            const api = root.CRMProgCQ;
            const selected = filters.sectors;
            const items = source?.records || [];
            const sectorDays = api.indexSectorDays(feiraDays || []);
            const parts = api.PARTS;
            const weekOptions = api.availableWeeks(items);
            const weeks = weekOptions.filter(week => filters.weeks?.includes(week));
            const weekSummary = weeks.length > 2 ? `${weeks.length} semanas` : weeks.join(', ') || 'Todas';
            const purchaseOrderUnavailable = source?.sourceSchemaVersion === 1;
            const recordFilters = purchaseOrderUnavailable ? { ...filters, purchaseOrder: 'all' } : filters;
            const filtered = api.filterAvailability(items, recordFilters);
            const visible = api.groups(items, { ...filters, search, weeks }).map(group => ({
                ...group, items: api.filterAvailability(group.items, recordFilters)
            }));
            const totals = new Map(parts.map(part => [part.code, 0]));
            for (const group of visible) totals.set(group.part, totals.get(group.part) + group.items.length);
            const totalLabel = selected.length ? 'Selecionados' : 'Total';
            const formatTotal = count => `${count.toLocaleString('pt-BR')} ${count === 1 ? 'produto' : 'produtos'}`;
            const counts = new Map(api.groups(filtered, { search, weeks }).map(group => [group.key, group.items.length]));
            const filterSelect = (key, label, options, disabled = false) => `<label class="prog-feira-parallel-filter"><span>${label}</span><select aria-label="${label}" data-cq-filter="${key}"${disabled ? ' disabled' : ''}>${options.map(([value, text]) => `<option value="${value}" ${(recordFilters[key] || 'all') === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
            const status = loading ? 'Carregando planilha' : !source ? 'Planilha indisponível'
                : source.isLive === false ? 'Exibindo última sincronização' : 'Dados sincronizados';
            const card = item => {
                const photo = image(item.codigo, item.numero);
                const days = sectorDays.get(api.sectorDaysKey(item));
                const andamento = api.orderProgressForWeeks(item.andamentoPedido, weeks).trim();
                const firstWeek = api.firstOrderWeek(item.andamentoPedido);
                const purchaseOrder = item.purchaseOrder;
                const purchaseOrderLabel = purchaseOrder ? `OC ${esc(purchaseOrder)}`
                    : purchaseOrder === '' ? 'SEM OC' : 'OC indisponível';
                return `<article class="prog-feira-card prog-cq-card">
                    <div class="prog-feira-card-top prog-cq-card-top">
                        <strong>${esc(item.codigo)}</strong>
                        ${firstWeek ? `<strong class="prog-cq-card-week" title="Semana do pedido">${firstWeek}</strong>` : ''}
                        ${item.numero ? `<strong class="prog-cq-card-of">OF ${esc(item.numero)}</strong>` : ''}
                    </div>
                    <div class="prog-feira-media">${photo.hasImage ? `<img class="prog-feira-image" src="${esc(photo.thumbUrl)}" data-fallback-src="${esc(photo.proxyUrl || '')}" alt="${esc(item.codigo)}" loading="lazy"><span class="prog-feira-image-empty" hidden>Imagem indisponível</span>` : '<span class="prog-feira-image-empty">Imagem indisponível</span>'}</div>
                    <div class="prog-feira-card-body">
                        <div class="prog-cq-sector-days"><strong>${days == null ? '—' : days.toLocaleString('pt-BR')}</strong><span>Dias parados no setor</span></div>
                        ${item.aviamentoPendente ? '<strong class="prog-cq-trim-pending">AV. PENDENTE CQ</strong>' : ''}
                        <strong class="prog-cq-purchase-order${purchaseOrder === '' ? ' prog-cq-purchase-order-missing' : ''}">${purchaseOrderLabel}</strong>
                        ${item.descricao ? `<strong>${esc(item.descricao)}</strong>` : ''}
                        <p class="prog-cq-order-progress${andamento ? '' : ' prog-cq-order-missing'}"><strong>Andamento do pedido</strong><span>${esc(andamento || 'Não informado')}</span></p>
                    </div>
                </article>`;
            };
            const previousWeekMenu = container.querySelector('[data-cq-week-menu]');
            const weekMenuOpen = Boolean(previousWeekMenu?.open);
            const weekScroll = weekMenuOpen ? previousWeekMenu.querySelector('[data-cq-week-options]').scrollTop : 0;
            const activeControl = container.ownerDocument?.activeElement;
            let weekFocus;
            if (activeControl && previousWeekMenu?.contains(activeControl)) {
                weekFocus = activeControl.matches('[data-cq-week]')
                    ? `[data-cq-week][value="${activeControl.value}"]`
                    : activeControl.matches('[data-cq-weeks-clear]') ? '[data-cq-weeks-clear]' : 'summary';
            }
            container.innerHTML = `<section class="prog-feira-view prog-cq-view">
                <header class="module-view-header"><h2>Prog CQ</h2><p>Andamento das amostras de controle de qualidade • Partes F6 e F7</p></header>
                <div class="table-card prog-cq-source" role="status"><strong>${status}</strong> <a class="exec-action-btn" href="${esc(api.SOURCE.url)}" target="_blank" rel="noopener noreferrer">Abrir planilha Prog CQ</a></div>
                <div class="prog-feira-toolbar">
                    <label class="prog-feira-parallel-filter"><span>Parte</span><select data-cq-part aria-label="Parte Prog CQ"><option value="all" ${filters.part === 'all' ? 'selected' : ''}>Todas as partes</option>${parts.map(part => `<option value="${part.code}" ${filters.part === part.code ? 'selected' : ''}>Parte ${part.code}</option>`).join('')}</select></label>
                    ${filterSelect('mesh', 'Situação malha', [['all','Todas'],['available','Tem malha'],['missing','Sem malha'],['unknown','Não informada']])}
                    ${filterSelect('trims', 'Aviamento', [['all','Todos'],['available','Com aviamento'],['missing','Sem aviamento']])}
                    ${filterSelect('purchaseOrder', 'Ordem de compra',
                        purchaseOrderUnavailable ? [['all','Indisponível']] : [['all','Todas'],['with','Com OC'],['without','Sem OC']],
                        purchaseOrderUnavailable)}
                    <div class="prog-feira-parallel-filter">
                        <span id="prog-cq-week-label">Semana</span>
                        <details class="follow-multi prog-cq-week-menu" data-cq-week-menu>
                            <summary aria-labelledby="prog-cq-week-label prog-cq-week-summary"><span id="prog-cq-week-summary">${weekSummary}</span></summary>
                            <div class="follow-multi-options" data-cq-week-options>
                                <button type="button" data-cq-weeks-clear>Todas / limpar seleção</button>
                                ${weekOptions.map(week => `<label><input type="checkbox" data-cq-week value="${week}" ${weeks.includes(week) ? 'checked' : ''}><span>${week}</span></label>`).join('')}
                                ${weekOptions.length ? '' : '<p>Nenhuma semana disponível.</p>'}
                            </div>
                        </details>
                    </div>
                    <div class="prog-feira-sector-selection"><strong>Setores:</strong><span>${selected.length ? selected.map(esc).join(', ') : 'Todos'}</span></div>
                    <button type="button" class="filter-clear-btn" data-cq-clear>Limpar filtros</button>
                </div>
                ${source && filters.part === 'all' ? `<p class="prog-cq-total prog-cq-total-all" data-cq-total="all">${totalLabel} nas duas partes · ${formatTotal([...totals.values()].reduce((sum, count) => sum + count, 0))}</p>` : ''}
                ${parts.filter(part => filters.part === 'all' || filters.part === part.code).map(part => {
                    const max = Math.max(1, ...part.sectors.map(sector => counts.get(api.sectorKey(part.code, sector)) || 0));
                    return `
                    <section class="prog-feira-distribution prog-cq-distribution" aria-label="Produtos por setor da Parte ${part.code}">
                        <header class="prog-cq-chart-header">
                            <h3>Produtos por setor • Parte ${part.code}</h3>
                            ${source ? `<strong class="prog-cq-total" data-cq-total="${part.code}">${totalLabel} · ${formatTotal(totals.get(part.code))}</strong>` : '<span>Quantidades ainda não disponíveis</span>'}
                        </header>
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
            container.querySelectorAll('img[data-fallback-src]').forEach(watchImage);
            container.querySelector('[data-cq-part]').addEventListener('change', event => onPart(event.target.value));
            container.querySelectorAll('[data-cq-filter]').forEach(select => {
                select.addEventListener('change', () => onFilter(select.dataset.cqFilter, select.value));
            });
            const weekMenu = container.querySelector('[data-cq-week-menu]');
            weekMenu.open = weekMenuOpen;
            if (weekMenuOpen) weekMenu.querySelector('[data-cq-week-options]').scrollTop = weekScroll;
            if (weekFocus) {
                (weekMenu.querySelector(weekFocus) || weekMenu.querySelector('summary')).focus({ preventScroll: true });
            }
            weekMenu.addEventListener('change', () => {
                const values = Array.from(weekMenu.querySelectorAll('[data-cq-week]:checked'), checkbox => checkbox.value);
                onFilter('weeks', values);
            });
            container.querySelector('[data-cq-weeks-clear]').addEventListener('click', () => onFilter('weeks', []));
            container.querySelector('[data-cq-clear]').addEventListener('click', () => {
                weekMenu.open = false;
                onClear();
            });
            container.querySelectorAll('[data-cq-sector]').forEach(button => button.addEventListener('click', () => onSector(button.dataset.cqSector)));
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
