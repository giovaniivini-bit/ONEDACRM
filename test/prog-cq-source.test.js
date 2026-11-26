const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchProgCQSource, readProgCQCache, fetchProgFeiraReportSource } = require('../server');
const { groups, toggleSector, indexSectorDays, sectorDaysKey } = require('../prog-cq');

const header = 'PERIODO,NUMERO,SETOR,DESC_SETOR,CODIGO,DESCRICAO,PARTE,OBS,PROGRAMACAO,SIT_AMOSTRA2,SIT_AMOSTRA,OC,OF_PEND_ALMOXARIFADO';
const populated = [header,
    '26,0011,17,Setor,01.14.00.1000A,"Calça, linho",F6,Interno,B01,NÃO USAR,"Aguardando amostra\r\nRevisão ""Nova""",00123.00124,0',
    '26,0012,17X,Setor,01.14.00.1000,Calça,F6,Interno,B01,NÃO USAR,,   ,  ',
    '26,0013,D9X,Setor,01.14.00.1000,Calça,F7,Interno,B02,NÃO USAR,Enviado,#DIV/0!,OF 10',
    '26,0014,D9,Setor,01.14.00.1000,Calça,F8,Interno,B02,NÃO USAR,Enviado,Interno,OF 10'
].join('\r\n');

test('lê a aba Prog CQ preservando texto multilinha, OF e código completo', async () => {
    const payload = await fetchProgCQSource(async (url, redirects, minimumLength) => {
        assert.match(url, /1QMegrgLwnsXnOyOrkUK_XELhL6Tji_WARdZXu3WSlKg\/export\?format=csv&gid=0$/);
        assert.equal(minimumLength, 1);
        return `\uFEFF${populated}`;
    });
    assert.equal(payload.sourceSchemaVersion, 2);
    assert.equal(payload.count, 3);
    assert.deepEqual(payload.records, [
        { part: 'F6', sector: '17', codigo: '01.14.00.1000A', numero: '0011', descricao: 'Calça, linho',
            andamentoPedido: 'Aguardando amostra\r\nRevisão "Nova"', aviamentoPendente: true, purchaseOrder: '00123.00124' },
        { part: 'F6', sector: '17x', codigo: '01.14.00.1000', numero: '0012', descricao: 'Calça',
            andamentoPedido: '', aviamentoPendente: false, purchaseOrder: '' },
        { part: 'F7', sector: 'D9x', codigo: '01.14.00.1000', numero: '0013', descricao: 'Calça',
            andamentoPedido: 'Enviado', aviamentoPendente: true, purchaseOrder: '' }
    ]);
    assert.ok(!JSON.stringify(payload).includes('OF 10'));
    assert.ok(!JSON.stringify(payload).includes('Interno'));
    assert.equal(payload.isLive, true);
});

test('agrupa e permite selecionar apenas os setores oficiais de cada parte', async () => {
    const { records } = await fetchProgCQSource(async () => populated);
    assert.deepEqual(groups(records).flatMap(group => group.items), [records[0], records[2]]);
    assert.deepEqual(toggleSector([], 'F6:17x'), []);
    assert.deepEqual(toggleSector([], 'F7:EN'), []);
    const selected = toggleSector([], 'F7:D9x');
    assert.deepEqual(groups(records, { sectors: selected }).flatMap(group => group.items), [records[2]]);
});

test('distingue aba vazia válida de resposta quebrada ou com colunas deslocadas', async () => {
    const empty = await fetchProgCQSource(async () => header);
    assert.deepEqual(empty.records, []);
    assert.equal(empty.count, 0);
    assert.equal(empty.isLive, true);
    await assert.rejects(fetchProgCQSource(async () => '<html>sem acesso</html>'), /Cabeçalhos/);
    await assert.rejects(fetchProgCQSource(async () => header.replace('SIT_AMOSTRA2,SIT_AMOSTRA', 'SIT_AMOSTRA,SIT_AMOSTRA2')), /Cabeçalhos/);
    await assert.rejects(fetchProgCQSource(async () => `${header}\n26,1,17,,X,Calça,F6,,,,"truncada`), /aspas/);
    await assert.rejects(fetchProgCQSource(async () => `${header}\n26,1,17,,,Calça,F6`), /sem setor ou código/);
});

