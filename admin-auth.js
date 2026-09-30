'use strict';

const crypto = require('crypto');
const { requestIsSameOrigin, safeTokenEquals } = require('./server-security');

const SESSION_COOKIE = 'crm_admin_session';
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function encodePasswordHash(password, salt = crypto.randomBytes(16)) {
    const normalized = String(password || '');
    if (normalized.length < 16) throw new Error('A senha administrativa deve ter pelo menos 16 caracteres.');
    const digest = crypto.scryptSync(normalized, salt, 64);
    return `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}

function verifyPassword(password, encodedHash) {
    try {
        const [algorithm, saltValue, digestValue, extra] = String(encodedHash || '').split('$');
        if (algorithm !== 'scrypt' || !saltValue || !digestValue || extra !== undefined) return false;
        const expected = Buffer.from(digestValue, 'base64url');
        if (expected.length !== 64) return false;
        const actual = crypto.scryptSync(String(password || ''), Buffer.from(saltValue, 'base64url'), expected.length);
        return crypto.timingSafeEqual(actual, expected);
    } catch (_) {
        return false;
    }
}

function parseCookies(req) {
    return String(req.headers.cookie || '').split(';').reduce((cookies, entry) => {
        const separator = entry.indexOf('=');
        if (separator < 1) return cookies;
        const name = entry.slice(0, separator).trim();
        const value = entry.slice(separator + 1).trim();
        if (name) cookies[name] = value;
        return cookies;
    }, {});
}

function normalizeAddress(value) {
    return String(value || '').trim().toLowerCase().replace(/^::ffff:/, '');
}

function clientAddress(req, trustProxy = false, trustedProxyAddresses = []) {
    const peerAddress = normalizeAddress(req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown');
    const trustedPeers = new Set(trustedProxyAddresses.map(normalizeAddress));
    if (trustProxy && trustedPeers.has(peerAddress)) {
        const forwarded = String(req.headers['x-forwarded-for'] || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
        if (forwarded.length) return normalizeAddress(forwarded[forwarded.length - 1]);
    }
    return peerAddress;
}

function shouldUseSecureCookie(req) {
    const hostname = String(req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '').toLowerCase();
    return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function createAdminAuth({
    passwordHash = '',
    legacyToken = '',
    publicOrigin = '',
    trustProxy = false,
    trustedProxyAddresses = [],
    sessionTtlMs = DEFAULT_SESSION_TTL_MS,
    now = () => Date.now()
} = {}) {
    const sessions = new Map();
    const loginAttempts = new Map();

    function prune(currentTime = now()) {
        for (const [token, expiresAt] of sessions) {
            if (expiresAt <= currentTime) sessions.delete(token);
        }
        for (const [address, record] of loginAttempts) {
            if (record.resetAt <= currentTime) loginAttempts.delete(address);
        }
    }

    function getSession(req) {
        prune();
        const token = parseCookies(req)[SESSION_COOKIE];
        if (!token) return null;
        const expiresAt = sessions.get(token);
        if (!expiresAt || expiresAt <= now()) {
            sessions.delete(token);
            return null;
        }
        return { token, expiresAt };
    }

    function isAuthorized(req) {
        if (legacyToken && safeTokenEquals(req.headers['x-crm-admin-token'], legacyToken)) return true;
        const session = getSession(req);
        return Boolean(session) && requestIsSameOrigin(req, { publicOrigin, trustProxy });
    }

    function status(req) {
        const session = getSession(req);
        return {
            authenticated: Boolean(session),
            expiresAt: session ? new Date(session.expiresAt).toISOString() : null,
            passwordEnabled: Boolean(passwordHash)
        };
    }

    function login(req, password) {
        prune();
        const address = clientAddress(req, trustProxy, trustedProxyAddresses);
        const currentTime = now();
        const attempt = loginAttempts.get(address);
        if (attempt && attempt.count >= MAX_LOGIN_ATTEMPTS && attempt.resetAt > currentTime) {
            return { ok: false, statusCode: 429, retryAfterSeconds: Math.ceil((attempt.resetAt - currentTime) / 1000) };
        }
        if (!passwordHash || !verifyPassword(password, passwordHash)) {
            const current = attempt && attempt.resetAt > currentTime
                ? attempt
                : { count: 0, resetAt: currentTime + LOGIN_WINDOW_MS };
            current.count += 1;
            loginAttempts.set(address, current);
            return { ok: false, statusCode: 401 };
        }
        loginAttempts.delete(address);
        const token = crypto.randomBytes(32).toString('base64url');
        const expiresAt = currentTime + sessionTtlMs;
        sessions.set(token, expiresAt);
        const secure = shouldUseSecureCookie(req) ? '; Secure' : '';
        return {
            ok: true,
            expiresAt,
            cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secure}`
        };
    }

    function logout(req) {
        const token = parseCookies(req)[SESSION_COOKIE];
        if (token) sessions.delete(token);
        const secure = shouldUseSecureCookie(req) ? '; Secure' : '';
        return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
    }

    return { isAuthorized, status, login, logout };
}

module.exports = {
    SESSION_COOKIE,
    DEFAULT_SESSION_TTL_MS,
    encodePasswordHash,
    verifyPassword,
    createAdminAuth
};
