const test=require('node:test');
const assert=require('node:assert/strict');
const {generateScheduledReports}=require('../scripts/generate-scheduled-reports.cjs');
const {REPORT_TYPES}=require('../automatic-reports');
const success={success:true,isLive:true,generatedReports:[...REPORT_TYPES].map(type=>({type,count:1}))};
const options=extra=>({readToken:()=> '  local-test-only  ',now:()=>new Date('2026-11-06T10:00:00Z'),...extra});

test('agendamento usa POST local autenticado, não segue redirecionamento e valida todos os relatórios',async()=>{
    let request;
    const result=await generateScheduledReports(options({fetchImpl:async(url,init)=>{request={url,init};return {ok:true,json:async()=>success};}}));
    assert.equal(request.url.href,'http://127.0.0.1:3036/api/automatic-reports/scheduled');
    assert.equal(request.init.method,'POST');
    assert.equal(request.init.headers['X-CRM-Admin-Token'],'local-test-only');
    assert.equal(request.init.redirect,'error');
    assert.equal(result.length,8);
    assert.ok(!JSON.stringify(result).includes('local-test-only'));
});

test('agendamento rejeita destino externo antes de ler ou enviar credencial',async()=>{
    for(const baseUrl of ['https://127.0.0.1','http://external.example','http://user:pass@localhost'])await assert.rejects(
        generateScheduledReports({baseUrl,readToken:()=>assert.fail('Não deveria ler credencial')}),/endereço HTTP local/);
    await assert.rejects(generateScheduledReports(options({readToken:()=>''})),/Credencial/);
});

test('falhas de fonte, geração parcial, cache e autenticação são informadas sem gerar lote falso',async()=>{
    const fetchImpl=async()=>({ok:false,status:401});
    await assert.rejects(generateScheduledReports(options({fetchImpl})),/HTTP 401/);
    for(const payload of [{...success,isLive:false},{...success,reportsError:'erro'},{...success,generatedReports:success.generatedReports.slice(0,4)}])await assert.rejects(
        generateScheduledReports(options({fetchImpl:async()=>({ok:true,json:async()=>payload})})),/fontes atualizadas/);
});

test('runner fora de horário não lê credencial nem chama API; repetição já concluída é ignorada',async()=>{
    assert.deepEqual(await generateScheduledReports(options({now:()=>new Date('2026-11-06T10:01:00Z'),readToken:()=>assert.fail('Fora de horário'),fetchImpl:()=>assert.fail('Fora de horário')})),[]);
    assert.deepEqual(await generateScheduledReports(options({fetchImpl:async()=>({ok:true,json:async()=>({success:true,skipped:true})})})),[]);
});

test('horários seguem São Paulo, incluindo fronteiras de minuto e o calendário local',()=>{
    const {getReportSlot}=require('../report-schedule');
    for(const iso of ['2026-11-06T09:59:59Z','2026-11-06T10:01:00Z','2026-11-06T16:29:59Z','2026-11-06T16:31:00Z','2026-11-06T00:00:00Z'])assert.equal(getReportSlot(new Date(iso)),null,iso);
    assert.equal(getReportSlot(new Date('2026-11-06T10:00:59Z')).key,'2026-11-06T07:00');
    assert.equal(getReportSlot(new Date('2026-11-06T16:30:00Z')).key,'2026-11-06T13:30');
});
