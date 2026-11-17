const test=require('node:test');
const assert=require('node:assert/strict');
const {buildReports}=require('../automatic-reports');
const {normalizeOrderReportRecords,buildComplementIndex}=require('../stylist-reports');
const groups=require('../automatic-report-groups');
const {planReportPages,createPdfRenderer}=require('../automatic-reports-pdf');
const now=new Date('2026-11-17T15:00:00Z');
const code='01.14.00.1000';
const row=(numero,extra={})=>({'Número':numero,'Código':code,Setor:'01','Produto Status':'PENDENTE DESENVOLVIMENTO',Comp1:'PP SAMPLE REENVIADA 13/11',...extra});
const sample=(numero,extra={})=>({NUMERO:numero,CODIGO:code,OP:'01A',SETOR:'ESTILO',PARTE:'FE',FLUXO:'D36',QTDE_PEND:'4',DT_SAIDA:'01/10/2026',FICHA:'03/11/2026',TIPO:'1',...extra});
test('Comp1/2 vêm de todas as linhas principais por OF e código completo, sem campos privados',()=>{
 const normalized=normalizeOrderReportRecords([row('1'),row('1',{Comp1:'Segunda linha',Comp2:'Aprovação',Tamanho:'M',Segredo:'privado'}),row('1',{Setor:'13',Comp1:'Outro setor'}),row('2',{Comp1:'Outra OF'}),row('1',{'Código':code+'A',Comp1:'Sufixo'})]);
 const lookup=buildComplementIndex(normalized);
 assert.deepEqual(lookup('1',code).map(e=>e.value),['PP SAMPLE REENVIADA 13/11','Segunda linha','Aprovação','Outro setor']);
 assert.deepEqual(lookup('2',code).map(e=>e.value),['Outra OF']);
 assert.deepEqual(lookup('1',code+'A').map(e=>e.value),['Sufixo']);
 assert.deepEqual(lookup('3',code),[]);assert.ok(!JSON.stringify(normalized).includes('privado'));
});
test('todos tipos preservam complementos da main; consolidação une textos com rastreio OF',()=>{
 const mainRecords=[row('1'),row('1',{Comp1:'Segunda linha'}),row('1',{Setor:'20'}),row('1',{Setor:'88'}),row('2',{Comp1:'Outra OF'}),row('2',{Comp1:'Outra OF',Comp2:'Outro complemento'}),row('3',{'Código':code+'A',Comp1:'Sufixo'})];
 const reports=buildReports([sample('1'),sample('2'),sample('1',{PARTE:'TF',FLUXO:'D43',OP:'M00'})],now,{mainRecords,colorRecords:[{PRODUTO:code,COR:'AZUL',PREVISÃO:'13/11/2026'}],trimRecords:[]});
 for(const type of ['tingimento','entregas','malotes','cores'])assert.ok(reports.find(r=>r.type===type).items.some(i=>i.complements.some(e=>e.value==='Segunda linha')),type);
 const item=reports.find(r=>r.stylist==='camila').items.find(i=>i.groupKey==='pedido-estampa');
 assert.equal(item.complements.filter(e=>e.value==='Outra OF').length,1);
 assert.ok(item.complements.some(e=>e.value==='Segunda linha'));
 assert.ok(!item.complements.some(e=>e.value==='Sufixo'));
 const lines=groups.getComplementLines(item);assert.ok(lines.some(line=>line.includes('(OF 2)')&&line.includes('Outra OF')));
 assert.ok(item.occurrences.find(i=>i.numero==='1').complements.some(e=>e.value==='Segunda linha'));
});
test('segmentos destacam PP SAMPLE e data próxima, preservando HTML como texto e datas independentes',()=>{
 const text='<img src=x> pp   sample REENVIADA 13/11/26; Entrega 20/11/2026. PP SAMPLE em análise';
 const runs=groups.getHighlightSegments(text);
 assert.equal(runs.map(run=>run.text).join(''),text);
 assert.deepEqual(runs.filter(run=>run.highlight).map(run=>run.text),['pp   sample','13/11/26','PP SAMPLE']);
 assert.equal(groups.getHighlightSegments('Entrega 13/11').some(run=>run.highlight),false);
 assert.equal(groups.getHighlightSegments('13/11 PP SAMPLE').filter(run=>run.highlight).map(run=>run.text).join('|'),'13/11|PP SAMPLE');
});
test('tela escapa complementos e mantém apenas spans controlados para os destaques',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const root={CRMAutomaticReportGroups:groups};vm.runInNewContext(fs.readFileSync(require.resolve('../automatic-reports-view'),'utf8'),{window:root});
 const container={innerHTML:'',querySelector:()=>({addEventListener(){}}),querySelectorAll:()=>[]};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 root.CRMAutomaticReportsView.render(container,{reports:[],selected:{id:'test',title:'Test',type:'cores',referenceDay:'2026-11-17',generatedAt:now,sourceTimestamp:now,items:[{codigo:code,d36:[{numero:'1',sector:'01F',date:'17/12'}],complements:[{label:'Comp1',value:'<script>x</script> PP SAMPLE 13/11',numero:'1'}]}]},escape:esc,image:()=>({hasImage:false})});
 assert.ok(container.innerHTML.includes('&lt;script&gt;x&lt;/script&gt;'));
 assert.ok(!container.innerHTML.includes('<script>'));
 assert.ok(container.innerHTML.includes('automatic-report-pp-highlight">13/11</span>'));
 assert.ok(container.innerHTML.includes('automatic-report-card-with-complements'));
 assert.ok(container.innerHTML.includes('D36: 01F - 17/12'));
});
test('PDF mantém oito cards curtos e continua complementos extensos integralmente nos limites',async t=>{
 const base={codigo:code,complements:[{label:'Comp1',value:'PP SAMPLE 13/11',numero:'1'}]};
 assert.equal(planReportPages({items:Array.from({length:8},()=>base)})[0].cards.length,8);
 const d36Card=planReportPages({items:[{...base,d36:[{numero:'1',sector:'01F',date:'17/12'}]}]})[0].cards[0];
 assert.ok(d36Card.item.complementRuns.flat().map(run=>run.text).join('').includes('D36: 01F - 17/12'));
 const value='PP SAMPLE REENVIADA 13/11/2026 '+('Texto completo sem corte '.repeat(1000))+'FINAL-INTEGRAL';
 const report={title:'Complementos',referenceDay:'2026-11-17',generatedAt:now.toISOString(),items:[{...base,complements:[{label:'Comp1',value,numero:'1'}]}]};
 const pages=planReportPages(report),cards=pages.flatMap(page=>page.cards);
 assert.ok(cards.length>1);assert.ok(cards.slice(1).every(card=>card.item.complementContinuation));
 assert.ok(cards.every(card=>card.y+card.height<=595.28-24));
 const text=cards.flatMap(card=>card.item.complementRuns).flat().map(run=>run.text).join('');
 assert.equal(text,`Comp1: ${value}`);
 assert.ok(cards.every(card=>card.item.complementStart+card.item.complementRuns.length*9<card.height));
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-comp-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 await createPdfRenderer(async()=>null)(report,path.join(dir,'test.pdf'));
 assert.equal((fs.readFileSync(path.join(dir,'test.pdf'),'latin1').match(/\/Type \/Page\b/g)||[]).length,pages.length);
});
test('OF com zeros só usa alias numérico único para o mesmo código; exato prevalece',()=>{
 const lookup=buildComplementIndex(normalizeOrderReportRecords([row('001',{Comp1:'Única'}),row('002',{Comp1:'Primeira'}),row('02',{Comp1:'Segunda'}),row('003',{'Código':code+'A',Comp1:'Variante'})]));
 assert.equal(lookup('1',code)[0].value,'Única');
 assert.equal(lookup('001',code)[0].value,'Única');
 assert.deepEqual(lookup('2',code),[]);
 assert.equal(lookup('02',code)[0].value,'Segunda');
 assert.deepEqual(lookup('3',code),[]);
});


