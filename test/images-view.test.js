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
    assert.match(app, /new Set\(getImageCoverageProducts\(\)\.map/);
    assert.match(app, /navigator\.clipboard\?\.writeText/);
    assert.match(app, /document\.createElement\('textarea'\)/);
    assert.match(app, /document\.execCommand\('copy'\)/);
    assert.match(app, /Nenhum produto válido encontrado/);
    assert.match(app, /Carregue ou sincronize os dados do CRM/);
    assert.match(index, /style\.css\?v=20261006-exact-image-code-1/);
    assert.match(index, /image-coverage\.js\?v=20261006-exact-image-code-1/);
    assert.match(index, /app\.js\?v=20261006-exact-image-code-1/);
});
