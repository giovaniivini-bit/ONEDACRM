const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { encodePasswordHash } = require('../admin-auth');

const rulesPath = path.join(os.tmpdir(), `oneda-alert-rules-${process.pid}.json`);
const reportsDir=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-routes-reports-'));
process.env.CRM_REPORTS_DIR=reportsDir;
process.env.CRM_ADMIN_TOKEN = 'route-test-secret';
process.env.CRM_ADMIN_PASSWORD_HASH = encodePasswordHash('Senha administrativa para rotas!');
process.env.ALERT_RULES_PATH = rulesPath;

const { requestHandler, validateCalendarRecords, sanitizeProgFeiraRecords, parseCSVRows } = require('../server');

let server;
let port;

function request({ method = 'GET', route = '/', headers = {}, body = '' }) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers:{...headers,...(body?{'Content-Length':Buffer.byteLength(body)}:{})} }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf8')
            }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

before(async () => {
    server = http.createServer(requestHandler);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    port = server.address().port;
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (fs.existsSync(rulesPath)) fs.rmSync(rulesPath, { force: true });
    fs.rmSync(reportsDir,{recursive:true,force:true});
});

test('serves health and blocks internal static files and malformed URLs', async () => {
    assert.equal((await request({ route: '/api/health' })).status, 200);
    const coverageScript = await request({ route: '/image-coverage.js' });
    assert.equal(coverageScript.status, 200);
    assert.match(coverageScript.body, /buildImageCoverageProducts/);
    assert.equal((await request({ route: '/server.js' })).status, 404);
    assert.equal((await request({ route: '/data/full_dataset.csv' })).status, 404);
    assert.equal((await request({ route: '/%E0%A4%A' })).status, 400);
    assert.equal((await request({ route: '/images/%E0%A4%A' })).status, 400);
});

test('fonte de finalização usa a nova planilha gid0 e aceita cabeçalho ainda sem produtos',async()=>{
    const {fetchSampleFinalizationSource}=require('../server');
    let target;
    const empty=await fetchSampleFinalizationSource(async url=>{target=url;return 'PRODUTO,DATA FINALIZAÇÂO\n';});
    assert.ok(target.includes('1bshn2-m-8O2WvkS5uX0Qbnt3YoCbGAM_gLX5pciTmsk'));
    assert.ok(target.includes('gid=0'));
    assert.equal(empty.status,'empty');assert.deepEqual(empty.records,[]);
    assert.equal(empty.isLive,true);
    const valid=await fetchSampleFinalizationSource(async()=> 'DATA DE FINALIZAÇÃO DA AMOSTRA,PRODUTO,PREÇO\n08/11/2026,01.14.01.0000,999\n');
    assert.deepEqual(valid.records,[{PRODUTO:'01.14.01.0000',DATA_FINALIZACAO:'2026-11-08',invalidDate:false}]);
    await assert.rejects(fetchSampleFinalizationSource(async()=>'<html>sem acesso</html>'),/colunas PRODUTO/);
    assert.equal((await request({method:'POST',route:'/api/external-sheet?type=amostras_finalizadas&refresh=1'})).status,401);
    for(const file of ['aproveitamento-dates.js','aproveitamento-finalizacao.js'])assert.equal((await request({route:`/${file}`})).status,200);
});

