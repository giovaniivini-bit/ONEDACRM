const test=require('node:test');
const assert=require('node:assert/strict');
const {buildReports}=require('../automatic-reports');
const {normalizeOrderReportRecords}=require('../stylist-reports');
const {groupReportItems}=require('../automatic-report-groups');
const {planReportPages}=require('../automatic-reports-pdf');
const {isEstampaStatusPendente}=require('../setor01-related-sectors');
const now=new Date('2026-11-05T01:00:00Z'); // São Paulo: 04/11.
const sample=(code,extra={})=>({NUMERO:'S1',CODIGO:code,OP:'01A',SETOR:'DESENHO',PARTE:'FE',FLUXO:'D36',TIPO:'1',QTDE_PEND:'4',FICHA:'03/11/2026',DT_SAIDA:'19/10/2026',...extra});
const order=(code,sector,extra={})=>({'Número':'P1','Código':code,Setor:sector,'Produto Status':'PENDENTE DESENVOLVIMENTO','Ped Desc Período':'SEM 45/2026','Produto Descrição':'CAMISETA','Qtde Original':'3','Dias Parado':'4','Desc Setor':'DESENVOLVIMENTO',...extra});
const stylistReports=(main,samples=[])=>buildReports(samples,now,{mainRecords:main,colorRecords:[]}).filter(r=>r.stylist);

test('quatro relatórios seguem os prefixos existentes, excluindo produtos sem estilista',()=>{
    const codes=['01.14.00.1000','01.15.00.1000','13.14.00.1000','01.18.00.1000','99.00.1000'];
    const reports=stylistReports(codes.map(c=>order(c,'01')));
    assert.deepEqual(reports.map(r=>[r.stylist,r.items.map(i=>i.codigo)]),[
        ['camila',[codes[0]]],['ketlyn',[codes[1]]],['joyce',[codes[2]]],['thamires',[codes[3]]]
    ]);
    assert.ok(reports.every(r=>r.sections.length===6));
});

test('pedido consolida tamanhos, cruza OF e código completo no Raio X e preserva semana preferida',()=>{
    const code='01.14.00.1000';
    const input=[order(code,'01',{'Desc Período OP':'PERÍODO ERRADO'}),order(code,'01'),order(code,'13'),order(code,'D01'),order(code,'X01'),
        order(code+'A','01',{'Produto Status':'LIBERADO PARA PRODUÇÃO'}),order(code+'A','D01',{'Número':'OUTRA'}),
        order(code+'B','D01'),order(code+'B','X01'),order(code,'D02'),order(code,'X02')];
    const [report]=stylistReports(input);
    assert.deepEqual(report.items.map(i=>i.groupKey),['pedido-estampa','pedido-aviamento','pedido-cor']);
    assert.equal(report.uniqueProducts,1);
    for(const item of report.items) {
        assert.equal(item.codigo,code);
        assert.equal(item.week,'SEM 45/2026');
        assert.equal(item.sector,'01 / 13');
        assert.equal(item.quantity,6);
        assert.match(item.sectorLabel,/01: 4 dias.*13: 4 dias/);
        assert.equal(item.description,'CAMISETA');
    }
    const normalized=normalizeOrderReportRecords([order(code,'1',{'Preço':'123','Cliente Cnpj':'privado'})]);
    assert.equal(normalized[0].setor,'01');
    assert.ok(!JSON.stringify(normalized).includes('privado'));
    assert.equal(Object.hasOwn(normalized[0],'Preço'),false);
});

test('pendência de estampa compartilha a classificação da tela e não inclui liberados ou cancelado',()=>{
    for(const status of ['PENDENTE DESENVOLVIMENTO','AGUAR. APROV. LIC./ CONCEITO','AGUAR. APROV. LIC./ PP SAMPLE'])assert.equal(isEstampaStatusPendente(status),true);
    for(const status of ['PP SAMPL APROVADA','LIBERADO PARA PRODUÇÃO','LIB p produção / falta PP sample','PEDIDO CANCELADO','—',''])assert.equal(isEstampaStatusPendente(status),false);
});

