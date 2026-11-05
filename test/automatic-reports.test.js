const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {buildReports,referenceDay,createReportStore}=require('../automatic-reports');
const {createPdfRenderer,planReportPages}=require('../automatic-reports-pdf');
const {groupReportItems}=require('../automatic-report-groups');
const sources={mainRecords:[{'Número':'1','Código':'A','Setor':'01'}],colorRecords:[]};
const now=new Date('2026-11-05T01:00:00Z'); // 04/11 in São Paulo.
const main=(code,extra={})=>({NUMERO:'123',CODIGO:code,OP:'01B',SETOR:'ESTILO',PARTE:'FE',FLUXO:'D36',QTDE_PEND:'4',DT_SAIDA:'01/11/2026',FICHA:'03/11/2026',TIPO:'1',...extra});
const tf=(code,sector,date,extra={})=>main(code,{PARTE:'TF',FLUXO:'D43',OP:sector,DT_SAIDA:date,...extra});

test('M00 >5 e M02 >7 usam dias do TF/D43, consolidam tamanhos e preservam variantes',()=>{
    const records=[main('A'),tf('A','M00','29/10/2026'),tf('A','M00','29/10/2026',{TAMANHO:'M'}),
        main('B'),tf('B','M00','30/10/2026'),main('C'),tf('C','M02','27/10/2026'),
        main('D'),tf('D','M02','28/10/2026'),main('A-1'),tf('A-1','M00','28/10/2026'),
        tf('ZERO','M00','01/01/2026',{QTDE_PEND:'0'}),tf('BAD','M00','31/02/2026'),
        tf('FUTURE','M02','10/11/2026'),tf('OLD','M00','01/01/2026',{TIPO:'3'}),
        tf('WRONG','M00','01/10/2026',{PARTE:'',FLUXO:'D99'})];
    const [report]=buildReports(records,now);
    assert.equal(referenceDay(now),'2026-11-04');
    assert.deepEqual(report.items.map(p=>p.codigo),['A','A-1','C']);
    assert.match(report.items[0].reason,/M00: 6 dias/);
    assert.match(report.items[2].reason,/M02: 8 dias/);
    assert.ok(report.warnings);
});

test('atraso usa entrega FE, exclui hoje/futuro/inválidas/cancelados sem confundir data TF',()=>{
    const records=[main('LATE'),tf('LATE','M02','01/11/2026',{FICHA:'20/12/2026'}),
        main('TODAY',{FICHA:'04/11/2026'}),main('FUTURE',{FICHA:'05/11/2026'}),
        main('INVALID',{FICHA:'31/02/2026'}),main('CANCEL',{OP:'01Z'}),
        main('DONE',{QTDE_PEND:'0'}),main('NOYEAR',{FICHA:'03/11'})];
    const report=buildReports(records,now)[1];
    assert.deepEqual(report.items.map(p=>p.codigo),['LATE','NOYEAR']);
    assert.ok(report.items.every(p=>p.reason.includes('1 dia em atraso')));
    assert.ok(report.warnings);
});

test('PDF real tem introdução, suporta relatório vazio e pagina em oito cards',async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-report-pdf-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    const report=buildReports([main('A'),tf('A','M00','01/10/2026')],now)[0];
    const renderer=createPdfRenderer(async()=>null);
    const file=path.join(dir,'test.pdf');
    await renderer({...report,generatedAt:now.toISOString(),items:Array.from({length:9},(_,i)=>({...report.items[0],codigo:`A${i}`}))},file);
    const pdf=fs.readFileSync(file).toString('latin1');
    assert.ok(pdf.startsWith('%PDF-'));
    assert.equal((pdf.match(/\/Type \/Page\b/g)||[]).length,2);
    await renderer({...report,generatedAt:now.toISOString(),items:[]},file);
    assert.equal((fs.readFileSync(file).toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1);
});

test('histórico persiste após reinício, serializa geração e não publica lote parcial',async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-reports-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    const renderPdf=async(_,file)=>fs.writeFileSync(file,'%PDF-test');
    const store=createReportStore({directory:dir,renderPdf,now:()=>now});
    const records=[main('A'),tf('A','M00','01/10/2026')];
    await Promise.all([store.generate(records,now.toISOString(),sources),store.generate(records,now.toISOString(),sources)]);
    assert.equal(store.list().length,8);
    const restarted=createReportStore({directory:dir,renderPdf,now:()=>now});
    const id=restarted.list()[0].id;
    assert.ok(restarted.read(id).report.items.length);
    assert.equal(restarted.read('../index'),null);
    let count=0;
    const failing=createReportStore({directory:dir,renderPdf:async(_,file)=>{if(++count===2)throw new Error('disk full');fs.writeFileSync(file,'PDF');},now:()=>now});
    await assert.rejects(failing.generate(records,now.toISOString(),sources),/disk full/);
    assert.equal(restarted.list().length,8);
    await assert.rejects(store.generate([],now.toISOString()),/Fonte indisponível/);
    assert.equal(restarted.list().length,8);
});

test('erro real de escrita durante carregamento da imagem é rejeitado sem encerrar Node',async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-report-error-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    const renderer=createPdfRenderer(async()=>{await new Promise(resolve=>setTimeout(resolve,50));return null;});
    const report=buildReports([main('A'),tf('A','M00','01/10/2026')],now)[0];
    await assert.rejects(renderer({...report,generatedAt:now.toISOString()},path.join(dir,'missing','test.pdf')),/ENOENT/);
});