test('downloader real aceita CSV curto e cabeçalho vazio após redirecionamento sem manter datas antigas',async()=>{
    const https=require('node:https'),{EventEmitter}=require('node:events');
    const cache=path.join(__dirname,'../data/amostras_finalizadas_external.json');
    const saved=fs.existsSync(cache)?fs.readFileSync(cache):null;
    const original=https.get;
    let csv='PRODUTO,DATA FINALIZAÇÂO\n01.14.01.0000,08/11/2026\n';
    try {
        https.get=(url,callback)=>{
            const req=new EventEmitter();req.setTimeout=()=>req;req.destroy=()=>{};
            setImmediate(()=>{
                const res=new EventEmitter();res.setEncoding=()=>{};
                const redirect=String(url).includes('docs.google.com');
                res.statusCode=redirect?307:200;res.headers=redirect?{location:'https://sheets.googleusercontent.com/finalizacao.csv'}:{};
                callback(res);
                if(!redirect){res.emit('data',csv);res.emit('end');}
            });
            return req;
        };
        const read=()=>request({method:'POST',route:'/api/external-sheet?type=amostras_finalizadas&refresh=1',headers:{'X-CRM-Admin-Token':'route-test-secret'}});
        const populated=await read();assert.equal(populated.status,200);
        assert.equal(JSON.parse(populated.body).records[0].DATA_FINALIZACAO,'2026-11-08');
        csv='PRODUTO,DATA FINALIZAÇÂO\n';
        const empty=await read();assert.equal(empty.status,200);
        assert.equal(JSON.parse(empty.body).isLive,true);
        assert.deepEqual(JSON.parse(empty.body).records,[]);
        csv='<html>Sem acesso</html>';
        const fallback=await read();assert.equal(fallback.status,200);
        assert.equal(JSON.parse(fallback.body).isLive,false);
        assert.deepEqual(JSON.parse(fallback.body).records,[]);
        fs.unlinkSync(cache);
        assert.equal((await read()).status,503);
    } finally {
        https.get=original;
        if(saved)fs.writeFileSync(cache,saved);else if(fs.existsSync(cache))fs.unlinkSync(cache);
    }
});

test('sync dos relatórios busca explicitamente a fonte Prog Feira em vez da base principal',async()=>{
    const {fetchProgFeiraReportSource}=require('../server');
    let target;
    const payload=await fetchProgFeiraReportSource(async url=>{
        target=url;
        return 'NUMERO,CODIGO,TIPO,OP,SETOR,QTDE_PEND,FICHA\n123,PROG-ONLY,1,01B,ESTILO,4,03/11/2026';
    });
    assert.ok(target.includes('1VdgVNsnz5HTeoCO2pRseXkvgbVcIDxc9u1zrIVLrv1s'));
    assert.equal(payload.records[0].CODIGO,'PROG-ONLY');
    assert.equal(payload.sourceSchemaVersion,4);
});

test('enforces method and admin authorization on write routes', async () => {
    assert.equal((await request({ route: '/api/sync' })).status, 405);
    assert.equal((await request({ method: 'PUT', route: '/api/alert-rules', body: '{}' })).status, 405);
    assert.equal((await request({ method: 'POST', route: '/api/upload', body: 'csv' })).status, 401);
});

test('serves only the seven code-owned alert rules', async () => {
    const rule = {
        id: 'route-test',
        name: 'Regra HTTP',
        description: '',
        enabled: true,
        severity: 'warning',
        match: 'all',
        conditions: [{ field: 'setor', operator: 'equals', value: '13' }],
        message: 'OF {op}',
        system: false
    };
    fs.writeFileSync(rulesPath, JSON.stringify({ version: 2, rules: [rule] }), 'utf8');
    const rejected = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'Content-Type': 'application/json', 'X-CRM-Admin-Token': 'route-test-secret' },
        body: JSON.stringify({ rules: [rule] })
    });
    assert.equal(rejected.status, 405);

    const loaded = await request({ route: '/api/alert-rules' });
    assert.equal(loaded.status, 200);
    assert.deepEqual(JSON.parse(loaded.body).data.map(item => item.id), [
        'setor13-calendario',
        'setor01-limite-dias',
        'malotes-parte-principal',
        'cq-amostra-reprovada',
        'pend-produto-aviamento',
        'pend-produto-cor',
        'prog-feira-limite-setor'
    ]);
});

