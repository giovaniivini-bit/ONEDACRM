const test = require('node:test');
const assert = require('node:assert/strict');
const { PARTS, groups, toggleSector } = require('../prog-cq');

test('Prog CQ mantém a ordem F6/F7 e a sequência exata dos setores', () => {
    assert.deepEqual(PARTS.map(part => part.code), ['F6', 'F7']);
    assert.deepEqual(PARTS[0].sectors, ['17x','17','D9x','B8x','D11','B9x','E7x','E8x','E9x','E5x']);
    assert.deepEqual(PARTS[1].sectors, ['EN','IS','17','D9','B8','D10','B9','E7','E8','E9','E5']);
    assert.deepEqual(groups().map(group => group.key), PARTS.flatMap(part => part.sectors.map(sector => `${part.code}:${sector}`)));
});

test('seleção múltipla separa partes e não confunde setores nem sufixos de produto', () => {
    const items = [{part:'F6',sector:'17x',codigo:'01.11.0001A'}, {part:'F7',sector:'17',codigo:'01.11.0001'}, {part:'F7',sector:'EN',codigo:'B'}];
    let selected = toggleSector([], 'F6:17x');
    selected = toggleSector(selected, 'F7:17');
    assert.deepEqual(groups(items, {sectors:selected}).flatMap(group => group.items), items.slice(0,2));
    assert.deepEqual(groups(items, {part:'F6',sectors:selected}).map(group => group.key), ['F6:17x']);
    assert.deepEqual(groups(items, {search:'0001A'}).flatMap(group => group.items), [items[0]]);
    assert.deepEqual(toggleSector(selected, 'F6:17x'), ['F7:17']);
    assert.deepEqual(toggleSector(selected, 'F6:17'), [...selected, 'F6:17']);
});

test('tela sem fonte sinaliza ausência de dados e conecta seleção e limpeza', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const handlers = {};
    const sectorButton = {dataset:{cqSector:'F6:17x'},addEventListener:(event,cb)=>{handlers.sector=cb;}};
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
    assert.equal((container.innerHTML.match(/data-cq-group=/g)||[]).length,21);
    assert.ok(container.innerHTML.indexOf('data-cq-group="F6:17x"')<container.innerHTML.indexOf('data-cq-group="F7:EN"'));
    assert.doesNotMatch(container.innerHTML,/<img|0 referências|Planilha ao vivo/);
    handlers['[data-cq-part]']({target:{value:'F7'}});
    handlers['[data-cq-clear]']();
    handlers.sector();
    assert.equal(sector,'F6:17x');
    assert.equal(part,'F7'); assert.equal(cleared,true);
    context.window.CRMProgCQView.render(container,{
        filters:{part:'F6',sectors:['F6:17']},
        source:{records:[
            {part:'F6',sector:'17',codigo:'A',aviamentoPendente:true,andamentoPedido:'TINTURARIA\nVALIDAÇÃO'},
            {part:'F6',sector:'17',codigo:'B',aviamentoPendente:false,andamentoPedido:''},
            {part:'F7',sector:'17',codigo:'C',aviamentoPendente:true,andamentoPedido:'OUTRO PEDIDO'}
        ]},
        escape:String, onPart(){}, onSector(){}, onClear(){}
    });
    assert.match(container.innerHTML,/TINTURARIA\nVALIDAÇÃO/);
    assert.match(container.innerHTML,/Não informado/);
    assert.equal((container.innerHTML.match(/AV\. PENDENTE CQ/g)||[]).length,1);
    assert.doesNotMatch(container.innerHTML,/OUTRO PEDIDO/);
});
