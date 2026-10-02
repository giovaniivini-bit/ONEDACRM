const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('tema claro possui tokens semânticos e superfícies executivas legíveis', () => {
    const css = fs.readFileSync(path.join(root, 'light-theme.css'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

    for (const token of ['--bg-input', '--bg-pill', '--border-subtle', '--text-primary', '--text-muted']) {
        assert.match(css, new RegExp(token));
    }
    for (const selector of ['.macro-chart-card', '.macro-legend-pill', '.hero-pie-chart-container', '.s13-photo-card']) {
        assert.match(css, new RegExp(selector.replace('.', '\\.')));
    }
    assert.match(css, /\.btn-sync-images-action\s*\{[\s\S]*?color: #ffffff !important/);
    assert.match(css, /\.nav-link\.active\s*\{[\s\S]*?background: #eef2ff !important/);
    assert.match(css, /\.alerts-tabs button\.active\s*\{[\s\S]*?background: #6d28d9 !important/);
    assert.doesNotMatch(css, /\.s13-photo-tag\[style\*="color: #ffffff"\]/);
    assert.match(css, /\.s13-photo-tag\[style\*="background: #f59e0b"\][\s\S]*?background: #92400e !important/);
    assert.match(index, /light-theme\.css\?v=20261002-setor01-gallery-2/);
    assert.match(server, /'light-theme\.css'/);
});

test('tema claro não altera o tema escuro por seletores sem escopo', () => {
    const css = fs.readFileSync(path.join(root, 'light-theme.css'), 'utf8');
    const rules = css.split('}').map(rule => rule.trim()).filter(Boolean);
    const unscoped = rules.filter(rule => !rule.startsWith('/*') && !rule.startsWith('@') && !rule.includes('body.light-mode'));
    assert.deepEqual(unscoped, []);
});
