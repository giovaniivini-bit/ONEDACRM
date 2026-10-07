const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    findLocalImagePath,
    seedCachedCloudImages,
    mergeCloudImageEntry,
    DRIVE_FOLDER_SORT_PARAMS
} = require('../server');

const root = path.resolve(__dirname, '..');
const { parseEmbeddedFolder } = require('../drive-folder-list');

test('partial sheet failure still applies fresh Prog Feira data and reports the failed source', async () => {
    const vm = require('node:vm');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const start = app.indexOf('async function loadExternalSheets(');
    const end = app.indexOf('function getProductImage(', start);
    const state = { activeSubmodule: 'prog-feira', progFeiraExternalData: { records: [{ CODIGO: 'OLD' }] } };
    let renders = 0;
    const context = vm.createContext({
        state, window: { location: { protocol: 'https:' } }, console: { warn() {} },
        updateSidebarBadges() {}, renderActiveView() { renders++; },
        adminFetch: async url => ({ ok: !url.includes('type=cq'), json: async () => url.includes('type=cq')
            ? { success: false, error: 'Fonte CQ indisponível' }
            : { success: true, isLive: true, records: [{ CODIGO: 'NEW' }] } })
    });
    vm.runInContext(app.slice(start, end), context);
    await assert.rejects(context.loadExternalSheets(true), /Atualização parcial: cq/);
    assert.equal(state.progFeiraExternalData.records[0].CODIGO, 'NEW');
    assert.equal(renders, 1);
});

test('embedded Drive listing discovers exact product filenames beyond the main page window', () => {
    const html = '<div class="flip-entry" id="entry-photo579"><div><a><div class="flip-entry-title">01.16.42.0579.jpg</div></a></div></div>' +
        '<div class="flip-entry" id="entry-photo578"><div class="flip-entry-title">01.16.42.0578.jpg</div></div>' +
        '<div class="flip-entry" id="entry-variant"><div class="flip-entry-title">01.16.42.0579A.jpg</div></div>' +
        '<div class="flip-entry" id="entry-document"><div class="flip-entry-title">notes.pdf</div></div>';
    assert.deepEqual(parseEmbeddedFolder(html), [
        { id: 'photo579', filename: '01.16.42.0579.jpg' },
        { id: 'photo578', filename: '01.16.42.0578.jpg' },
        { id: 'variant', filename: '01.16.42.0579A.jpg' }
    ]);
    assert.deepEqual(parseEmbeddedFolder('<html>Login required</html>'), []);
});

test('Drive replacement wins over bundled image and URLs are versioned', () => {
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

    assert.match(server, /existing\.isBundledStatic \|\| existing\.isLocal === false/);
    assert.match(server, /mergedMap\[key\] = remoteEntry \|\| bundledEntry/);
    assert.match(server, /if \(refreshedDriveIds\.size\) await proxyGoogleDriveImage\.invalidate\(refreshedDriveIds\)/);
    assert.match(server, /`\/images\/\$\{encodeURIComponent\(origFilename\)\}\?v=/);
    assert.match(server, /\[\.\.\.bundledIndex\.list, \.\.\.list\]/);
    assert.match(app, /found\.version \? `&v=/);
    assert.match(app, /sz=w600\$\{versionSuffix\}/);
});

test('amplia as janelas públicas e preserva descobertas anteriores do Drive', () => {
    assert.deepEqual(DRIVE_FOLDER_SORT_PARAMS, [
        '',
        '?sort=13&direction=d',
        '?sort=13&direction=a',
        '?sort=7&direction=d',
        '?sort=7&direction=a',
        '?sort=3&direction=a',
        '?sort=11&direction=a',
        '?sort=19&direction=a'
    ]);

    const files = new Map();
    const cachedCloud = {
        filename: 'ON.19.0166.jpg',
        base: 'ON.19.0166',
        id: 'old-id',
        isLocal: false,
        version: 'old-version'
    };
    const mountedLocal = {
        filename: 'LOCAL.jpg',
        base: 'LOCAL',
        id: 'known-fallback-id',
        isLocal: true,
        isBundledStatic: false
    };

    seedCachedCloudImages(files, { list: [cachedCloud, mountedLocal] });
    assert.equal(files.get('ON.19.0166.JPG').id, 'old-id');
    assert.equal(files.get('LOCAL.JPG').id, 'known-fallback-id');
    assert.equal(files.get('LOCAL.JPG').isLocal, false);
    assert.match(files.get('LOCAL.JPG').thumbUrl, /proxy-image\?id=known-fallback-id/);

    const refreshedCloud = { ...cachedCloud, id: 'new-id', version: 'new-version' };
    mergeCloudImageEntry(files, refreshedCloud);
    assert.equal(files.get('ON.19.0166.JPG').id, 'new-id');
    assert.equal(files.get('ON.19.0166.JPG').version, 'new-version');

    files.set('LOCAL.JPG', { ...mountedLocal, id: null });
    mergeCloudImageEntry(files, { ...refreshedCloud, filename: 'LOCAL.jpg', id: 'fallback-id' });
    assert.equal(files.get('LOCAL.JPG').isLocal, true);
    assert.equal(files.get('LOCAL.JPG').id, 'fallback-id');
});

test('operational image replaces bundled copy with the same product filename', t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-image-source-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const operationalDir = path.join(temp, 'drive');
    const bundledDir = path.join(temp, 'bundle');
    const cacheDir = path.join(temp, 'cache');
    fs.mkdirSync(operationalDir);
    fs.mkdirSync(bundledDir);
    fs.mkdirSync(cacheDir);
    const filename = '01.11.00.7904.jpg';
    const currentDriveImage = path.join(operationalDir, filename);
    fs.writeFileSync(currentDriveImage, 'new-drive-image');
    fs.writeFileSync(path.join(bundledDir, filename), 'old-bundled-image');
    fs.writeFileSync(path.join(cacheDir, filename), 'old-cache-image');

    const selected = findLocalImagePath(filename, {
        imageMap: new Map([[filename.toUpperCase(), currentDriveImage]]),
        knownDirs: [operationalDir],
        staticImagesDir: bundledDir,
        cacheDir
    });
    assert.equal(selected, currentDriveImage);
    assert.equal(fs.readFileSync(selected, 'utf8'), 'new-drive-image');
});
