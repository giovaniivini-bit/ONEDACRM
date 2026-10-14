(function () {
    const state = { result:null, filter:'', group:'', delivery:'', layout:'delivery', search:'', sequence:0, loading:false };
    const filters=window.CRMMpoFilters;
    const labels=filters.people;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const safeImage = value => {
        try {
            const url=new URL(value);
            return url.origin==='https://mpo.136-248-111-213.sslip.io' && /^\/(?:workspaces\/[A-Za-z0-9_-]+\/)?images\//.test(url.pathname) ? url.href : '';
        } catch { return ''; }
    };
    function selection(overrides={}) {
        return {person:state.filter,group:state.group,delivery:state.delivery,search:state.search,...overrides};
    }
    function cards(summary,items) {
        return items.map(item => {
            const image=safeImage(item.image_full_url), sheet=safeImage(item.folha_full_url);
            const people=filters.responsibleKeys(summary,item);
            const names=[...new Set((item.sources || []).map(source=>source.name).filter(Boolean))];
            const pendencies=(item.pendencias || []).map(text => {
                const kind=Object.keys(filters.groups).find(key=>filters.groups[key].text===filters.normalize(text));
                const label=kind ? filters.groups[kind].label : text;
                return `<div class="mpo-pendency-block" ${kind===state.group ? 'data-selected="true"' : ''}><strong>${escape(label)}</strong>${item.previsoes?.[text] ? `<p>Previsão / informação: ${escape(item.previsoes[text])}</p>` : ''}</div>`;
            }).join('');
            return `<article class="mpo-card" data-key="${escape(item.key)}">${image ? `<a href="${escape(image)}" target="_blank" rel="noopener"><img src="${escape(image)}" alt="Ficha ${escape(item.ref)}" loading="lazy"></a>` : '<div class="mpo-empty">Sem imagem disponível</div>'}<div class="mpo-body"><h3>${escape(item.ref)}</h3><div class="mpo-people">${people.map(key=>`<span class="mpo-person mpo-${key}">${escape(labels[key])}</span>`).join('')}</div><p>${escape(item.cliente)} · ${escape(item.fase)}</p><p>Entrega: ${escape(filters.deliveryInfo(item.data_entrega).label)} · Folha ${escape(item.folha ?? 'Não informada')}</p>${names.length ? `<p>Documento de origem: ${escape(names.join(', '))}</p>` : ''}${pendencies}${Object.entries(item.previsoes || {}).filter(([name])=>!(item.pendencias || []).includes(name)).map(([name,value])=>`<p>Previsão ${escape(name)}: ${escape(value)}</p>`).join('')}${item.obs_gerais ? `<p>Observações: ${escape(item.obs_gerais)}</p>` : ''}${sheet ? `<a href="${escape(sheet)}" target="_blank" rel="noopener">Abrir folha completa</a>` : ''}</div></article>`;
        }).join('');
    }
    function paintCards(container) {
        const summary=state.result.summary;
        const items=filters.filterItems(summary,selection());
        const availableGroups=Object.entries(filters.groups);
        container.querySelector('#mpo-group-filters').innerHTML=`<button data-pendency="" aria-pressed="${!state.group}">Todas as pendências</button>${availableGroups.map(([key,group])=>`<button class="mpo-${group.person}" data-pendency="${key}" aria-pressed="${state.group===key}">${escape(group.label)} (${filters.filterItems(summary,selection({group:key})).length})</button>`).join('')}`;
        const dates=filters.groupDeliveries(filters.filterItems(summary,selection({delivery:''})));
        container.querySelector('#mpo-date-filters').innerHTML=`<button data-delivery="" aria-pressed="${!state.delivery}">Todas as datas (${dates.reduce((total,date)=>total+date.items.length,0)})</button>${dates.map(date=>`<button data-delivery="${escape(date.key)}" aria-pressed="${state.delivery===date.key}">${escape(date.label)} (${date.items.length})</button>`).join('')}${state.delivery && !dates.some(date=>date.key===state.delivery) ? `<button data-delivery="${escape(state.delivery)}" aria-pressed="true">Data selecionada — sem fichas (0)</button>` : ''}`;
        container.querySelector('#mpo-cards').innerHTML=state.layout==='delivery'
            ? filters.groupDeliveries(items).map(date=>`<section class="mpo-delivery-group"><h3 class="mpo-delivery-heading">Entrega: ${escape(date.label)} <span>${date.items.length} fichas</span></h3><div class="mpo-grid">${cards(summary,date.items)}</div></section>`).join('')
            : `<div class="mpo-grid">${cards(summary,items)}</div>`;
        container.querySelector('#mpo-empty-result').hidden=items.length>0;
        container.querySelector('#mpo-visible-count').textContent=`${items.length} fichas neste filtro`;
        container.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(state.filter===button.dataset.filter)));
        container.querySelectorAll('[data-pendency]').forEach(button=>button.onclick=()=>{state.group=button.dataset.pendency;paintCards(container);});
        container.querySelectorAll('[data-delivery]').forEach(button=>button.onclick=()=>{state.delivery=button.dataset.delivery;paintCards(container);});
        const byKey=new Map(items.map(item=>[item.key,item]));
        container.querySelectorAll('.mpo-card').forEach(card=>{
            const img=card.querySelector('img');
            if(!img) return;
            const alternatives=(byKey.get(card.dataset.key)?.image_urls || []).map(safeImage).filter(url=>url && url!==img.src);
            img.onerror=()=>{
                const next=alternatives.shift();
                if(next) {img.parentElement.href=next;img.src=next;}
                else {const empty=document.createElement('div');empty.className='mpo-empty';empty.textContent='Imagem indisponível no MPO';img.parentElement.replaceWith(empty);}
            };
        });
    }
    function paint(container,error='') {
        const summary=state.result?.summary;
        const date=state.result?.fetchedAt ? new Date(state.result.fetchedAt).toLocaleString('pt-BR') : '';
        container.innerHTML=`<section class="mpo-view" aria-busy="${state.loading}"><div class="mpo-toolbar"><h2>MPO — Pendências por responsável</h2><button id="mpo-refresh" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Sincronizando…' : 'Sincronizar MPO'}</button></div><p>Os filtros de responsável, pendência e entrega funcionam juntos. Uma ficha pode ter combinação e terceiros; os contadores podem se sobrepor.</p>${error ? `<p class="mpo-warning" role="alert">${escape(error)}</p>` : ''}${state.result?.warning ? `<p class="mpo-warning" role="alert">${escape(state.result.warning)}</p>` : ''}${summary ? `<p class="mpo-sync-status" role="status">${state.result.stale ? 'Última consulta salva' : 'Última sincronização'}: ${escape(date)}</p><p>${summary.workspace.total_pecas} fichas · ${summary.workspace.total_com_pendencia} com pendências · ${summary.workspace.total_sem_pendencia} sem pendências</p><div class="mpo-filter-panel"><h3>Responsável</h3><div class="mpo-filters"><button data-filter="">Todos</button>${Object.entries(labels).map(([key,label])=>`<button class="mpo-${key}" data-filter="${key}">${escape(label)} (${summary.por_responsavel?.[key]?.total_pecas || 0})</button>`).join('')}</div><h3>Grupo de pendência independente</h3><div id="mpo-group-filters" class="mpo-filters"></div><h3>Data de entrega</h3><div id="mpo-date-filters" class="mpo-filters"></div><div class="mpo-filter-actions"><label for="mpo-layout">Exibir imagens <select id="mpo-layout"><option value="delivery" ${state.layout==='delivery' ? 'selected' : ''}>Agrupadas por data de entrega</option><option value="cards" ${state.layout==='cards' ? 'selected' : ''}>Grade de fichas</option></select></label><button id="mpo-clear">Limpar filtros</button></div></div><label class="mpo-search-label" for="mpo-search">Buscar nas fichas</label><input id="mpo-search" type="search" placeholder="Pessoa, produto, pendência, previsão ou entrega" value="${escape(state.search)}"><p id="mpo-visible-count" role="status"></p><div id="mpo-cards"></div><p id="mpo-empty-result">Nenhuma ficha neste filtro. Use Limpar filtros para ver todas.</p>` : `<p role="status">${state.loading ? 'Consultando a memória disponível do MPO…' : 'Clique em Sincronizar MPO para consultar as fichas disponíveis.'}</p>`}</section>`;
        container.querySelector('#mpo-refresh').onclick=()=>load(container);
        if(summary) {
            paintCards(container);
            container.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{state.filter=button.dataset.filter;paintCards(container);});
            container.querySelector('#mpo-search').oninput=event=>{state.search=event.target.value;paintCards(container);};
            container.querySelector('#mpo-layout').onchange=event=>{state.layout=event.target.value;paintCards(container);};
            container.querySelector('#mpo-clear').onclick=()=>{state.filter='';state.group='';state.delivery='';state.search='';container.querySelector('#mpo-search').value='';paintCards(container);};
        }
    }
    async function load(container) {
        const sequence=++state.sequence;
        state.loading=true;
        paint(container);
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),25000);
        try {
            const response=await fetch('/api/mpo/pending-by-person',{cache:'no-store',signal:controller.signal});
            const result=await response.json();
            if(!response.ok || !result.summary || !Array.isArray(result.summary.todas_pecas)) throw new Error(result.error || 'Falha ao consultar MPO');
            if(sequence!==state.sequence || !container.querySelector('.mpo-view')) return;
            state.result=result;state.loading=false;paint(container);
        } catch(error) {
            if(sequence===state.sequence && container.querySelector('.mpo-view')) {
                state.loading=false;
                if(state.result) state.result={...state.result,stale:true};
                paint(container,error.name==='AbortError' ? 'A consulta demorou demais. Tente sincronizar novamente.' : error.message);
            }
        } finally {clearTimeout(timeout);}
    }
    window.renderMpoView=load;
})();
