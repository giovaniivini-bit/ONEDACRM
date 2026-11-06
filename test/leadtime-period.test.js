const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual active renderer and its callbacks, including rerenders.
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = source.lastIndexOf('    function renderLeadtimeView(container)');
const end = source.indexOf('    function renderProgFeiraView', start);
const renderer = source.slice(start, end);
const row = (date, code, days = 2) => ({ NUMERO: code, CODIGO: code, PRODUTO_DESC: 'Produto', REALIZADO_FIM: date, DIAS_REALIZADO: String(days), PECAS: '10' });
function setup(records) {
    const state = { leadtimeExternalData: { records }, leadtimeMonths: [], leadtimeFilter: null, leadtimeSearch: '' };
    const container = { innerHTML: '', querySelector: () => null };
    const context = vm.createContext({ state, window: {}, escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;') });
    vm.runInContext(renderer, context);
    const render = () => context.renderLeadtimeView(container);
    render();
    return { state, container, window: context.window, render };
}
const records = [row('01/09/2025', 'OLD'), row('04/09/2026', 'SEP', 4), row('05/10/2026', 'OCT', 6), row('2026-11-06', 'NOV'), row('', 'UNDATED')];

test('period lists real months chronologically across years and includes recent data by default', () => {
    const { container } = setup(records);
    assert.match(container.innerHTML, /Set\/25 \(1\)/);
    assert.match(container.innerHTML, /Set\/26 \(1\)/);
    assert.match(container.innerHTML, /Out\/26 \(1\)/);
    assert.match(container.innerHTML, /Nov\/26 \(1\)/);
    assert.ok(container.innerHTML.indexOf('Set/25 (1)') < container.innerHTML.indexOf('Set/26 (1)'));
    assert.match(container.innerHTML, /4 OFs com data de liberação • 1 registros sem data válida/);
});
test('multiple months filter chart, KPIs and table together', () => {
    const { window, container } = setup(records);
    window.crmToggleLeadtimeMonth('2026-09');
    window.crmToggleLeadtimeMonth('2026-10');
    assert.match(container.innerHTML, /Set\/26 • Out\/26 • 2 OFs/);
    assert.match(container.innerHTML, /leadtime-kpi-value">5,00 /);
    assert.match(container.innerHTML, /2 OFs exibidas/);
    assert.match(container.innerHTML, /Setembro de 2026: 1 OFs liberadas/);
    assert.doesNotMatch(container.innerHTML, /Novembro de 2026: 1 OFs liberadas/);
    assert.doesNotMatch(container.innerHTML, />UNDATED<|>OLD<|>NOV</);
});
test('all months and deselecting the final selection restore the full dated period', () => {
    const { window, container } = setup(records);
    window.crmToggleLeadtimeMonth('2026-10');
    window.crmToggleLeadtimeMonth('2026-10');
    assert.match(container.innerHTML, /Todos os meses da planilha • 4 OFs/);
    window.crmToggleLeadtimeMonth('2026-09');
    window.crmToggleLeadtimeMonth(null);
    assert.match(container.innerHTML, /4 OFs exibidas/);
});
test('column drilldown remains scoped to selected period and resets when period changes', () => {
    const { window, state, container } = setup(records);
    window.crmFilterLeadtime('2026-10');
    assert.match(container.innerHTML, /1 OFs exibidas/);
    window.crmToggleLeadtimeMonth('2026-09');
    assert.equal(state.leadtimeFilter, null);
    window.crmFilterLeadtime('2026-10');
    assert.equal(state.leadtimeFilter, null);
    assert.match(container.innerHTML, /Set\/26 • 1 OFs/);
});
test('empty/invalid dates do not become options; empty and refreshed unavailable selections stay finite', () => {
    const { window, state, container, render } = setup([row('31/09/2026', 'BAD'), row('xx', 'BAD2'), ...records]);
    assert.match(container.innerHTML, /Set\/26 \(1\)/);
    window.crmToggleLeadtimeMonth('2026-10');
    state.leadtimeExternalData.records = [];
    render();
    assert.match(container.innerHTML, /Nenhum mês disponível na seleção/);
    assert.match(container.innerHTML, /0 OFs exibidas/);
    assert.doesNotMatch(container.innerHTML, /NaN|Infinity/);
    window.crmToggleLeadtimeMonth(null);
    assert.match(container.innerHTML, /Todos os meses da planilha • 0 OFs/);
});
test('search combines with period and preserves safe input rendering', () => {
    const { window, container } = setup(records);
    window.crmToggleLeadtimeMonth('2026-09');
    window.crmSearchLeadtime('OCT');
    assert.match(container.innerHTML, /0 OFs exibidas/);
    window.crmSearchLeadtime('SEP');
    assert.match(container.innerHTML, /1 OFs exibidas/);
    window.crmSearchLeadtime('"<');
    assert.match(container.innerHTML, /value="&quot;&lt;"/);
});
