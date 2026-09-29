const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../alerts-engine');

test('default alert rules are valid and cloned independently', () => {
    const first = engine.cloneDefaults();
    const second = engine.cloneDefaults();
    assert.equal(engine.validateRules(first).valid, true);
    first[0].conditions[0].value = 'ALTERADO';
    assert.notEqual(first[0].conditions[0].value, second[0].conditions[0].value);
});

test('evaluates critical, warning and missing-image alerts without duplicates', () => {
    const records = [
        { op: '06000', codigo: '01.01', setor: '13', diasParado: 5, prazoStatus: 'ATRASO', hasImage: false },
        { op: '06000', codigo: '01.01', setor: '13', diasParado: 5, prazoStatus: 'ATRASO', hasImage: false }
    ];
    const alerts = engine.evaluateRecords(records, engine.cloneDefaults());
    assert.equal(alerts.length, 3);
    assert.equal(alerts[0].severity, 'critical');
    assert.match(alerts[0].message, /06000/);
    assert.equal(new Set(alerts.map(alert => alert.id)).size, alerts.length);
});

test('keeps alerts for the same product when it is pending in distinct sectors', () => {
    const rule = engine.cloneDefaults()[0];
    const alerts = engine.evaluateRecords([
        { op: '06000', codigo: '01.01', setor: '13', prazoStatus: 'ATRASO' },
        { op: '06000', codigo: '01.01', setor: 'D01', prazoStatus: 'ATRASO' }
    ], [rule]);
    assert.equal(alerts.length, 2);
});

test('supports all/any combinations, numbers and Brazilian dates', () => {
    const rule = {
        id: 'teste-data', name: 'Teste', severity: 'warning', enabled: true, match: 'all',
        conditions: [
            { field: 'diasParado', operator: 'greaterThan', value: '2' },
            { field: 'dtPrevMov', operator: 'beforeToday', value: '' }
        ],
        message: '{codigo}'
    };
    const alerts = engine.evaluateRecords(
        [{ op: '1', codigo: 'ABC', diasParado: '3', dtPrevMov: '20/09/2026' }],
        [rule],
        { now: new Date(2026, 8, 25) }
    );
    assert.equal(alerts.length, 1);
    assert.equal(engine.compareCondition(
        { dtPrevMov: '31/02/2026' },
        { field: 'dtPrevMov', operator: 'beforeToday', value: '' },
        new Date(2026, 8, 25)
    ), false);
    assert.equal(engine.compareCondition(
        { dtPrevMov: '2026-09-25' },
        { field: 'dtPrevMov', operator: 'beforeToday', value: '' },
        new Date(2026, 8, 25, 18)
    ), false);
});

test('rejects unknown fields, operators and excessive rules', () => {
    const invalid = [{ id: 'abc', name: 'X', severity: 'info', match: 'all', conditions: [{ field: 'senha', operator: 'equals', value: 'x' }] }];
    assert.equal(engine.validateRules(invalid).valid, false);
    assert.equal(engine.validateRules(Array.from({ length: 51 }, (_, index) => ({ ...engine.cloneDefaults()[0], id: `r-${index}` }))).valid, false);
});
