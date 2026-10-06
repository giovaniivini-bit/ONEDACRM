const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildImageCoverageProducts,
    resolveImageEntry,
    sanitizeImageMap
} = require('../image-coverage');

test('resolve imagens somente pelo código completo, sem herdar foto do produto-base', () => {
    const base = { filename: '21.19.00.0007.jpg' };
    const variant = { filename: '21.19.00.0007A.jpg' };
    const map = {
        '21.19.00.0007': base,
        '2119000007': base,
        '21.19.00.0007A': variant,
        '2119000007A': variant
    };

    assert.equal(resolveImageEntry(map, '21.19.00.0007'), base);
    assert.equal(resolveImageEntry(map, '21.19.00.0007A'), variant);
    assert.equal(resolveImageEntry({ '21.19.00.0007': base }, '21.19.00.0007A'), null);
    assert.equal(resolveImageEntry({ '21.19.00.0007': base }, '21.19.00.00071'), null);
    assert.equal(resolveImageEntry({ '2119000007A': variant }, '21.19.00.0007A'), variant);
    assert.equal(resolveImageEntry({ '21.19.00.0007A': base }, '21.19.00.0007A'), null);
    const opImage = { filename: '78357.jpg', base: '78357' };
    assert.equal(resolveImageEntry({ '78357': opImage }, '21.19.00.0007A', '78357'), opImage);
});

test('remove aliases antigos do cache sem remover equivalências de pontuação', () => {
    const base = { filename: '21.19.00.0007.jpg', base: '21.19.00.0007' };
    const variant = { filename: '21.19.00.0007A.jpg', base: '21.19.00.0007A' };
    const clean = sanitizeImageMap({
        '21.19.00.0007': base,
        '2119000007': base,
        '21.19.00.0007.JPG': base,
        '21.19.00.0007A': base,
        '2119000007A': variant
    });

    assert.equal(clean['21.19.00.0007'], base);
    assert.equal(clean['2119000007'], base);
    assert.equal(clean['21.19.00.0007.JPG'], base);
    assert.equal(clean['2119000007A'], variant);
    assert.equal(clean['21.19.00.0007A'], undefined);
});

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