test('authenticates administrative writes with an HttpOnly session cookie', async () => {
    const origin = `http://127.0.0.1:${port}`;
    const missingOrigin = await request({
        method: 'POST',
        route: '/api/admin/login',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'Senha administrativa para rotas!' })
    });
    assert.equal(missingOrigin.status, 403);

    const invalid = await request({
        method: 'POST',
        route: '/api/admin/login',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ password: 'senha incorreta' })
    });
    assert.equal(invalid.status, 401);

    const login = await request({
        method: 'POST',
        route: '/api/admin/login',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ password: 'Senha administrativa para rotas!' })
    });
    assert.equal(login.status, 200);
    assert.match(login.headers['set-cookie'][0], /HttpOnly/);
    assert.match(login.headers['set-cookie'][0], /SameSite=Strict/);
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    const session = await request({
        route: '/api/admin/session',
        headers: { Cookie: cookie, Origin: origin }
    });
    assert.equal(JSON.parse(session.body).authenticated, true);

    const saved = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin },
        body: JSON.stringify({ rules: [] })
    });
    assert.equal(saved.status, 405);

    const crossOrigin = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://evil.example' },
        body: JSON.stringify({ rules: [] })
    });
    assert.equal(crossOrigin.status, 405);

    const logout = await request({
        method: 'POST',
        route: '/api/admin/logout',
        headers: { Cookie: cookie, Origin: origin }
    });
    assert.equal(logout.status, 200);
    assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
    const afterLogout = await request({
        route: '/api/admin/session',
        headers: { Cookie: cookie, Origin: origin }
    });
    assert.equal(JSON.parse(afterLogout.body).authenticated, false);
});

test('validates the industrial calendar before it can replace the cache', () => {
    const validRows = Array.from({ length: 40 }, (_, index) => ({
        SEMANA: `26${String(index + 1).padStart(2, '0')}`,
        'Data limite para setor 13': '24/set.',
        'data setor 20 -  CORTE iniciar': '',
        'data limite para liberar pendência de estampa': '',
        'quantidade dias aceitaveis para ficar pendente setor 01': '',
        'quantidade dias SETOR  01A': '',
        'quantidade dias SETOR  01B': '',
        'quantidade dias SETOR 1B2': '',
        'quantidade dias SETOR 02M': '',
        'quantidade dias SETOR 02B': '',
        'quantidade dias SETOR 01C': '',
        'quantidade dias SETOR 01E': '',
        'quantidade dias SETOR 1E2': '',
        'Quantidade dias SETOR 02C': ''
    }));
    const limitRow = {
        SEMANA: '',
        'Data limite para setor 13': '',
        'data setor 20 -  CORTE iniciar': '',
        'data limite para liberar pendência de estampa': '',
        'quantidade dias aceitaveis para ficar pendente setor 01': '2 dias',
        'quantidade dias SETOR  01A': '7 dias',
        'quantidade dias SETOR  01B': '7 dias',
        'quantidade dias SETOR 1B2': '5 dias',
        'quantidade dias SETOR 02M': '3 dias',
        'quantidade dias SETOR 02B': '7 dias',
        'quantidade dias SETOR 01C': '3 dias',
        'quantidade dias SETOR 01E': '4 dias',
        'quantidade dias SETOR 1E2': '4 dias',
        'Quantidade dias SETOR 02C': '3 dias'
    };
    const calendarRows = [...validRows, limitRow];
    assert.equal(validateCalendarRecords(calendarRows).length, 41);
    assert.deepEqual(validateCalendarRecords(calendarRows).at(-1), limitRow);
    const embeddedLimitRows = validRows.map((row, index) => index === 0 ? {
        ...row,
        ...Object.fromEntries(Object.entries(limitRow).slice(4))
    } : row);
    assert.equal(validateCalendarRecords(embeddedLimitRows).length, 40);
    assert.throws(() => validateCalendarRecords([...validRows.slice(0, 3), limitRow]), /incompleto/);
    assert.throws(() => validateCalendarRecords([...validRows.map(row => ({ ...row, 'Data limite para setor 13': '' })), limitRow]), /inválido/);
    assert.throws(() => validateCalendarRecords([...validRows.map((row, index) => ({
        ...row,
        SEMANA: `99${String(index + 1).padStart(2, '0')}`,
        'Data limite para setor 13': 'arquivo indisponivel'
    })), limitRow]), /inválido/);
    assert.throws(() => validateCalendarRecords([...validRows, { ...limitRow, 'quantidade dias SETOR 02B': '' }]), /inválido/);
    assert.throws(() => validateCalendarRecords([...validRows, limitRow, { ...limitRow }]), /inválido/);
    assert.throws(() => validateCalendarRecords([...validRows, { ...limitRow, INESPERADO: 'conteúdo' }]), /inválido/);
});

