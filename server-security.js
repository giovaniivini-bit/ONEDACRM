'use strict';

const crypto = require('crypto');

class BodyTooLargeError extends Error {
    constructor(limit) {
        super(`Corpo da requisição excede o limite de ${limit} bytes.`);
        this.name = 'BodyTooLargeError';
        this.statusCode = 413;
    }
}

function readRequestBody(req, limitBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let rejected = false;
        req.on('data', chunk => {
            if (rejected) return;
            size += chunk.length;
            if (size > limitBytes) {
                rejected = true;
                chunks.length = 0;
                reject(new BodyTooLargeError(limitBytes));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (!rejected) resolve(Buffer.concat(chunks).toString('utf8'));
        });
        req.on('error', reject);
    });
}

function safeTokenEquals(actual, expected) {
    if (!actual || !expected) return false;
    const left = Buffer.from(String(actual));
    const right = Buffer.from(String(expected));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requestIsSameOrigin(req, { publicOrigin = '', trustProxy = false } = {}) {
    const origin = req.headers.origin;
    if (!origin) return false;
    try {
        const originUrl = new URL(origin);
        if (publicOrigin) return originUrl.origin === new URL(publicOrigin).origin;
        const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const protocol = trustProxy && forwardedProtocol
            ? forwardedProtocol
            : (req.socket?.encrypted ? 'https' : 'http');
        return originUrl.origin === `${protocol}://${req.headers.host}`;
    } catch (_) {
        return false;
    }
}

function requestIsLocalHost(req) {
    try {
        const hostUrl = new URL(`http://${req.headers.host || ''}`);
        const localHost = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostUrl.hostname);
        const remoteAddress = String(req.socket?.remoteAddress || req.connection?.remoteAddress || '')
            .toLowerCase()
            .replace(/^::ffff:/, '');
        return localHost && ['127.0.0.1', '::1'].includes(remoteAddress);
    } catch (_) {
        return false;
    }
}

function isAdminRequest(req, configuredToken) {
    if (configuredToken) return safeTokenEquals(req.headers['x-crm-admin-token'], configuredToken);
    return requestIsLocalHost(req) && requestIsSameOrigin(req);
}

function applySecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

module.exports = {
    BodyTooLargeError,
    readRequestBody,
    safeTokenEquals,
    requestIsSameOrigin,
    requestIsLocalHost,
    isAdminRequest,
    applySecurityHeaders
};
