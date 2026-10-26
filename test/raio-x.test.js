const test = require('node:test');
const assert = require('node:assert/strict');
const rx = require('../raio-x');
const helpers = require('../setor01-related-sectors');
const row = (setor, extra = {}) => ({ op: '123', codigo: '01.00.123A', setor, qtdeOriginal: 10, diasParado: 2, statusModelagem: 'Lib corte', statusEstilo: 'LIBERADO PARA PRODUÇÃO', cliente: 'C&A', ...extra });
const defaults = { search: '', sectors: [], client: 'all', pending: 'all', style: 'all', model: 'all', malote: 'all' };

test('nomes usam Desc Setor somente dos setores principais e eliminam repetições', () => {
    const names = rx.sectorNames([row('1', { descSetor: 'ESTILO' }), row('01', { descSetor: 'ESTILO' }), row('13', { descSetor: 'MODELAGEM' }), row('D01', { descSetor: 'COR' }), row('88', { descSetor: 'MALOTES' }), row('05', { descSetor: '' })]);
    assert.deepEqual(names, { '01': 'ESTILO', '13': 'MODELAGEM' });
});

test('consolida setores por OF e código completo sem multiplicar produtos ou peças', () => {
    const products = rx.build([row('01'), row('13', { diasParado: 5 }), row('D01'), row('X01'), row('88', { parte: 'D7' })]);
    assert.equal(products.length, 1);
    assert.deepEqual(products[0].sectors, ['01', '13']);
    assert.equal(products[0].qtdeOriginal, 10);
    assert.deepEqual(products[0].setorDias, [{ setor: '01', dias: 2 }, { setor: '13', dias: 5 }]);
    assert.deepEqual(products[0].setoresCor, ['D01']);
    assert.deepEqual(products[0].setoresAviamento, ['X01']);
    assert.deepEqual(products[0].malotes, ['88']);
});

test('não cruza variantes de produto ou OFs diferentes, nem cria cards secundários', () => {
    const products = rx.build([row('01'), row('13', { codigo: '01.00.123B' }), row('D01', { codigo: '01.00.123B' }), row('88', { op: '999', parte: 'D7' }), row('01', { codigo: '' }), row('01', { op: '' })]);
    assert.equal(products.length, 2);
    assert.deepEqual(products.find(p => p.codigo.endsWith('A')).setoresCor, []);
    assert.deepEqual(products.find(p => p.codigo.endsWith('B')).setoresCor, ['D01']);
    assert.ok(products.every(p => p.malotes.length === 0));
});

test('inclui todos os setores solicitados e normaliza setores numéricos', () => {
    const products = rx.build([...rx.SECTORS.map(s => row(s)), row('1'), row('088', { partes: ['D7'] }), row('83', { parte: 'D3' })]);
    assert.equal(products.length, 1);
    assert.deepEqual(products[0].sectors, rx.SECTORS);
    assert.deepEqual(products[0].malotes, ['88']);
    assert.equal(rx.build([row('D01'), row('X01'), row('83', { parte: 'D7' })]).length, 0);
});

test('filtros de cor, estilo, modelagem, setor, cliente, busca e malote se combinam', () => {
    const products = rx.build([row('01'), row('D01'), row('83', { partes: ['D7'] }), row('13', { op: '456', statusModelagem: 'Ag feira', statusEstilo: 'PENDENTE DESENVOLVIMENTO' }), row('X01', { op: '456' })]);
    const filter = f => rx.filter(products, { ...defaults, ...f }, helpers);
    assert.equal(filter({ pending: 'cor', style: 'liberados', model: 'Lib corte', sectors: ['01'], malote: '83', search: '123a', client: 'C&A' }).length, 1);
    assert.equal(filter({ pending: 'aviamento', style: 'pendentes', model: 'Ag feira', malote: 'none' }).length, 1);
    assert.equal(filter({ pending: 'ambas' }).length, 0);
    assert.equal(filter({ pending: 'nenhuma' }).length, 0);
    assert.equal(filter({ malote: '88' }).length, 0);
    assert.equal(filter({ style: 'liberados', model: 'Ag feira' }).length, 0);
    assert.equal(rx.build([]).length, 0);
});

test('seleção de setores aceita um ou vários por união, sem duplicar cards', () => {
    const products = rx.build([row('01'), row('13'), row('05', { op: '456' }), row('20', { op: '789' })]);
    const filter = sectors => rx.filter(products, { ...defaults, sectors }, helpers);
    assert.equal(filter([]).length, 3);
    assert.equal(filter(['01']).length, 1);
    assert.equal(filter(['01', '13']).length, 1);
    assert.equal(filter(['01', '05']).length, 2);
    assert.equal(filter(['43']).length, 0);
    assert.equal(filter(['01', '05', '20']).length, 3);
});

test('preserva status divergentes entre setores e não considera status desconhecido liberado', () => {
    const products = rx.build([row('01'), row('13', { statusModelagem: 'Ag feira', statusEstilo: 'PENDENTE DESENVOLVIMENTO' }), row('05', { op: '456', statusEstilo: 'DESCONHECIDO' })]);
    assert.deepEqual(products[0].modelagem, ['Lib corte', 'Ag feira']);
    assert.equal(rx.filter(products, { ...defaults, style: 'pendentes' }, helpers).length, 1);
    assert.equal(rx.filter(products, { ...defaults, style: 'liberados' }, helpers).length, 1);
});
test('Raio X imprime com margem segura e campos legíveis sem compressão de badges', () => {
    const fs = require('node:fs');
    const css = fs.readFileSync(require('node:path').join(__dirname, '../style.css'), 'utf8');
    const app = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
    assert.match(css, /@page raio-x-report\s*\{[^}]*margin:12mm !important/);
    assert.match(css, /\.rx-print-grid\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(css, /#raioXPrintReport \.rx-card\s*\{[^}]*height:auto[^}]*overflow:visible/);
    assert.match(app, /cards\.slice\(offset, offset \+ 6\)/);
    assert.match(app, /class="rx-print-details"/);
});
