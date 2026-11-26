const test = require('node:test');
const assert = require('node:assert/strict');
const { PARTS, firstOrderWeek, groups, toggleSector } = require('../prog-cq');

test('Prog CQ mantém a ordem F6/F7 e a sequência exata dos setores', () => {
    assert.deepEqual(PARTS.map(part => part.code), ['F6', 'F7']);
    assert.deepEqual(PARTS[0].sectors, ['EN', 'IS', '17', 'D9', 'B8', 'D10', 'B9', 'E7', 'E8', 'E9', 'E5']);
    assert.deepEqual(PARTS[1].sectors, ['17x', 'D9x', 'B8x', 'D11', 'B9x', 'E7x', 'E8x', 'E9x', 'E5x']);
    assert.deepEqual(groups().map(group => group.key), PARTS.flatMap(part => part.sectors.map(sector => `${part.code}:${sector}`)));
});

test('seleção múltipla separa partes e não confunde setores nem sufixos de produto', () => {
    const items = [{part:'F6',sector:'17',codigo:'01.11.0001A'}, {part:'F7',sector:'17x',codigo:'01.11.0001'}, {part:'F6',sector:'EN',codigo:'B'}];
    let selected = toggleSector([], 'F6:17');
    selected = toggleSector(selected, 'F7:17x');
    assert.deepEqual(groups(items, {sectors:selected}).flatMap(group => group.items), items.slice(0,2));
    assert.deepEqual(groups(items, {part:'F6',sectors:selected}).map(group => group.key), ['F6:17']);
    assert.deepEqual(groups(items, {search:'0001A'}).flatMap(group => group.items), [items[0]]);
    assert.deepEqual(toggleSector(selected, 'F6:17'), ['F7:17x']);
    assert.deepEqual(toggleSector(selected, 'F6:EN'), [...selected, 'F6:EN']);
});

