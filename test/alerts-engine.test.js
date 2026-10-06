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

test('creates PEND. PRODUTO alerts only when the same OF has production and X01 or D01', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '70001', codigo: 'AVI', setor: '05g', semanaPedido: '11 - SEM 46 - 2026' },
        { op: '70001', codigo: 'AVI', setor: 'X01', semanaPedido: '2645', alertEntityKey: 'linha-x01-a' },
        { op: '70001', codigo: 'AVI-ALT', setor: 'x01', semanaPedido: '2644', alertEntityKey: 'linha-x01-b' },
        { op: '70002', codigo: '13.16.00.0676A', setor: '05', semanaPedido: '2647' },
        { op: '70002', codigo: '13.16.00.0676A', setor: 'D01', semanaPedido: '' },
        { op: '70003', codigo: 'CM1-AVI', setor: 'CM1', semanaPedido: '2648' },
        { op: '70003', codigo: 'CM1-AVI', setor: 'X01', semanaPedido: '2648' },
        { op: '70004', codigo: 'SEM-PROD', setor: 'X01', semanaPedido: '2648' },
        { op: '70005', codigo: 'CM1-COR', setor: 'CM1', semanaPedido: '2648' },
        { op: '70005', codigo: 'CM1-COR', setor: 'D01', semanaPedido: '2648' },
        { op: '70006', codigo: '05-AVI', setor: '05', semanaPedido: '2648' },
        { op: '70006', codigo: '05-AVI', setor: 'X01', semanaPedido: '2648' },
        { op: ' 70007 ', codigo: 'SETOR-02', setor: '2', semanaPedido: '2649' },
        { op: '70007', codigo: 'SETOR-02', setor: 'X01', semanaPedido: '2601' },
        { op: '70008', codigo: 'SETOR-03', setor: '03', semanaPedido: '2650' },
        { op: '70008', codigo: 'SETOR-03', setor: 'D01', semanaPedido: '' },
        { op: '70009', codigo: 'SETOR-04', setor: '04', semanaPedido: '2651' },
        { op: '70009', codigo: 'SETOR-04', setor: 'X01', semanaPedido: '' }
    ], [], { colorRecords: [
        { PRODUTO: '13.16.00.0676A', PREVISÃO: '14/10/2026', COR: 'PURPLE POTION' },
        { PRODUTO: '13.16.00.0676A', PREVISÃO: '24/09/2026', COR: 'LIZARD' },
        { PRODUTO: '13.16.00.0676A', PREVISÃO: '14/10/2026', COR: 'BLACK BEAUTY' },
        { PRODUTO: '13.16.00.0676', PREVISÃO: '01/01/2027', COR: 'OUTRA REFERÊNCIA' },
        { PRODUTO: 'SETOR-03', PREVISÃO: '-', COR: 'SEM PREVISÃO' }
    ] });
    const pendRules = engine.cloneDefaults().filter(rule => rule.id.startsWith('pend-produto-'));
    const alerts = engine.evaluateRecords(records, pendRules);

    assert.equal(alerts.length, 6);
    assert.deepEqual(alerts.map(alert => alert.ruleId).sort(), [
        'pend-produto-aviamento',
        'pend-produto-aviamento',
        'pend-produto-aviamento',
        'pend-produto-aviamento',
        'pend-produto-cor',
        'pend-produto-cor'
    ]);
    const aviamento = alerts.find(alert => alert.op === '70001');
    assert.equal(aviamento.record.productionSector, '05G');
    assert.equal(aviamento.record.pendencySector, 'X01');
    assert.equal(aviamento.record.semanaPedido, '2646');
    assert.equal(aviamento.message, 'PEND AVIAMENTO na produção, OF 70001 está no setor 05G, pertence à semana 2646; precisa resolver o aviamento com urgência.');
    const cor = alerts.find(alert => alert.op === '70002');
    assert.equal(cor.record.colorForecast, '24/09/2026 / 14/10/2026');
    assert.equal(cor.message, 'PEND COR na produção, Produto 13.16.00.0676A está no setor 05, pertence à semana 2647; previsão COR 24/09/2026 / 14/10/2026.');
    assert.equal(alerts.some(alert => ['70004', '70005', '70006'].includes(alert.op)), false);
    assert.equal(alerts.filter(alert => alert.op === '70001').length, 1);
    assert.equal(alerts.find(alert => alert.op === '70007').record.productionSector, '02');
    assert.equal(alerts.find(alert => alert.op === '70007').record.semanaPedido, '2649');
    assert.equal(alerts.find(alert => alert.op === '70008').record.productionSector, '03');
    assert.equal(alerts.find(alert => alert.op === '70008').record.colorForecast, 'não informada');
    assert.equal(alerts.find(alert => alert.op === '70009').record.productionSector, '04');
});

