const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const completion=require('../aproveitamento-finalizacao');
const {requestHandler,fetchSampleFinalizationSource}=require('../server');

(async()=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-finalizacao-preview-'));
    const baseRows=[
        {CODIGO:'01.14.01.0000',DESCRICAO:'CAMISETA A',PEDIDO:'S',PRECO_VENDA:'10,00',DATA_CAD:'1/1/2025',DT_APROV:'1/2/2025'},
        {CODIGO:'02.14.01.0000',DESCRICAO:'CAMISETA B',PEDIDO:'N',PRECO_VENDA:'20,00',DATA_CAD:'1/1/2028',DT_APROV:'1/2/2028'},
        {CODIGO:'01.14.01.0000A',DESCRICAO:'CAMISETA C',PEDIDO:'N',PRECO_VENDA:'30,00'},
        {CODIGO:'13.14.01.0000',DESCRICAO:'CAMISETA D',PEDIDO:'S',PRECO_VENDA:'40,00'},
        {CODIGO:'05.14.01.0000',DESCRICAO:'CAMISETA E',PEDIDO:'N',PRECO_VENDA:'50,00'}
    ];
    const records=completion.parseMatrix([['Produto','Data de finalização da amostra'],
        ['01.14.01.0000','01/11/2026'],['02.14.01.0000','20/10/2026'],['01.14.01.0000A','08/11/2026'],
        ['05.14.01.0000','21/10/2026'],['05.14.01.0000','22/10/2026'],['99.00.00.0000','31/12/2040']]);
    let primary={success:true,records:baseRows},finalization={success:true,isLive:true,records};
    let failFinalization=false,browser;
    const server=http.createServer(requestHandler);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    try {
        browser=await chromium.launch({headless:true,channel:'msedge'});
        const page=await browser.newPage({viewport:{width:1440,height:1000}});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/api/**',route=>{
            const url=new URL(route.request().url());
            if(url.pathname==='/api/external-sheet') {
                const type=url.searchParams.get('type');
                if(type==='aproveitamento')return route.fulfill({json:primary});
                if(type==='amostras_finalizadas')return route.fulfill({status:failFinalization?503:200,json:failFinalization?{success:false,error:'Fonte de teste indisponível'}:finalization});
            }
            const payload=url.pathname==='/api/drive-images'?{success:true,data:{map:{},count:0}}:{success:true,data:[],records:[],count:0};
            return route.fulfill({json:payload});
        });
        const view=page.locator('#print-area-aproveitamento');
        const table=view.locator('table').last();
        const open=async()=>{
            await page.goto(base);
            await page.locator('.nav-link[data-submodule="aproveitamento"]').click();
            await page.waitForFunction(()=>document.querySelector('#print-area-aproveitamento')?.textContent.includes('Base completa:'));
        };
        const total=async(expected)=>{
            await page.waitForFunction(expected=>parseInt(document.querySelector('#print-area-aproveitamento .kpi-value')?.textContent)===expected,expected);
        };
        await open();await total(5);
        assert.ok((await view.locator('h2').textContent()).includes('BASE COMPLETA'));
        assert.match(await view.locator('.kpi-value').nth(2).textContent(),/30,00/);
        assert.ok((await view.textContent()).includes('1 com datas divergentes'));
        assert.ok((await view.textContent()).includes('08/11/2026'));
        assert.ok(!(await view.textContent()).includes('2040'));
        await page.getByRole('button',{name:'15 dias',exact:true}).click();await total(2);
        assert.match(await view.locator('.kpi-value').nth(1).textContent(),/1/);
        assert.match(await view.locator('.kpi-value').nth(2).textContent(),/20,00/);
        await page.getByRole('button',{name:'30 dias',exact:true}).click();await total(3);
        await view.getByRole('combobox').selectOption({label:'Renner'});await total(1);
        await view.getByRole('combobox').selectOption('all');await total(3);
        await page.getByRole('button',{name:'Personalizado',exact:true}).click();
        await view.locator('input[type="date"]').nth(0).fill('2026-11-01');
        await view.locator('input[type="date"]').nth(0).dispatchEvent('change');
        await view.locator('input[type="date"]').nth(1).fill('2026-11-01');
        await view.locator('input[type="date"]').nth(1).dispatchEvent('change');await total(1);
        assert.equal(await table.locator('tbody tr').count(),1);
        assert.ok((await table.locator('tbody').textContent()).includes('01/11/2026'));
        assert.ok((await table.locator('tbody').textContent()).includes('10,00'));
        await page.screenshot({path:path.join(directory,'periodo.png')});
        await table.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(directory,'tabela.png')});
        await page.pdf({path:path.join(directory,'finalizacao.pdf'),format:'A4',landscape:true,printBackground:true});
        await view.locator('input[type="date"]').nth(0).fill('2026-12-01');
        await view.locator('input[type="date"]').nth(0).dispatchEvent('change');await total(0);
        assert.ok((await view.textContent()).includes('A data inicial deve ser anterior'));
        finalization={success:true,isLive:true,records:[]};
        await open();await total(5);
        assert.ok((await view.textContent()).includes('Aguardando datas válidas'));
        await page.getByRole('button',{name:'15 dias',exact:true}).click();await total(0);
        await page.getByRole('button',{name:'Todo o período',exact:true}).click();await total(5);
        assert.ok((await table.locator('tbody').textContent()).includes('Sem data de finalização'));
        failFinalization=true;
        await open();await total(5);
        assert.ok((await view.textContent()).includes('Fonte de finalização indisponível'));
        assert.ok(!(await view.textContent()).includes('Datas de finalização em cache'));
        failFinalization=false;finalization={success:true,isLive:false,records};
        await open();await total(5);
        assert.ok((await view.textContent()).includes('Datas de finalização em cache'));
        // Read-only real sources: source sheet is never modified by this script.
        primary=await fetch('https://crm.136-248-111-213.sslip.io/api/external-sheet?type=aproveitamento').then(r=>r.json());
        finalization=await fetchSampleFinalizationSource();
        const joined=completion.join(primary.records,finalization);
        const stats=completion.summarize(joined);
        await open();await total(primary.records.length);
        if(!await page.locator('body').evaluate(el=>el.classList.contains('light-mode')))await page.locator('#themeToggleBtn').click();
        await view.locator('.exec-action-btn.active').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
        await page.screenshot({path:path.join(directory,'real-claro.png')});
        if(await page.locator('body').evaluate(el=>el.classList.contains('light-mode')))await page.locator('#themeToggleBtn').click();
        await view.locator('.exec-action-btn.active').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
        await page.screenshot({path:path.join(directory,'real.png')});
        const example=joined.find(row=>row.CRM_FINALIZACAO.date);
        if(example) {
            const code=example.PRODUTO || example.CODIGO || example.IMG_PRODUTO;
            await page.locator('#cqSearchInput').fill(code);
            await page.locator('#cqSearchInput').press('Enter');
            await table.locator('tbody tr').first().getByText(code,{exact:true}).waitFor();
            await table.scrollIntoViewIfNeeded();
            await page.screenshot({path:path.join(directory,'real-data-produto.png')});
        }
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:path.join(directory,'celular.png')});
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({directory,records:primary.records.length,finalizationRows:finalization.count,stats,errors}));
    } finally {
        if(browser)await browser.close();
        await new Promise(resolve=>server.close(resolve));
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
