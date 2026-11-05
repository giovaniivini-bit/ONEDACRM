const test=require('node:test');
const assert=require('node:assert/strict');
const {generateScheduledReports}=require('../scripts/generate-scheduled-reports.cjs');
const {REPORT_TYPES}=require('../automatic-reports');
const success={success:true,isLive:true,generatedReports:[...REPORT_TYPES].map(type=>({type,count:1}))};
const options=extra=>({readToken:()=> '  local-test-only  ',...extra});

test('agendamento usa POST local autenticado, não segue redirecionamento e valida todos os relatórios',async()=>{
    let request;
    const result=await generateScheduledReports(options({fetchImpl:async(url,init)=>{request={url,init};return {ok:true,json:async()=>success};}}));
    assert.equal(request.url.href,'http://127.0.0.1:3036/api/external-sheet?type=prog_feira&refresh=1');
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

test('falhas de fonte, geração parcial, cache e autenticação falham para permitir retentativa do serviço',async()=>{
    const fetchImpl=async()=>({ok:false,status:401});
    await assert.rejects(generateScheduledReports(options({fetchImpl})),/HTTP 401/);
    for(const payload of [{...success,isLive:false},{...success,reportsError:'erro'},{...success,generatedReports:success.generatedReports.slice(0,4)}])await assert.rejects(
        generateScheduledReports(options({fetchImpl:async()=>({ok:true,json:async()=>payload})})),/fontes atualizadas/);
});