test('color forecast index matches the complete product code and ignores invalid placeholders', () => {
    const index = engine.buildColorForecastIndex([
        { 'PRODUTO / REF': '21.19.00.0007', PREVISÃO: '10/10/2026' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: '11/10/2026' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: '#VALUE!' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: '—' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: 'APÓS APROVAÇÃO' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: '31/02/2026' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: '0' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: '1' },
        { 'PRODUTO / REF': '21.19.00.0007A', PREVISÃO: '12' }
    ]);

    assert.deepEqual(index.get(engine.normalizeProductCode('21.19.00.0007')), ['10/10/2026']);
    assert.deepEqual(index.get(engine.normalizeProductCode('21.19.00.0007A')), ['11/10/2026']);
});

test('PEND. PRODUTO — Cor keeps separate forecasts for multiple products in the same OF', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '72000', codigo: 'PROD.A', setor: '02', semanaPedido: '2646' },
        { op: '72000', codigo: 'PROD.B', setor: '03', semanaPedido: '2647' },
        { op: '72000', codigo: 'PROD.A', setor: 'D01', semanaPedido: '' },
        { op: '72000', codigo: 'PROD.B', setor: 'D01', semanaPedido: '' }
    ], [], { colorRecords: [
        { PRODUTO: 'PROD.A', PREVISÃO: '01/11/2026' },
        { PRODUTO: 'PROD.B', PREVISÃO: '02/11/2026' }
    ] });
    const rule = engine.cloneDefaults().find(item => item.id === 'pend-produto-cor');
    const alerts = engine.evaluateRecords(records, [rule]);

    assert.equal(alerts.length, 2);
    assert.deepEqual(alerts.map(alert => alert.codigo).sort(), ['PROD.A', 'PROD.B']);
    assert.match(alerts.find(alert => alert.codigo === 'PROD.A').message, /semana 2646; previsão COR 01\/11\/2026/);
    assert.match(alerts.find(alert => alert.codigo === 'PROD.B').message, /semana 2647; previsão COR 02\/11\/2026/);
});

test('PEND. PRODUTO — Aviamento remains one consolidated alert per OF', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '73000', codigo: 'PROD.A', setor: '02', semanaPedido: '2646' },
        { op: '73000', codigo: 'PROD.B', setor: '03', semanaPedido: '2647' },
        { op: '73000', codigo: 'PROD.A', setor: 'X01', semanaPedido: '' },
        { op: '73000', codigo: 'PROD.B', setor: 'X01', semanaPedido: '' }
    ], []);
    const rule = engine.cloneDefaults().find(item => item.id === 'pend-produto-aviamento');
    const alerts = engine.evaluateRecords(records, [rule]);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].record.productionSector, '02/03');
    assert.equal(alerts[0].record.semanaPedido, '2646/2647');
});

test('PEND. PRODUTO — Cor never guesses across explicit mismatched product codes', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '74000', codigo: 'PROD.A', setor: '02', semanaPedido: '2646' },
        { op: '74000', codigo: 'PROD.B', setor: 'D01', semanaPedido: '2646' }
    ], [], { colorRecords: [{ PRODUTO: 'PROD.A', PREVISÃO: '01/11/2026' }] });
    const rule = engine.cloneDefaults().find(item => item.id === 'pend-produto-cor');
    assert.equal(engine.evaluateRecords(records, [rule]).length, 0);
});

