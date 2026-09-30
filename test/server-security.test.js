const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { readRequestBody, safeTokenEquals, requestIsSameOrigin, requestIsLocalHost, isAdminRequest } = require('../server-security');

test('compares admin tokens safely', () => {
    assert.equal(safeTokenEquals('abc123', 'abc123'), true);
    assert.equal(safeTokenEquals('abc123', 'wrong'), false);
    assert.equal(safeTokenEquals('', 'abc123'), false);
});

test('recognizes same-origin requests and rejects foreign origins', () => {
    assert.equal(requestIsSameOrigin({
        headers: { origin: 'https://crm.example.com', host: 'crm.example.com' },
        socket: { encrypted: true }
    }), true);
    assert.equal(requestIsSameOrigin({ headers: { origin: 'https://crm.example.com', host: 'crm.example.com' } }), false);
    assert.equal(requestIsSameOrigin({
        headers: { origin: 'https://crm.example.com', host: 'internal:3000', 'x-forwarded-proto': 'https' }
    }, { publicOrigin: 'https://crm.example.com', trustProxy: true }), true);
    assert.equal(requestIsSameOrigin({ headers: { origin: 'https://evil.example', host: 'crm.example.com' } }), false);
    const local = {
        headers: { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' },
        socket: { remoteAddress: '::ffff:127.0.0.1' }
    };
    assert.equal(requestIsLocalHost(local), true);
    assert.equal(requestIsLocalHost({ headers: { host: '[::1]:3000' }, socket: { remoteAddress: '::1' } }), true);
    assert.equal(isAdminRequest(local, ''), true);
    assert.equal(isAdminRequest({
        headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
        socket: { remoteAddress: '203.0.113.8', encrypted: true }
    }, ''), false);
    assert.equal(isAdminRequest({
        headers: { origin: 'https://crm.example.com', host: 'crm.example.com' },
        socket: { remoteAddress: '203.0.113.8' }
    }, ''), false);
    assert.equal(isAdminRequest({ headers: { 'x-crm-admin-token': 'secret' } }, 'secret'), true);
});

test('reads normal bodies and rejects oversized bodies', async () => {
    const normal = Readable.from([Buffer.from('conteudo')]);
    assert.equal(await readRequestBody(normal, 100), 'conteudo');
    const oversized = Readable.from([Buffer.alloc(101)]);
    await assert.rejects(() => readRequestBody(oversized, 100), error => error.statusCode === 413);
});
