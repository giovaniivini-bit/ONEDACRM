const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../costura');
const now=new Date('2026-10-30T12:00:00Z');
function block(dates=['26/10','27/10','28/10','29/10','30/10'],target=69) {
    return [
        ['ANDREA',999,999,999,999,999],['TOTAL',999,999,999,999,999],
        ['',...dates],['TOTAL DIA',10,10,14,14,10],
        ['JÔ'],['FEIRA',1,2,3,3,2],['CQ',1,'','',1,''],['TESTE','','',1,'',''],['TOTAL',2,2,4,4,2],
        ['CLEIDE'],['FEIRA',3,4,4,4,2],['CQ',1,'',1,'',2],['TESTE','',1,'','',''],['OUTROS (DESCREVER)','','','',1,''],['TOTAL',4,5,5,5,4],
        ['JOSI'],['FEIRA',4,2,4,5,3],['CQ','',1,1,'',''],['OUTROS (DESCREVER)','','','','',1],['TOTAL',4,3,5,5,4],
        ['Quantidade de amostras da semana'],['CQs em atraso',0],['programação B44',target],['Testes / outros',0],['',target,'media / dia',target===null?'':target/5]
    ];
}
function join(...blocks) {
    const max=Math.max(...blocks.map(b=>b.length));
    return Array.from({length:max},(_,r)=>blocks.flatMap(b=>[...(b[r]||[]),...Array(Math.max(0,8-(b[r]?.length||0))).fill('')]));
}
test('costura separa corte e calcula 58/69 sem arredondar o atingimento',()=>{
    const [w]=api.buildWeeks(block(),now);
    const s=api.summarize(w,'2026-10-30');
    assert.equal(s.total,58);assert.equal(s.target,69);assert.equal(s.remaining,11);
    assert.equal(s.average,11.6);assert.equal(s.dailyTarget,13.8);
    assert.equal(Math.round(s.average),12);assert.equal(Math.round(s.dailyTarget),14);
    assert.ok(Math.abs(s.attainment-84.057971)<0.00001);
    assert.deepEqual(s.people.map(p=>p.total),[14,23,21]);
    assert.equal(s.status,'Meta ainda não atingida');
    assert.equal(api.summarize(w,'2026-11-02').status,'Meta não atingida');
    assert.equal(w.validDates,true);
});
test('novas semanas deslocadas e espaçamento variável não dependem de colunas fixas',()=>{
    const matrix=join(block(),block(['19/10','20/10','21/10','22/10','23/10'],52));
    const shifted=matrix.map(row=>['','','',...row]);
    const weeks=api.buildWeeks(shifted,now);
    assert.equal(weeks.length,2);assert.equal(weeks[0].column,3);
    assert.equal(weeks[1].column,11);assert.equal(weeks[1].target,52);
    const d=api.dashboard(weeks,now);
    assert.equal(d.current.total,58);assert.equal(d.closed.length,1);
    assert.equal(d.people.find(p=>p.name==='Jô').average,14);
});
test('datas repetidas ficam sinalizadas e fora das médias duplicadas',()=>{
    const weeks=api.buildWeeks(join(block(),block(['19/10','20/10','21/10','22/10','23/10']),block(['19/10','20/10','21/10','22/10','23/10'])),now);
    assert.equal(weeks[2].duplicate,true);
    const d=api.dashboard(weeks,now);assert.equal(d.closed.length,1);assert.equal(d.history.length,3);
});
test('meta ausente não vira zero ou meta atingida e nova semana vazia mantém calendário real',()=>{
    const rows=block();rows.splice(rows.findIndex(r=>r[0]==='Quantidade de amostras da semana'));
    const [w]=api.buildWeeks(rows,now);assert.equal(w.target,null);
    assert.equal(api.summarize(w,'2026-10-30').attainment,null);
    assert.equal(api.dashboard([w],new Date('2026-11-04T12:00:00Z')).current,null);
    assert.equal(api.dashboard([w],new Date('2026-11-04T12:00:00Z')).latest.id,w.id);
    assert.equal(api.summarize({...w,target:0}).status,'Sem meta prevista');
});
test('datas da costura prevalecem, virada de ano é preservada e datas inválidas não entram nas médias',()=>{
    const rows=join(block(['04/01','05/01','06/01','07/01','08/01']),block(['28/12','29/12','30/12','31/12','01/01']));
    const weeks=api.buildWeeks(rows,new Date('2027-01-08T12:00:00Z'));
    assert.equal(weeks[0].start,'2027-01-04');assert.equal(weeks[1].start,'2026-12-28');assert.equal(weeks[1].end,'2027-01-01');
    const bad=api.buildWeeks(block(['26/10','27/10','31/02','29/10','30/10']),now);
    assert.equal(bad[0].validDates,false);assert.equal(api.dashboard(bad,now).current,null);
    assert.equal(api.todayKey(new Date('2026-10-31T02:00:00Z')),'2026-10-30');
});
test('meta atingida, excesso e números brasileiros são calculados sem NaN',()=>{
    const [w]=api.buildWeeks(block(undefined,50),now);const s=api.summarize(w,'2026-10-30');
    assert.equal(s.status,'Meta atingida');assert.equal(s.excess,8);assert.equal(s.remaining,0);
    assert.equal(api.number('13,8'),13.8);assert.equal(api.number('#REF!'),null);
    assert.equal(api.dashboard([],now).closedAverage,null);
});