test('amostra aplica dia de São Paulo, >15 estrito e ignora fluxo TF, cancelados e saldo zero',()=>{
    const code='01.14.00.1000';
    const input=[sample(code),sample(code+'A',{NUMERO:'S2',FICHA:'04/11',DT_SAIDA:'20/10/2026'}),
        sample(code+'B',{NUMERO:'S3',OP:'01B',FICHA:'',DT_SAIDA:'18/10/2026'}),
        sample(code+'C',{NUMERO:'S4',OP:'1B2',FICHA:'31/02/2026',DT_SAIDA:'19/10/2026'}),
        sample(code+'D',{NUMERO:'S5',OP:'02A',FICHA:'05/11/2026',DT_SAIDA:'01/01/2026'}),
        sample(code+'E',{NUMERO:'S6',OP:'01Z'}),sample(code+'F',{NUMERO:'S7',QTDE_PEND:'0'}),
        sample(code+'G',{NUMERO:'S8',PARTE:'TF',FLUXO:'D43',OP:'M00'}),
        sample(code+'H',{NUMERO:'S9',FICHA:'05/11/2026',DT_SAIDA:'INVÁLIDA'})];
    const [report]=stylistReports([],input);
    assert.deepEqual(groupReportItems(report).map(g=>[g.key,g.items.map(i=>i.codigo)]),[
        ['pedido-estampa',[]],['pedido-aviamento',[]],['pedido-cor',[]],
        ['amostra-atraso',[code]],['amostra-sem-data',[code+'B',code+'C']],
        ['amostra-permanencia',[code,code+'B',code+'C']]
    ]);
    assert.match(report.warnings,/1 entregas inválidas/);
    assert.match(report.warnings,/1 amostras sem movimentação/);
    assert.equal(report.uniqueProducts,3);
    assert.equal(report.items.find(i=>i.codigo===code).numero,'S1');
});

test('cada tema começa em folha própria com cards alinhados ao topo',()=>{
    const pages=planReportPages({sections:[{key:'a',theme:'PEDIDO',title:'AVIAMENTO'},{key:'b',theme:'PEDIDO',title:'COR'}],items:[{groupKey:'a'},{groupKey:'b'}]});
    const nextIndex=pages.findIndex(p=>p.headings.some(h=>h.title==='PEDIDO / COR'));
    const next=pages[nextIndex].headings.find(h=>h.title==='PEDIDO / COR');
    assert.equal(nextIndex,1);
    assert.equal(next.y,58);
    assert.equal(pages[nextIndex].cards[0].y,80);
    assert.ok(pages.every(page=>new Set(page.cards.map(card=>card.item.groupKey)).size<=1));
    assert.equal(pages.flatMap(p=>p.cards).length,2);
});

test('títulos tema/subtema e seções vazias ficam no PDF sem perder cards em continuações',()=>{
    const [report]=stylistReports(Array.from({length:11},(_,i)=>order(`01.14.00.${i}`,'01')));
    const pages=planReportPages(report);
    assert.equal(pages.flatMap(p=>p.cards).length,11);
    assert.ok(pages.every(p=>p.cards.length<=8));
    assert.ok(pages[0].headings[0].title.startsWith('PEDIDO / PRODUTOS COM PENDÊNCIA DE ESTAMPA'));
    for(const page of pages) {
        assert.ok(page.cards.every(c=>c.y+c.height<=595.28-24));
        assert.ok(page.headings.every(h=>h.y+22<=595.28-24));
    }
    const empty=stylistReports([])[0];
    const emptyPages=planReportPages(empty);
    assert.equal(emptyPages.length,1);
    assert.equal(emptyPages[0].headings.length,6);
    assert.equal(emptyPages[0].emptyTexts.length,6);
});

test('previsões usam o vínculo completo e a prioridade de envio ao cliente do Raio X',()=>{
    const code='01.14.00.1000';
    const colorRecords=[{PRODUTO:code,COR:'AZUL',PANTONE:'19-4052',PREVISÃO:'10/11/2026','ENV. CLIENTE':'05/11/2026'},
        {PRODUTO:code+'A',COR:'VERDE',PREVISÃO:'20/11/2026'}];
    const trimRecords=[{PRODUTO:code,'TIPO AVIAMENTO':'BOTÃO',DESCRIÇÃO:'AZUL',PREVISÃO:'11/11/2026',RECEBIDO:'04/11/2026'}];
    const mainRecords=[order(code,'01'),order(code,'D01'),order(code,'X01')];
    const report=buildReports([],now,{mainRecords,colorRecords,trimRecords}).find(r=>r.stylist==='camila');
    assert.equal(report.items.length,3);
    for(const item of report.items)assert.deepEqual(item.forecasts.map(f=>[f.sector,f.kind,f.value]),[
        ['D01','sent','05/11/2026'],['X01','forecast','11/11/2026']
    ]);
    assert.ok(report.items.every(item=>!JSON.stringify(item.forecasts).includes('20/11/2026')));
    const missing=buildReports([],now,{mainRecords,colorRecords:[],trimRecords:[]}).find(r=>r.stylist==='camila');
    assert.ok(missing.items[0].forecasts.every(f=>f.value==='Não informada'));
});

test('amostra só recebe previsões quando os fluxos CO/D41 e AV/D47 estão pendentes em D01/X01',()=>{
    const code='01.14.00.1000';
    const records=[sample(code),sample(code,{PARTE:'CO',FLUXO:'D41',OP:'D01'}),sample(code,{PARTE:'AV',FLUXO:'D47',OP:'X01'}),
        sample(code+'A'),sample(code+'A',{PARTE:'CO',FLUXO:'D41',OP:'D01',QTDE_PEND:'0'})];
    const sources={mainRecords:[],colorRecords:[{PRODUTO:code,COR:'AZUL',PREVISÃO:'10/11/2026'},{PRODUTO:code+'A',COR:'VERDE',PREVISÃO:'15/11/2026'}],
        trimRecords:[{PRODUTO:code,'TIPO AVIAMENTO':'ELÁSTICO',PREVISÃO:'12/11/2026'}]};
    const report=buildReports(records,now,sources).find(r=>r.stylist==='camila');
    assert.deepEqual(report.items.find(p=>p.codigo===code).forecasts.map(f=>f.sector),['D01','X01']);
    assert.deepEqual(report.items.find(p=>p.codigo===code+'A').forecasts,[]);
});

