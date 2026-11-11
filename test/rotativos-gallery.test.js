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


test('galeria Setor43 usa somente setor exato, preserva sufixos e maior permanência sem somar OFs',()=>{
 const result=JSON.parse(JSON.stringify(context.getRotativosSectorGalleryItems([
  {codigo:'01.13.00.1000',setor:'43',diasParado:3},{codigo:'01.13.00.1000',setor:'043',diasParado:8},
  {codigo:'01.13.00.1000A',setor:'43',diasParado:1},{codigo:'OUTRO',setor:'05',descSetor:'ROTATIVO',diasParado:99}
 ])));
 assert.deepEqual(result,[{codigo:'01.13.00.1000',days:8},{codigo:'01.13.00.1000A',days:1}]);
});
test('galeria Setor43 distingue zero e dado ausente; descarta setor/código inválido e fonte vazia',()=>{
 const get=records=>JSON.parse(JSON.stringify(context.getRotativosSectorGalleryItems(records)));
 assert.deepEqual(get([]),[]);assert.deepEqual(get([null,{setor:'43',codigo:''}]),[]);
 assert.deepEqual(get([{codigo:'A',setor:'43',diasParado:0},{codigo:'B',setor:'43',diasParado:''},{codigo:'C',setor:'43',diasParado:'inválido'}]),[{codigo:'A',days:0},{codigo:'B',days:null},{codigo:'C',days:null}]);
});


test('Setor43 mantém ausência distinta de zero após processar o CSV real e consolidar grades',()=>{
 const pipeline=source.slice(source.indexOf('    function normalizeKey('),source.indexOf('    // Identificar códigos de produtos nos setores de produção'));
 context.calculatePrazoStatus=()=>null;vm.runInContext(pipeline,context);
 const row=(codigo,days,op=codigo)=>({'Número':op,'Código':codigo,Setor:'43','Dias Parado':days,'Qtde Original':'1'});
 const normalized=context.processRawRecords([row('A',''),row('B','0'),row('C','inválido'),row('D',''),row('D','7')]);
 const gallery=JSON.parse(JSON.stringify(context.getRotativosSectorGalleryItems(normalized)));
 assert.deepEqual(gallery,[{codigo:'A',days:null},{codigo:'B',days:0},{codigo:'C',days:null},{codigo:'D',days:7}]);
});
