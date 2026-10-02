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

test('filtro de tipo é dinâmico e o PDF respeita o conjunto filtrado', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    assert.match(app, /alertsCategory: 'all'/);
    assert.match(app, /function getAlertCategory\(alert\)/);
    assert.match(app, /ruleId === 'setor13-calendario'/);
    assert.match(app, /ruleId === 'setor01-limite-dias'/);
    assert.match(app, /ruleId === 'malotes-parte-principal'/);
    assert.doesNotMatch(app, /\['05', '06', '12', '13'\]\.includes\(setor\)/);
    assert.match(app, /new Map\(\)\)\.values\(\)/);
    assert.match(app, /getAlertCategory\(alert\)\.key !== state\.alertsCategory/);
    assert.match(app, /!categories\.some\(category => category\.key === state\.alertsCategory\)/);
    assert.match(app, /window\.crmFilterAlertsCategory/);
    assert.doesNotMatch(app, />Programar regras</);
    assert.doesNotMatch(app, /persistAlertRules|openAlertRuleModal|crmOpenAlertRuleModal/);
    assert.match(app, /alertsTab: 'active'/);
    assert.match(app, /alertRulesSource: 'loading'/);
    assert.match(app, /state\.alertRulesSource = 'api'/);
    assert.match(app, /state\.alertRulesSource = 'fallback'/);
    assert.match(app, /Consulta oficial indisponível/);
    assert.match(app, /cópia local de contingência/);
    assert.match(app, /window\.crmSetAlertsTab/);
    assert.match(app, /> Regras vigentes<\/button>/);
    assert.match(app, /role="tablist"/);
    assert.match(app, /role="tabpanel"/);
    assert.match(app, /Consulta somente de leitura/);
    assert.match(app, /Fonte oficial/);
    assert.match(app, /limite atual:/);
    assert.match(app, /semanas carregadas/);
    assert.match(app, /Mensagem gerada/);
    assert.doesNotMatch(app, /crmOpenAlertRuleModal|crmSaveAlertRule|crmToggleAlertRule/);
    assert.match(app, /regras oficiais do CRM/);
    assert.match(app, /state\.alertsPageLimit = Number\.MAX_SAFE_INTEGER/);
    assert.match(app, /alertas: 'print-alertas'/);
    assert.match(css, /body\.print-alertas \.alerts-panel\s*\{[\s\S]*?break-inside: auto !important/);
    assert.match(css, /body\.print-alertas \.alert-item\s*\{[\s\S]*?min-height: 26mm !important[\s\S]*?break-inside: avoid !important/);
    assert.match(index, /style\.css\?v=20261002-setor01-gallery-1/);
    assert.match(index, /light-theme\.css\?v=20261002-setor01-gallery-1/);
    assert.match(index, /app\.js\?v=20261002-setor01-gallery-1/);
});
