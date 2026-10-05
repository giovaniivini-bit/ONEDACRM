const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDriveImageProxy } = require('../drive-image-cache');
function response() { return { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } }; }
test('deduplicates concurrent downloads; survives restart; handles ETag and invalid input', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-img-test-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    let calls = 0;
    const download = async () => { calls++; await new Promise(r => setTimeout(r, 20)); return { type: 'image/jpeg', buffer: Buffer.from('image-fixture') }; };
    const proxy = createDriveImageProxy(dir, download);
    const responses = Array.from({ length: 5 }, response);
    await Promise.all(responses.map(res => proxy('file_id_12345', res)));
    assert.equal(calls, 1);
    assert.ok(responses.every(res => res.status === 200));
    const restarted = createDriveImageProxy(dir, () => { throw Error('offline'); });
    const cached = response(); await restarted('file_id_12345', cached);
    assert.equal(cached.status, 200); assert.deepEqual(cached.body, responses[0].body);
    const conditional = response(); await restarted('file_id_12345', conditional, 'w600', { headers: { 'if-none-match': cached.headers.ETag } });
    assert.equal(conditional.status, 304);
    const bad = response(); await restarted('../../etc/passwd', bad); assert.equal(bad.status, 400);
    const badSize = response(); await restarted('file_id_12345', badSize, 'w99999'); assert.equal(badSize.status, 400);
});
test('Drive failures are not cached as images, retries are bounded, stale images remain available', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-img-test-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    let calls = 0;
    const proxy = createDriveImageProxy(dir, async () => { calls++; throw Error('unavailable'); });
    for (let i = 0; i < 2; i++) { const res = response(); await proxy('file_id_12345', res); assert.equal(res.status, 502); assert.equal(res.headers['Cache-Control'], 'no-store'); }
    assert.equal(calls, 1);
    await fs.writeFile(path.join(dir, 'stale_id_12345-w600.json'), JSON.stringify({ saved: 0, type: 'image/png', etag: '"old"', body: Buffer.from('old-image').toString('base64') }));
    const stale = response(); await proxy('stale_id_12345', stale);
    assert.equal(stale.status, 200); assert.equal(stale.body.toString(), 'old-image');
});

test('limits concurrent downloads and prunes the disk cache', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-img-test-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    let active = 0; let peak = 0;
    const download = async url => {
        active++; peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 15));
        active--;
        return { type: 'image/jpeg', buffer: Buffer.from(url.repeat(4)) };
    };
    const proxy = createDriveImageProxy(dir, download, { maxConcurrent: 2, maxCacheEntries: 2, maxCacheBytes: 1024 * 1024 });
    await Promise.all(['cache_file_0001', 'cache_file_0002', 'cache_file_0003', 'cache_file_0004'].map(async id => {
        const res = response(); await proxy(id, res); assert.equal(res.status, 200);
    }));
    await new Promise(resolve => setTimeout(resolve, 30));
    const cachedFiles = (await fs.readdir(dir)).filter(name => name.endsWith('.json'));
    assert.ok(peak <= 2);
    assert.ok(cachedFiles.length <= 2);
});

test('manual invalidation removes cached Drive thumbnails so replacements are downloaded', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-img-test-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    let current = 'old-image';
    let calls = 0;
    const proxy = createDriveImageProxy(dir, async () => {
        calls++;
        return { type: 'image/jpeg', buffer: Buffer.from(current) };
    });
    const first = response(); await proxy('replace_id_12345', first);
    current = 'new-image';
    const cached = response(); await proxy('replace_id_12345', cached);
    assert.equal(cached.body.toString(), 'old-image');

    await proxy.invalidate(new Set(['replace_id_12345']));
    const refreshed = response(); await proxy('replace_id_12345', refreshed);
    assert.equal(refreshed.body.toString(), 'new-image');
    assert.equal(calls, 2);
});

test('invalidation during an old download prevents it from repopulating the cache', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-img-test-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    let releaseOld;
    let calls = 0;
    const proxy = createDriveImageProxy(dir, async () => {
        calls++;
        if (calls === 1) {
            await new Promise(resolve => { releaseOld = resolve; });
            return { type: 'image/jpeg', buffer: Buffer.from('old-image') };
        }
        return { type: 'image/jpeg', buffer: Buffer.from('new-image') };
    });

    const oldResponse = response();
    const oldRequest = proxy('replace_id_12345', oldResponse);
    while (!releaseOld) await new Promise(resolve => setImmediate(resolve));
    await proxy.invalidate(new Set(['replace_id_12345']));
    const newResponse = response();
    await proxy('replace_id_12345', newResponse);
    releaseOld();
    await oldRequest;

    const cached = response();
    await proxy('replace_id_12345', cached);
    assert.equal(newResponse.body.toString(), 'new-image');
    assert.equal(cached.body.toString(), 'new-image');
    assert.equal(calls, 2);
});
