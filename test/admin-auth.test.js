'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodePasswordHash, verifyPassword, createAdminAuth } = require('../admin-auth');

function fakeRequest({ host = 'crm.example.com', origin = 'https://crm.example.com', cookie = '', address = '203.0.113.10' } = {}) {
    return {
        headers: { host, origin, cookie },
        socket: { remoteAddress: address, encrypted: origin.startsWith('https://') }
    };
}

test('hashes and verifies strong passwords without storing plaintext', () => {
    const password = 'Senha forte com 24 caracteres!';
    const encoded = encodePasswordHash(password, Buffer.alloc(16, 7));
    assert.match(encoded, /^scrypt\$/);
    assert.equal(encoded.includes(password), false);
    assert.equal(verifyPassword(password, encoded), true);
    assert.equal(verifyPassword('senha errada e bem comprida', encoded), false);
    assert.throws(() => encodePasswordHash('curta'), /16 caracteres/);
});

test('creates HttpOnly sessions and requires same-origin writes', () => {
    const password = 'Senha administrativa de teste!';
    const auth = createAdminAuth({ passwordHash: encodePasswordHash(password), sessionTtlMs: 60_000 });
    const login = auth.login(fakeRequest(), password);
    assert.equal(login.ok, true);
    assert.match(login.cookie, /HttpOnly/);
    assert.match(login.cookie, /SameSite=Strict/);
    assert.match(login.cookie, /Secure/);

    const cookie = login.cookie.split(';')[0];
    assert.equal(auth.isAuthorized(fakeRequest({ cookie })), true);
    assert.equal(auth.isAuthorized(fakeRequest({ cookie, origin: 'https://evil.example' })), false);
    assert.equal(auth.status(fakeRequest({ cookie })).authenticated, true);

    auth.logout(fakeRequest({ cookie }));
    assert.equal(auth.status(fakeRequest({ cookie })).authenticated, false);
});

test('expires sessions and keeps legacy recovery independent from cookies', () => {
    let currentTime = 10_000;
    const password = 'Senha para testar expiracao!';
    const auth = createAdminAuth({
        passwordHash: encodePasswordHash(password),
        legacyToken: 'recovery-token',
        sessionTtlMs: 100,
        now: () => currentTime
    });
    const login = auth.login(fakeRequest(), password);
    const cookie = login.cookie.split(';')[0];
    currentTime += 101;
    assert.equal(auth.status(fakeRequest({ cookie })).authenticated, false);
    assert.equal(auth.isAuthorized({
        headers: { cookie, 'x-crm-admin-token': 'recovery-token' },
        socket: { remoteAddress: '203.0.113.10' }
    }), true);
});

test('rate limits clients separately when the trusted proxy supplies their addresses', () => {
    const password = 'Senha para testar o proxy!';
    const auth = createAdminAuth({
        passwordHash: encodePasswordHash(password),
        trustProxy: true,
        trustedProxyAddresses: ['127.0.0.1']
    });
    const proxiedRequest = (address, peer = '127.0.0.1') => ({
        headers: {
            host: 'crm.example.com',
            origin: 'https://crm.example.com',
            'x-forwarded-for': address
        },
        socket: { remoteAddress: peer }
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal(auth.login(proxiedRequest('198.51.100.10'), 'incorreta').statusCode, 401);
    }
    assert.equal(auth.login(proxiedRequest('198.51.100.10'), password).statusCode, 429);
    assert.equal(auth.login(proxiedRequest('198.51.100.11'), password).ok, true);

    const directAuth = createAdminAuth({
        passwordHash: encodePasswordHash(password),
        trustProxy: true,
        trustedProxyAddresses: ['127.0.0.1']
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal(directAuth.login(proxiedRequest(`203.0.113.${attempt}`, '198.51.100.50'), 'incorreta').statusCode, 401);
    }
    assert.equal(directAuth.login(proxiedRequest('203.0.113.99', '198.51.100.50'), password).statusCode, 429);
});

test('rate limits repeated invalid passwords and retains legacy recovery token', () => {
    const auth = createAdminAuth({
        passwordHash: encodePasswordHash('Outra senha administrativa!'),
        legacyToken: 'recovery-token'
    });
    const req = fakeRequest();
    for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal(auth.login(req, 'incorreta mas comprida').statusCode, 401);
    }
    assert.equal(auth.login(req, 'Outra senha administrativa!').statusCode, 429);
    assert.equal(auth.isAuthorized({ headers: { 'x-crm-admin-token': 'recovery-token' } }), true);
});
