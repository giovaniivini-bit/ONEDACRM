const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { publicImage, consolidate, validateSummaries, createMpoService } = require('../mpo-integration');
function build(id, ref = '01.16.00.7930A', overrides = {}) {
    const item = { id: '1', ref, cliente: 'Oneda', folha: 1, fase: '01A', tem_pendencia: true, pendencias: ['Pendência Ana'], previsoes: {}, image_url: `/workspaces/${id}/images/fichas/a.png`, ...overrides };
    return { workspace: { id, nome: id }, todas_pecas: [item], por_responsavel: { ana: { responsavel: 'Ana', itens: [item] } } };
}
test('consolidates internal and default memories without requiring a program name', () => {
    const summaries = validateSummaries({ workspaces: { default: build('default'), mpo_project_default: build('mpo_project_default', '01.16.00.7930') } });
    const summary = consolidate(summaries);
    assert.equal(summary.workspace.total_pecas, 2);
    assert.equal(summary.por_responsavel.ana.total_pecas, 2);
    assert.notEqual(summary.todas_pecas[0].key, summary.todas_pecas[1].key);
    assert.equal(summary.todas_pecas[0].sources[0].name, '');
});
test('collapses identical copies but preserves different pendencies and full codes', () => {
    const summary = consolidate([build('default'), build('copy'), build('different', undefined, { obs_gerais: 'Outra observação' }), build('suffix', '01.16.00.7930')]);
    assert.equal(summary.workspace.total_pecas, 3);
    assert.equal(summary.identicalCopies, 1);
    assert.equal(summary.por_responsavel.ana.total_pecas, 3);
    assert.equal(summary.todas_pecas[0].sources.length, 2);
    assert.equal(summary.todas_pecas[0].image_urls.length, 2);
});
test('rejects incomplete payloads and group references that cannot be resolved', () => {
    assert.throws(() => validateSummaries({}), /inválida/);
    assert.throws(() => validateSummaries({ workspaces: {} }), /fontes/);
    assert.throws(() => validateSummaries({ workspaces: { wrong: build('default') } }), /inválido/);
    assert.throws(() => validateSummaries({ workspaces: { default: build('default', undefined, { pendencias: null }) } }), /inválida/);
    const inconsistent = build('default');
    inconsistent.por_responsavel.ana.itens = [{ id: 'other', ref: 'other' }];
    assert.throws(() => consolidate(validateSummaries({ workspaces: { default: inconsistent } })), /ausente/);
});
test('image links reject arbitrary origins and encoded traversal', () => {
    assert.equal(publicImage('/workspaces/B41/images/fichas/a.png'), 'https://mpo.136-248-111-213.sslip.io/workspaces/B41/images/fichas/a.png');
    assert.equal(publicImage('/images/fichas/a.png'), 'https://mpo.136-248-111-213.sslip.io/images/fichas/a.png');
    for (const value of ['http://127.0.0.1:8085/a.png', '/workspaces/B41/images/../../secret.png', '/workspaces/B41/images/%252e%252e/secret.png', '/workspaces/B41/images/a.svg', '/workspaces/B41/images/a.png?x=1']) assert.equal(publicImage(value), '');
});
test('persists successful data, survives restart and outage, rejects incomplete replacement', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oneda-mpo-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const snapshotPath = path.join(dir, 'snapshot.json');
    let fail = false;
    let calls = 0;
    const sync = createMpoService({ snapshotPath, read: async route => {
        calls++;
        assert.equal(route, '/api/crm/all-summaries');
        if (fail) return {};
        return { workspaces: { default: build('default') } };
    } });
    const [fresh, same] = await Promise.all([sync(), sync()]);
    assert.equal(calls, 1);
    assert.deepEqual(fresh, same);
    assert.equal(fresh.stale, false);
    const saved = await fs.readFile(snapshotPath, 'utf8');
    fail = true;
    const cached = await sync();
    assert.equal(cached.stale, true);
    assert.equal(cached.fetchedAt, fresh.fetchedAt);
    assert.equal(await fs.readFile(snapshotPath, 'utf8'), saved);
    const restarted = createMpoService({ snapshotPath, read: async () => { throw new Error('offline'); } });
    assert.deepEqual((await restarted()).summary, fresh.summary);
    const empty = build('default'); empty.todas_pecas = []; empty.por_responsavel = {};
    const cleared = createMpoService({ snapshotPath, read: async () => ({ workspaces: { default: empty } }) });
    assert.equal((await cleared()).summary.workspace.total_pecas, 0);
});
test('outage without a previous snapshot fails instead of inventing an empty result', async () => {
    const sync = createMpoService({ snapshotPath: path.join(os.tmpdir(), `missing-mpo-${process.pid}.json`), read: async () => { throw new Error('offline'); } });
    await assert.rejects(sync(), /offline/);
});

test('view keeps image alternatives with their own card, searches groups and retains data on failure', async () => {
    const vm = require('node:vm');
    const nodes = {};
    let cardNodes = [];
    let html = '';
    const buttons = ['', 'ana'].map(filter => ({ dataset: { filter }, setAttribute() {} }));
    const node = id => nodes[id] ||= { innerHTML: '', textContent: '', hidden: false };
    Object.defineProperty(node('#mpo-cards'), 'innerHTML', { get: () => html, set: value => {
        html = value;
        cardNodes = [...value.matchAll(/<article class="mpo-card">([\s\S]*?)<\/article>/g)].map(match => {
            const src = match[1].match(/<img src="([^"]+)"/);
            const img = src ? { src: src[1], parentElement: { href: src[1], replaceWith(value) { this.replacement = value; } } } : null;
            return { querySelector: () => img };
        });
    } });
    const container = {
        set innerHTML(value) { this.markup = value; },
        querySelector: selector => selector === '.mpo-view' ? {} : node(selector),
        querySelectorAll: selector => selector === '.mpo-card' ? cardNodes : selector === '[data-filter]' ? buttons : []
    };
    const summary = consolidate([build('default', 'WITHOUT-IMAGE', { image_url: '', pendencias: ['Aguardando'] }), build('second', 'WITH-IMAGE'), build('copy', 'WITH-IMAGE')]);
    let fail = false;
    const context = { window: {}, URL, AbortController, setTimeout, clearTimeout, document: { createElement: () => ({}) }, fetch: async () => {
        if (fail) throw new Error('offline');
        return { ok: true, json: async () => ({ summary, fetchedAt: '2026-10-12T12:00:00.000Z', stale: false }) };
    } };
    vm.runInNewContext(await fs.readFile(path.join(__dirname, '..', 'mpo-view.js'), 'utf8'), context);
    await context.window.renderMpoView(container);
    assert.equal(cardNodes.length, 2);
    const image = cardNodes[1].querySelector('img');
    image.onerror();
    assert.match(image.src, /\/workspaces\/copy\/images\//);
    assert.equal(image.parentElement.href, image.src);
    node('#mpo-search').oninput({ target: { value: 'Ana' } });
    assert.equal(cardNodes.length, 2, 'responsible groups are searched even without the name in pendency text');
    node('#mpo-search').oninput({ target: { value: 'WITHOUT-IMAGE' } });
    assert.equal(cardNodes.length, 1);
    fail = true;
    await context.window.renderMpoView(container);
    assert.match(container.markup, /offline/);
    assert.match(container.markup, /Última consulta salva/);
    assert.equal(cardNodes.length, 1);
});
