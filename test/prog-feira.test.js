const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeSector, parseDelivery, calculateDaysInSector, buildProducts, groupBySector } = require('../prog-feira');

test('normalizes the spreadsheet scientific notation used for sector 1E2', () => {
    assert.equal(normalizeSector('1,00E+02'), '1E2');
    assert.equal(normalizeSector('1.00E+02'), '1E2');
    assert.equal(normalizeSector('02B'), '02B');
});

test('builds one product from TIPO 1, 2 and 3 without tripling totals', () => {
    const records = [
        { NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01E', SETOR: 'ESTAMPARIA DE AMOSTRAS', ORDEM: '10', DT_SAIDA: '01/10/2026', TIPO: '1', QTDE_PEND: '4', SETOR_TING: 'M03', SETOR_FLUXO_EM: 'DES', FICHA: '09/10', IMG_PRODUTO: '01.11.00.7904' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', ORDEM: 'T51A - RNA', TIPO: '2' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01A', SETOR: 'PRE CADASTRAMENTO/DESENHO', DT_SAIDA: '10/08/2026', TIPO: '3', QTDE_PEND: '0' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01E', SETOR: 'ESTAMPARIA DE AMOSTRAS', DT_SAIDA: '01/10/2026', TIPO: '3', QTDE_PEND: '4' }
    ];
    const products = buildProducts(records, new Date(2026, 9, 5));
    assert.equal(products.length, 1);
    assert.equal(products[0].codigo, '01.11.00.7904');
    assert.equal(products[0].numero, '77826');
    assert.equal(products[0].program, 'T51A - RNA');
    assert.equal(products[0].delivery, '09/10');
    assert.equal(products[0].isDes, true);
    assert.equal(products[0].daysInSector, 4);
    assert.equal(products[0].history.length, 2);
});

test('calculates elapsed calendar days in the current sector safely', () => {
    const now = new Date(2026, 9, 5, 23, 30);
    assert.equal(calculateDaysInSector('02/10/2026', now), 3);
    assert.equal(calculateDaysInSector('2026-10-04', now), 1);
    assert.equal(calculateDaysInSector('06/10/2026', now), 0);
    assert.equal(calculateDaysInSector('31/12/26', now), 0);
    assert.equal(calculateDaysInSector('31/12', now), 0);
    assert.equal(calculateDaysInSector('2026-10-04junk', now), null);
    assert.equal(calculateDaysInSector('data inválida', now), null);
});

test('renders the elapsed days on every Prog Feira card', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
    const lightCss = fs.readFileSync(path.join(__dirname, '..', 'light-theme.css'), 'utf8');
    assert.match(app, /prog-feira-days/);
    assert.match(app, /no setor atual/);
    assert.match(css, /\.prog-feira-days\.late/);
    assert.match(lightCss, /body\.light-mode \.prog-feira-days\.late/);
    assert.match(lightCss, /color:\s*#b91c1c/);
});

test('organiza Prog Feira em paginas de oito cards e quatro colunas no PDF', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(app, /index \+= 8/);
    assert.match(app, /prog-feira-sector prog-feira-print-page/);
    assert.match(app, /'prog-feira': 'print-prog-feira'/);
    assert.match(css, /body\.print-prog-feira \.prog-feira-grid[\s\S]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    assert.match(css, /grid-template-rows:repeat\(2,86mm\)/);
    assert.match(css, /body\.print-prog-feira \.prog-feira-print-page[\s\S]*break-after:page/);
    assert.match(html, /style\.css\?v=20261020-prog-program-1/);
    assert.match(html, /app\.js\?v=[\w-]+/);
});

test('groups products by the D36 sector order and parses delivery dates', () => {
    const products = buildProducts([
        { NUMERO: '2', CODIGO: 'B', OP: '02B', SETOR: 'CORTE AMOSTRAS', TIPO: '1', FICHA: '05/10' },
        { NUMERO: '1', CODIGO: 'A', OP: '01A', SETOR: 'PRE CADASTRAMENTO/DESENHO', TIPO: '1', FICHA: '04/10' }
    ], new Date(2026, 9, 5));
    assert.deepEqual(groupBySector(products).map(group => group.sector), ['01A', '02B']);
    assert.equal(parseDelivery('09/10', new Date(2026, 9, 5)).getFullYear(), 2026);
    assert.equal(parseDelivery('10/01', new Date(2026, 11, 20)).getFullYear(), 2027);
    assert.equal(parseDelivery('20/12', new Date(2026, 0, 10)).getFullYear(), 2025);
    assert.equal(parseDelivery('31/02', new Date(2026, 9, 5)), null);
});
const { filterByPrograms, getProgramOptions } = require('../prog-feira');
test('programação usa COD_CLIENTE atual, preserva variantes e não usa ORDEM como substituto', () => {
    const products = buildProducts([
        { NUMERO: '1', CODIGO: 'A', TIPO: '1', COD_CLIENTE: ' b43 ', OP: '02M' },
        { NUMERO: '2', CODIGO: 'B', TIPO: '1', 'COD CLIENTE': 'B42', OP: '02M' },
        { NUMERO: '3', CODIGO: 'C', TIPO: '1', COD_CLIENTE: '  ', OP: '02M' },
        { NUMERO: '3', CODIGO: 'C', TIPO: '2', ORDEM: 'B99' },
        { NUMERO: '4', CODIGO: 'D', TIPO: '1', COD_CLIENTE: 'B43 (W.ROT)', OP: '01F' }
    ]);
    assert.equal(products.find(p => p.codigo === 'C').program, 'B99');
    assert.equal(products.find(p => p.codigo === 'C').customerProgram, '');
    assert.deepEqual(filterByPrograms(products, ['B43', 'B42']).map(p => p.codigo).sort(), ['A', 'B']);
    assert.deepEqual(filterByPrograms(products, ['']).map(p => p.codigo), ['C']);
    assert.deepEqual(filterByPrograms(products, ['B43', '']).map(p => p.codigo).sort(), ['A', 'C']);
    assert.equal(filterByPrograms(products, []).length, 4);
    assert.equal(filterByPrograms(products, ['inexistente']).length, 0);
    assert.equal(filterByPrograms(products, ['b43']).length, 1);
    assert.deepEqual(getProgramOptions(products, ['B44']), [
        { value: 'B42', count: 1 }, { value: 'B43', count: 1 },
        { value: 'B43 (W.ROT)', count: 1 }, { value: 'B44', count: 0 }, { value: '', count: 1 }
    ]);
    assert.equal(filterByPrograms(products, ['B43', 'B43 (W.ROT)']).filter(p => p.sector === '01F').length, 1);
});
test('filtro de programação fica suspenso quando a coluna está indisponível e retoma a seleção depois', () => {
    const available = [{ customerProgram: 'B43' }, { customerProgram: '' }];
    const unavailable = [{ customerProgram: '' }, { customerProgram: '' }];
    for (const selected of [['B43'], ['']]) {
        assert.equal(filterByPrograms(unavailable, selected, false).length, 2);
        assert.equal(filterByPrograms(available, selected, true).length, 1);
    }
});

test('opção VAZIO permanece disponível mesmo sem produtos sem programação', () => {
    assert.deepEqual(getProgramOptions([{ customerProgram: 'B43' }]), [{ value: 'B43', count: 1 }, { value: '', count: 0 }]);
});
