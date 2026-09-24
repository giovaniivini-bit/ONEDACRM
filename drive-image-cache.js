'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');

// Only images from Google may be followed; never proxy an arbitrary user URL.
function downloadImage(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || !/^(drive\.google\.com|([a-z0-9-]+\.)*googleusercontent\.com)$/.test(parsed.hostname) || redirects > 5) {
            reject(new Error('Invalid image redirect')); return;
        }
        const request = https.get(parsed, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                downloadImage(new URL(response.headers.location, parsed).href, redirects + 1).then(resolve, reject);
                return;
            }
            const type = (response.headers['content-type'] || '').split(';')[0];
            if (response.statusCode !== 200 || !/^image\/(jpeg|png|webp|gif)$/.test(type)) {
                response.resume(); reject(new Error('Drive did not return an image')); return;
            }
            const chunks = []; let length = 0;
            response.on('data', chunk => {
                length += chunk.length;
                if (length > 12 * 1024 * 1024) request.destroy(new Error('Image too large'));
                else chunks.push(chunk);
            });
            response.on('error', reject);
            response.on('aborted', () => reject(new Error('Image download interrupted')));
            response.on('end', () => length ? resolve({ type, buffer: Buffer.concat(chunks) }) : reject(new Error('Empty image')));
        });
        const deadline = setTimeout(() => request.destroy(new Error('Image download timeout')), 15000);
        request.on('close', () => clearTimeout(deadline));
        request.on('error', reject);
    });
}

function createDriveImageProxy(directory, download = downloadImage, options = {}) {
    const pending = new Map();
    const failures = new Map();
    const ttl = 86400000;
    const maxConcurrent = Math.max(1, Number(options.maxConcurrent) || 4);
    const maxCacheBytes = Math.max(1024, Number(options.maxCacheBytes) || 512 * 1024 * 1024);
    const maxCacheEntries = Math.max(1, Number(options.maxCacheEntries) || 1000);
    let activeDownloads = 0;
    const downloadQueue = [];
    let prunePromise = Promise.resolve();

    function withDownloadSlot(task) {
        return new Promise((resolve, reject) => {
            const run = async () => {
                activeDownloads += 1;
                try { resolve(await task()); }
                catch (error) { reject(error); }
                finally {
                    activeDownloads -= 1;
                    const next = downloadQueue.shift();
                    if (next) next();
                }
            };
            if (activeDownloads < maxConcurrent) run();
            else downloadQueue.push(run);
        });
    }

    async function pruneCache() {
        let names;
        try { names = await fs.readdir(directory); } catch (_) { return; }
        const files = (await Promise.all(names.filter(name => name.endsWith('.json')).map(async name => {
            const file = path.join(directory, name);
            try { return { file, ...(await fs.stat(file)) }; } catch (_) { return null; }
        }))).filter(Boolean).sort((a, b) => a.mtimeMs - b.mtimeMs);
        let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        while (files.length > maxCacheEntries || totalBytes > maxCacheBytes) {
            const oldest = files.shift();
            if (!oldest) break;
            try { await fs.unlink(oldest.file); totalBytes -= oldest.size; } catch (_) { /* Best effort. */ }
        }
    }
    async function getImage(id, size) {
        const key = `${id}-${size}`;
        const filename = path.join(directory, key + '.json');
        let cached;
        try {
            const data = JSON.parse(await fs.readFile(filename, 'utf8'));
            cached = { ...data, buffer: Buffer.from(data.body, 'base64') };
            if (Date.now() - cached.saved < ttl) return cached;
        } catch (_) { /* Cache miss. */ }
        if ((failures.get(key) || 0) > Date.now()) {
            if (cached) return cached;
            throw new Error('Drive temporarily unavailable');
        }
        if (!pending.has(key)) {
            const promise = (async () => {
                try {
                    const entry = await withDownloadSlot(() => download(`https://drive.google.com/thumbnail?id=${id}&sz=${size}`));
                    entry.saved = Date.now();
                    entry.etag = '"' + crypto.createHash('sha256').update(entry.buffer).digest('hex') + '"';
                    try {
                        await fs.mkdir(directory, { recursive: true });
                        const temp = filename + '.tmp';
                        await fs.writeFile(temp, JSON.stringify({ type: entry.type, saved: entry.saved, etag: entry.etag, body: entry.buffer.toString('base64') }));
                        await fs.rename(temp, filename);
                        prunePromise = prunePromise.then(pruneCache, pruneCache);
                    } catch (_) { /* A disk-cache failure must not hide a valid downloaded photo. */ }
                    failures.delete(key);
                    return entry;
                } catch (error) {
                    if (failures.size > 1000) failures.clear();
                    failures.set(key, Date.now() + 60000);
                    if (cached) return cached;
                    throw error;
                } finally { pending.delete(key); }
            })();
            pending.set(key, promise);
        }
        return pending.get(key);
    }
    return async (id, res, size = 'w600', req = { headers: {} }) => {
        if (!/^[A-Za-z0-9_-]{10,100}$/.test(id) || !['w600', 'w1200'].includes(size)) {
            res.writeHead(400, { 'Cache-Control': 'no-store' }); res.end('Invalid image request'); return;
        }
        try {
            const entry = await getImage(id, size);
            const headers = { 'Content-Type': entry.type, 'ETag': entry.etag, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
            if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304, headers); res.end(); return; }
            res.writeHead(200, { ...headers, 'Content-Length': entry.buffer.length });
            res.end(entry.buffer);
        } catch (_) {
            res.writeHead(502, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Imagem temporariamente indisponível');
        }
    };
}
module.exports = { createDriveImageProxy, downloadImage };