test('D36 preserves active sector/date pairs by full code and unique OF alias',()=>{
 const {buildD36Index}=require('../stylist-reports');
 const lookup=buildD36Index([
  sample('001',{OP:'01F',DT_SAIDA:'17/12/2026'}),sample('001',{OP:'01F',DT_SAIDA:'17/12/2026',TAMANHO:'G'}),
  sample('001',{OP:'02C',DT_SAIDA:'2026-11-10'}),sample('001',{OP:'01B',DT_SAIDA:'31/02/2026'}),
  sample('002',{OP:'01F'}),sample('02',{OP:'01E'}),sample('001',{CODIGO:code+'A',OP:'02B'}),
  sample('001',{PARTE:'TF',FLUXO:'D43',OP:'M00'}),sample('001',{OP:'01Z'}),
  sample('001',{OP:'01A',QTDE_PEND:'0'}),sample('001',{OP:'99'}),
  {'Número':'4','Código':code,Parte:'FE',Fluxo:'D36',Setor:'01F','Qtde Pend':'1','Data Saída':'17/12/2026'}
 ],now);
 assert.deepEqual(lookup('1',code),[
  {numero:'001',sector:'01F',date:'17/12'},
  {numero:'001',sector:'02C',date:'10/11'},
  {numero:'001',sector:'01B',date:null}
 ]);
 assert.deepEqual(lookup('2',code),[]);
 assert.equal(lookup('02',code)[0].sector,'01E');
 assert.equal(lookup('1',code+'A')[0].sector,'02B');
 assert.equal(lookup('4',code)[0].date,'17/12');
 assert.deepEqual(lookup('1',code+'B'),[]);
});