test('projects Prog Feira records and rejects exports without current TIPO 1 rows', () => {
    const sanitized = sanitizeProgFeiraRecords([{
        NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01E', TIPO: '1', FICHA: '09/10',
        PRECO_VENDA: '99,90', PRECO_COM: '45,00', COD_CLIENTE: 'B41', ID: 'interno'
    }]);
    assert.equal(sanitized.length, 1);
    assert.equal(sanitized[0].CODIGO, '01.11.00.7904');
    assert.equal(sanitized[0].FICHA, '09/10');
    assert.equal(Object.hasOwn(sanitized[0], 'PRECO_VENDA'), false);
    assert.equal(Object.hasOwn(sanitized[0], 'PRECO_COM'), false);
    assert.equal(sanitized[0].COD_CLIENTE, 'B41');
    assert.equal(Object.hasOwn(sanitized[0], 'ID'), false);
    assert.throws(() => sanitizeProgFeiraRecords([
        { NUMERO: '77826', CODIGO: '01.11.00.7904', TIPO: '2' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', TIPO: '3' }
    ]), /TIPO 1/);
});

test('rejects alert-rule writes and foreign CORS preflight', async () => {
    const oversized = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'X-CRM-Admin-Token': 'route-test-secret' },
        body: Buffer.alloc(256 * 1024 + 1, 120)
    });
    assert.equal(oversized.status, 405);

    const foreign = await request({
        method: 'OPTIONS',
        route: '/api/alert-rules',
        headers: { Origin: 'https://evil.example', Host: `127.0.0.1:${port}` }
    });
    assert.equal(foreign.status, 403);
});
test('Prog Feira normaliza cabeçalho COD CLIENTE e mantém células vazias sem expor preços', () => {
    const rows = sanitizeProgFeiraRecords([
        { CODIGO: 'A', TIPO: '1', 'COD CLIENTE': ' B42 ', PRECO_COM: '10' },
        { CODIGO: 'B', TIPO: '1', COD_CLIENTE: '   ', PRECO_VENDA: '20' }
    ]);
    assert.equal(rows[0].COD_CLIENTE, 'B42');
    assert.equal(rows[1].COD_CLIENTE, '');
    assert.equal(Object.hasOwn(rows[0], 'PRECO_COM'), false);
    assert.equal(Object.hasOwn(rows[1], 'PRECO_VENDA'), false);
});
test('nova exportação Prog Feira projeta campos operacionais sem preços e mantém vínculos de parte/fluxo',()=>{
    const input=[{'Número':'100','Código':'ABC',Parte:'FE',Fluxo:'D36',Setor:'01A','Descrição2':'B45','Qtde Pend':'4','Preço':'100','Cliente Cnpj':'privado'}, {'Número':'100','Código':'ABC',Parte:'CO',Fluxo:'D41',Setor:'D01','Qtde Pend':'4'}];
    const rows=sanitizeProgFeiraRecords(input);assert.equal(rows.length,2);assert.equal(rows[0].COD_CLIENTE,'B45');assert.equal(rows[0].OP,'01A');assert.equal(rows[1].FLUXO,'D41');assert.equal(rows[1].PARTE,'CO');
    assert.equal(JSON.stringify(rows).includes('privado'),false);assert.equal(Object.hasOwn(rows[0],'Preço'),false);
    assert.deepEqual(sanitizeProgFeiraRecords(rows),rows,'cache projetado pode ser lido novamente sem perder relações');
    assert.equal(sanitizeProgFeiraRecords(input.slice(1)).length,1);
    assert.equal(sanitizeProgFeiraRecords([{...input[0],'Qtde Pend':'0'}]).length,1);
});
test('API Prog Feira conserva somente o código Etiqueta e mantém projeção no cache',()=>{
    const rows=sanitizeProgFeiraRecords([{'Número':'100','Código':'ABC',Parte:'FE',Fluxo:'D36',Setor:'01A',Etiqueta:' CFUN ','Desc Etiqueta':'descrição não solicitada','Qtde Pend':'4','Preço':'99'}]);
    assert.equal(rows[0].ETIQUETA,'CFUN');assert.equal(Object.hasOwn(rows[0],'Desc Etiqueta'),false);assert.equal(Object.hasOwn(rows[0],'Preço'),false);assert.deepEqual(sanitizeProgFeiraRecords(rows),rows);
});

