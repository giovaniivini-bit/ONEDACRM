const test = require('node:test');
const assert = require('node:assert/strict');
const { FLOWS, groups, toggleSector } = require('../prog-cq');

test('Prog CQ mantém a ordem C32/D32 e a sequência exata dos setores', () => {
    assert.deepEqual(FLOWS.map(flow => flow.code), ['C32', 'D32']);
    assert.deepEqual(FLOWS[0].sectors, ['17x','D9x','B8x','D11','B9x','E7x','E8x','E9x','E5x']);
    assert.deepEqual(FLOWS[1].sectors, ['EN','IS','17','D9','B8','D10','B9','E7','E8','E9','E5']);
    assert.deepEqual(groups().map(group => group.key), FLOWS.flatMap(flow => flow.sectors.map(sector => `${flow.code}:${sector}`)));
});

test('seleção múltipla separa fluxos e não confunde setores nem sufixos de produto', () => {
    const items = [{flow:'C32',sector:'17x',codigo:'01.11.0001A'}, {flow:'D32',sector:'17',codigo:'01.11.0001'}, {flow:'D32',sector:'EN',codigo:'B'}];
    let selected = toggleSector([], 'C32:17x');
    selected = toggleSector(selected, 'D32:17');
    assert.deepEqual(groups(items, {sectors:selected}).flatMap(group => group.items), items.slice(0,2));
    assert.deepEqual(groups(items, {flow:'C32',sectors:selected}).map(group => group.key), ['C32:17x']);
    assert.deepEqual(groups(items, {search:'0001A'}).flatMap(group => group.items), [items[0]]);
    assert.deepEqual(toggleSector(selected, 'C32:17x'), ['D32:17']);
    assert.deepEqual(toggleSector(selected, 'C32:17'), selected);
});

test('tela sem fonte sinaliza ausência de dados e conecta seleção e limpeza', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const handlers = {};
    const sectorButton = {dataset:{cqSector:'C32:17x'},addEventListener:(event,cb)=>{handlers.sector=cb;}};
    const container = {innerHTML:'', querySelector: selector => ({addEventListener:(event,cb) => {handlers[selector]=cb;}}), querySelectorAll: () => [sectorButton]};
    const context = {window:{CRMProgCQ:require('../prog-cq')}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../prog-cq-view'), 'utf8'),context);
    let flow, sector, cleared=false;
    context.window.CRMProgCQView.render(container,{filters:{flow:'all',sectors:[]},search:'',escape:String,onFlow:value=>{flow=value;},onClear:()=>{cleared=true;},onSector:value=>{sector=value;}});
    assert.match(container.innerHTML,/Aguardando configuração da planilha/);
    assert.match(container.innerHTML,/Quantidades ainda não disponíveis/);
    assert.match(container.innerHTML,/1QMegrgLwnsXnOyOrkUK_XELhL6Tji_WARdZXu3WSlKg\/edit#gid=0/);
    assert.match(container.innerHTML,/Abrir planilha Prog CQ/);
    assert.equal((container.innerHTML.match(/data-cq-group=/g)||[]).length,20);
    assert.ok(container.innerHTML.indexOf('data-cq-group="C32:17x"')<container.innerHTML.indexOf('data-cq-group="D32:EN"'));
    assert.doesNotMatch(container.innerHTML,/<img|0 referências|Planilha ao vivo/);
    handlers['[data-cq-flow]']({target:{value:'D32'}});
    handlers['[data-cq-clear]']();
    handlers.sector();
    assert.equal(sector,'C32:17x');
    assert.equal(flow,'D32'); assert.equal(cleared,true);
});