test('tela sem fonte sinaliza ausência de dados e conecta seleção e limpeza', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const handlers = {};
    const sectorButton = {dataset:{cqSector:'F6:EN'},addEventListener:(event,cb)=>{handlers.sector=cb;}};
    const container = {innerHTML:'', querySelector: selector => ({addEventListener:(event,cb) => {handlers[selector]=cb;}}), querySelectorAll: () => [sectorButton]};
    const context = {window:{CRMProgCQ:require('../prog-cq')}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../prog-cq-view'), 'utf8'),context);
    let part, sector, cleared=false;
    context.window.CRMProgCQView.render(container,{filters:{part:'all',sectors:[]},search:'',escape:String,onPart:value=>{part=value;},onClear:()=>{cleared=true;},onSector:value=>{sector=value;}});
    assert.match(container.innerHTML,/Planilha indisponível/);
    assert.match(container.innerHTML,/Parte F6/);
    assert.match(container.innerHTML,/Parte F7/);
    assert.doesNotMatch(container.innerHTML,/C32|D32/);
    assert.match(container.innerHTML,/Quantidades ainda não disponíveis/);
    assert.match(container.innerHTML,/1QMegrgLwnsXnOyOrkUK_XELhL6Tji_WARdZXu3WSlKg\/edit#gid=0/);
    assert.match(container.innerHTML,/Abrir planilha Prog CQ/);
    const expectedKeys = PARTS.flatMap(part => part.sectors.map(sector => `${part.code}:${sector}`));
    assert.deepEqual([...container.innerHTML.matchAll(/data-cq-sector="([^"]+)"/g)].map(match => match[1]), expectedKeys);
    assert.deepEqual([...container.innerHTML.matchAll(/data-cq-group="([^"]+)"/g)].map(match => match[1]), expectedKeys);
    assert.doesNotMatch(container.innerHTML,/<img|0 referências|Planilha ao vivo/);
    handlers['[data-cq-part]']({target:{value:'F7'}});
    handlers['[data-cq-clear]']();
    handlers.sector();
    assert.equal(sector,'F6:EN');
    assert.equal(part,'F7'); assert.equal(cleared,true);
    context.window.CRMProgCQView.render(container,{
        filters:{part:'F6',sectors:['F6:17']},
        feiraDays:[{part:'F6',sector:'17',codigo:'A',numero:'12',days:0}],
        source:{records:[
            {part:'F6',sector:'17',codigo:'A',numero:'00012',purchaseOrder:'00123.00124',aviamentoPendente:true,andamentoPedido:'TINTURARIA\nVALIDAÇÃO'},
            {part:'F6',sector:'17',codigo:'B',purchaseOrder:'',aviamentoPendente:false,andamentoPedido:''},
            {part:'F7',sector:'17x',codigo:'C',aviamentoPendente:true,andamentoPedido:'OUTRO PEDIDO'},
            {part:'F6',sector:'17x',codigo:'D',aviamentoPendente:true,andamentoPedido:'FORA DO FLUXO F6'},
            {part:'F7',sector:'EN',codigo:'E',aviamentoPendente:true,andamentoPedido:'FORA DO FLUXO F7'}
        ]},
        escape:String, onPart(){}, onSector(){}, onClear(){}
    });
    assert.match(container.innerHTML,/TINTURARIA\nVALIDAÇÃO/);
    assert.match(container.innerHTML, /prog-cq-card-of">OF 00012</);
    assert.match(container.innerHTML, /AV\. PENDENTE CQ<\/strong>\s+<strong class="prog-cq-purchase-order">OC 00123\.00124</);
    assert.match(container.innerHTML, /prog-cq-purchase-order-missing">SEM OC</);
    assert.match(container.innerHTML, /prog-cq-sector-days"><strong>0<\/strong><span>Dias parados no setor/);
    assert.match(container.innerHTML, /prog-cq-sector-days"><strong>—<\/strong><span>Dias parados no setor/);
    assert.match(container.innerHTML,/prog-cq-order-missing/);
    assert.match(container.innerHTML,/prog-cq-bar[^>]+height:72px/);
    assert.match(container.innerHTML,/Não informado/);
    assert.equal((container.innerHTML.match(/AV\. PENDENTE CQ/g)||[]).length,1);
    assert.doesNotMatch(container.innerHTML,/OUTRO PEDIDO|F6:17x|FORA DO FLUXO/);
    for (const partCode of ['F6', 'F7']) {
        const expected = expectedKeys.filter(key => key.startsWith(partCode + ':'));
        context.window.CRMProgCQView.render(container, {
            filters:{part:partCode, sectors:[]},
            source:{records:[
                {part:'F6',sector:'17x',codigo:'D',andamentoPedido:'FORA DO FLUXO F6'},
                {part:'F7',sector:'EN',codigo:'E',andamentoPedido:'FORA DO FLUXO F7'}
            ]},
            escape:String, onPart(){}, onFilter(){}, onSector(){}, onClear(){}
        });
        assert.deepEqual([...container.innerHTML.matchAll(/data-cq-sector="([^"]+)"/g)].map(match => match[1]), expected);
        assert.deepEqual([...container.innerHTML.matchAll(/data-cq-group="([^"]+)"/g)].map(match => match[1]), expected);
        assert.doesNotMatch(container.innerHTML,/FORA DO FLUXO|prog-cq-card/);
    }
});

test('malha exige todas as partes fora da tecelagem e tinturaria', () => {
    const { filterAvailability } = require('../prog-cq');
    const ready = { andamentoPedido: '2704 - 078501 - 126855-LAB-APROVAÇÃO LOTE TINTURARIA\nDEPÓSITO MALHA', aviamentoPendente: false };
    const missing = { andamentoPedido: 'CORTE\n2708 - 078912 - 126856-PPCP - TECELAGEM ANÁLISE OI', aviamentoPendente: false };
    const missingTrim = { andamentoPedido: 'CORTE', aviamentoPendente: true };
    const unknown = { andamentoPedido: '', aviamentoPendente: true };
    const rows = [ready, missing, missingTrim, unknown];
    assert.deepEqual(filterAvailability(rows,{mesh:'available',trims:'available'}),[ready]);
    assert.deepEqual(filterAvailability(rows,{mesh:'missing'}),[missing]);
    assert.deepEqual(filterAvailability(rows,{mesh:'unknown'}),[unknown]);
    assert.deepEqual(filterAvailability(rows,{trims:'missing'}),[missingTrim,unknown]);
    const withOC = { ...ready, purchaseOrder:'00123.00124' };
    const withoutOC = { ...ready, purchaseOrder:'' };
    const legacy = { ...ready, purchaseOrder:null };
    const rowsByOC = [withOC, withoutOC, legacy, { ...missing, purchaseOrder:'00234' }];
    assert.deepEqual(filterAvailability(rowsByOC,{mesh:'available',purchaseOrder:'with'}),[withOC]);
    assert.deepEqual(filterAvailability(rowsByOC,{purchaseOrder:'without'}),[withoutOC]);
    assert.deepEqual(filterAvailability([{andamentoPedido:'2704 - 078501 - 126855-TINTURARIA'}],{mesh:'missing'}).length,1);
});

test('semanas em ordem e seleção múltipla filtram cards e gráfico sem duplicar produtos', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const records = [
        {part:'F6', sector:'17', codigo:'MULTI', andamentoPedido:'2708 - CORTE\r\n 2704 - TINTURARIA\n2704 - LABORATÓRIO\n2712 - REVISÃO'},
        {part:'F6', sector:'17', codigo:'OUTRA', andamentoPedido:'2708 - TECELAGEM'},
        {part:'F6', sector:'17', codigo:'TEM-MALHA', andamentoPedido:'2704 - DEPÓSITO'},
        {part:'F6', sector:'17', codigo:'SEM', andamentoPedido:'OF 2660 - TINTURARIA'},
        {part:'F7', sector:'D9x', codigo:'F7-ANTIGA', andamentoPedido:'2652 – DEPÓSITO'}
    ];
    let changeWeek, clearWeeks, selection;
    const menu = {
        querySelector: () => ({scrollTop:0, focus(){}}),
        querySelectorAll: () => [{value:'2704'}, {value:'2708'}],
        addEventListener(event, callback) { if (event === 'change') changeWeek = callback; }
    };
    const container = {
        innerHTML:'',
        querySelector(selector) {
            if (selector === '[data-cq-week-menu]') return menu;
            return { addEventListener(event, callback) { if (selector === '[data-cq-weeks-clear]') clearWeeks = callback; } };
        },
        querySelectorAll: () => []
    };
    const context = {window:{CRMProgCQ:require('../prog-cq')}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../prog-cq-view'), 'utf8'), context);
    context.window.CRMProgCQView.render(container, {
        filters:{part:'F6', sectors:['F6:17'], weeks:['2708', '2704'], mesh:'missing'},
        source:{records},
        escape:String, onPart(){}, onFilter:(key, value) => { selection = [key, Array.from(value)]; }, onSector(){}, onClear(){}
    });
    assert.equal(firstOrderWeek('Texto sem semana\n2708 - CORTE\n2704 - TINTURARIA'), '2708');
    assert.equal(firstOrderWeek('SEM INFORMACAO'), '');
    assert.match(container.innerHTML, /prog-cq-card-week" title="Semana do pedido">2708</);
    const options = [...container.innerHTML.matchAll(/data-cq-week value="([^"]+)" (checked)?/g)];
    assert.deepEqual(options.map(match => match[1]), ['2652','2704','2708','2712']);
    assert.deepEqual(options.filter(match => match[2]).map(match => match[1]), ['2704','2708']);
    assert.match(container.innerHTML, /data-cq-total="F6">Selecionados · 2 produtos</);
    assert.match(container.innerHTML, /data-cq-sector="F6:17"[^>]+aria-label="Parte F6 setor 17, 2 registros"/);
    assert.equal((container.innerHTML.match(/class="prog-feira-card prog-cq-card"/g) || []).length, 2);
    assert.match(container.innerHTML, /2708 - CORTE\n 2704 - TINTURARIA\n2704 - LABORATÓRIO/);
    assert.match(container.innerHTML, /2708 - TECELAGEM/);
    assert.doesNotMatch(container.innerHTML, /2712 - REVISÃO|TEM-MALHA|F7-ANTIGA|OF 2660/);
    changeWeek({target:{value:'2708'}});
    assert.deepEqual(selection, ['weeks', ['2704', '2708']]);
    clearWeeks();
    assert.deepEqual(selection, ['weeks', []]);
});

test('total de produtos acompanha os setores selecionados e soma as duas partes', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const container = { innerHTML:'', querySelector:() => ({ addEventListener(){} }), querySelectorAll:() => [] };
    const context = {window:{CRMProgCQ:require('../prog-cq')}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../prog-cq-view'), 'utf8'), context);
    const source = {records:[
        {part:'F6', sector:'17', codigo:'A'},
        {part:'F6', sector:'17', codigo:'B'},
        {part:'F6', sector:'D9', codigo:'C'},
        {part:'F7', sector:'17x', codigo:'D'},
        {part:'F6', sector:'17x', codigo:'FORA'}
    ]};
    function totals(part, sectors, purchaseOrder = 'all', sourceSchemaVersion = 2) {
        context.window.CRMProgCQView.render(container, {
            filters:{part, sectors, purchaseOrder}, source:{ ...source, sourceSchemaVersion }, escape:String
        });
        return Object.fromEntries([...container.innerHTML.matchAll(/data-cq-total="([^"]+)">([^<]+)/g)].map(match => match.slice(1)));
    }

    assert.deepEqual(totals('all', []), {
        all:'Total nas duas partes · 4 produtos', F6:'Total · 3 produtos', F7:'Total · 1 produto'
    });
    assert.deepEqual(totals('all', ['F6:17', 'F7:17x']), {
        all:'Selecionados nas duas partes · 3 produtos', F6:'Selecionados · 2 produtos', F7:'Selecionados · 1 produto'
    });
    assert.deepEqual(totals('F6', ['F7:17x']), { F6:'Selecionados · 0 produtos' });
    assert.deepEqual(totals('F6', [], 'without', 1), { F6:'Total · 3 produtos' });
    assert.match(container.innerHTML, /data-cq-filter="purchaseOrder" disabled/);
    assert.doesNotMatch(container.innerHTML, /SEM OC/);
});
