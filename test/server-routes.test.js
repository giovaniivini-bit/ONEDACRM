const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const rulesPath = path.join(os.tmpdir(), `oneda-alert-rules-${process.pid}.json`);
process.env.CRM_ADMIN_TOKEN = 'route-test-secret';
process.env.ALERT_RULES_PATH = rulesPath;

const { requestHandler, validateCalendarRecords } = require('../server');

let server;
let port;

function request({ method = 'GET', route = '/', headers = {}, body = '' }) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf8')
            }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

before(async () => {
    server = http.createServer(requestHandler);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    port = server.address().port;
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (fs.existsSync(rulesPath)) fs.rmSync(rulesPath, { force: true });
});

test('serves health and blocks internal static files and malformed URLs', async () => {
    assert.equal((await request({ route: '/api/health' })).status, 200);
    assert.equal((await request({ route: '/server.js' })).status, 404);
    assert.equal((await request({ route: '/data/full_dataset.csv' })).status, 404);
    assert.equal((await request({ route: '/%E0%A4%A' })).status, 400);
    assert.equal((await request({ route: '/images/%E0%A4%A' })).status, 400);
});

test('enforces method and admin authorization on write routes', async () => {
    assert.equal((await request({ route: '/api/sync' })).status, 405);
    assert.equal((await request({ method: 'PUT', route: '/api/alert-rules', body: '{}' })).status, 401);
    assert.equal((await request({ method: 'POST', route: '/api/upload', body: 'csv' })).status, 401);
});

test('persists valid alert rules and reloads them', async () => {
    const rule = {
        id: 'route-test',
        name: 'Regra HTTP',
        description: '',
        enabled: true,
        severity: 'warning',
        match: 'all',
        conditions: [{ field: 'setor', operator: 'equals', value: '13' }],
        message: 'OF {op}',
        system: false
    };
    const saved = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'Content-Type': 'application/json', 'X-CRM-Admin-Token': 'route-test-secret' },
        body: JSON.stringify({ rules: [rule] })
    });
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(saved.body).count, 1);

    const loaded = await request({ route: '/api/alert-rules' });
    assert.equal(loaded.status, 200);
    assert.equal(JSON.parse(loaded.body).data[0].id, 'route-test');
    const stored = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    assert.equal(stored.version, 2);
    assert.equal(stored.rules[0].id, 'route-test');

    const oldSystemRule = { ...rule, id: 'prazo-atrasado', name: 'Antiga', system: true };
    fs.writeFileSync(rulesPath, JSON.stringify([oldSystemRule, rule]), 'utf8');
    const migrated = JSON.parse((await request({ route: '/api/alert-rules' })).body).data;
    assert.deepEqual(migrated.map(item => item.id), [
        'setor13-calendario',
        'setor01-limite-dias',
        'malotes-parte-principal',
        'route-test'
    ]);
});

test('validates the industrial calendar before it can replace the cache', () => {
    const validRows = Array.from({ length: 40 }, (_, index) => ({
        SEMANA: `26${String(index + 1).padStart(2, '0')}`,
        'Data limite para setor 13': '24/set.',
        'data setor 20 -  CORTE iniciar': '',
        'data limite para liberar pendência de estampa': '',
        'quantidade dias aceitaveis para ficar pendente setor 01': '2 dias'
    }));
    assert.equal(validateCalendarRecords(validRows).length, 40);
    assert.throws(() => validateCalendarRecords(validRows.slice(0, 3)), /incompleto/);
    assert.throws(() => validateCalendarRecords(validRows.map(row => ({ ...row, 'Data limite para setor 13': '' }))), /inválido/);
    assert.throws(() => validateCalendarRecords(validRows.map((row, index) => ({
        ...row,
        SEMANA: `99${String(index + 1).padStart(2, '0')}`,
        'Data limite para setor 13': 'arquivo indisponivel',
        'quantidade dias aceitaveis para ficar pendente setor 01': 'erro 999'
    }))), /inválido/);
    assert.throws(() => validateCalendarRecords(validRows.map(row => ({
        ...row,
        'quantidade dias aceitaveis para ficar pendente setor 01': '99 dias'
    }))), /inválido/);
});

test('rejects oversized rules and foreign CORS preflight', async () => {
    const oversized = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'X-CRM-Admin-Token': 'route-test-secret' },
        body: Buffer.alloc(256 * 1024 + 1, 120)
    });
    assert.equal(oversized.status, 413);

    const foreign = await request({
        method: 'OPTIONS',
        route: '/api/alert-rules',
        headers: { Origin: 'https://evil.example', Host: `127.0.0.1:${port}` }
    });
    assert.equal(foreign.status, 403);
});
