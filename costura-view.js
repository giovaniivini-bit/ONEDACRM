(function(root,factory) {
    const api=factory(typeof module==='object'&&module.exports ? require('./costura') : root.CRMCostura);
    if(typeof module==='object'&&module.exports) module.exports=api;
    if(root) root.CRMCosturaView=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(engine) {
    'use strict';
    const url='https://docs.google.com/spreadsheets/d/1h04pHGE4wYZ3FnhAT3M-IeSB8pIFAi-RHdsqwKxwMwU/edit#gid=2024325688';
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fmt=(n,d=0)=>n===null||n===undefined||!Number.isFinite(n)?'—':n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
    const date=key=>key?key.split('-').reverse().join('/'):'—';
    const period=w=>`${date(w.start)} a ${date(w.end)}`;
    const percent=n=>n===null?'—':fmt(n,1)+'%';
    const sum=values=>values.reduce((a,b)=>a+b,0);
    const kpi=(title,value,note='')=>`<article class="sw-kpi"><span>${title}</span><strong>${value}</strong><small>${note}</small></article>`;

    function weekDetails(w) {
        const maximum=Math.max(1,...w.values,w.dailyTarget||0);
        const activities=new Map();
        w.people.forEach(p=>p.activities.forEach(a=>activities.set(a.label,(activities.get(a.label)||0)+a.total)));
        return `<section class="sw-panel sw-week-details" data-sw-week="${esc(w.id)}">
            <header><h3>Produção por dia e por costureira</h3><span>${period(w)}</span></header>
            <div class="sw-daily-chart" role="img" aria-label="Entregas diárias e meta diária da costura">
                ${w.dates.map((d,i)=>`<div class="sw-day"><div class="sw-day-plot"><div class="sw-day-bar" style="height:${w.values[i]*100/maximum}%"><b>${fmt(w.values[i])}</b></div>${w.dailyTarget!==null?`<i class="sw-target-line" style="bottom:${Math.min(100,w.dailyTarget*100/maximum)}%" title="Meta diária: ${fmt(w.dailyTarget,1)}"></i>`:''}</div><strong>${['Seg','Ter','Qua','Qui','Sex'][i]||''}</strong><small>${date(d).slice(0,5)}</small></div>`).join('')}
            </div>
            <p class="sw-caption">Barras: referências entregues. ${w.dailyTarget!==null?`Linha tracejada: meta diária exata de ${fmt(w.dailyTarget,1)}.`:'Meta diária não informada.'} Sem lançamento na planilha: zero contabilizado.</p>
            <div class="sw-people-cards">${w.people.map(p=>`<article><span>${esc(p.name)}</span><strong>${fmt(p.total)}</strong><small>${percent(p.share)} da produção da semana</small><p>Média: <b>${fmt(p.average,1)}</b> por dia</p></article>`).join('')}</div>
            <div class="sw-table-wrap"><table class="sw-table"><thead><tr><th>Costureira</th>${w.dates.map(d=>`<th>${date(d).slice(0,5)}</th>`).join('')}<th>Total</th><th>Média/dia</th></tr></thead><tbody>${w.people.map(p=>`<tr><th>${esc(p.name)}</th>${p.values.map(n=>`<td>${fmt(n)}</td>`).join('')}<td><b>${fmt(p.total)}</b></td><td>${fmt(p.average,1)}</td></tr>`).join('')}<tr class="sw-total"><th>Total entregue</th>${w.values.map(n=>`<td>${fmt(n)}</td>`).join('')}<td>${fmt(w.total)}</td><td>${fmt(w.average,1)}</td></tr></tbody></table></div>
            <div class="sw-two-columns"><section><h4>Entregas por atividade</h4><div class="sw-breakdown">${[...activities].map(([label,n])=>`<div><span>${esc(label)}</span><strong>${fmt(n)}</strong><small>${percent(w.total?n*100/w.total:0)}</small></div>`).join('')}</div></section>
            <section><h4>Composição da meta semanal</h4><div class="sw-breakdown">${w.targets.length?w.targets.map(t=>`<div><span>${esc(t.label)}</span><strong>${fmt(t.value)}</strong></div>`).join(''):'<p>Meta não informada para este período.</p>'}</div><p class="sw-caption">Meta total: <b>${fmt(w.target)}</b> referências.</p></section></div>
        </section>`;
    }

    function header(payload,options={}) {
        const sourceStamp=payload?.timestamp?new Date(payload.timestamp).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Ainda não carregada';
        return `            <header class="sw-heading"><div><h2><i class="fa-solid fa-scissors"></i> Produção time de amostras</h2><p>${options.team==='cutting'?'Ações por colaborador, produção diária e evolução do corte.':'Meta de entrega, produção diária e evolução da equipe de costura.'}</p></div><div class="sw-actions"><a class="exec-action-btn" href="${url}" target="_blank" rel="noopener">Abrir planilha</a><button type="button" class="exec-action-btn" data-sw-refresh ${options.loading?'disabled':''}><i class="fa-solid fa-arrows-rotate ${options.loading?'fa-spin':''}"></i> ${options.loading?'Atualizando…':'Atualizar'}</button></div></header>
            <p class="sw-source">${payload?(payload.isLive===false?'Cache local da planilha':'Fonte: Produção Amostras'):'Aguardando a planilha'} · Atualização: ${esc(sourceStamp)} · horário de Brasília</p>
            ${options.error?`<div class="sw-warning" role="status">${esc(options.error)}${payload?' Os últimos dados disponíveis continuam exibidos.':''}</div>`:''}
            <div class="alerts-tabs sw-team-tabs" role="tablist" aria-label="Equipe de amostras">
                <button type="button" id="swTeamCosturaTab" data-sw-tab="sewing" role="tab" aria-controls="swTeamCosturaPanel" aria-selected="${options.team!=='cutting'}" class="${options.team!=='cutting'?'active':''}"><i class="fa-solid fa-shirt"></i> Costura</button>
                <button type="button" id="swTeamCorteTab" data-sw-tab="cutting" role="tab" aria-controls="swTeamCortePanel" aria-selected="${options.team==='cutting'}" class="${options.team==='cutting'?'active':''}"><i class="fa-solid fa-scissors"></i> Corte</button>
            </div>
`;
    }
    function bindControls(container,options) {
        container.querySelector('[data-sw-refresh]')?.addEventListener('click',()=>options.onRefresh?.());
        container.querySelector('[data-sw-history]')?.addEventListener('change',e=>options.onHistory?.(e.target.value));
        container.querySelectorAll('[data-sw-select]').forEach(button=>button.addEventListener('click',()=>options.onSelect?.(button.dataset.swSelect)));
        container.querySelectorAll('[data-sw-tab]').forEach(button=>button.addEventListener('click',()=>options.onTab?.(button.dataset.swTab)));
    }

    function render(container,payload,options={}) {
        const model=engine.dashboard(payload?.weeks||[],options.now||new Date());
        const current=model.current;
        const validHistory=model.history.filter(w=>w.validDates&&!w.duplicate&&w.start<=model.today);
        const limit=options.historyLimit==='all'?Infinity:Number(options.historyLimit||8);
        const range=validHistory.slice(0,limit);
        const history=engine.dashboard(range,options.now||new Date());
        const max=Math.max(1,...range.flatMap(w=>[w.total,w.target||0]));
        const issues=model.history.filter(w=>w.issues.length);
        const selected=model.history.find(w=>w.id===options.selectedWeek);
        const delta=(w,previous)=>{
            if(!previous) return '—';
            const n=w.total-previous.total;
            return `${n>0?'+':''}${fmt(n)}${previous.total?` (${n>0?'+':''}${fmt(n*100/previous.total,1)}%)`:''}`;
        };
        container.innerHTML=`<section class="sw-view">
            ${header(payload,options)}
            <div class="sw-team-panel" id="swTeamCosturaPanel" role="tabpanel" aria-labelledby="swTeamCosturaTab">
            ${!payload?`<section class="sw-panel sw-empty"><h3>${options.loading?'Carregando produção da costura…':'Dados indisponíveis'}</h3><p>${options.loading?'Buscando a semana atual e o histórico na planilha.':'Use Atualizar para tentar carregar a planilha.'}</p></section>`:`
            <section class="sw-panel sw-current" data-sw-current><header><h3>Semana atual</h3><span>Hoje: ${date(model.today)}${current?' · '+period(current):''}</span></header>
            ${current?`<div class="sw-hero"><div class="sw-main-goal"><span>Meta da semana</span><strong data-sw-target>${fmt(current.target)}</strong><small>referências para entregar</small></div><div class="sw-progress-area"><div class="sw-status ${current.target>0&&current.remaining===0?'met':'pending'}">${esc(current.status)}</div><div class="sw-progress-caption"><strong data-sw-realized>${fmt(current.total)} entregues</strong><b data-sw-attainment>${percent(current.attainment)}</b></div><div class="sw-progress" role="progressbar" aria-label="Atingimento da meta semanal" aria-valuenow="${Math.min(100,current.attainment||0)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(100,current.attainment||0)}%"></span></div><p>${current.remaining===null?'Meta não informada.':current.target===0?'Não há meta prevista para comparar nesta semana.':current.remaining>0?`Faltam <b>${fmt(current.remaining)}</b> referências para a meta.`:`Meta atingida${current.excess?` com ${fmt(current.excess)} referências acima do previsto`:''}.`}</p></div></div>
                <div class="sw-kpis">${kpi('Meta diária',fmt(current.dailyTarget===null?null:Math.round(current.dailyTarget)),current.dailyTarget===null?'Sem meta informada':`${fmt(current.dailyTarget,1)} exata · ${current.days} dias previstos`)}${kpi('Média realizada/dia',fmt(current.average===null?null:Math.round(current.average)),`${fmt(current.average,1)} exata · total ÷ ${current.days} dias`)}${kpi('Referências restantes',fmt(current.remaining),'Diferença para a meta semanal')}${kpi('Vs. semana anterior',delta(current,model.previous),'Comparação com última semana encerrada; atual parcial')}${kpi('Ritmo até hoje',current.elapsed?fmt(current.total/current.elapsed,1):'—',`${current.elapsed} dias da semana até hoje`)}${kpi('Necessárias por dia restante',current.remainingDays&&current.remaining!==null?fmt(current.remaining/current.remainingDays,1):'—',`${current.remainingDays} dias, incluindo hoje, até sexta`)}</div>
            `:`<div class="sw-empty"><h3>A semana atual ainda não está na planilha.</h3><p>${model.latest?'Última semana disponível: '+period(model.latest)+'.':'Nenhuma semana válida disponível.'} A meta antiga não é apresentada como meta atual.</p></div>`}</section>
            ${current?weekDetails(current):model.latest?`<h3 class="sw-section-title">Última semana disponível · ${period(model.latest)}</h3>${weekDetails(model.latest)}`:''}
            <section class="sw-panel sw-history"><header><div><h3>Histórico e evolução semanal</h3><p>Produção e metas; a semana atual permanece destacada acima.</p></div><label>Período<select data-sw-history aria-label="Período do histórico">${[['4','4 últimas semanas'],['8','8 últimas semanas'],['12','12 últimas semanas'],['all','Todo o histórico']].map(([v,label])=>`<option value="${v}" ${String(options.historyLimit||8)===v?'selected':''}>${label}</option>`).join('')}</select></label></header>
                <div class="sw-kpis">${kpi('Semanas encerradas',fmt(history.closed.length),'No período selecionado, sem duplicações')}${kpi('Média por semana',fmt(history.closedAverage,1),'Somente semanas encerradas')}${kpi('Melhor semana',history.best?fmt(history.best.total):'—',history.best?period(history.best):'Sem histórico encerrado')}${kpi('Metas atingidas',`${history.metWeeks} de ${history.targetWeeks}`,'Semanas encerradas com meta maior que zero')}</div>
                <div class="sw-week-chart-scroll"><div class="sw-week-chart" style="--sw-weeks:${Math.max(1,range.length)}" aria-label="Entregas e metas por semana">${[...range].reverse().map(w=>`<div class="sw-week-column ${w.id===current?.id?'current':''}"><div class="sw-week-bars"><div class="sw-history-bar target" style="height:${(w.target||0)*100/max}%" title="Meta: ${fmt(w.target)}"><span>${fmt(w.target)}</span></div><div class="sw-history-bar actual" style="height:${w.total*100/max}%" title="Entregue: ${fmt(w.total)}"><span>${fmt(w.total)}</span></div></div><b>${date(w.start).slice(0,5)}</b><small>${percent(w.attainment)}</small></div>`).join('')||'<p>Sem histórico disponível.</p>'}</div></div>
                <p class="sw-caption"><i class="sw-chart-key target"></i> Meta <i class="sw-chart-key actual"></i> Entregue · Atingimento usa valores exatos. Médias históricas não incluem a semana atual.</p>
                <div class="sw-table-wrap"><table class="sw-table"><thead><tr><th>Semana</th><th>Meta</th><th>Entregue</th><th>Atingimento</th><th>Média/dia</th><th>Vs. anterior disponível</th><th>Situação</th><th></th></tr></thead><tbody>${range.map(w=>{const previous=validHistory.find(p=>p.start<w.start);return `<tr class="${w.id===current?.id?'sw-current-row':''}"><th>${period(w)}${w.id===current?.id?'<small>Semana atual · parcial</small>':''}</th><td>${fmt(w.target)}</td><td>${fmt(w.total)}</td><td>${percent(w.attainment)}</td><td>${fmt(w.average,1)}</td><td>${delta(w,previous)}</td><td>${esc(w.status)}</td><td><button type="button" class="exec-action-btn" data-sw-select="${esc(w.id)}">Detalhar</button></td></tr>`;}).join('')}</tbody></table></div>
                <h4>Produção média por costureira no histórico</h4><div class="sw-table-wrap"><table class="sw-table"><thead><tr><th>Costureira</th><th>Total</th><th>Média/semana</th><th>Média/dia</th><th>Melhor semana</th><th>Participação</th></tr></thead><tbody>${history.people.map(p=>`<tr><th>${esc(p.name)}</th><td>${fmt(p.total)}</td><td>${fmt(p.average,1)}</td><td>${fmt(p.dailyAverage,1)}</td><td>${fmt(p.best)}</td><td>${percent(p.share)}</td></tr>`).join('')}</tbody></table></div>
            </section>
            ${selected?`<h3 class="sw-section-title">Detalhe histórico · ${period(selected)}</h3>${weekDetails(selected)}`:''}
            ${issues.length?`<details class="sw-panel sw-quality"><summary>Conferência da planilha · ${issues.length} bloco(s) com observações</summary><p>Períodos repetidos ou datas inválidas não duplicam as médias. O bloco repetido permanece listado aqui para conferência.</p><ul>${issues.map(w=>`<li><b>${period(w)}</b> · ${fmt(w.total)} entregas · ${w.issues.map(esc).join(' ')}</li>`).join('')}</ul></details>`:''}
            <p class="sw-caption">Indicadores exclusivos da costura. Totais e metas vêm das atividades e da composição semanal da aba Produção Amostras. Média diária = total ÷ dias previstos; valores principais arredondados para facilitar a leitura.</p>`}
        </div></section>`;
        bindControls(container,options);
    }
    return {render,header,bindControls,helpers:{esc,fmt,date,period,percent,kpi}};
});