test('ano industrial explícito conserva histórico quando o calendário do computador avança',()=>{
    const rows=block();rows.splice(rows.findIndex(r=>r[0]==='programação B44'),0,['CQs semana 2647',0]);
    const [w]=api.buildWeeks(rows,new Date('2028-02-01T12:00:00Z'));
    assert.equal(w.start,'2026-10-26');assert.equal(w.target,69);
    const missing=block().filter(r=>r[0]!=='JOSI');
    const [incomplete]=api.buildWeeks(missing,now);
    assert.ok(incomplete.issues.some(i=>i.includes('costureira sem bloco')));
    assert.equal(api.dashboard([incomplete],new Date('2026-11-04T12:00:00Z')).people.find(p=>p.name==='Josi').average,null);
});

test('semana atual é encontrada pelas datas mesmo com semana futura inserida à esquerda',()=>{
    const weeks=api.buildWeeks(join(block(['02/11','03/11','04/11','05/11','06/11'],80),block()),now);
    const d=api.dashboard(weeks,now);
    assert.equal(d.current.start,'2026-10-26');assert.equal(d.current.target,69);
    assert.equal(d.closed.length,0);
});

test('view preserva números da semana, estados indisponíveis/cache e texto escapado',()=>{
    const view=require('../costura-view');
    const container={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
    view.render(container,null,{now,loading:true});assert.ok(container.innerHTML.includes('Carregando produção da costura'));
    const rows=block();rows.splice(rows.findIndex(r=>r[0]==='TOTAL' && r[1]===2),0,['<img src=x>',0,0,0,0,0]);
    view.render(container,{weeks:api.buildWeeks(rows,now),isLive:false,timestamp:now.toISOString()},{now,error:'<script>erro</script>'});
    assert.ok(container.innerHTML.includes('data-sw-target>69'));
    assert.ok(container.innerHTML.includes('84,1%'));
    assert.ok(container.innerHTML.includes('Cache local da planilha'));
    assert.ok(container.innerHTML.includes('&lt;img src=x&gt;'));
    assert.ok(!container.innerHTML.includes('<script>erro'));
    view.render(container,{weeks:api.buildWeeks(block(undefined,0),now)},{now});
    assert.ok(container.innerHTML.includes('Não há meta prevista para comparar'));
    assert.ok(!container.innerHTML.includes('Meta atingida com'));
});
