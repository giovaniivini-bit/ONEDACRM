const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const dates = require('../aproveitamento-dates');
const completion = require('../aproveitamento-finalizacao');

test('nova planilha aceita os cabeçalhos observados e interpreta datas brasileiras ou ISO',()=>{
    const records=completion.parseMatrix([['PRODUTO','DATA FINALIZAÇÂO'],[' 01.14.01.0000 ','08/11/2026'],['01.14.01.0000A','2026-10-31'],['01.14.01.0000B','31/02/2026']]);
    assert.deepEqual(records,[{PRODUTO:'01.14.01.0000',DATA_FINALIZACAO:'2026-11-08',invalidDate:false},
        {PRODUTO:'01.14.01.0000A',DATA_FINALIZACAO:'2026-10-31',invalidDate:false},
        {PRODUTO:'01.14.01.0000B',DATA_FINALIZACAO:'',invalidDate:true}]);
    assert.equal(dates.format(dates.parse('03/04/2026','dmy')&&'2026-04-03'),'03/04/2026');
    assert.deepEqual(completion.parseMatrix([['Produto','Data de finalização da amostra']]),[]);
    assert.throws(()=>completion.parseMatrix([['Produto','Cadastro']]),/colunas PRODUTO/);
    assert.throws(()=>completion.parseMatrix([['<!DOCTYPE html>']]),/colunas PRODUTO/);
});

test('cruzamento preserva compra/preço, código completo, ordem e todos os registros da base principal',()=>{
    const base=[{CODIGO:'01.14.01.0000',PEDIDO:'S',PRECO_VENDA:'28,90',DATA_CAD:'1/1/2025',DT_APROV:'2/1/2025'},
        {CODIGO:'01.14.01.0000A',PEDIDO:'N',PRECO_VENDA:'39,90'},
        {CODIGO:'01.14.01.0000',PEDIDO:'N',PRECO_VENDA:'29,90'},{CODIGO:'01.14.01.0000B',PEDIDO:'S'}];
    const source={success:true,records:completion.parseMatrix([['Produto','Data finalização'],['01.14.01.0000','01/11/2026'],['01.14.01.0000A','02/11/2026'],['99.00.00.0000','01/01/2040']])};
    const joined=completion.join(base,source);
    assert.equal(joined.length,base.length);
    assert.deepEqual(joined.map(r=>r.CRM_FINALIZACAO.date),['2026-11-01','2026-11-02','2026-11-01','']);
    joined.forEach((record,index)=>{const {CRM_FINALIZACAO,...original}=record;assert.deepEqual(original,base[index]);});
    assert.ok(base.every(r=>!r.CRM_FINALIZACAO),'não altera os dados originais');
    assert.equal(completion.summarize(joined).matched,3);
    assert.equal(completion.summarize(joined).missing,1);
});

test('duplicatas iguais não duplicam amostras; datas divergentes ou inválidas exigem revisão',()=>{
    const source={success:true,records:completion.parseMatrix([['PRODUTO','DATA FINALIZAÇÂO'],
        ['A','01/11/2026'],['A','01/11/2026'],['B','01/11/2026'],['B','02/11/2026'],
        ['C','31/02/2026'],['C','01/11/2026'],['D',''],['','01/11/2026']])};
    const joined=completion.join(['A','B','C','D','E'].map(CODIGO=>({CODIGO})),source);
    assert.deepEqual(joined.map(r=>r.CRM_FINALIZACAO.status),['matched','conflict','invalid','missing','missing']);
    assert.deepEqual(joined.map(r=>r.CRM_FINALIZACAO.date),['2026-11-01','','','','']);
    assert.deepEqual(completion.summarize(joined),{matched:1,conflict:1,invalid:1,missing:2,unavailable:0});
});

test('fonte vazia ou indisponível não usa DATA_CAD nem DT_APROV como finalização',()=>{
    const base=[{CODIGO:'01.14.01.0000',DATA_CAD:'11/1/2026',DT_APROV:'11/2/2026'}];
    assert.equal(completion.join(base,{success:true,records:[]})[0].CRM_FINALIZACAO.status,'missing');
    assert.equal(completion.join(base,null)[0].CRM_FINALIZACAO.status,'unavailable');
    const cached=completion.join(base,{success:true,isLive:false,records:[{PRODUTO:base[0].CODIGO,DATA_FINALIZACAO:'2026-11-03'}]});
    assert.equal(cached[0].CRM_FINALIZACAO.date,'2026-11-03');
    const invalid=completion.join(base,{success:true,records:[{PRODUTO:base[0].CODIGO,DATA_FINALIZACAO:'2026-02-31'}]});
    assert.equal(invalid[0].CRM_FINALIZACAO.status,'invalid');
});

test('datas da exportação são mês/dia/ano e nunca geram meses inexistentes',()=>{
    for(const [input,expected] of [['8/31/2026','31/08/2026'],['10/27/2026','27/10/2026'],['5/12/2025','12/05/2025'],['11/4/2026','04/11/2026'],['2026-11-04','04/11/2026'],['2/29/2024','29/02/2024']]) {
        assert.equal(dates.format(input),expected);
        assert.ok(dates.parse(input).getFullYear()<2028);
    }
    for(const input of ['2/29/2026','2/31/2026','13/1/2026','2026-02-31','01/32/2026','not a date','',null])assert.equal(dates.parse(input),null);
});

test('intervalo personalizado usa os mesmos dias de calendário da exportação',()=>{
    const start=dates.parse('2026-08-01'),end=dates.parse('2026-08-31');
    const rows=['7/31/2026','8/1/2026','8/31/2026','9/1/2026'];
    assert.deepEqual(rows.filter(raw=>{const date=dates.parse(raw);return date>=start&&date<=end;}),['8/1/2026','8/31/2026']);
    assert.match(appSource,/crmSetAproveitamentoCustomDate[\s\S]{0,350}aproveitamentoPeriod = 'custom'/);
});

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

