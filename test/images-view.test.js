const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('controle de imagens possui aba total, status e cópia de nomes esperados', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    assert.match(app, /missingImagesTab: 'missing'/);
    assert.match(app, /Imagens Totais do App/);
    assert.match(app, /showingAllImages \? products : missingProducts/);
    assert.match(app, /state\.progFeiraExternalData\?\.records/);
    assert.match(app, /window\.CRMImageCoverage\.buildImageCoverageProducts/);
    assert.match(app, /buildProgProducts: window\.CRMProgFeira\?\.buildProducts/);
    assert.match(app, /'prog-feira', 'imagens-ausentes', 'alertas'/);
    assert.match(app, /product\.hasImage \? 'Disponível' : 'Precisa atualizar'/);
    assert.match(app, /window\.crmCopyAllImageFilenames/);
    assert.doesNotMatch(app, /window\.crmCopyImageFilename/);
    assert.doesNotMatch(app, /missing-image-copy-btn/);
    assert.match(app, /filenames\.join\('\\n'\)/);
    assert.match(app, /new Set\(productsToCopy\.map/);
    assert.match(app, /navigator\.clipboard\?\.writeText/);
    assert.match(app, /document\.createElement\('textarea'\)/);
    assert.match(app, /document\.execCommand\('copy'\)/);
    assert.match(app, /Nenhum produto válido encontrado/);
    assert.match(app, /Carregue ou sincronize os dados do CRM/);
    assert.match(index, /style\.css\?v=20261028-rx-sector-layout-1/);
    assert.match(index, /image-coverage\.js\?v=20261006-exact-image-code-1/);
    assert.match(index, /app\.js\?v=[\w-]+/);
});
test('copiar lista ausente respeita busca, preserva sufixos e mantém cópia total existente',()=>{
    const vm=require('node:vm');
    const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
    const helper=app.slice(app.indexOf('    function filterImageCoverageProducts('),app.indexOf('    function renderMissingImagesView('));
    const handler=app.slice(app.indexOf('    window.crmCopyAllImageFilenames ='),app.indexOf('    window.crmExportMissingImagesCSV ='));
    const make=(codigo,hasImage)=>({codigo,imageCode:codigo,hasImage,ops:['10'],setores:['01B'],descricao:'Produto',cliente:'Oneda',marca:''});
    const products=[make('01.00.0001A',false),make('01.00.0001B',true),make('01.00.0002',false)];
    let copied='';const notifications=[];
    const context={window:{},state:{missingImagesSearch:''},getImageCoverageProducts:()=>products,copyImageText:text=>{copied=text;},showNotification:(...args)=>notifications.push(args)};
    vm.runInNewContext(helper+handler,context);
    context.window.crmCopyAllImageFilenames(true);assert.equal(copied,'01.00.0001A.jpg\n01.00.0002.jpg');
    context.state.missingImagesSearch='0001A';context.window.crmCopyAllImageFilenames(true);assert.equal(copied,'01.00.0001A.jpg');
    context.window.crmCopyAllImageFilenames();assert.equal(copied,'01.00.0001A.jpg\n01.00.0001B.jpg\n01.00.0002.jpg');
    context.state.missingImagesSearch='INEXISTENTE';copied='';context.window.crmCopyAllImageFilenames(true);assert.equal(copied,'');assert.ok(notifications.length);
});
