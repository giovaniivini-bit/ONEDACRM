const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('alertas exibem a imagem do pedido como primeiro conteúdo do cartão', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const cardStart = app.indexOf('<article class="alert-item alert-${alert.severity}">');
    const iconStart = app.indexOf('<div class="alert-item-icon"', cardStart);
    const imageStart = app.indexOf('class="alert-item-image', cardStart);

    assert.ok(cardStart > -1);
    assert.ok(imageStart > cardStart && imageStart < iconStart);
    assert.match(app, /getProductImage\(alert\.codigo, alert\.op\)/);
    assert.match(app, /js-alert-open-image/);
    assert.match(app, /alert-item-image-placeholder/);
    assert.match(app, /alert-item-image-fallback/);
    assert.match(app, /titleElement\.textContent = String\(title/);
    assert.match(app, /subtitleElement\.textContent = String\(subtitle/);
    assert.match(app, /url\.startsWith\('\/'\).*url\.startsWith\('https:\/\/'\).*url\.startsWith\('data:image\/'\)/s);
    assert.doesNotMatch(app, /<strong[^>]*>\$\{title/);
    assert.match(css, /\.alert-item-image\s*\{[\s\S]*?width: 92px;[\s\S]*?height: 68px;/);
    assert.match(css, /\.alert-item-image img\s*\{[\s\S]*?object-fit: contain;/);
    assert.match(css, /\.alert-item-image\.image-unavailable \.alert-item-image-fallback\s*\{[\s\S]*?display: grid;/);
});
