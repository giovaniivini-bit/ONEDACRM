const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const helper=source.slice(source.indexOf('    function getRotativosGalleryItems('),source.indexOf('    function renderRotativosView('));
const context=vm.createContext({});vm.runInContext(helper,context);
const items=rows=>JSON.parse(JSON.stringify(context.getRotativosGalleryItems(rows)));
test('Rotativos: códigos completos e sufixos ficam separados, repetições preservam previsões distintas',()=>{
 const result=items([{produto:' 13.16.00.0673 ',prevMesa:'19/11/2026'},{produto:'13.16.00.0673A',prevMesa:'20/11/2026'},{produto:'13.16.00.0673',prevMesa:'19/11/2026'},{produto:'13.16.00.0673',prevMesa:'21/11/2026'}]);
 assert.equal(result.length,2);assert.equal(result[0].codigo,'13.16.00.0673');assert.deepEqual(result[0].forecasts,['19/11/2026','21/11/2026']);assert.equal(result[1].codigo,'13.16.00.0673A');
});
test('Rotativos: fonte vazia e código vazio não inventam produtos; previsão vazia é explícita',()=>{
 assert.deepEqual(items([]),[]);assert.deepEqual(items(null),[]);assert.deepEqual(items([{produto:'  '}]),[]);
 assert.deepEqual(items([{produto:'ON.16.0146',prevMesa:''}]),[{codigo:'ON.16.0146',forecasts:['Não informada']}]);
});