test('reports share D36 data across orders and samples without confusing delivery dates or OFs',()=>{
 const records=[sample('001',{OP:'01F',DT_SAIDA:'17/12/2026'}),sample('001',{OP:'02C',DT_SAIDA:'16/11/2026'}),
  sample('2',{OP:'01B',DT_SAIDA:'31/02/2026'}),sample('3',{CODIGO:code+'A',OP:'01E',DT_SAIDA:'14/11/2026'})];
 const mainRecords=[row('1'),row('2'),row('3',{'Código':code+'A'})];
 const reports=buildReports(records,now,{mainRecords,colorRecords:[],trimRecords:[]});
 const stylist=reports.find(report=>report.stylist==='camila');
 const order=stylist.items.find(item=>item.codigo===code&&item.groupKey==='pedido-estampa');
 const late=stylist.items.find(item=>item.codigo===code&&item.groupKey==='amostra-atraso');
 assert.equal(order.d36.length,3);assert.equal(late.d36.length,3);
 assert.deepEqual(order.d36.map(entry=>entry.sector),['01F','02C','01B']);
 assert.equal(order.occurrences.find(item=>item.numero==='1').d36[0].date,'17/12');
 const lines=groups.getComplementLines(order);
 assert.ok(lines.includes('D36 (OF 001): 01F - 17/12'));
 assert.ok(lines.includes('D36 (OF 2): 01B - Data não informada'));
 assert.ok(!lines.some(line=>line.includes('03/11')));
 const general=reports.find(report=>report.type==='entregas').items.find(item=>item.numero==='001');
 assert.equal(general.d36[0].sector,'01F');
 assert.equal(groups.getComplementLines(general).filter(line=>line.startsWith('D36')).length,2);
 assert.deepEqual(stylist.items.find(item=>item.codigo===code+'A'&&item.groupKey==='pedido-estampa').d36,[{numero:'3',sector:'01E',date:'14/11'}]);
 assert.deepEqual(groups.getComplementLines({codigo:code}),[]);
});
