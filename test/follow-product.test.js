const test = require('node:test');
const assert = require('node:assert/strict');
const follow = require('../follow-product');
const row = (extra = {}) => ({ op:'00123', codigo:'21.19.00.0007A', setor:'99', semanaPedido:'SEMANA 46', etiqueta:'Café', progAmostras:'B46', statusModelagem:'Liberado', raw:{ Comp1:'Bordado',Comp2:'Preço a confirmar' }, ...extra });

test('inclui todos os setores, preserva sufixos e OFs distintas', () => {
    const result = follow.build({main:[row(),row({setor:'13'}),row({op:'123'}),row({codigo:'21.19.00.0007'}),row({op:''}),row({codigo:'—'})]});
    assert.equal(result.length,3);
    assert.equal(result[0].op,'00123');
    assert.deepEqual(result[0].mainSectors.map(x => x.setor), ['99','13']);
});
test('conserva observações de todas as linhas da OF/código sem misturar e deduplica', () => {
    const result = follow.build({ main:[row({rawRows:[{Comp1:'Bordado',Comp2:'Um'},{Comp1:'Bordado',Comp2:'Dois'}]}), row({setor:'13',raw:{Comp1:'Estampa',Comp2:'Dois'}}),row({op:'999',raw:{Comp1:'Outra OF'}})] });
    assert.deepEqual(result[0].observation1,['Bordado','Estampa']);
    assert.deepEqual(result[0].observation2,['Um','Dois']);
    assert.deepEqual(result[1].observation1,['Outra OF']);
});
test('inclui prog-only mesmo fora FE/D36 e mostra fluxos sem inventar estados ausentes', () => {
    const result = follow.build({progFeira:[{Número:'007',Código:'AA',Parte:'D6',Fluxo:'D35',Setor:'CTO',Comp1:'Custo',Descrição2:'B47'},{NUMERO:'007',CODIGO:'AA',PARTE:'CO',FLUXO:'D41',OP:'D02'},{NUMERO:'',CODIGO:'ZZ'}]});
    assert.equal(result.length,1);
    assert.equal(result[0].op,'007');
    assert.equal(result[0].flows[0].sectors[0].setor,'CTO');
    assert.equal(result[0].flows[1].sectors[0].setor,'D02');
    assert.equal(result[0].flows[2].sectors.length,0);
    assert.deepEqual(result[0].programs,['B47']);
});
test('planilhas usam código completo e preservam vários itens sem exigir D01/X01', () => {
    const result=follow.build({main:[row(),row({codigo:'21.19.00.0007'})], colors:[{PRODUTO:'21.19.00.0007A',COR:'Azul'},{PRODUTO:'21.19.00.0007A',COR:'Verde'}], trims:[{PRODUTO:'21.19.00.0007A',DESCRIÇÃO:'Botão'}],rotativos:[{produto:'21.19.00.0007A',prevMesa:'17/11'},{produto:'21.19.00.0007A',prevMesa:'18/11'}]});
    assert.equal(result[0].colorSheet.items.length,2);
    assert.equal(result[0].trimSheet.items.length,1);
    assert.equal(result[0].rotativosSheet.items.length,2);
    assert.equal(result[1].colorSheet.items.length,0);
});
test('distingue fonte desconhecida, planilha vazia e campos vazios', () => {
    const product=follow.build({main:[row({raw:{},statusModelagem:''})],trims:[]})[0];
    assert.equal(product.colorSheet.available,false);
    assert.equal(product.trimSheet.available,true);
    const html=follow.render([product]);
    assert.match(html,/Fonte indisponível/);
    assert.match(html,/Sem registro na planilha/);
    assert.match(html,/Não informado/);
    assert.match(html,/Imagem não disponível/);
});
test('busca código OF etiqueta semana e programação sem distinguir caixa/acentos', () => {
    const products=follow.build({main:[row(),row({op:'888',codigo:'OUTRO',etiqueta:'Renner',semanaPedido:'47',progAmostras:'B47'})]});
    for (const query of ['0007a','00123','CAFE','semana 46','b46']) assert.equal(follow.filter(products,query)[0].op,'00123');
    assert.equal(follow.filter(products,'b47')[0].op,'888');
    assert.equal(follow.filter(products,'não existe').length,0);
});
test('render escapa conteúdo, atributos e URLs, e mantém lazy/fallback em dados', () => {
    const products=follow.build({main:[row({codigo:'<img src=x>',raw:{Comp1:'<script>alert(1)</script>',Comp2:'" onmouseover="oops'}})], colors:[{PRODUTO:'<img src=x>',COR:'<svg onload=evil>'}]});
    const html=follow.render(products,{getImage:()=>({thumbUrl:'/safe.jpg?x="evil',proxyUrl:'https://example.com/fallback.jpg',largeUrl:'javascript:evil'})});
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<svg'));
    assert.ok(!html.includes('onmouseover="oops'));
    assert.match(html,/&lt;script&gt;/);
    assert.match(html,/loading="lazy"/);
    assert.match(html,/data-fallback="https:\/\/example.com\/fallback.jpg"/);
    assert.ok(!follow.render(products,{getImage:()=>({thumbUrl:'javascript:alert(1)'})}).includes('<img'));
});

test('reconcilia zeros externos somente com uma OF principal inequívoca do mesmo código completo', () => {
    const unique=follow.build({main:[row()],progFeira:[{NUMERO:'123',CODIGO:'21.19.00.0007A',TIPO:'1',COD_CLIENTE:'B47'},{NUMERO:'123',CODIGO:'21.19.00.0007',TIPO:'1'}]});
    assert.equal(unique.length,2);
    assert.equal(unique[0].op,'00123');
    assert.deepEqual(unique[0].sources,['ERP principal','Prog Feira']);
    assert.deepEqual(unique[0].programs,['B46','B47']);
    const ambiguous=follow.build({main:[row(),row({op:'0123'})],progFeira:[{NUMERO:'123',CODIGO:'21.19.00.0007A',TIPO:'1'}]});
    assert.equal(ambiguous.length,3);
    const exact=follow.build({main:[row(),row({op:'123'})],progFeira:[{NUMERO:'123',CODIGO:'21.19.00.0007A',TIPO:'1'}]});
    assert.deepEqual(exact[1].sources,['ERP principal','Prog Feira']);
});

test('setor Prog usa OP e descrição separada; modelagem usa descrição do local',()=>{
 const [p]=follow.build({main:[{op:'1',codigo:'A',rawRows:[{'Descrição do Local':'AGUARDANDO CLIENTE','Local Produto':'1 Ag F'}]}],progFeira:[{NUMERO:'1',CODIGO:'A',OP:'DES',SETOR:'CUSTO PENDENTE',FLUXO:'D35'}]});
 assert.deepEqual(p.modelingStatuses,['AGUARDANDO CLIENTE']);
 assert.equal(p.flows.find(f=>f.code==='D35').sectors[0].setor,'DES');
});
