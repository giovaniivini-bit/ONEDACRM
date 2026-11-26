const test = require('node:test');
const assert = require('node:assert/strict');
const { PARTS, groups, toggleSector } = require('../prog-cq');

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
        source:{records:[
            {part:'F6',sector:'17',codigo:'A',aviamentoPendente:true,andamentoPedido:'TINTURARIA\nVALIDAÇÃO'},
            {part:'F6',sector:'17',codigo:'B',aviamentoPendente:false,andamentoPedido:''},
            {part:'F7',sector:'17x',codigo:'C',aviamentoPendente:true,andamentoPedido:'OUTRO PEDIDO'},
            {part:'F6',sector:'17x',codigo:'D',aviamentoPendente:true,andamentoPedido:'FORA DO FLUXO F6'},
            {part:'F7',sector:'EN',codigo:'E',aviamentoPendente:true,andamentoPedido:'FORA DO FLUXO F7'}
        ]},
        escape:String, onPart(){}, onSector(){}, onClear(){}
    });
    assert.match(container.innerHTML,/TINTURARIA\nVALIDAÇÃO/);
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
    assert.deepEqual(filterAvailability([{andamentoPedido:'2704 - 078501 - 126855-TINTURARIA'}],{mesh:'missing'}).length,1);
});

test('semana lista códigos em ordem e filtra as linhas dos cards e o gráfico', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const records = [
        {part:'F6', sector:'17', codigo:'MULTI', andamentoPedido:'2708 - CORTE\r\n 2704 - TINTURARIA\n2704 - LABORATÓRIO'},
        {part:'F6', sector:'17', codigo:'OUTRA', andamentoPedido:'2708 - DEPÓSITO'},
        {part:'F6', sector:'17', codigo:'TEM-MALHA', andamentoPedido:'2704 - DEPÓSITO'},
        {part:'F6', sector:'17', codigo:'SEM', andamentoPedido:'OF 2660 - CORTE'},
        {part:'F7', sector:'D9x', codigo:'F7-ANTIGA', andamentoPedido:'2652 – DEPÓSITO'}
    ];
    let changeWeek, selection;
    const weekSelect = {
        dataset:{cqFilter:'week'},
        value:'2708',
        addEventListener(event, callback) { if (event === 'change') changeWeek = callback; }
    };
    const container = {
        innerHTML:'',
        querySelector: () => ({ addEventListener(){} }),
        querySelectorAll: selector => selector === '[data-cq-filter]' ? [weekSelect] : []
    };
    const context = {window:{CRMProgCQ:require('../prog-cq')}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../prog-cq-view'), 'utf8'), context);
    context.window.CRMProgCQView.render(container, {
        filters:{part:'F6', sectors:['F6:17'], week:'2704', mesh:'missing'},
        source:{records},
        escape:String, onPart(){}, onFilter:(key, value) => { selection = [key, value]; }, onSector(){}, onClear(){}
    });
    const weekOptions = container.innerHTML.match(/data-cq-filter="week">([^]*?)<\/select>/)[1];
    assert.deepEqual([...weekOptions.matchAll(/value="([^"]+)"/g)].map(match => match[1]), ['all','2652','2704','2708']);
    assert.match(weekOptions, /value="2704" selected/);
    assert.match(container.innerHTML, /data-cq-sector="F6:17"[^>]+aria-label="Parte F6 setor 17, 1 registros"/);
    assert.equal((container.innerHTML.match(/class="prog-feira-card prog-cq-card"/g) || []).length, 1);
    assert.match(container.innerHTML, /2704 - TINTURARIA\n2704 - LABORATÓRIO/);
    assert.doesNotMatch(container.innerHTML, /2708 - CORTE|OUTRA|TEM-MALHA|F7-ANTIGA|OF 2660/);
    changeWeek();
    assert.deepEqual(selection, ['week', '2708']);
});
