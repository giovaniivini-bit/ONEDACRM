const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('CQ report selects its print layout and restores the screen after printing', () => {
    const vm = require('node:vm');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const start = app.indexOf('window.crmGeneratePDFReport = () => {');
    const end = app.indexOf('\n    };', start) + '\n    };'.length;
    const classes = new Set(['print-setor13']);
    const elements = Object.fromEntries(['printReportTitle','printReportModule','printReportDate'].map(id => [id, {textContent:''}]));
    let afterPrint;
    let printed = false;
    const context = {
        state: { activeSubmodule: 'andamento-cq', cqDisplayMode: 'both', cqSearch: '7890' },
        document: { body: { classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)) } }, getElementById: id => elements[id] },
        window: { addEventListener: (name, fn) => { if(name === 'afterprint') afterPrint = fn; }, print: () => { printed = true; } },
        showNotification() {}, renderActiveView() { throw new Error('CQ screen should not be re-rendered for printing'); },
        setTimeout: fn => fn()
    };
    vm.runInNewContext(app.slice(start, end), context);
    context.window.crmGeneratePDFReport();
    assert.equal(printed, true);
    assert.equal(classes.has('print-cq'), true);
    assert.equal(classes.has('print-setor13'), false);
    assert.match(elements.printReportTitle.textContent, /Controle de Qualidade/);
    afterPrint();
    assert.equal(classes.size, 0);
    assert.equal(context.state.cqDisplayMode, 'both');
    assert.equal(context.state.cqSearch, '7890');
});

test('PDF do Setor 13 usa modo de impressão específico e limpa após imprimir', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

    assert.match(app, /state\.activeSubmodule === 'setor13'/);
    assert.match(app, /setor13: 'print-setor13'/);
    assert.match(app, /document\.body\.classList\.add\(activePrintClass, 'print-gallery-report'\)/);
    assert.match(app, /addEventListener\('afterprint', cleanupPrintMode, \{ once: true \}\)/);
});

