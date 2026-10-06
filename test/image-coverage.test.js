const test = require('node:test');
const assert = require('node:assert/strict');
const { buildImageCoverageProducts } = require('../image-coverage');

test('includes current Prog Feira products such as ON.17.0156 and ignores history rows', () => {
    const products = buildImageCoverageProducts({
        progFeira: [
            { CODIGO: 'ON.17.0156', IMG_PRODUTO: 'ON.17.0156', NUMERO: '78223', OP: '01F', SETOR: 'PECAS PRONTAS', TIPO: '1' },
            { CODIGO: 'ON.17.0156', IMG_PRODUTO: 'ON.17.0156', NUMERO: '78223', OP: '01A', SETOR: 'DESENHO', TIPO: '3' },
            { CODIGO: 'OUTRO', IMG_PRODUTO: 'OUTRO', NUMERO: '1', OP: '02B', TIPO: '2' }
        ]
    }, { checkImage: () => false });

    assert.equal(products.length, 1);
    assert.equal(products[0].codigo, 'ON.17.0156');
    assert.equal(products[0].imageCode, 'ON.17.0156');
    assert.equal(products[0].hasImage, false);
    assert.deepEqual(products[0].setores, ['01F (Prog Feira)']);
});

test('keeps distinct image requirements when one product uses a different IMG_PRODUTO', () => {
    const checked = [];
    const products = buildImageCoverageProducts({
        main: [{ codigo: '01.00.0001', op: '10', setor: '13' }],
        progFeira: [{ CODIGO: '01.00.0001', IMG_PRODUTO: 'FOTO-ESPECIAL', NUMERO: '10', OP: '01F', TIPO: '1' }]
    }, {
        checkImage: code => {
            checked.push(code);
            return code === '01.00.0001';
        }
    });

    assert.equal(products.length, 2);
    assert.deepEqual(products.map(item => item.imageCode), ['01.00.0001', 'FOTO-ESPECIAL']);
    assert.deepEqual(products.map(item => item.hasImage), [true, false]);
    assert.deepEqual(checked.sort(), ['01.00.0001', 'FOTO-ESPECIAL']);
});

test('deduplicates the same product and image requirement across sources', () => {
    const products = buildImageCoverageProducts({
        main: [
            { codigo: 'ABC', op: '1', setor: '13' },
            { codigo: 'ABC', op: '2', setor: '01' }
        ],
        cq: [{ CODIGO: 'ABC', IMG_PRODUTO: 'ABC', NUMERO: '3' }]
    }, { checkImage: () => true });

    assert.equal(products.length, 1);
    assert.deepEqual(products[0].ops, ['1', '2', '3']);
    assert.equal(products[0].hasImage, true);
});