test('mais de quatro previsões continuam em cards iguais, sem perder datas ou aumentar dimensões',()=>{
    const {getReportCardItems,formatForecastLine}=require('../automatic-report-groups');
    const item={codigo:'01.14.00.1000',numero:'1',groupKey:'pedido-cor',forecasts:Array.from({length:9},(_,i)=>({sector:'D01',kind:'forecast',value:`${i+1}/11/2026`,name:`COR ${i}`}))};
    const fragments=getReportCardItems(item);
    assert.deepEqual(fragments.map(f=>f.forecasts.length),[4,4,1]);
    assert.deepEqual(fragments.flatMap(f=>f.forecasts),item.forecasts);
    assert.equal(formatForecastLine(item.forecasts[0]),'D01 prev.: 1/11/2026 | COR 0');
    const base={stylist:'camila',sections:[{key:'pedido-cor',theme:'PEDIDO',title:'COR'}]};
    const original=planReportPages({...base,items:[{...item,forecasts:[]}]})[0].cards[0];
    const expanded=planReportPages({...base,items:[item]})[0].cards;
    assert.equal(expanded.length,3);
    assert.ok(expanded.every(card=>card.width===original.width&&card.height===original.height));
});


test('um produto por tema soma OFs distintas e partes por OF sem contar grades novamente',()=>{
    const code='01.14.00.1000';
    const input=[order(code,'01',{'Número':'100',Parte:'A'}),order(code,'01',{'Número':'100',Parte:'A',Tamanho:'M'}),
        order(code,'01',{'Número':'100',Parte:'B'}),order(code,'D01',{'Número':'100',Parte:'A'}),
        order(code,'01',{'Número':'101',Parte:'A'}),order(code,'D01',{'Número':'101',Parte:'A'}),
        order(code+'A','01',{'Número':'102',Parte:'A'})];
    const [report]=stylistReports(input);
    const estampa=report.items.filter(item=>item.groupKey==='pedido-estampa');
    assert.equal(estampa.length,2);
    const item=estampa.find(item=>item.codigo===code);
    assert.deepEqual(item.orders,['100','101']);assert.equal(item.orderCount,2);assert.equal(item.partCount,3);assert.equal(item.partsKnown,true);
    assert.equal(item.occurrences.length,2);assert.equal(item.forecasts.length,1);
    assert.equal(report.items.filter(item=>item.codigo===code).length,2,'mesmo produto permanece em estampa e cor');
    assert.equal(report.uniqueProducts,2);
    const cards=planReportPages({...report,generatedAt:now.toISOString()}).flatMap(page=>page.cards);
    assert.equal(cards.filter(card=>card.item.codigo===code&&card.item.groupKey==='pedido-cor').length,1);
});

test('amostras consolidadas conservam movimentos individuais e exibem maior permanência',()=>{
    const code='01.14.00.1000';
    const [report]=stylistReports([], [sample(code,{NUMERO:'100',DT_SAIDA:'01/10/2026'}),sample(code,{NUMERO:'101',DT_SAIDA:'01/09/2026'})]);
    const item=report.items.find(item=>item.groupKey==='amostra-permanencia');
    assert.equal(item.orderCount,2);assert.equal(item.partCount,2);
    assert.match(item.movementDate,/01\/10\/2026.*01\/09\/2026/);
    assert.equal(item.daysInSector,Math.max(...item.occurrences.map(row=>row.daysInSector)));
    assert.equal(new Set(item.occurrences.map(row=>row.daysInSector)).size,2);
});

test('partes ausentes são informadas; previsões extensas não repetem imagem principal nem perdem itens',()=>{
    const {consolidateStylistItems}=require('../stylist-reports');
    const {getReportCardItems,formatProductSummary}=require('../automatic-report-groups');
    const forecasts=Array.from({length:25},(_,i)=>({sector:'D01',kind:'forecast',value:String(i),name:'Cor'}));
    const [item]=consolidateStylistItems([{codigo:'01.14.00.1000',numero:'100',groupKey:'pedido-cor',forecasts},
        {codigo:'01.14.00.1000',numero:'101',groupKey:'pedido-cor',forecasts}]);
    assert.equal(item.partsKnown,false);assert.match(formatProductSummary(item),/Partes não informadas/);
    const cards=getReportCardItems(item);assert.equal(cards.length,2);assert.equal(cards.filter(card=>!card.continuation).length,1);
    assert.deepEqual(cards.flatMap(card=>card.forecasts),forecasts);
});
