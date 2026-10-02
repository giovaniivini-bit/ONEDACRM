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

test('builds the industrial calendar using columns A, B and E', () => {
    const calendar = engine.buildCalendarIndex([{
        SEMANA: '2645',
        'Data limite para setor 13': '24/set.',
        'data setor 20 - CORTE iniciar': '28/set.',
        'data limite para liberar pendência de estampa': '25/set.',
        'quantidade dias aceitaveis para ficar pendente setor 01': '2 dias'
    }]);
    assert.equal(calendar['2645'].sector13Deadline, '24/09/2026');
    assert.equal(calendar['2645'].sector01MaxDays, 2);
    assert.equal(engine.normalizeWeek('11 - SEM 45 - 2026'), '2645');
    assert.equal(engine.normalizeWeek('01 - SEM 02 - 2027'), '2702');
    assert.equal(engine.normalizeWeek('2645'), '2645');
    const firstIndustrialDeadline = engine.parseIndustrialDate('20/nov.', '2601');
    assert.equal(firstIndustrialDeadline.getFullYear(), 2025);
    assert.equal(firstIndustrialDeadline.getMonth(), 10);
    assert.equal(firstIndustrialDeadline.getDate(), 20);
});

test('creates only the three requested operational alert types', () => {
    const calendarRows = [{
        SEMANA: '2645',
        'Data limite para setor 13': '24/set.',
        'quantidade dias aceitaveis para ficar pendente setor 01': '2 dias'
    }];
    const source = [
        { op: '06000', codigo: '01.01', setor: '13', semanaPedido: '11 - SEM 45 - 2026', diasParado: 1 },
        { op: '06001', codigo: '02.02', setor: '01', semanaPedido: '2645', diasParado: 3 },
        { op: '06002', codigo: '03.03', setor: '20', semanaPedido: '2645' },
        { op: '06002', codigo: '03.03', setor: '88', semanaPedido: '2645' },
        { op: '06003', codigo: '04.04', setor: 'D01', semanaPedido: '2645', prazoStatus: 'ATRASO', hasImage: false }
    ];
    const records = engine.buildOperationalAlertRecords(source, calendarRows, { now: new Date(2026, 8, 25, 12) });
    const alerts = engine.evaluateRecords(records, engine.cloneDefaults());
    assert.equal(alerts.length, 3);
    assert.deepEqual(new Set(alerts.map(alert => alert.ruleId)), new Set([
        'setor13-calendario',
        'setor01-limite-dias',
        'malotes-parte-principal'
    ]));
    assert.match(alerts.find(alert => alert.ruleId === 'setor13-calendario').message, /24\/09\/2026/);
    assert.match(alerts.find(alert => alert.ruleId === 'setor01-limite-dias').message, /limite é 2 dias/);
    assert.match(alerts.find(alert => alert.ruleId === 'malotes-parte-principal').message, /setor 20, malote no setor 88/);
});

test('uses the unique Setor 01 calendar limit when the order has no week', () => {
    const calendarRows = [{
        SEMANA: '2645',
        'Data limite para setor 13': '24/set.',
        'quantidade dias aceitaveis para ficar pendente setor 01': '2 dias'
    }];
    const records = engine.buildOperationalAlertRecords([
        { op: '1', codigo: 'A', setor: '13', semanaPedido: '2645' },
        { op: '2', codigo: 'B', setor: '01', semanaPedido: '2645', diasParado: 2 },
        { op: '3', codigo: 'C', setor: '13', semanaPedido: '9999' },
        { op: '4', codigo: 'D', setor: '01', semanaPedido: '', diasParado: 3 }
    ], calendarRows, { now: new Date(2026, 8, 24, 18) });
    const alerts = engine.evaluateRecords(records, engine.cloneDefaults());
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].ruleId, 'setor01-limite-dias');
    assert.match(alerts[0].message, /produto D está há 3 dias; limite é 2 dias/);
});

test('does not guess a Setor 01 limit when the calendar has conflicting limits', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '5', codigo: 'E', setor: '01', semanaPedido: '', diasParado: 9 }
    ], [
        { SEMANA: '2645', 'Data limite para setor 13': '24/set.', 'quantidade dias aceitaveis para ficar pendente setor 01': '2 dias' },
        { SEMANA: '2646', 'Data limite para setor 13': '01/out.', 'quantidade dias aceitaveis para ficar pendente setor 01': '3 dias' }
    ]);
    assert.equal(engine.evaluateRecords(records, engine.cloneDefaults()).length, 0);
});

test('creates a malote alert only for main sectors 20 and 26', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '10', codigo: 'A', setor: '26' },
        { op: '10', codigo: 'A', setor: '83' },
        { op: '11', codigo: 'B', setor: '31' },
        { op: '11', codigo: 'B', setor: '88' }
    ], [], { now: new Date(2026, 8, 25) });
    const alerts = engine.evaluateRecords(records, [engine.cloneDefaults()[2]]);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].record.primarySector, '26');
    assert.equal(alerts[0].record.maloteSetor, '83');
});

test('does not duplicate generic custom alerts when a record also matches the malote crossing', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '10', codigo: 'A', setor: '20', diasParado: 5 },
        { op: '10', codigo: 'A', setor: '83', diasParado: 5 }
    ], []);
    const genericRule = {
        id: 'custom-days', name: 'Dias', description: '', enabled: true, severity: 'warning', match: 'all',
        conditions: [{ field: 'diasParado', operator: 'greaterThan', value: '2' }], message: '{setor}', system: false
    };
    const alerts = engine.evaluateRecords(records, [genericRule]);
    assert.equal(alerts.length, 2);
    assert.deepEqual(alerts.map(alert => alert.record.setor).sort(), ['20', '83']);
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
