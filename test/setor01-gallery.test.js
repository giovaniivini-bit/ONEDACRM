const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('miniaturas do Setor 01 reutilizam a geometria do Setor 13', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    assert.match(css, /:is\(#setor13TableSection, #setor01GallerySection\) \.s13-photo-wrapper\s*\{[\s\S]*?min-height: 260px/);
    assert.match(css, /:is\(#setor13TableSection, #setor01GallerySection\) \.s13-card-body/);
    assert.match(css, /:is\(#setor13TableSection, #setor01GallerySection\) \.s13-card-meta-grid/);
});

test('cards do Setor 01 exibem etiqueta e pendências de aviamento e cor', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const relatedSectors = require('../setor01-related-sectors');
    const records = [
        { op: '06000', setor: '01' },
        { op: '06000', setor: 'x01' },
        { op: '06000', setor: 'X02' },
        { op: '06000', setor: 'd01' },
        { op: '06000', setor: 'D02' },
        { op: '07000', setor: '01' }
    ];
    const sectorMap = relatedSectors.buildMap(records);

    assert.deepEqual(relatedSectors.resolve({ op: '06000' }, sectorMap), {
        setoresAviamento: ['X01', 'X02'],
        setoresCor: ['D01', 'D02']
    });
    assert.deepEqual(relatedSectors.resolve({ op: '07000' }, sectorMap), {
        setoresAviamento: [],
        setoresCor: []
    });
    assert.match(app, /CRMSetor01RelatedSectors\.buildMap\(state\.allData\)/);
    assert.match(app, /CRMSetor01RelatedSectors\.resolve\(item, relatedSectorMap\)/);
    assert.match(app, /<span class="s13-meta-label">Etiqueta<\/span>/);
    assert.match(app, /<span class="s13-meta-label">Setor Aviamento<\/span>/);
    assert.match(app, /<span class="s13-meta-label">Setor Cor<\/span>/);
    assert.match(app, /setor === 'X01' \? 'danger badge-pulse-red' : 'success'/);
    assert.match(app, /setor === 'D01' \? 'danger badge-pulse-red' : 'success'/);
    assert.match(app, /id="setor01TableSection" style="[^"]*\$\{state\.setor01ViewMode === 'table' \? '' : 'display: none;'\}/);
    assert.match(app, /state\.setor01ViewMode === 'table' \? 'setor01TableSection' : 'setor01GallerySection'/);
});
