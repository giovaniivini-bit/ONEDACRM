const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../costura');
const view=require('../corte-view');
const now=new Date('2026-10-31T12:00:00Z');
function matrix(cutDates=['26/10','27/10','28/10','29/10','30/10'],sewingDates=cutDates,target=69) {
    return [
        ['',...cutDates],['ANDREA'],['CORTE FEIRA',7,2,5,2,0],['REPROCESSO FEIRA',2,0,1,2,1],
        ['CORTE MALHA P/ TINGIR',0,23,6,0,11],['ANALISAR MALHA',27,4,0,0,18],['TESTE / BANDEIRA',0,0,0,8,0],['MESA DE AMOSTRA',0,0,1,0,0],['TOTAL',36,29,13,12,30],
        ['CHICO'],['CORTE FEIRA',5,9,6,2,1],['REPROCESSO FEIRA',1,1,2,2,0],['CORTE CQ',0,1,0,0,0],['REPROCESSO CQ',1,0,0,0,0],['TESTE / BANDEIRA',1,0,1,1,2],['TOTAL',8,11,9,5,3],
        ['',...sewingDates],['JÔ'],['FEIRA',2,2,4,4,2],['TOTAL',2,2,4,4,2],['CLEIDE'],['FEIRA',4,5,5,5,4],['TOTAL',4,5,5,5,4],['JOSI'],['FEIRA',4,3,5,5,4],['TOTAL',4,3,5,5,4],
        ['Quantidade de amostras da semana'],['programação B44',target-2],['Testes / outros',2],['',target,'media / dia',target/5]
    ];
}
function join(a,b) { return Array.from({length:Math.max(a.length,b.length)},(_,r)=>[...(a[r]||[]),...Array(8-(a[r]?.length||0)).fill(''),...(b[r]||[])]); }
test('corte conta ações e reprocessos de Andrea/Chico sem copiar meta ou números da costura',()=>{
    const [cut]=engine.buildCuttingWeeks(matrix(),now);
    const [sewing]=engine.buildWeeks(matrix(),now);
    assert.equal(cut.total,156);assert.deepEqual(cut.values,[44,40,22,17,33]);
    assert.deepEqual(cut.people.map(p=>p.total),[120,36]);assert.equal(engine.countReworks(cut),13);
    assert.equal(cut.target,null);assert.deepEqual(cut.targets,[]);
    assert.equal(sewing.total,58);assert.equal(sewing.target,69);
    const m=engine.dashboard([cut],now,{team:'cutting'});
    assert.deepEqual(m.people.map(p=>p.name),['Andrea','Chico']);
    assert.equal(m.current.average,31.2);
});
test('calendários de corte e costura são independentes',()=>{
    const rows=matrix(['19/10','20/10','21/10','22/10','23/10'],['26/10','27/10','28/10','29/10','30/10']);
    const cut=engine.dashboard(engine.buildCuttingWeeks(rows,now),now,{team:'cutting'});
    const sewing=engine.dashboard(engine.buildWeeks(rows,now),now);
    assert.equal(cut.current,null);assert.equal(cut.latest.start,'2026-10-19');
    assert.equal(sewing.current.start,'2026-10-26');
});
test('comparação informa alta/queda/estável e usa dias equivalentes durante semana parcial',()=>{
    const current={values:[44,40,22,17,33]},previous={values:[37,0,35,22,2]};
    assert.deepEqual(engine.compareProduction(current,previous),{current:156,previous:96,delta:60,percent:62.5,trend:'Subiu'});
    const partial=engine.compareProduction(current,previous,2);
    assert.equal(partial.current,84);assert.equal(partial.previous,37);assert.equal(partial.delta,47);
    assert.equal(engine.compareProduction(previous,current).trend,'Caiu');
    assert.equal(engine.compareProduction(current,current).trend,'Estável');
    assert.equal(engine.compareProduction(current,null).delta,null);
    assert.equal(engine.compareProduction({values:[1]},{values:[0]}).percent,null);
});
test('semanas novas à esquerda atualizam datas e metas da costura sem cruzar equipes',()=>{
    const newDates=['02/11','03/11','04/11','05/11','06/11'];
    const rows=join(matrix(newDates,newDates,80),matrix());
    const next=new Date('2026-11-03T12:00:00Z');
    const cut=engine.dashboard(engine.buildCuttingWeeks(rows,next),next,{team:'cutting'});
    const sewing=engine.dashboard(engine.buildWeeks(rows,next),next);
    assert.equal(cut.current.start,'2026-11-02');assert.equal(cut.current.target,null);
    assert.equal(sewing.current.start,'2026-11-02');assert.equal(sewing.current.target,80);
});
test('corte sinaliza datas inválidas e repetidas sem inflar médias',()=>{
    const cut=engine.buildCuttingWeeks(join(matrix(),matrix()),now);
    assert.equal(cut.length,2);assert.equal(cut[1].duplicate,true);
    assert.equal(engine.dashboard(cut,new Date('2026-11-04T12:00:00Z'),{team:'cutting'}).closed.length,1);
    const invalid=engine.buildCuttingWeeks(matrix(['7','07/01','08/01','09/01','10/01']),now);
    assert.equal(invalid[0].validDates,false);
});
test('tela do corte usa unidade ações e não mostra meta da costura; cache legado é explícito',()=>{
    const c={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
    const payload={weeks:engine.buildWeeks(matrix(),now),cuttingWeeks:engine.buildCuttingWeeks(matrix(),now)};
    view.render(c,payload,{now});
    assert.ok(c.innerHTML.includes('data-cut-total>156'));
    assert.ok(c.innerHTML.includes('Produção time de amostras'));
    assert.ok(!c.innerHTML.includes('data-sw-target'));
    assert.ok(c.innerHTML.includes('Ações na semana'));
    view.render(c,{weeks:payload.weeks},{now});
    assert.ok(c.innerHTML.includes('Este cache contém apenas a costura'));
    assert.ok(!c.innerHTML.includes('data-cut-total'));
});
