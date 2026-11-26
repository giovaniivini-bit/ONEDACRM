const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchProgCQSource, readProgCQCache } = require('../server');
const { groups, toggleSector } = require('../prog-cq');

const header = 'PERIODO,NUMERO,SETOR,DESC_SETOR,CODIGO,DESCRICAO,PARTE,OBS,PROGRAMACAO,SIT_AMOSTRA2,SIT_AMOSTRA,OC,OF_PEND_ALMOXARIFADO';
const populated = [header,
    '26,0011,17,Setor,01.14.00.1000A,"Calça, linho",F6,Interno,B01,NÃO USAR,"Aguardando amostra\r\nRevisão ""Nova""",Interno,0',
    '26,0012,17X,Setor,01.14.00.1000,Calça,F6,Interno,B01,NÃO USAR,,Interno,  ',
    '26,0013,D9X,Setor,01.14.00.1000,Calça,F7,Interno,B02,NÃO USAR,Enviado,Interno,OF 10',
    '26,0014,D9,Setor,01.14.00.1000,Calça,F8,Interno,B02,NÃO USAR,Enviado,Interno,OF 10'
].join('\r\n');

test('lê a aba Prog CQ preservando texto multilinha, OF e código completo', async () => {
    const payload = await fetchProgCQSource(async (url, redirects, minimumLength) => {
        assert.match(url, /1QMegrgLwnsXnOyOrkUK_XELhL6Tji_WARdZXu3WSlKg\/export\?format=csv&gid=0$/);
        assert.equal(minimumLength, 1);
        return `\uFEFF${populated}`;
    });
    assert.equal(payload.sourceSchemaVersion, 1);
    assert.equal(payload.count, 3);
    assert.deepEqual(payload.records, [
        { part: 'F6', sector: '17', codigo: '01.14.00.1000A', numero: '0011', descricao: 'Calça, linho',
            andamentoPedido: 'Aguardando amostra\r\nRevisão "Nova"', aviamentoPendente: true },
        { part: 'F6', sector: '17x', codigo: '01.14.00.1000', numero: '0012', descricao: 'Calça',
            andamentoPedido: '', aviamentoPendente: false },
        { part: 'F7', sector: 'D9x', codigo: '01.14.00.1000', numero: '0013', descricao: 'Calça',
            andamentoPedido: 'Enviado', aviamentoPendente: true }
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

test('cache Prog CQ exige o esquema atual, valida registros e mantém apenas campos públicos', async () => {
    const payload = await fetchProgCQSource(async () => populated);
    assert.deepEqual(readProgCQCache(payload), payload);
    assert.equal(readProgCQCache({ ...payload, sourceSchemaVersion: 0 }), null);
    assert.equal(readProgCQCache({ ...payload, count: 0 }), null);
    assert.equal(readProgCQCache({ ...payload, timestamp: 'inválida' }), null);
    assert.equal(readProgCQCache({ ...payload, records: [{ ...payload.records[0], aviamentoPendente: '0' }], count: 1 }), null);
    const cache = readProgCQCache({ ...payload, internal: true, records: payload.records.map(record => ({ ...record, internal: true })) });
    assert.deepEqual(cache, payload);
});
