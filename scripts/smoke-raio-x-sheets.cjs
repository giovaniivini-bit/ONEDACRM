// Optional integration smoke: NODE_PATH must expose Playwright; point CRM_SMOKE_URL to the preview.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.CRM_SMOKE_URL || 'http://127.0.0.1:3036';
(async () => {
    const fixture = (await fetch('https://crm.136-248-111-213.sslip.io/api/data?source=raw').then(r => r.json()));
    const template = fixture.data.find(row => ['01','1'].includes(String(row.Setor)));
    assert.ok(template);
    const code = '01.99.00.0001A';
    const main = (op, codigo, setor) => ({...template, 'Número':op, 'Código':codigo, Setor:setor, 'Qtde Original':'4'});
    fixture.data = [main('900001',code,'01'),main('900001',code,'D01'),main('900001',code,'X01'),main('900002','01.99.00.0001','01'),main('900002','01.99.00.0001','D01'),main('900003','01.99.00.0001B','01')];
    const attack = '<img src=x onerror="window.__rxInjected=1">';
    const colors = { success:true, isLive:true, records:[
        {PRODUTO:code,COR:'AZUL '+attack,PANTONE:'19-4001','ENV CLIENTE':'20/10/2026','PREVISÃO':'10/10/2026'},
        {PRODUTO:code,COR:'VERDE','ENV CLIENTE':'','PREVISÃO':'30/10/2026'},
        {PRODUTO:'01.99.00.0001B',COR:'NÃO DEVE APARECER'}
    ] };
    const trims = { success:true, isLive:true, records:[
        {PRODUTO:code,'TIPO AVIAMENTO':'BOTÃO','DESCRIÇÃO':'18 mm','ENV. CLIENTE':'22/10/2026','PREVISÃO':'10/10/2026'},
        {PRODUTO:code,'TIPO AVIAMENTO':'ETIQUETA','ENV. CLIENTE':'','PREVISÃO':'31/10/2026'}
    ] };
    const browser = await chromium.launch({headless:true,channel:process.env.CRM_SMOKE_BROWSER || 'chrome'});
    try {
        const page = await browser.newPage({viewport:{width:1440,height:1100}});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/api/**',async route=>{
            const url = new URL(route.request().url());
            if (url.pathname==='/api/data') return route.fulfill({json:fixture});
            const type=url.searchParams.get('type');
            if(type==='cores'||type==='aviamentos'){
                await new Promise(resolve=>setTimeout(resolve,type==='cores'?2500:3500));
                return route.fulfill({json:type==='cores'?colors:trims});
            }
            return route.fulfill({json:{success:true,records:[],rules:[],images:{},count:0}});
        });
        await page.goto(base,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>document.querySelector('#systemStatusText')?.textContent.includes('Conectado'));
        await page.locator('.nav-link[data-submodule="raio-x"]').click();
        await page.locator('#raioXGallery .rx-card').first().waitFor();
        assert.equal(await page.locator('#raioXGallery .rx-sheet-details').count(),0,'sem complemento antes de localizar informações na planilha');
        await page.waitForFunction(()=>document.querySelectorAll('#raioXGallery .rx-sheet-item').length===4);
        assert.equal(await page.locator('#raioXGallery .rx-card').count(),3);
        const a=page.locator('#raioXGallery .rx-card').filter({has:page.getByText(code,{exact:true})});
        assert.equal(await a.locator('[data-rx-sheet="color"] .rx-sheet-item').count(),2);
        assert.equal(await a.locator('[data-rx-sheet="trim"] .rx-sheet-item').count(),2);
        const colorItems=a.locator('[data-rx-sheet="color"] .rx-sheet-item');
        assert.ok((await colorItems.first().textContent()).includes(attack));
        assert.equal(await a.locator('.rx-sheet-details img').count(),0);
        assert.equal(await page.evaluate(()=>window.__rxInjected),undefined);
        for(const [kind,values] of [['color',['20/10/2026','30/10/2026']],['trim',['22/10/2026','31/10/2026']]]){
            const dates=await a.locator('[data-rx-sheet="'+kind+'"] .rx-sheet-delivery strong').allTextContents();
            assert.deepEqual(dates,values);
        }
        assert.equal(await page.locator('#raioXGallery .rx-card').filter({has:page.getByText('01.99.00.0001',{exact:true})}).locator('.rx-sheet-details').count(),0);
        assert.equal(await page.locator('#raioXGallery .rx-card').filter({has:page.getByText('01.99.00.0001B',{exact:true})}).locator('.rx-sheet-details').count(),0);
        await page.emulateMedia({media:'print'});
        await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
        assert.equal(await page.locator('#raioXPrintReport .rx-sheet-item').count(),4);
        if(process.env.CRM_SMOKE_PDF) await page.pdf({path:process.env.CRM_SMOKE_PDF,preferCSSPageSize:true,printBackground:true});
        await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
        assert.equal(await page.locator('#raioXPrintReport').count(),0);
        await page.emulateMedia({media:'screen'});
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({cards:3,details:4,checks:'late load,exact suffix,sent priority,forecast,not found,escaping,print,cleanup',errors}));
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