test('PDF inicia miniaturas na página 2 sem quebra duplicada no toolbar', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    assert.match(css, /#setor13TableSection,[\s\S]*?page-break-before: always !important/);
    assert.match(css, /\.s13-gallery-toolbar\s*\{[\s\S]*?page-break-before: auto !important/);
    assert.match(css, /body\.print-setor13 \.analytics-grid\s*\{[\s\S]*?zoom: 0\.55 !important[\s\S]*?max-height: 500px !important[\s\S]*?overflow: hidden !important/);
    assert.match(css, /body\.print-setor13 \.analytics-grid \.dist-list\s*\{[\s\S]*?max-height: 155px !important[\s\S]*?overflow: hidden !important/);
});

test('miniaturas do Setor 13 omitem campos redundantes e usam layout compacto', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const cardStart = app.indexOf('<!-- Linha 1: Código e OP -->');
    const cardEnd = app.indexOf('<!-- Linha 6: Botões de Ação -->', cardStart);
    const cardMarkup = app.slice(cardStart, cardEnd);

    assert.ok(cardStart > -1 && cardEnd > cardStart);
    assert.doesNotMatch(cardMarkup, /Etiqueta|Tipo Produto|Marca/);
    assert.match(cardMarkup, /OC \/ RIS/);
    assert.match(cardMarkup, /Prog\. Amostra/);
    assert.match(cardMarkup, /Semana Ped\./);
    assert.match(cardMarkup, /Total Peças/);
    assert.match(css, /:is\(#setor13TableSection, #setor01GallerySection\) \.s13-photo-wrapper\s*\{[\s\S]*?min-height: 260px/);
    assert.match(css, /:is\(#setor13TableSection, #setor01GallerySection\) \.s13-photo-placeholder\s*\{[\s\S]*?padding: 6px/);
    assert.match(css, /:is\(#setor13TableSection, #setor01GallerySection\) \.s13-photo-placeholder \.s13-placeholder-icon\s*\{[\s\S]*?font-size: 20px/);
    assert.match(css, /body\.print-setor13 #setor13TableSection \.s13-photo-wrapper\s*\{[\s\S]*?height: 105px/);
    assert.match(css, /body\.print-setor13 #setor13TableSection \.s13-photo-placeholder\s*\{[\s\S]*?padding: 4px/);
});

test('PDFs executivos ocultam listas e iniciam galerias na página 2', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    for (const id of ['processoTableSection', 'setor01TableSection', 'estampaTableSection', 'malotesTableSection']) {
        assert.match(app, new RegExp(`class="table-card pdf-detail-list" id="${id}"`));
    }
    for (const id of ['processoGallerySection', 'setor01GallerySection', 'estampaGallerySection', 'malotesGallerySection']) {
        assert.match(app, new RegExp(`id="${id}"`));
        assert.match(css, new RegExp(`#${id}`));
    }
    assert.match(css, /\.pdf-detail-list,[\s\S]*?\.pdf-screen-controls\s*\{[\s\S]*?display: none !important/);
    assert.match(app, /state\.setor13ViewMode = 'grid'/);
    assert.match(app, /state\.setor01ViewMode = 'grid'/);
    assert.match(app, /state\.setor13ViewMode = originalSetor13ViewMode/);
    assert.match(app, /state\.setor01ViewMode = originalSetor01ViewMode/);
    assert.match(app, /state\.activeSubmodule === 'processo' && state\.processoFilter === 'bons'/);
    assert.match(app, /state\.activeSubmodule === 'estampa' && state\.estampaFilter === 'sem_pendencia'/);
    assert.match(app, /state\.processoFilter = originalProcessoFilter/);
    assert.match(app, /state\.estampaFilter = originalEstampaFilter/);
    assert.match(app, /s13-gallery-toolbar pdf-screen-controls/);
    assert.match(app, /filter-toolbar pdf-screen-controls/);
    assert.match(app, /'malotes': 'Malotes - Setores 88 e 83'/);
});
for (const scenario of ['loaded', 'rerender', 'timeout', 'fallback']) {
    test(`Prog Feira print waits for images: ${scenario}`, async () => {
        const vm = require('node:vm');
        const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
        const start = app.indexOf('window.crmGeneratePDFReport = () => {');
        const end = app.indexOf('\n    };', start) + '\n    };'.length;
        let view = {}, printed = 0, removed = 0, finish;
        const timers = [];
        const ready = new Promise(resolve => { finish = resolve; });
        let attempts = 0;
        const image = { dataset: {fallbackSrc: '/fallback.jpg'}, complete: false, naturalWidth: 0, decode: async () => {
            attempts++;
            if (scenario === 'fallback' && attempts === 1) throw new Error('original failed');
            await ready; image.complete = true; image.naturalWidth = 300;
        }};
        const context = {
            state: {activeSubmodule:'prog-feira'},
            document: {body:{classList:{add(){},remove(){}}},getElementById:()=>null,querySelector:()=>view,querySelectorAll:()=>[image]},
            window: {addEventListener(){},removeEventListener(){removed++;},print(){printed++;}},
            showNotification(){},setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){}
        };
        vm.runInNewContext(app.slice(start,end),context);
        context.window.crmGeneratePDFReport();
        context.window.crmGeneratePDFReport();
        assert.equal(timers.length,1,'duplicate click suppressed');
        const printing = timers[0].fn();
        assert.equal(image.loading,'eager');
        assert.equal(printed,0);
        if(scenario === 'rerender') view = {};
        if(scenario === 'timeout') timers.find(t=>t.ms===20000).fn();
        else finish();
        await printing;
        assert.equal(printed,scenario==='loaded'||scenario==='fallback'?1:0);
        if(scenario==='fallback') assert.equal(image.src,'/fallback.jpg');
        if(scenario==='timeout'||scenario==='rerender') {
            assert.equal(removed,1);
            assert.equal(context.window.crmGeneratePDFReport.pending,false);
        }
    });
}

test('Prog CQ espera a foto alternativa e invalida o pedido se a impressão já terminou', async () => {
    const vm = require('node:vm');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const start = app.indexOf('window.crmGeneratePDFReport = () => {');
    const end = app.indexOf('\n    };', start) + '\n    };'.length;
    let prepared = 0, printed = 0, afterPrint, finish;
    const jobs = [];
    const report = { remove() {} };
    const view = { querySelector: () => report };
    const ready = new Promise(resolve => { finish = resolve; });
    const img = {
        dataset:{fallbackSrc:'/proxy.jpg'}, complete:false, naturalWidth:0,
        async decode() {
            if (this.src !== '/proxy.jpg') throw new Error('Miniatura indisponível');
            await ready;
            this.complete = true;
            this.naturalWidth = 297;
        }
    };
    const context = {
        state:{activeSubmodule:'prog-cq'},
        document:{
            body:{classList:{add(){},remove(){}}},
            getElementById:()=>null,
            querySelector:()=>view,
            querySelectorAll: selector => {
                assert.equal(selector, '.prog-cq-print-report img:not([hidden])');
                return [img];
            }
        },
        window:{
            addEventListener(event, callback) { if (event === 'afterprint') afterPrint = callback; },
            print() { printed++; }
        },
        prepareProgGalleryPrint() { prepared++; },
        showNotification(){}, setTimeout(fn){jobs.push(fn);}, clearTimeout(){}
    };
    vm.runInNewContext(app.slice(start,end), context);
    context.window.crmGeneratePDFReport();
    const inProgress = jobs.shift()();
    await new Promise(setImmediate);
    assert.equal(prepared, 1);
    assert.equal(img.src, '/proxy.jpg');
    assert.equal(printed, 0);
    afterPrint();
    finish();
    await inProgress;
    assert.equal(printed, 0);
    assert.equal(context.window.crmGeneratePDFReport.pending, false);
});

test('Prog CQ fits only the details of cards whose content exceeds its slot', () => {
    const vm = require('node:vm');
    const context = {window:{}};
    vm.runInNewContext(fs.readFileSync(path.join(root, 'prog-cq-view.js'), 'utf8'), context);

    const fitFrame = (height, scaledHeight) => {
        const properties = new Map();
        return {
            properties, clientHeight:100,
            style:{setProperty:(name, value) => properties.set(name, value), removeProperty:name => properties.delete(name)},
            firstElementChild:{
                scrollHeight:height,
                getBoundingClientRect:()=>({width:200, height:properties.has('--prog-cq-detail-scale') ? scaledHeight : height})
            }
        };
    };
    const compact = fitFrame(60, 60);
    const long = fitFrame(190, 99);
    context.window.CRMProgCQView.fitPrint({ querySelectorAll:selector => {
        assert.equal(selector, '.prog-cq-print-details');
        return [compact,long];
    } });
    assert.equal(compact.properties.size,0);
    assert.deepEqual([...long.properties.keys()], ['--prog-cq-detail-scale']);
    assert.equal(Number(long.properties.get('--prog-cq-detail-scale')), 0.5 * 95 / 99);
});
