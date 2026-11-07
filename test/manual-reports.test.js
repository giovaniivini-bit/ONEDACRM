const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createReportStore } = require('../automatic-reports');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const callbacks = app.slice(app.indexOf('    let automaticReportListRequest=0;'), app.indexOf('    function renderSetor01StyleBadge'));
const records = [{ NUMERO: '1', CODIGO: '01.12.00.1234', TIPO: '1', OP: '01B', SETOR: 'ESTILO', QTDE_PEND: '1' }];
const sources = { mainRecords: [{ NUMERO: '1', CODIGO: '01.12.00.1234', SETOR: '01' }], colorRecords: [], trimRecords: [] };
const payload = () => ({ records, sources, sourceTimestamp: '2026-11-07T12:00:00Z' });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('manual gera fora do horário, compartilha pedidos simultâneos e permite novo lote após terminar', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oneda-manual-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    let clock = new Date('2026-11-07T12:00:00Z'), loads = 0;
    const store = createReportStore({ directory, now: () => clock, renderPdf: async (_, file) => fs.writeFileSync(file, 'PDF') });
    const gate = deferred();
    const first = store.generateOnDemand(async () => { loads++; await gate.promise; return payload(); });
    const second = store.generateOnDemand(() => assert.fail('Não repetir as fontes'));
    assert.equal(first, second);
    gate.resolve();
    const result = await first;
    assert.equal(loads, 1);
    assert.equal(result.generatedReports.length, 8);
    assert.equal(store.list().length, 8);
    assert.equal(fs.existsSync(path.join(directory, 'schedule-runs.json')), false);
    assert.ok(store.list().every(meta => !meta.scheduleKey));
    assert.equal((await store.generateOnDemand(async () => payload())).generatedReports.length, 8);
    assert.equal(store.list().length, 16);
    // Manual batches at the scheduled minute must not consume its ledger entry.
    clock = new Date('2026-11-07T16:30:00Z');
    const [manual, scheduled] = await Promise.all([store.generateOnDemand(async () => payload()), store.generateScheduled(async () => payload())]);
    assert.equal(manual.generatedReports.length, 8);
    assert.equal(scheduled.generatedReports.length, 8);
    assert.equal(store.list().length, 32);
    assert.equal((await store.generateScheduled(() => assert.fail('Horário já concluído'))).skipped, true);
});

test('falha manual de fonte ou PDF conserva o histórico e libera uma nova tentativa', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oneda-manual-failure-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    let fail = false, renders = 0;
    const store = createReportStore({ directory, renderPdf: async (_, file) => {
        if (fail && ++renders === 2) throw new Error('PDF indisponível');
        fs.writeFileSync(file, 'PDF');
    } });
    await store.generateOnDemand(async () => payload());
    const before = fs.readFileSync(path.join(directory, 'index.json'), 'utf8');
    await assert.rejects(store.generateOnDemand(async () => { throw new Error('Falha da planilha'); }), /Falha da planilha/);
    assert.equal(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'), before);
    fail = true;
    await assert.rejects(store.generateOnDemand(async () => payload()), /PDF indisponível/);
    assert.equal(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'), before);
    fail = false;
    await store.generateOnDemand(async () => payload());
    assert.equal(store.list().length, 16);
});

function setup(adminFetch, fetch) {
    const state = { activeSubmodule: 'relatorios-automaticos', automaticReports: [{ id: 'old' }], automaticReport: { id: 'old' }, automaticReportSelection: ['old'] };
    const notifications = [], renders = [];
    const context = vm.createContext({ state, adminFetch, fetch, renderActiveView: () => renders.push(state.automaticReportGenerating), showNotification: (...args) => notifications.push(args) });
    vm.runInContext(callbacks, context);
    return { context, state, notifications, renders };
}
const ok = data => ({ ok: true, json: async () => ({ success: true, ...data }) });

test('ação da tela impede clique duplo/exclusão durante geração e atualiza histórico ao concluir', async () => {
    const gate = deferred(); let posts = 0, lists = 0;
    const ui = setup(async (url, init) => {
        assert.equal(url, '/api/automatic-reports/generate'); assert.equal(init.method, 'POST'); posts++;
        await gate.promise;
        return ok({ generatedReports: Array.from({ length: 8 }, (_, i) => ({ id: String(i) })) });
    }, async () => { lists++; return ok({ reports: [{ id: 'new' }, { id: 'old' }] }); });
    const task = ui.context.generateAutomaticReports();
    assert.equal(ui.state.automaticReportGenerating, true);
    await ui.context.generateAutomaticReports();
    await ui.context.deleteAutomaticReports(['old']);
    assert.equal(posts, 1);
    gate.resolve(); await task;
    assert.equal(lists, 1);
    assert.equal(ui.state.automaticReports[0].id, 'new');
    assert.equal(ui.state.automaticReport.id, 'old');
    assert.equal(ui.state.automaticReportSelection[0], 'old');
    assert.equal(ui.state.automaticReportGenerating, false);
    assert.match(ui.notifications[0][0], /8 relatórios gerados/);
});

test('falha e cancelamento do login exibem erro, preservam histórico e liberam retentativa', async () => {
    for (const cancel of [false, true]) {
        let retry = false;
        const ui = setup(async () => {
            if (retry) return ok({ generatedReports: [] });
            if (cancel) throw new Error('Login cancelado');
            return { ok: false, json: async () => ({ error: 'Fonte indisponível' }) };
        }, async () => ok({ reports: [{ id: 'old' }] }));
        await ui.context.generateAutomaticReports();
        assert.match(ui.state.automaticReportsError, cancel ? /Login cancelado/ : /Fonte indisponível/);
        assert.equal(ui.state.automaticReports[0].id, 'old');
        assert.equal(ui.state.automaticReportGenerating, false);
        assert.equal(ui.notifications.length, 0);
        retry = true;
        await ui.context.generateAutomaticReports();
        assert.equal(ui.state.automaticReportsError, '');
        assert.equal(ui.notifications.length, 1);
    }
});