test('cache Prog CQ mantém os campos públicos e distingue cache antigo sem coluna OC', async () => {
    const payload = await fetchProgCQSource(async () => populated);
    assert.deepEqual(readProgCQCache(payload), payload);
    assert.equal(readProgCQCache({ ...payload, sourceSchemaVersion: 0 }), null);
    const legacy = readProgCQCache({ ...payload, sourceSchemaVersion: 1,
        records: payload.records.map(({purchaseOrder, ...record}) => record) });
    assert.equal(legacy.sourceSchemaVersion, 1);
    assert.ok(legacy.records.every(record => record.purchaseOrder === null));
    assert.equal(readProgCQCache({ ...payload, records: [{ ...payload.records[0], purchaseOrder: null }], count: 1 }), null);
    assert.equal(readProgCQCache({ ...payload, count: 0 }), null);
    assert.equal(readProgCQCache({ ...payload, timestamp: 'inválida' }), null);
    assert.equal(readProgCQCache({ ...payload, records: [{ ...payload.records[0], aviamentoPendente: '0' }], count: 1 }), null);
    const cache = readProgCQCache({ ...payload, internal: true, records: payload.records.map(record => ({ ...record, internal: true })) });
    assert.deepEqual(cache, payload);
});

test('Prog Feira lê DB para F6/F7 e o cruzamento usa OF, código completo, parte e setor', async () => {
    const headers = Array.from({length:110}, (_, i) => `Coluna ${i}`);
    const columns = {4:'Parte', 5:'Número', 40:'Código', 79:'Fluxo', 81:'Setor', 105:'Dias Parado', 107:'Dias Parado'};
    for (const [index, label] of Object.entries(columns)) headers[index] = label;
    const row = (part, numero, codigo, sector, days) => {
        const values = Array(headers.length).fill('');
        Object.assign(values, {4:part, 5:numero, 40:codigo, 79:part === 'FE' ? 'D36' : 'CQ', 81:sector, 105:days, 107:'999'});
        return values.join(',');
    };
    const code = '01.14.00.1000A';
    const csv = [
        headers.join(','),
        row('FE','0010',code,'01A','20'),
        row('F6','0012',code,'17','0'),
        row('F6','0012',code,'17','0'),
        row('F6','0013',code,'17','29'),
        row('F6','0012',code,'D9','6'),
        row('F7','0012',code,'D9X','4'),
        row('F7','0012',code,'D9x','8'),
        row('F6','0012','01.14.00.1000','17','9'),
        row('F6','0014',code,'17',''),
        row('F6','0015',code,'17','#N/A')
    ].join('\n');
    const payload = await fetchProgFeiraReportSource(async () => csv);
    assert.equal(payload.records.length, 1);
    assert.equal(payload.records[0].PARTE, 'FE');
    assert.equal(payload.cqSectorDays.length, 7);
    const index = indexSectorDays(payload.cqSectorDays);
    const days = (part, sector, numero, codigo = code) => index.get(sectorDaysKey({part, sector, numero, codigo}));
    assert.equal(days('F6','17','12'), 0);
    assert.equal(days('F6','17','13'), 29);
    assert.equal(days('F6','D9','0012'), 6);
    assert.equal(days('F7','D9x','0012'), null);
    assert.equal(days('F6','17','0012','01.14.00.1000'), 9);
    assert.equal(days('F7','17','0012'), undefined);
    assert.equal(days('F6','17','0014'), undefined);
    assert.equal(days('F6','17','0015'), undefined);
});
