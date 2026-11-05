const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {buildReports,referenceDay,createReportStore}=require('../automatic-reports');
const {createPdfRenderer}=require('../automatic-reports-pdf');
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
    await Promise.all([store.generate(records,now.toISOString()),store.generate(records,now.toISOString())]);
    assert.equal(store.list().length,4);
    const restarted=createReportStore({directory:dir,renderPdf,now:()=>now});
    const id=restarted.list()[0].id;
    assert.ok(restarted.read(id).report.items.length);
    assert.equal(restarted.read('../index'),null);
    let count=0;
    const failing=createReportStore({directory:dir,renderPdf:async(_,file)=>{if(++count===2)throw new Error('disk full');fs.writeFileSync(file,'PDF');},now:()=>now});
    await assert.rejects(failing.generate(records,now.toISOString()),/disk full/);
    assert.equal(restarted.list().length,4);
    await assert.rejects(store.generate([],now.toISOString()),/Fonte indisponível/);
    assert.equal(restarted.list().length,4);
});

test('erro real de escrita durante carregamento da imagem é rejeitado sem encerrar Node',async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-report-error-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    const renderer=createPdfRenderer(async()=>{await new Promise(resolve=>setTimeout(resolve,50));return null;});
    const report=buildReports([main('A'),tf('A','M00','01/10/2026')],now)[0];
    await assert.rejects(renderer({...report,generatedAt:now.toISOString()},path.join(dir,'missing','test.pdf')),/ENOENT/);
});
