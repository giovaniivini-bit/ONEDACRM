const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('menu movel exibe um acionador acessivel ligado a sidebar', () => {
    assert.match(html, /id="mobileMenuBtn"[^>]+aria-controls="sidebar"[^>]+aria-expanded="false"/);
    assert.match(html, /id="sidebarMobileOverlay"[^>]+aria-label="Fechar menu lateral"/);
});

test('menu movel abre, fecha por toque externo e fecha apos navegar', () => {
    assert.ok(js.includes("sidebar.classList.toggle('mobile-open')"));
    assert.ok(js.includes("sidebar.classList.remove('collapsed')"));
    assert.ok(js.includes("sidebarMobileOverlay.addEventListener('click', closeMobileSidebar)"));
    assert.ok(js.includes("link.addEventListener('click', closeMobileSidebar)"));
});

test('menu movel mantem o botao visivel apenas no breakpoint movel', () => {
    assert.match(css, /\.mobile-menu-btn,\s*\.sidebar-mobile-overlay\s*\{\s*display:\s*none/);
    assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.mobile-menu-btn\s*\{[\s\S]*?display:\s*inline-flex/);
    assert.match(css, /\.sidebar\.mobile-open \+ \.sidebar-mobile-overlay\s*\{\s*display:\s*block/);
});