test('costura preserva matriz CSV e protege atualização da nova fonte', async()=>{
    const rows=parseCSVRows('\ufeff,26/10,26/10\r\nJÔ,"2,5","linha 1\nlinha 2"\r\n');
    assert.deepEqual(rows,[['','26/10','26/10'],['JÔ','2,5','linha 1\nlinha 2']]);
    for(const file of ['costura.js','costura-view.js','corte-view.js','costura.css','product-stylist.js']) assert.equal((await request({route:'/'+file})).status,200);
    assert.equal((await request({method:'POST',route:'/api/external-sheet?type=producao_costura&refresh=1'})).status,401);
});

test('fontes dos relatórios usam base principal para malotes e cores filtradas como na tela',async()=>{
    const {fetchAutomaticReportSources,createColorPayload}=require('../server');
    const colors='TINTURARIA,RESPONSÁVEL,PRODUTO,COR,PREVISÃO,PANTONE\nT,ANA,01.A,AZUL,03/11/2026,19-4052\nT,ANA,01.B,VERDE,03/11/2026,-\n';
    const urls=[];
    const fetchSheet=async url=>{urls.push(url);return url.includes('1j7k8')?colors:url.includes('1aAsiic')?'TIPO AVIAMENTO,RESPONSÁVEL,PRODUTO,PREVISÃO\nBOTÃO,ANA,01.A,04/11/2026\n':'Número,Código,Setor\n77,01.A,88\n';};
    const sources=await fetchAutomaticReportSources({},fetchSheet);
    assert.equal(urls.length,3);
    assert.ok(urls.some(url=>url.includes('1CWbwOq6')));
    assert.ok(urls.some(url=>url.includes('1j7k8WWv')&&url.includes('722944309')));
    assert.equal(sources.mainRecords[0]['Setor'],'88');
    assert.deepEqual(sources.colorRecords.map(r=>r.PRODUTO),['01.A']);
    assert.equal(createColorPayload(sources.colorRecords).byResponsavel.ANA,1);
    urls.length=0;
    await fetchAutomaticReportSources({mainRecords:sources.mainRecords},fetchSheet);
    assert.equal(urls.length,2,'sync geral reutiliza a base que acabou de sincronizar');
    assert.equal(sources.trimRecords[0].PRODUTO,'01.A');
    await assert.rejects(fetchAutomaticReportSources({},async()=>'<html>Erro Google</html>'),/Fonte de malotes inválida/);
    await assert.rejects(fetchAutomaticReportSources({mainRecords:sources.mainRecords},async()=>'Produto,Previsão\n01.A,03/11/2026'),/Fonte de cores inválida/);
    await assert.rejects(fetchAutomaticReportSources({mainRecords:sources.mainRecords},async url=>url.includes('1j7k8')?colors:'Produto,Previsão\n01.A,03/11/2026'),/Fonte de aviamentos inválida/);
    assert.equal((await request({route:'/automatic-report-groups.js'})).status,200);
});

test('excluir relatório exige autorização, valida ID e remove PDF e snapshot sem atingir outros',async()=>{
    const id='a'.repeat(32)+'-malotes', other='b'.repeat(32)+'-cores';
    const metas=[{id},{id:other}];
    fs.writeFileSync(path.join(reportsDir,'index.json'),JSON.stringify(metas));
    for(const meta of metas)for(const extension of ['json','pdf'])fs.writeFileSync(path.join(reportsDir,`${meta.id}.${extension}`),extension==='json'?'{}':'PDF');
    const route=`/api/automatic-reports?id=${id}`;
    const headers={'X-CRM-Admin-Token':'route-test-secret'};
    assert.equal((await request({method:'DELETE',route})).status,401);
    assert.equal(fs.existsSync(path.join(reportsDir,`${id}.pdf`)),true);
    assert.equal((await request({method:'DELETE',route:'/api/automatic-reports',headers})).status,400);
    assert.equal((await request({method:'DELETE',route:'/api/automatic-reports?id=..%2Findex',headers})).status,404);
    assert.equal((await request({method:'DELETE',route,headers})).status,200);
    assert.equal((await request({route})).status,404);
    assert.equal((await request({route:route+'&format=pdf'})).status,404);
    assert.equal(fs.existsSync(path.join(reportsDir,`${id}.pdf`)),false);
    assert.equal(fs.existsSync(path.join(reportsDir,`${id}.json`)),false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(reportsDir,'index.json'),'utf8')),[{id:other}]);
    assert.equal((await request({method:'DELETE',route,headers})).status,404);
});