test('PEND. PRODUTO — Cor uses the sole D01 product when production code is absent', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '75000', codigo: '', setor: '02', semanaPedido: '2646' },
        { op: '75000', codigo: 'PROD.C', setor: 'D01', semanaPedido: '2646' }
    ], [], { colorRecords: [{ PRODUTO: 'PROD.C', PREVISÃO: '03/11/2026' }] });
    const rule = engine.cloneDefaults().find(item => item.id === 'pend-produto-cor');
    const alerts = engine.evaluateRecords(records, [rule]);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].codigo, 'PROD.C');
    assert.match(alerts[0].message, /Produto PROD\.C.*previsão COR 03\/11\/2026/);
});

test('color forecast positional fallback reads the real PREVISÃO column index', () => {
    const row = {
        A: 'MULTICOLOR', B: 'ANA', C: 'PROD.X', D: 'COLEÇÃO', E: 'DESENVOLVIMENTO',
        F: '19-0000', G: 'COR', H: 'BASE', I: 'SOLICITAÇÃO', J: '01/10/2026', K: '15/10/2026'
    };
    const index = engine.buildColorForecastIndex([row]);
    assert.deepEqual(index.get(engine.normalizeProductCode('PROD.X')), ['15/10/2026']);
});

test('PEND. PRODUTO exposes all production sectors and weeks when the same OF is divergent', () => {
    const records = engine.buildOperationalAlertRecords([
        { op: '71000', codigo: 'A', setor: '02', semanaPedido: '2646' },
        { op: '71000', codigo: 'A', setor: '05G', semanaPedido: '2647' },
        { op: '71000', codigo: 'A', setor: 'X01', semanaPedido: '2601' }
    ], []);
    const rule = engine.cloneDefaults().find(item => item.id === 'pend-produto-aviamento');
    const alerts = engine.evaluateRecords(records, [rule]);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].record.productionSector, '02/05G');
    assert.equal(alerts[0].record.semanaPedido, '2646/2647');
    assert.match(alerts[0].message, /setor 02\/05G, pertence à semana 2646\/2647/);
});

test('creates a critical CQ alert from DESC_AMOSTRA and calculates rejected days from observation', () => {
    const cqRecords = engine.buildCQAlertRecords([{
        NUMERO: '62034',
        CODIGO: '01.18.07.0692',
        DESC_AMOSTRA: 'Reprovado',
        PERIODO: '2646',
        DIAS: '-46301',
        OBSERVACAO: 'Reprovado em 01/10/2026\nEnviado dia 24/09/2026'
    }], { now: new Date(2026, 9, 6, 14) });

    assert.equal(cqRecords.length, 1);
    assert.equal(cqRecords[0].setorCQReprovado, true);
    assert.equal(cqRecords[0].diasReprovado, 5);
    assert.equal(cqRecords[0].semanaPedido, '2646');
    const operational = engine.buildOperationalAlertRecords(cqRecords, [], { now: new Date(2026, 9, 6, 14) });
    const alerts = engine.evaluateRecords(operational, engine.cloneDefaults(), { now: new Date(2026, 9, 6, 14) });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].ruleId, 'cq-amostra-reprovada');
    assert.equal(alerts[0].severity, 'critical');
    assert.equal(alerts[0].message, 'SETOR CQ, OF 62034 está com SIT AMOSTRA REPROVADA, pertence à semana 2646, está reprovado há 5 dias.');
});

test('CQ alert requires exact rejected status and uses the latest valid rejection date', () => {
    assert.equal(engine.normalizeCQStatus('Não reprovado'), null);
    assert.equal(engine.normalizeCQStatus('Reprovado cancelado'), null);
    assert.equal(engine.normalizeCQStatus('Reprovada'), null);
    assert.equal(engine.buildCQAlertRecords([{ DESC_AMOSTRA: 'Não reprovado', NUMERO: '1' }]).length, 0);

    const latest = engine.getCQRejectionDate([
        'Reprovado dia: 01/09/26',
        'Reprovado dia: 31/02/2026',
        'Reprovado em 05/10/2026'
    ].join('\n'));
    assert.equal(latest.getFullYear(), 2026);
    assert.equal(latest.getMonth(), 9);
    assert.equal(latest.getDate(), 5);
    assert.equal(engine.calculateElapsedDays(latest, new Date(2026, 9, 6, 14)), 1);
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
