(function(root,factory) {
    const api=factory(typeof module==='object'&&module.exports?require('./costura'):root.CRMCostura,
        typeof module==='object'&&module.exports?require('./costura-view'):root.CRMCosturaView);
    if(typeof module==='object'&&module.exports) module.exports=api;
    if(root) root.CRMCorteView=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(engine,shared) {
    'use strict';
    const {esc,fmt,date,period,percent,kpi}=shared.helpers;
    const signed=n=>n===null?'—':`${n>0?'+':''}${fmt(n)}`;
    const change=c=>c.delta===null?'Sem base anterior':`${signed(c.delta)} ações${c.percent===null?'':` (${c.percent>0?'+':''}${fmt(c.percent,1)}%)`}`;
    const trendClass=c=>c.delta===null?'':c.delta>0?'up':c.delta<0?'down':'same';
    const sum=values=>values.reduce((a,b)=>a+b,0);
    function breakdown(w) {
        const rows=new Map();
        w.people.forEach(p=>p.activities.forEach(a=>{
            if(!rows.has(a.label)) rows.set(a.label,new Map());
            rows.get(a.label).set(p.name,(rows.get(a.label).get(p.name)||0)+a.total);
        }));
        return `<div class="sw-table-wrap"><table class="sw-table"><thead><tr><th>Atividade</th>${engine.CUTTING_PEOPLE.map(n=>`<th>${esc(n)}</th>`).join('')}<th>Total de ações</th></tr></thead><tbody>${[...rows].map(([label,people])=>`<tr><th>${esc(label)}</th>${engine.CUTTING_PEOPLE.map(n=>`<td>${fmt(people.get(n)||0)}</td>`).join('')}<td><b>${fmt(sum([...people.values()]))}</b></td></tr>`).join('')}</tbody></table></div>`;
    }
    function details(w,previous=null) {
        const max=Math.max(1,...w.values);
        const days=w.elapsed<w.days?w.elapsed:w.days;
        return `<section class="sw-panel sw-cut-details" data-cut-week="${esc(w.id)}"><header><h3>Ações por dia e colaborador</h3><span>${period(w)}</span></header>
            <div class="sw-daily-chart" role="img" aria-label="Ações diárias do corte">${w.dates.map((d,i)=>`<div class="sw-day"><div class="sw-day-plot"><div class="sw-day-bar" style="height:${w.values[i]*100/max}%"><b>${fmt(w.values[i])}</b></div></div><strong>${['Seg','Ter','Qua','Qui','Sex'][i]||''}</strong><small>${date(d).slice(0,5)}</small></div>`).join('')}</div>
            <div class="sw-people-cards sw-cut-people">${w.people.map(p=>{
                const before=previous?.people.find(x=>x.name===p.name);
                const c=engine.compareProduction(p,before,days);
                const rework=engine.countReworks({people:[p]});
                return `<article data-cut-person="${esc(p.name)}"><span>${esc(p.name)}</span><strong>${fmt(p.total)}</strong><small>ações · ${percent(p.share)} da equipe</small><p>Média: <b>${fmt(p.average,1)}</b> ações por dia</p><p>Reprocessos: <b>${fmt(rework)}</b> ações</p><p class="sw-trend ${trendClass(c)}">${esc(c.trend)} · ${change(c)}</p><small>Vs. período anterior disponível, mesmos ${days} dias.</small></article>`;
            }).join('')}</div>
            <div class="sw-table-wrap"><table class="sw-table"><thead><tr><th>Colaborador</th>${w.dates.map(d=>`<th>${date(d).slice(0,5)}</th>`).join('')}<th>Total</th><th>Média/dia</th></tr></thead><tbody>${w.people.map(p=>`<tr><th>${esc(p.name)}</th>${p.values.map(n=>`<td>${fmt(n)}</td>`).join('')}<td><b>${fmt(p.total)}</b></td><td>${fmt(p.average,1)}</td></tr>`).join('')}<tr class="sw-total"><th>Total de ações</th>${w.values.map(n=>`<td>${fmt(n)}</td>`).join('')}<td>${fmt(w.total)}</td><td>${fmt(w.average,1)}</td></tr></tbody></table></div>
            <h4>Distribuição das ações por atividade</h4>${breakdown(w)}
        </section>`;
    }
    function render(container,payload,options={}) {
        options={...options,team:'cutting'};
        const weeks=Array.isArray(payload?.cuttingWeeks)?payload.cuttingWeeks:[];
        const model=engine.dashboard(weeks,options.now||new Date(),{team:'cutting'});
        const current=model.current;
        const valid=model.history.filter(w=>w.validDates&&!w.duplicate&&w.start<=model.today);
        const limit=options.historyLimit==='all'?Infinity:Number(options.historyLimit||8);
        const range=valid.slice(0,limit);
        const history=engine.dashboard(range,options.now||new Date(),{team:'cutting'});
        const comparison=engine.compareProduction(current,model.previous,current?.elapsed ?? null);
        const reworks=engine.countReworks(current);
        const max=Math.max(1,...range.map(w=>w.total));
        const selected=model.history.find(w=>w.id===options.selectedWeek);
        const issues=model.history.filter(w=>w.issues.length);
        container.innerHTML=`<section class="sw-view sw-cutting">${shared.header(payload,options)}
            <div class="sw-team-panel" id="swTeamCortePanel" role="tabpanel" aria-labelledby="swTeamCorteTab">
            ${!payload?`<section class="sw-panel sw-empty"><h3>${options.loading?'Carregando produção do corte…':'Dados indisponíveis'}</h3><p>Use Atualizar para consultar a planilha.</p></section>`:!Array.isArray(payload.cuttingWeeks)||!weeks.length?`<section class="sw-panel sw-empty" data-cut-unavailable><h3>Dados do corte ainda não disponíveis</h3><p>${Array.isArray(payload.cuttingWeeks)?'Nenhum bloco de Andrea ou Chico foi encontrado nesta leitura.':'Este cache contém apenas a costura.'} Use Atualizar para consultar os blocos do corte.</p></section>`:`
            <section class="sw-panel sw-current" data-cut-current><header><h3>Corte · semana atual</h3><span>Hoje: ${date(model.today)}${current?' · '+period(current):''}</span></header>
            ${current?`<div class="sw-hero"><div class="sw-main-goal"><span>Ações na semana</span><strong data-cut-total>${fmt(current.total)}</strong><small>Andrea + Chico</small></div><div class="sw-progress-area"><div class="sw-cut-trend sw-trend ${trendClass(comparison)}" data-cut-trend><strong>${esc(comparison.trend)}</strong><b>${change(comparison)}</b></div><p>${comparison.delta===null?'Não há período anterior disponível para comparação.':`${fmt(comparison.current)} ações nesta semana contra ${fmt(comparison.previous)} na anterior, considerando os mesmos ${current.elapsed} dias.`}</p><p>${current.end<model.today?'Semana encerrada.':'Semana em andamento; comparação parcial em dias equivalentes.'}</p></div></div>
                <div class="sw-kpis">${kpi('Média por dia',fmt(current.average,1),`${current.days} dias previstos na semana`)}${kpi('Semana anterior',fmt(model.previous?.total),'Total do período anterior disponível')}${kpi('Reprocessos',fmt(reworks),`${percent(current.total?reworks*100/current.total:0)} das ações desta semana`)}${kpi('Variação no total semanal',change(engine.compareProduction(current,model.previous)),'Total atual versus total da semana anterior; atual pode ser parcial')}</div>
            `:`<div class="sw-empty"><h3>A semana atual do corte ainda não está na planilha.</h3><p>${model.latest?'Última disponível: '+period(model.latest):'Nenhuma semana válida de corte disponível.'}</p></div>`}</section>
            ${current?details(current,model.previous):model.latest?`<h3 class="sw-section-title">Última semana de corte disponível · ${period(model.latest)}</h3>${details(model.latest,valid.find(w=>w.start<model.latest.start))}`:''}
            <section class="sw-panel sw-history"><header><div><h3>Histórico de produtividade do corte</h3><p>Volumes de ações e evolução de Andrea e Chico.</p></div><label>Período<select data-sw-history aria-label="Período do histórico do corte">${[['4','4 últimas semanas'],['8','8 últimas semanas'],['12','12 últimas semanas'],['all','Todo o histórico']].map(([value,label])=>`<option value="${value}" ${String(options.historyLimit||8)===value?'selected':''}>${label}</option>`).join('')}</select></label></header>
                <div class="sw-kpis">${kpi('Semanas encerradas',fmt(history.closed.length),'Sem semana atual, datas inválidas ou repetidas')}${kpi('Média de ações/semana',fmt(history.closedAverage,1),'Semanas encerradas no período selecionado')}${kpi('Melhor semana',fmt(history.best?.total),history.best?period(history.best):'Sem histórico encerrado')}${kpi('Média de reprocessos/semana',history.closed.length?fmt(sum(history.closed.map(w=>engine.countReworks(w)))/history.closed.length,1):'—','Reprocessos incluídos no total de ações')}</div>
                <div class="sw-week-chart-scroll"><div class="sw-week-chart" style="--sw-weeks:${Math.max(1,range.length)}" aria-label="Ações semanais por colaborador do corte">${[...range].reverse().map(w=>`<div class="sw-week-column ${w.id===current?.id?'current':''}"><div class="sw-week-bars"><div class="sw-cut-stack" style="height:${w.total*100/max}%"><b>${fmt(w.total)}</b>${engine.CUTTING_PEOPLE.map((name,i)=>`<span class="sw-cut-color-${i}" style="height:${w.total?(w.people.find(p=>p.name===name)?.total||0)*100/w.total:0}%" title="${esc(name)}: ${fmt(w.people.find(p=>p.name===name)?.total)} ações"></span>`).join('')}</div></div><b>${date(w.start).slice(0,5)}</b><small>${w.id===current?.id?'Atual':''}</small></div>`).join('')||'<p>Sem histórico disponível.</p>'}</div></div>
                <p class="sw-caption"><i class="sw-chart-key sw-cut-color-0"></i> Andrea <i class="sw-chart-key sw-cut-color-1"></i> Chico · Cada coluna representa o total de ações da semana.</p>
                <div class="sw-table-wrap"><table class="sw-table" data-cut-history><thead><tr><th>Semana</th><th>Ações</th><th>Média/dia</th><th>Vs. anterior disponível</th><th>Andrea</th><th>Chico</th><th>Reprocessos</th><th></th></tr></thead><tbody>${range.map(w=>{const before=valid.find(p=>p.start<w.start);const c=engine.compareProduction(w,before);return `<tr class="${w.id===current?.id?'sw-current-row':''}"><th>${period(w)}${w.id===current?.id?'<small>Semana atual</small>':''}</th><td><b>${fmt(w.total)}</b></td><td>${fmt(w.average,1)}</td><td class="sw-trend ${trendClass(c)}">${esc(c.trend)} · ${change(c)}${w.end>=model.today?' · parcial':''}</td>${engine.CUTTING_PEOPLE.map(name=>`<td>${fmt(w.people.find(p=>p.name===name)?.total)}</td>`).join('')}<td>${fmt(engine.countReworks(w))}</td><td><button type="button" class="exec-action-btn" data-sw-select="${esc(w.id)}">Detalhar</button></td></tr>`;}).join('')}</tbody></table></div>
                <h4>Médias por colaborador no histórico</h4>${history.closed.length?`<div class="sw-table-wrap"><table class="sw-table"><thead><tr><th>Colaborador</th><th>Ações</th><th>Média/semana</th><th>Média/dia</th><th>Melhor semana</th><th>Participação</th></tr></thead><tbody>${history.people.map(p=>`<tr><th>${esc(p.name)}</th><td>${fmt(p.total)}</td><td>${fmt(p.average,1)}</td><td>${fmt(p.dailyAverage,1)}</td><td>${fmt(p.best)}</td><td>${percent(p.share)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sw-caption">Ainda não há semanas encerradas para calcular médias históricas.</p>'}
            </section>
            ${selected?`<h3 class="sw-section-title">Detalhe do corte · ${period(selected)}</h3>${details(selected,valid.find(w=>w.start<selected.start))}`:''}
            ${issues.length?`<details class="sw-panel sw-quality"><summary>Conferência das datas do corte · ${issues.length} bloco(s)</summary><p>Datas inválidas e períodos repetidos ficam fora das médias; o bloco mais à esquerda prevalece quando as datas se repetem.</p><ul>${issues.map(w=>`<li><b>${period(w)}</b> · ${fmt(w.total)} ações · ${w.issues.map(esc).join(' ')}</li>`).join('')}</ul></details>`:''}
            <p class="sw-caption">Contagem de ações do corte, incluindo reprocessos. Um produto pode gerar várias ações. Datas próprias do corte; a comparação principal usa dias equivalentes da semana anterior disponível. Médias históricas excluem a semana atual.</p>`}
            </div></section>`;
        shared.bindControls(container,options);
    }
    return {render};
});