test('excluir PDFs selecionados ou todos exige autorização e valida todo o lote antes de apagar',async()=>{
    const ids=['c'.repeat(32)+'-entregas','d'.repeat(32)+'-cores','e'.repeat(32)+'-malotes'];
    fs.writeFileSync(path.join(reportsDir,'index.json'),JSON.stringify(ids.map(id=>({id}))));
    for(const id of ids)for(const ext of ['pdf','json'])fs.writeFileSync(path.join(reportsDir,`${id}.${ext}`),ext==='json'?'{}':'PDF');
    const headers={'X-CRM-Admin-Token':'route-test-secret','Content-Type':'application/json'};
    assert.equal((await request({method:'DELETE',route:'/api/automatic-reports',body:JSON.stringify({ids})})).status,401);
    for(const body of [null,{}, {ids:[]},{ids:[ids[0],'../index']}] )assert.equal((await request({method:'DELETE',route:'/api/automatic-reports',headers,body:JSON.stringify(body)})).status,400);
    assert.equal(JSON.parse(fs.readFileSync(path.join(reportsDir,'index.json'))).length,3);
    const response=await request({method:'DELETE',route:'/api/automatic-reports',headers,body:JSON.stringify({ids:ids.slice(0,2)})});
    assert.equal(response.status,200);assert.deepEqual(JSON.parse(response.body).deletedIds,ids.slice(0,2));
    assert.equal((await request({route:`/api/automatic-reports?id=${ids[0]}&format=pdf`})).status,404);
    assert.equal((await request({route:`/api/automatic-reports?id=${ids[2]}&format=pdf`})).status,200);
    assert.equal((await request({method:'DELETE',route:'/api/automatic-reports',headers,body:JSON.stringify({ids:[ids[2]]})})).status,200);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(reportsDir,'index.json'))),[]);
});

test('rota agendada exige POST autenticado e mantém recursos internos inacessíveis',async()=>{
    assert.equal((await request({route:'/api/automatic-reports/scheduled'})).status,405);
    assert.equal((await request({method:'POST',route:'/api/automatic-reports/scheduled'})).status,401);
    const headers={'X-CRM-Admin-Token':'route-test-secret'};
    assert.equal((await request({method:'POST',route:'/api/automatic-reports/scheduled',headers:{...headers,Host:'crm.example'}})).status,403);
    assert.equal((await request({method:'POST',route:'/api/automatic-reports/scheduled',headers:{...headers,'X-Forwarded-For':'203.0.113.1'}})).status,403);
    assert.equal((await request({route:'/report-schedule.js'})).status,404);
    assert.equal((await request({route:'/data/automatic-reports/schedule-runs.json'})).status,404);
});

test('sincronizar Prog Feira atualiza a fonte sem gerar PDFs nem baixar fontes dos relatórios',async()=>{
    const https=require('node:https'),{EventEmitter}=require('node:events');
    const cache=path.join(__dirname,'../data/prog_feira_external.json');
    const saved=fs.existsSync(cache)?fs.readFileSync(cache):null;
    const reportsBefore=fs.readFileSync(path.join(reportsDir,'index.json'),'utf8');
    const original=https.get,urls=[];
    try {
        https.get=(url,callback)=>{
            urls.push(String(url));const req=new EventEmitter();req.setTimeout=()=>req;req.destroy=()=>{};
            setImmediate(()=>{const res=new EventEmitter();res.statusCode=200;res.headers={};res.setEncoding=()=>{};callback(res);
                res.emit('data','Número,Código,Parte,Fluxo,Setor,Qtde Pend\n'+Array.from({length:40},(_,i)=>`${i+1},01.12.00.1000,FE,D36,01B,4`).join('\n'));res.emit('end');});return req;
        };
        const response=await request({method:'POST',route:'/api/external-sheet?type=prog_feira&refresh=1',headers:{'X-CRM-Admin-Token':'route-test-secret'}});
        assert.equal(response.status,200);const payload=JSON.parse(response.body);assert.equal(payload.success,true);assert.equal(payload.isLive,true);assert.equal(payload.records.length,40);
        assert.equal(Object.hasOwn(payload,'generatedReports'),false);assert.equal(urls.length,1);
        assert.equal(fs.readFileSync(path.join(reportsDir,'index.json'),'utf8'),reportsBefore);
    } finally {https.get=original;if(saved)fs.writeFileSync(cache,saved);else if(fs.existsSync(cache))fs.unlinkSync(cache);}
});