test('separa M00 antes de M02 e ordena cada grupo da data menos atrasada à mais atrasada',()=>{
    const report=buildReports([tf('OLD','M00','01/10/2026'),tf('NEW','M00','29/10/2026'),
        tf('BOTH','M00','28/10/2026'),tf('BOTH','M02','26/10/2026'),tf('NEW02','M02','27/10/2026')],now)[0];
    assert.deepEqual(groupReportItems(report).map(g=>[g.key,g.items.map(p=>p.codigo)]),[
        ['M00',['NEW','BOTH','OLD']],['M02',['NEW02','BOTH']]
    ]);
    assert.match(report.items[3].reason,/M02/);
});

test('agrupa entregas por dia normalizado e ordena da menos atrasada para a mais atrasada',()=>{
    const report=buildReports([main('A',{FICHA:'20/10/2026'}),main('B',{FICHA:'03/11'}),
        main('C',{FICHA:'3/11/2026'}),main('D',{FICHA:'01/11/2026'})],now)[1];
    assert.deepEqual(groupReportItems(report).map(g=>[g.title,g.items.map(p=>p.codigo)]),[
        ['Entrega 03/11/2026',['B','C']],['Entrega 01/11/2026',['D']],['Entrega 20/10/2026',['A']]
    ]);
});

test('malotes e cores reproduzem os alertas existentes e não expõem colunas extras',()=>{
    const engine=require('../alerts-engine');
    const mainRecords=[{'Número':'77','Código':'01.A','Setor':'20'},
        {'Número':'77','Código':'01.A','Setor':'88','Desc Setor':'MALOTES'},
        {'Número':'77','Código':'01.A','Setor':'88','Tamanho':'M'},
        {'Número':'78','Código':'01.B','Setor':'13'}, {'Número':'78','Código':'01.B','Setor':'83'},
        {'Número':'79','Código':'01.C','Setor':'26'}, {'Número':'79','Código':'01.C','Setor':'083'}];
    const color=(code,date,extra={})=>({PRODUTO:code,COR:'AZUL',PANTONE:'19-4052',PREVISÃO:date,...extra});
    const colorRecords=[color('01.A','04/11/2026'),color('01.B','03/11/2026'),color('01.B','03/11/2026',{COR:'VERDE'}),
        color('01.C','05/11/2026'),color('01.D','03/11/2026',{RECEBIDO:'03/11/2026'}),
        color('01.E','03/11/2026',{'ENV. CLIENTE':'04/11/2026'}),color('01.F','INVÁLIDA')];
    const reports=buildReports([main('FE')],now,{mainRecords,colorRecords});
    assert.deepEqual(reports[2].items.map(i=>[i.numero,i.sector]),[['77','88'],['79','83']]);
    assert.match(reports[2].items[0].reason,/principal no setor 20, malote no setor 88/);
    const expected=engine.buildForecastAlerts(colorRecords,'colors',now);
    assert.deepEqual(reports[3].items.map(i=>i.reason).sort(),expected.map(a=>a.message).sort());
    assert.deepEqual(reports[3].items.map(i=>i.codigo),['01.A','01.B','01.B']);
    assert.ok(reports[3].items.every(i=>i.detailLabel==='Previsão da cor'));
    assert.ok(!JSON.stringify(reports).includes('Tamanho'));
});

test('paginação mantém título junto dos cards, oito por folha e meia área útil entre datas',()=>{
    const report=buildReports(Array.from({length:21},(_,i)=>main(`P${i}`,{FICHA:`${3-Math.floor(i/7)}/11/2026`})),now)[1];
    const pages=planReportPages(report);
    assert.ok(pages.every(p=>p.cards.length>0&&p.cards.length<=8));
    assert.equal(pages.flatMap(p=>p.cards).length,21);
    for(const page of pages) {
        for(const h of page.headings) assert.ok(page.cards.some(c=>c.y===h.y+22));
        assert.ok(page.cards.every(c=>c.y+c.height<=595.28-24));
    }
    const firsts=new Map(),lasts=new Map();
    pages.forEach((p,n)=>p.cards.forEach(c=>{
        const top=n*(595.28-24-58)+(c.y-58);
        if(!firsts.has(c.item.groupKey))firsts.set(c.item.groupKey,top);
        lasts.set(c.item.groupKey,top+c.height);
    }));
    const keys=[...firsts.keys()];
    for(let i=1;i<keys.length;i++)assert.ok(firsts.get(keys[i])-lasts.get(keys[i-1])>=250);
    // Unsectioned historical reports remain readable.
    assert.equal(planReportPages({items:Array.from({length:9},()=>({codigo:'A'}))}).length,2);
});

test('novos tipos persistem e são acessíveis por ID; falha de qualquer fonte preserva todo o histórico',async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-report-four-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    const store=createReportStore({directory:dir,renderPdf:async(_,file)=>fs.writeFileSync(file,'PDF'),now:()=>now});
    const metas=await store.generate([main('A')],now.toISOString(),{...sources,mainTimestamp:'MAIN',colorTimestamp:'COLORS'});
    assert.deepEqual(metas.map(m=>m.type),['tingimento','entregas','malotes','cores']);
    assert.equal(store.read(metas[2].id).report.sourceTimestamp,'MAIN');
    assert.equal(store.read(metas[3].id).report.sourceTimestamp,'COLORS');
    await assert.rejects(store.generate([main('A')],now.toISOString()),/Fontes de malotes e cores/);
    assert.equal(store.list().length,4);
});
