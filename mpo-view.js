(function () {
    const state = { result: null, filter: '', search: '', sequence: 0, loading: false };
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const labels = { joyce: 'Joyce', rayza: 'Rayza', ana: 'Ana', quadro: 'Liberação de Quadro', mesa_amostra: 'Mesa de Amostra', sem_pendencia: 'Sem Pendências' };
    const safeImage = value => {
        try {
            const url = new URL(value);
            return url.origin === 'https://mpo.136-248-111-213.sslip.io' && /^\/(?:workspaces\/[A-Za-z0-9_-]+\/)?images\//.test(url.pathname) ? url.href : '';
        } catch { return ''; }
    };
    function responsibleKeys(summary, item) {
        return Object.keys(labels).filter(key => summary.por_responsavel?.[key]?.itens.some(member => member.key === item.key));
    }
    function visibleItems(summary) {
        const query = state.search.toLocaleLowerCase('pt-BR');
        return (summary?.todas_pecas || []).filter(item => {
            const people = responsibleKeys(summary, item);
            return (!state.filter || people.includes(state.filter)) && [item.ref, item.cliente, item.fase, item.data_entrega, ...(item.pendencias || []), ...Object.values(item.previsoes || {}), item.obs_gerais, ...people.map(key => labels[key]), ...(item.sources || []).map(source => source.name)].join(' ').toLocaleLowerCase('pt-BR').includes(query);
        });
    }
    function cards(summary, items) {
        return items.map(item => {
            const image = safeImage(item.image_full_url);
            const sheet = safeImage(item.folha_full_url);
            const people = responsibleKeys(summary, item);
            const names = [...new Set((item.sources || []).map(source => source.name).filter(Boolean))];
            return `<article class="mpo-card">${image ? `<a href="${escape(image)}" target="_blank" rel="noopener"><img src="${escape(image)}" alt="Ficha ${escape(item.ref)}" loading="lazy"></a>` : '<div class="mpo-empty">Sem imagem disponível</div>'}<div class="mpo-body"><h3>${escape(item.ref)}</h3><div class="mpo-people">${people.map(key => `<span class="mpo-person mpo-${key}">${escape(labels[key])}</span>`).join('')}</div><p>${escape(item.cliente)} · ${escape(item.fase)}</p><p>Entrega: ${escape(item.data_entrega || 'Não informada')} · Folha ${escape(item.folha ?? 'Não informada')}</p>${names.length ? `<p>Documento de origem: ${escape(names.join(', '))}</p>` : ''}${(item.pendencias || []).map(p => `<p class="mpo-pendency">${escape(p)}${item.previsoes?.[p] ? ` — ${escape(item.previsoes[p])}` : ''}</p>`).join('')}${Object.entries(item.previsoes || {}).filter(([name]) => !(item.pendencias || []).includes(name)).map(([name, value]) => `<p>Previsão ${escape(name)}: ${escape(value)}</p>`).join('')}${item.obs_gerais ? `<p>Observações: ${escape(item.obs_gerais)}</p>` : ''}${sheet ? `<a href="${escape(sheet)}" target="_blank" rel="noopener">Abrir folha completa</a>` : ''}</div></article>`;
        }).join('');
    }
    function paintCards(container) {
        const summary = state.result?.summary;
        const items = visibleItems(summary);
        container.querySelector('#mpo-cards').innerHTML = cards(summary, items);
        container.querySelector('#mpo-empty-result').hidden = items.length > 0;
        container.querySelector('#mpo-visible-count').textContent = `${items.length} fichas neste filtro`;
        container.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(state.filter === button.dataset.filter)));
        container.querySelectorAll('.mpo-card').forEach((card, index) => {
            const img = card.querySelector('img');
            if (!img) return;
            const alternatives = (items[index].image_urls || []).map(safeImage).filter(url => url && url !== img.src);
            img.onerror = () => {
                const next = alternatives.shift();
                if (next) { img.parentElement.href = next; img.src = next; }
                else { const empty = document.createElement('div'); empty.className = 'mpo-empty'; empty.textContent = 'Imagem indisponível no MPO'; img.parentElement.replaceWith(empty); }
            };
        });
    }
    function paint(container, error = '') {
        const summary = state.result?.summary;
        const date = state.result?.fetchedAt ? new Date(state.result.fetchedAt).toLocaleString('pt-BR') : '';
        container.innerHTML = `<section class="mpo-view" aria-busy="${state.loading}"><div class="mpo-toolbar"><h2>MPO — Pendências por responsável</h2><button id="mpo-refresh" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Sincronizando…' : 'Sincronizar MPO'}</button></div><p>Fichas e pendências disponíveis no MPO. Os totais por responsável podem se sobrepor.</p>${error ? `<p class="mpo-warning" role="alert">${escape(error)}</p>` : ''}${state.result?.warning ? `<p class="mpo-warning" role="alert">${escape(state.result.warning)}</p>` : ''}${summary ? `<p class="mpo-sync-status" role="status">${state.result.stale ? 'Última consulta salva' : 'Última sincronização'}: ${escape(date)}</p><p>${summary.workspace.total_pecas} fichas · ${summary.workspace.total_com_pendencia} com pendências · ${summary.workspace.total_sem_pendencia} sem pendências</p><div class="mpo-filters"><button data-filter="">Todos</button>${Object.entries(labels).map(([key, label]) => `<button class="mpo-${key}" data-filter="${key}">${escape(label)} (${summary.por_responsavel?.[key]?.total_pecas || 0})</button>`).join('')}</div><label class="mpo-search-label" for="mpo-search">Buscar nas fichas</label><input id="mpo-search" type="search" placeholder="Pessoa, produto, pendência, previsão ou entrega" value="${escape(state.search)}"><p id="mpo-visible-count" role="status"></p><div id="mpo-cards" class="mpo-grid"></div><p id="mpo-empty-result">Nenhuma ficha neste filtro.</p>` : `<p role="status">${state.loading ? 'Consultando a memória disponível do MPO…' : 'Clique em Sincronizar MPO para consultar as fichas disponíveis.'}</p>`}</section>`;
        container.querySelector('#mpo-refresh').onclick = () => load(container);
        if (summary) {
            paintCards(container);
            container.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { state.filter = button.dataset.filter; paintCards(container); });
            container.querySelector('#mpo-search').oninput = event => { state.search = event.target.value; paintCards(container); };
        }
    }
    async function load(container) {
        const sequence = ++state.sequence;
        state.loading = true;
        paint(container);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        try {
            const response = await fetch('/api/mpo/pending-by-person', { cache: 'no-store', signal: controller.signal });
            const result = await response.json();
            if (!response.ok || !result.summary || !Array.isArray(result.summary.todas_pecas)) throw new Error(result.error || 'Falha ao consultar MPO');
            if (sequence !== state.sequence || !container.querySelector('.mpo-view')) return;
            state.result = result;
            state.loading = false;
            paint(container);
        } catch (error) {
            if (sequence === state.sequence && container.querySelector('.mpo-view')) {
                state.loading = false;
                if (state.result) state.result = { ...state.result, stale: true };
                paint(container, error.name === 'AbortError' ? 'A consulta demorou demais. Tente sincronizar novamente.' : error.message);
            }
        } finally { clearTimeout(timeout); }
    }
    window.renderMpoView = load;
})();
