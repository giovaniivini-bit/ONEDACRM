const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('status de estilo agrupa os estados definidos e tolera acentos e espaços', () => {
    const { styleStatusGroup } = require('../setor01-related-sectors');
    for (const status of ['PENDENTE DESENVOLVIMENTO', 'AGUAR. APROV. LIC. / CONCEITO', 'AGUAR. APROV. LIC./ PP SAMPLE', 'PEDIDO CANCELADO']) {
        assert.equal(styleStatusGroup(status), 'pendentes');
    }
    for (const status of ['PP SAMPL APROVADA', 'LIBERADO PARA PRODUÇÂO', 'liberado para produção']) {
        assert.equal(styleStatusGroup(status), 'liberados');
    }
    assert.equal(styleStatusGroup('Agu retor Feira / pos fei'), 'outros');
    assert.equal(styleStatusGroup(''), 'outros');
});

test('filtro de pendências separa D01 e X01 e não trata D02/X02 como pendentes', () => {
    const { matchesPending } = require('../setor01-related-sectors');
    const items = [
        { id: 'cor', setoresCor: ['D01'], setoresAviamento: ['X02'] },
        { id: 'aviamento', setoresCor: ['D02'], setoresAviamento: ['X01'] },
        { id: 'ambas', setoresCor: ['D01'], setoresAviamento: ['X01'] },
        { id: 'nenhuma', setoresCor: ['D02'], setoresAviamento: ['X02'] },
        { id: 'sem-registro' }
    ];
    for (const kind of ['cor', 'aviamento', 'ambas']) {
        assert.deepEqual(items.filter(item => matchesPending(item, kind)).map(item => item.id), [kind]);
    }
    assert.deepEqual(items.filter(item => matchesPending(item, 'nenhuma')).map(item => item.id), ['nenhuma', 'sem-registro']);
    assert.equal(items.filter(item => matchesPending(item, 'all')).length, 5);
});

test('miniaturas do Setor 01 reutilizam a geometria do Setor 13', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    assert.match(css, /:is\(#setor13TableSection, #setor01GallerySection\) \.s13-photo-wrapper\s*\{[\s\S]*?min-height: 260px/);
    assert.match(css, /#setor01GallerySection \.s13-photo-wrapper\s*\{[\s\S]*?height: 260px;[\s\S]*?min-height: 260px;[\s\S]*?flex: 0 0 260px/);
    assert.match(css, /#setor01GallerySection \.s13-photo-img\s*\{[\s\S]*?object-fit: contain/);
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
    assert.match(app, /class="s13-card-description"/);
});