test('geração manual exige POST administrativo, atualiza fontes e preserva histórico em falha', async () => {
    const route = '/api/automatic-reports/generate';
    for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await request({ method, route })).status, 405);
    assert.equal((await request({ method: 'POST', route })).status, 401);
    const origin = `http://127.0.0.1:${port}`;
    const login = await request({ method: 'POST', route: '/api/admin/login', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'Senha administrativa para rotas!' }) });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    assert.equal((await request({ method: 'POST', route, headers: { Cookie: cookie, Origin: 'https://other.example' } })).status, 401);
    const https = require('node:https'), { EventEmitter } = require('node:events');
    const caches = ['prog_feira_external.json', 'cores_external.json', 'aviamentos_external.json'].map(name => path.join(__dirname, '../data', name));
    const saved = caches.map(file => fs.existsSync(file) ? fs.readFileSync(file) : null);
    const original = https.get;
    let fail = false;
    const urls = [];
    try {
        https.get = (url, callback) => {
            urls.push(String(url));
            const req = new EventEmitter(); req.setTimeout = () => req; req.destroy = () => {};
            setImmediate(() => {
                const res = new EventEmitter(); res.statusCode = 200; res.headers = {}; res.setEncoding = () => {}; callback(res);
                const csv = String(url).includes('1VdgVN') ? 'Número,Código,Parte,Fluxo,Setor,Qtde Pend\n123,01.12.00.TESTE,FE,D36,01B,1'
                    : String(url).includes('1j7k8') ? 'PRODUTO,RESPONSÁVEL,PREVISÃO,PANTONE\n01.12.00.TESTE,ANA,07/11/2026,123'
                    : String(url).includes('1aAsiic') ? 'PRODUTO,PREVISÃO,TIPO AVIAMENTO\n01.12.00.TESTE,07/11/2026,BOTÃO'
                    : 'NUMERO,CODIGO,SETOR\n123,01.12.00.TESTE,01';
                const [header, row] = csv.split('\n');
                res.emit('data', fail ? '<html>Falha de fonte</html>' : header + '\n' + Array(30).fill(row).join('\n')); res.emit('end');
            });
            return req;
        };
        const headers = { Cookie: cookie, Origin: origin };
        const [first, concurrent] = await Promise.all([request({ method: 'POST', route, headers }), request({ method: 'POST', route, headers })]);
        assert.equal(first.status, 200); assert.equal(concurrent.status, 200);
        const result = JSON.parse(first.body);
        assert.equal(result.generatedReports.length, 8); assert.equal(result.isLive, true);
        assert.deepEqual(JSON.parse(concurrent.body).generatedReports, result.generatedReports);
        assert.equal(urls.length, 4);
        const id = result.generatedReports[0].id;
        assert.equal((await request({ route: `/api/automatic-reports?id=${id}&format=pdf` })).body.slice(0, 5), '%PDF-');
        const before = fs.readFileSync(path.join(reportsDir, 'index.json'), 'utf8');
        fail = true;
        const failed = await request({ method: 'POST', route, headers });
        assert.equal(failed.status, 500);
        assert.match(JSON.parse(failed.body).error, /histórico anterior foi preservado/);
        assert.equal(fs.readFileSync(path.join(reportsDir, 'index.json'), 'utf8'), before);
        assert.equal(fs.existsSync(path.join(reportsDir, 'schedule-runs.json')), false);
    } finally {
        https.get = original;
        caches.forEach((file, i) => { if (saved[i]) fs.writeFileSync(file, saved[i]); else if (fs.existsSync(file)) fs.unlinkSync(file); });
    }
});
