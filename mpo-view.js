(function () {
    const state = { workspace: '', data: null, programs: [], filter: '', search: '', sequence: 0 };
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const labels = {joyce:'Joyce',rayza:'Rayza',ana:'Ana',quadro:'Liberação de Quadro',mesa_amostra:'Mesa de Amostra',sem_pendencia:'Sem Pendências'};
    function paint(container, error = '') {
        const summary = state.data;
        const allowed = state.filter ? new Set((summary?.por_responsavel?.[state.filter]?.itens || []).map(i => String(i.id))) : null;
        const items = (summary?.todas_pecas || []).filter(i => (!allowed || allowed.has(String(i.id))) && [i.ref,i.cliente,i.fase,...(i.pendencias || []),i.obs_gerais].join(' ').toLowerCase().includes(state.search.toLowerCase()));
        container.innerHTML = `<section class="mpo-view"><h2>MPO — Mapa de Produção Otimizado</h2><label>Programação <select id="mpo-program"><option value="">Selecione uma programação</option>${state.programs.map(p => `<option value="${escape(p.id)}" ${p.id===state.workspace?'selected':''}>${escape(p.nome)}</option>`).join('')}</select></label><button id="mpo-refresh">Atualizar</button>${error?`<p role="alert">${escape(error)}</p>`:''}${!state.programs.length?'<p>Nenhuma programação B41, B42 ou outra B + número está publicada pelo MPO. Os nomes precisam estar disponíveis na API do MPO.</p>':''}${summary?`<p>${escape(summary.workspace.nome)} · ${summary.workspace.total_pecas} produtos · ${summary.workspace.total_com_pendencia} com pendências · ${summary.workspace.total_sem_pendencia} liberados</p><div class="mpo-filters"><button data-filter="">Todos</button>${Object.entries(labels).map(([key,label])=>`<button data-filter="${key}" ${state.filter===key?'aria-pressed="true"':''}>${label} (${summary.por_responsavel?.[key]?.total_pecas || 0})</button>`).join('')}</div><input id="mpo-search" type="search" placeholder="Buscar produto, cliente ou pendência" value="${escape(state.search)}"><div class="mpo-grid">${items.map(i=>`<article class="mpo-card">${i.image_full_url?`<a href="${escape(i.image_full_url)}" target="_blank" rel="noopener"><img src="${escape(i.image_full_url)}" alt="${escape(i.ref)}" loading="lazy"></a>`:'<div class="mpo-empty">Sem imagem disponível</div>'}<div class="mpo-body"><h3>${escape(i.ref)}</h3><p>${escape(i.cliente)} · ${escape(i.fase)}</p><p>Entrega: ${escape(i.data_entrega || 'Não informada')} · Folha ${escape(i.folha)}</p>${(i.pendencias || []).map(p=>`<p class="mpo-pendency">${escape(p)}${i.previsoes?.[p]?` — ${escape(i.previsoes[p])}`:''}</p>`).join('')}${i.obs_gerais?`<p>${escape(i.obs_gerais)}</p>`:''}${i.folha_full_url?`<a href="${escape(i.folha_full_url)}" target="_blank" rel="noopener">Abrir folha completa</a>`:''}</div></article>`).join('')}</div>${!items.length?'<p>Nenhum produto neste filtro.</p>':''}`:'<p>Escolha uma programação para consultar produtos e pendências.</p>'}</section>`;
        container.querySelector('#mpo-program').onchange = e => {state.workspace=e.target.value;state.filter='';state.search='';state.data=null;load(container);};
        container.querySelector('#mpo-refresh').onclick = () => load(container);
        container.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;paint(container);});
        const search=container.querySelector('#mpo-search');
        if(search) search.onchange=e=>{state.search=e.target.value;paint(container);};
    }
    async function load(container) {
        const sequence=++state.sequence;
        paint(container);
        try {
            const response=await fetch('/api/mpo'+(state.workspace?'?workspace='+encodeURIComponent(state.workspace):''), {cache:'no-store'});
            const result=await response.json();
            if(!response.ok) throw new Error(result.error || 'Falha ao consultar MPO');
            if(sequence!==state.sequence || !container.querySelector('.mpo-view')) return;
            state.programs=result.programs;state.data=result.summary || null;paint(container);
        } catch(error) {if(sequence===state.sequence && container.querySelector('.mpo-view')) {state.data=null;paint(container,error.message);}}
    }
    window.renderMpoView=load;
})();
