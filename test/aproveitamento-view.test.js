const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('aproveitamento deriva clientes pelos prefixos informados', () => {
    const expectedMappings = [
        ["'01'", "'C&A'"],
        ["'02'", "'Renner'"],
        ["'03'", "'Riachuelo'"],
        ["'05'", "'Centauro'"],
        ["'13'", "'Hering'"],
        ["'15'", "'Carrefour'"],
        ["'21'", "'Santa Marca'"]
    ];

    for (const [prefix, client] of expectedMappings) {
        assert.match(appSource, new RegExp(`${prefix}: ${client}`));
    }
    assert.match(appSource, /record\.PRODUTO \|\| record\.CODIGO \|\| record\.IMG_PRODUTO/);
    assert.match(appSource, /\^ON\\\.\/i\.test\(code\).*Showroom Oneda/);
});

test('aproveitamento usa PRECO_VENDA para os cálculos e para a tabela', () => {
    assert.match(appSource, /const custoRaw = r\.PRECO_VENDA/);
    assert.match(appSource, /escapeHtml\(r\.PRECO_VENDA \|\| '-'\)/);
    assert.ok(appSource.includes('PREÇO MÉDIO DE VENDA'));
    assert.ok(appSource.includes('DIFERENÇA DE TICKET'));
});

test('aproveitamento oferece os cinco prazos solicitados e filtro por cliente', () => {
    for (const label of ['15 dias', '30 dias', '45 dias', '6 meses', 'Personalizado']) {
        assert.ok(appSource.includes(label), `prazo ausente: ${label}`);
    }
    assert.match(appSource, /aproveitamentoClient: 'all'/);
    assert.match(appSource, /window\.crmSetAproveitamentoClient/);
    assert.match(appSource, /window\.crmSetAproveitamentoCustomDate/);
    assert.match(appSource, /const dataMaxDate = validDates\.length/);
});

test('aproveitamento usa o código canônico e escapa campos externos na tabela', () => {
    assert.match(appSource, /getAproveitamentoProductCode\(r\)\.toLowerCase\(\)\.includes\(s\)/);
    assert.match(appSource, /escapeHtml\(getAproveitamentoProductCode\(r\)\)/);
    assert.match(appSource, /escapeHtml\(r\.DESCRICAO \|\| '-'\)/);
    assert.match(appSource, /escapeHtml\(m\.name\)/);
});

