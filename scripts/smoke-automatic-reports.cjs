const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const {createReportStore}=require('../automatic-reports');
const {createPdfRenderer}=require('../automatic-reports-pdf');
const {resolveImageEntry}=require('../image-coverage');

(async()=>{
    const origin='https://crm.136-248-111-213.sslip.io';
    const [source,index,main]=await Promise.all([
        fetch(`${origin}/api/external-sheet?type=prog_feira`).then(r=>r.json()),
        fetch(`${origin}/api/drive-images`).then(r=>r.json()),
        fetch(`${origin}/api/data?source=raw`).then(r=>r.json())
    ]);
    assert.ok(source.success&&Array.isArray(source.records));
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'oneda-auto-report-preview-'));
    const renderer=createPdfRenderer(async item=>{
        const entry=resolveImageEntry(index.data.map,item.imageCode,item.numero);
        const url=entry?.isLocal!==false
            ? `${origin}/api/image-file?file=${encodeURIComponent(entry?.filename||`${item.imageCode}.jpg`)}`
            : entry?.id ? `${origin}/api/proxy-image?id=${encodeURIComponent(entry.id)}&sz=w1200` : '';
        if(!url)return null;
        const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
        if(!response.ok||!/^image\/(png|jpeg)/.test(response.headers.get('content-type')||''))return null;
        return Buffer.from(await response.arrayBuffer());
    });
    const store=createReportStore({directory,renderPdf:renderer});
    const metas=await store.generate(source.records,source.timestamp);
    process.env.CRM_REPORTS_DIR=directory;
    const {requestHandler}=require('../server');
    const server=http.createServer(requestHandler);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
        const base=`http://127.0.0.1:${server.address().port}`;
        const response=await fetch(`${base}/api/automatic-reports`);
        assert.equal(response.status,200);
        assert.equal((await response.json()).reports.length,2);
        assert.equal((await fetch(`${base}/api/automatic-reports?id=..%2Findex`)).status,404);
        assert.equal((await fetch(`${base}/api/automatic-reports`,{method:'POST'})).status,405);
        for(const m of metas) {
            const pdf=await fetch(`${base}/api/automatic-reports?id=${m.id}&format=pdf`);
            assert.equal(pdf.headers.get('content-type'),'application/pdf');
            assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
        }
        browser=await chromium.launch({headless:true,channel:'msedge'});
        const page=await browser.newPage({viewport:{width:1440,height:1000}});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/api/**',route=>{
            const url=new URL(route.request().url());
            if(url.pathname==='/api/automatic-reports')return route.continue();
            if(['/api/image-file','/api/proxy-image'].includes(url.pathname))return route.fetch({url:`${origin}${url.pathname}${url.search}`}).then(response=>route.fulfill({response}));
            const payload=url.pathname==='/api/data'?main:url.pathname==='/api/drive-images'?index:{success:true,records:[],rules:[],count:0};
            return route.fulfill({json:payload});
        });
        await page.goto(base);
        await page.locator('.nav-link[data-submodule="relatorios-automaticos"]').click();
        await page.waitForFunction(()=>document.querySelectorAll('[data-report-index]').length===2);
        await page.locator('[data-report-index="0"]').click();
        await page.waitForFunction(()=>document.querySelector('.automatic-report-detail'));
        assert.equal(await page.locator('.automatic-report-cards .prog-feira-card').count(),metas[0].count);
        await page.screenshot({path:path.join(directory,'tela.png'),fullPage:false});
        await page.setViewportSize({width:390,height:844});
        assert.equal(await page.locator('.automatic-reports-view').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({directory,reports:metas.map(m=>({id:m.id,type:m.type,count:m.count})),errors}));
    } finally {
        if(browser)await browser.close();
        await new Promise(resolve=>server.close(resolve));
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
