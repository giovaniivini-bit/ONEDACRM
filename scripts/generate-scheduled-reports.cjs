const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {REPORT_TYPES}=require('../automatic-reports');

async function generateScheduledReports({baseUrl='http://127.0.0.1:3036',tokenFile=path.join(os.homedir(),'.config','oneda-crm','admin-token'),
    fetchImpl=fetch,readToken=file=>fs.readFileSync(file,'utf8')}={}) {
    const base=new URL(baseUrl);
    if(base.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname) || base.username || base.password)throw new Error('O agendamento exige o endereço HTTP local do CRM.');
    const token=String(await readToken(tokenFile)).trim();
    if(!token)throw new Error('Credencial administrativa local indisponível.');
    const response=await fetchImpl(new URL('/api/external-sheet?type=prog_feira&refresh=1',base),{
        method:'POST',headers:{'X-CRM-Admin-Token':token},redirect:'error',signal:AbortSignal.timeout(8*60*1000)
    });
    if(!response.ok)throw new Error(`Falha ao gerar relatórios: HTTP ${response.status}.`);
    const payload=await response.json();
    const types=new Set(payload.generatedReports?.map(report=>report.type));
    if(!payload.success || payload.isLive!==true || payload.reportsError || types.size!==REPORT_TYPES.size || [...REPORT_TYPES].some(type=>!types.has(type)))throw new Error('A geração dos relatórios não foi concluída com fontes atualizadas.');
    return payload.generatedReports.map(report=>({type:report.type,count:report.count}));
}

if(require.main===module)generateScheduledReports({baseUrl:process.env.CRM_REPORTS_BASE_URL,tokenFile:process.env.CRM_ADMIN_TOKEN_FILE})
    .then(reports=>console.log(JSON.stringify({success:true,generatedAt:new Date().toISOString(),reports})))
    .catch(()=>{console.error('Falha na geração agendada. Consulte o serviço do CRM; o histórico anterior foi preservado.');process.exitCode=1;});

module.exports={generateScheduledReports};
