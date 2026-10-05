const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findLocalImagePath } = require('../server');

const root = path.resolve(__dirname, '..');

test('Drive replacement wins over bundled image and URLs are versioned', () => {
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

    assert.match(server, /if \(existing\.isBundledStatic\) allFiles\.set\(upper, cloudEntry\)/);
    assert.match(server, /mergedMap\[key\] = remoteEntry \|\| bundledEntry/);
    assert.match(server, /proxyGoogleDriveImage\.invalidate\(knownDriveImageIds\)/);
    assert.match(server, /`\/images\/\$\{encodeURIComponent\(origFilename\)\}\?v=/);
    assert.match(server, /\[\.\.\.bundledIndex\.list, \.\.\.list\]/);
    assert.match(app, /found\.version \? `&v=/);
    assert.match(app, /sz=w600\$\{versionSuffix\}/);
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
