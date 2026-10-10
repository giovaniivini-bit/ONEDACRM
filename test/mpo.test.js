const test=require('node:test');
const assert=require('node:assert/strict');
const {validPrograms,publicImage,consolidate}=require('../mpo-integration');
test('MPO consolidates workspaces without mixing repeated item IDs',()=>{
    const build=(id,ref)=>({workspace:{id,nome:id},todas_pecas:[{id:'1',ref,tem_pendencia:true}],por_responsavel:{ana:{responsavel:'Ana',itens:[{id:'1',ref}]}}});
    const summary=consolidate([build('B41','0007'),build('B42','0007A')]);
    assert.equal(summary.workspace.total_pecas,2);
    assert.equal(summary.por_responsavel.ana.total_pecas,2);
    assert.notEqual(summary.todas_pecas[0].key,summary.todas_pecas[1].key);
    assert.equal(summary.por_responsavel.ana.itens[1].key,summary.todas_pecas[1].key);
});
test('MPO only exposes named B programs and sorts them numerically',()=>{
    assert.deepEqual(validPrograms({workspaces:[{id:'x',nome:'B42'},{id:'y',nome:' B41 '},{id:'default',nome:'default'},{id:'z',nome:'Projeto'}]}).map(p=>p.nome),['B41','B42']);
});
test('MPO image links use public origin and reject arbitrary URLs and traversal',()=>{
    assert.equal(publicImage('/workspaces/B41/images/fichas/a.png'),'https://mpo.136-248-111-213.sslip.io/workspaces/B41/images/fichas/a.png');
    assert.equal(publicImage('http://127.0.0.1:8085/a.png'),'');
    assert.equal(publicImage('/workspaces/B41/images/../../secret'),'');
});
