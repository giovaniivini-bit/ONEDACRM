const test=require('node:test');
const assert=require('node:assert/strict');
const {validPrograms,publicImage}=require('../mpo-integration');
test('MPO only exposes named B programs and sorts them numerically',()=>{
    assert.deepEqual(validPrograms({workspaces:[{id:'x',nome:'B42'},{id:'y',nome:' B41 '},{id:'default',nome:'default'},{id:'z',nome:'Projeto'}]}).map(p=>p.nome),['B41','B42']);
});
test('MPO image links use public origin and reject arbitrary URLs and traversal',()=>{
    assert.equal(publicImage('/workspaces/B41/images/fichas/a.png'),'https://mpo.136-248-111-213.sslip.io/workspaces/B41/images/fichas/a.png');
    assert.equal(publicImage('http://127.0.0.1:8085/a.png'),'');
    assert.equal(publicImage('/workspaces/B41/images/../../secret'),'');
});
