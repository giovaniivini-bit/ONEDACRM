const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { encodePasswordHash } = require('../admin-auth');

const rulesPath = path.join(os.tmpdir(), `oneda-alert-rules-${process.pid}.json`);
process.env.CRM_ADMIN_TOKEN = 'route-test-secret';
process.env.CRM_ADMIN_PASSWORD_HASH = encodePasswordHash('Senha administrativa para rotas!');
process.env.ALERT_RULES_PATH = rulesPath;

const { requestHandler, validateCalendarRecords, sanitizeProgFeiraRecords } = require('../server');

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
    assert.equal((await request({ method: 'PUT', route: '/api/alert-rules', body: '{}' })).status, 405);
    assert.equal((await request({ method: 'POST', route: '/api/upload', body: 'csv' })).status, 401);
});

test('serves only the three code-owned alert rules', async () => {
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
    fs.writeFileSync(rulesPath, JSON.stringify({ version: 2, rules: [rule] }), 'utf8');
    const rejected = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'Content-Type': 'application/json', 'X-CRM-Admin-Token': 'route-test-secret' },
        body: JSON.stringify({ rules: [rule] })
    });
    assert.equal(rejected.status, 405);

    const loaded = await request({ route: '/api/alert-rules' });
    assert.equal(loaded.status, 200);
    assert.deepEqual(JSON.parse(loaded.body).data.map(item => item.id), [
        'setor13-calendario',
        'setor01-limite-dias',
        'malotes-parte-principal'
    ]);
});

test('authenticates administrative writes with an HttpOnly session cookie', async () => {
    const origin = `http://127.0.0.1:${port}`;
    const missingOrigin = await request({
        method: 'POST',
        route: '/api/admin/login',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'Senha administrativa para rotas!' })
    });
    assert.equal(missingOrigin.status, 403);

    const invalid = await request({
        method: 'POST',
        route: '/api/admin/login',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ password: 'senha incorreta' })
    });
    assert.equal(invalid.status, 401);

    const login = await request({
        method: 'POST',
        route: '/api/admin/login',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ password: 'Senha administrativa para rotas!' })
    });
    assert.equal(login.status, 200);
    assert.match(login.headers['set-cookie'][0], /HttpOnly/);
    assert.match(login.headers['set-cookie'][0], /SameSite=Strict/);
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    const session = await request({
        route: '/api/admin/session',
        headers: { Cookie: cookie, Origin: origin }
    });
    assert.equal(JSON.parse(session.body).authenticated, true);

    const saved = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin },
        body: JSON.stringify({ rules: [] })
    });
    assert.equal(saved.status, 405);

    const crossOrigin = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://evil.example' },
        body: JSON.stringify({ rules: [] })
    });
    assert.equal(crossOrigin.status, 405);

    const logout = await request({
        method: 'POST',
        route: '/api/admin/logout',
        headers: { Cookie: cookie, Origin: origin }
    });
    assert.equal(logout.status, 200);
    assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
    const afterLogout = await request({
        route: '/api/admin/session',
        headers: { Cookie: cookie, Origin: origin }
    });
    assert.equal(JSON.parse(afterLogout.body).authenticated, false);
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

test('projects Prog Feira records and rejects exports without current TIPO 1 rows', () => {
    const sanitized = sanitizeProgFeiraRecords([{
        NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01E', TIPO: '1', FICHA: '09/10',
        PRECO_VENDA: '99,90', PRECO_COM: '45,00', COD_CLIENTE: 'B41', ID: 'interno'
    }]);
    assert.equal(sanitized.length, 1);
    assert.equal(sanitized[0].CODIGO, '01.11.00.7904');
    assert.equal(sanitized[0].FICHA, '09/10');
    assert.equal(Object.hasOwn(sanitized[0], 'PRECO_VENDA'), false);
    assert.equal(Object.hasOwn(sanitized[0], 'PRECO_COM'), false);
    assert.equal(Object.hasOwn(sanitized[0], 'COD_CLIENTE'), false);
    assert.throws(() => sanitizeProgFeiraRecords([
        { NUMERO: '77826', CODIGO: '01.11.00.7904', TIPO: '2' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', TIPO: '3' }
    ]), /TIPO 1/);
});

test('rejects alert-rule writes and foreign CORS preflight', async () => {
    const oversized = await request({
        method: 'PUT',
        route: '/api/alert-rules',
        headers: { 'X-CRM-Admin-Token': 'route-test-secret' },
        body: Buffer.alloc(256 * 1024 + 1, 120)
    });
    assert.equal(oversized.status, 405);

    const foreign = await request({
        method: 'OPTIONS',
        route: '/api/alert-rules',
        headers: { Origin: 'https://evil.example', Host: `127.0.0.1:${port}` }
    });
    assert.equal(foreign.status, 403);
});
