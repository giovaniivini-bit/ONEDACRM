(function(root) {
    root.CRMAutomaticReportsView = { render(container, { reports, selected, loading, error, escape: esc, image, choose, refresh, remove, deleting }) {
        const date = value => new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
        container.innerHTML = `<section class="automatic-reports-view">
            <div class="module-view-header"><h2>Relatórios automáticos</h2><p>Gerados a cada sincronização: relatórios gerais e pendências de pedidos e amostras por estilista. Abra uma versão para consultar os cards ou o PDF já pronto.</p><button class="exec-action-btn" data-reports-refresh>Atualizar lista</button></div>
            ${loading ? '<p role="status">Carregando relatórios...</p>' : ''}
            ${error ? `<p class="badge badge-rose" role="alert">${esc(error)}</p>` : ''}
            <div class="automatic-reports-history table-card"><h3>Histórico de relatórios</h3>
                ${reports.length ? reports.map((r,i) => `<div class="automatic-report-row"><button type="button" class="automatic-report-entry ${selected?.id===r.id?'selected':''}" data-report-index="${i}" ${r.deletionPending?'disabled':''}><strong>${esc(r.title)}</strong>${r.deletionPending?'<span>Exclusão pendente</span>':''}<span>${esc(date(r.generatedAt))} • ${r.count} ${esc(r.countLabel || (r.type==='cores'?'pendências':'produtos'))} • Referência ${esc(r.referenceDay.split('-').reverse().join('/'))}</span></button><button type="button" class="automatic-report-delete" data-report-delete="${i}" ${deleting?'disabled':''} aria-label="Excluir relatório ${esc(r.title)} de ${esc(date(r.generatedAt))}">${r.deletionPending?'Tentar exclusão':'Excluir PDF'}</button></div>`).join('') : '<p>Nenhum relatório gerado. A próxima sincronização bem-sucedida criará os oito relatórios, mesmo quando não houver pendências.</p>'}
            </div>
            ${selected ? `<article class="automatic-report-detail">
                <div class="table-card automatic-report-intro"><h2>${esc(selected.title)}</h2><p>${esc(selected.description)}</p><p>Referência: ${esc(selected.referenceDay.split('-').reverse().join('/'))} • Gerado em ${esc(date(selected.generatedAt))} • Fonte sincronizada em ${esc(date(selected.sourceTimestamp))} • ${selected.items.length} ${esc(selected.countLabel || (selected.type==='cores'?'pendências':'produtos'))}${selected.stylist?` • ${selected.uniqueProducts} produtos/OFs`:''}</p>${selected.warnings?`<p class="badge badge-amber">${esc(selected.warnings)}</p>`:''}<a class="btn btn-primary" href="/api/automatic-reports?id=${encodeURIComponent(selected.id)}&format=pdf" target="_blank" rel="noopener">Abrir PDF gerado</a></div>
                ${selected.sourceTimestamps?`<p class="automatic-report-sources">PEDIDO: ${esc(date(selected.sourceTimestamps.pedido))} • AMOSTRA: ${esc(date(selected.sourceTimestamps.amostra))}</p>`:''}
                ${selected.items.length || selected.sections ? root.CRMAutomaticReportGroups.groupReportItems(selected).map(group => `<section class="automatic-report-group ${selected.grouping==='delivery'?'automatic-report-date-group':''}">${group.title?`<h3>${esc(group.title)} <small>${group.items.length} produtos</small></h3>`:''}<div class="automatic-report-cards">${group.items.map(item => {
                    const img=image(item.imageCode,item.numero);
                    return `<article class="prog-feira-card"><div class="prog-feira-card-top"><strong>${esc(item.codigo)}</strong>${item.numero?`<span>OF ${esc(item.numero)}</span>`:''}</div><div class="prog-feira-media">${img.hasImage ? `<img src="${esc(img.thumbUrl)}" data-report-fallback="${esc(img.proxyUrl||'')}" alt="${esc(item.codigo)}" loading="lazy">`:'<span>Imagem indisponível</span>'}</div><div class="prog-feira-card-body"><strong class="automatic-report-reason">${esc(item.reason)}</strong><p>${esc(item.sector)} • ${esc(item.sectorLabel)}</p><p>${esc(item.detailLabel||'Entrega')}: ${esc(item.delivery||'Não informada')}</p>${item.customerProgram?`<p>Programação: ${esc(item.customerProgram)}</p>`:''}${item.etiqueta?`<p>Etiqueta: ${esc(item.etiqueta)}</p>`:''}${item.responsible?`<p>Responsável: ${esc(item.responsible)}</p>`:''}${item.description?`<p>${esc(item.description)}</p>`:''}${item.quantity!=null?`<p>Peças: ${item.quantity}</p>`:''}${item.styleStatus?`<p>Status: ${esc(item.styleStatus)}</p>`:''}${item.daysInSector!=null?`<p>${item.daysInSector} dias no setor</p>`:''}${item.notes?`<p>Observação: ${esc(item.notes)}</p>`:''}</div></article>`;
                }).join('') || '<p>Nenhuma pendência neste grupo.</p>'}</div></section>`).join('') : '<p>Nenhum produto atende aos critérios nesta sincronização.</p>'}
            </article>` : ''}
        </section>`;
        container.querySelector('[data-reports-refresh]').addEventListener('click',refresh);
        container.querySelectorAll('[data-report-index]').forEach(el=>el.addEventListener('click',()=>choose(reports[Number(el.dataset.reportIndex)].id)));
        container.querySelectorAll('[data-report-delete]').forEach(el=>el.addEventListener('click',()=>remove(reports[Number(el.dataset.reportDelete)].id)));
        container.querySelectorAll('[data-report-fallback]').forEach(img=>img.addEventListener('error',()=>{
            if(img.dataset.tried||!img.dataset.reportFallback) {img.hidden=true;return;}
            img.dataset.tried='1'; img.src=img.dataset.reportFallback;
        }));
    }};
})(typeof window!=='undefined'?window:globalThis);
