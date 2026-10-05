const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSector, parseDelivery, buildProducts, groupBySector } = require('../prog-feira');

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
    assert.equal(products[0].history.length, 2);
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
