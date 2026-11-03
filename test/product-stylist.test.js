const {test}=require('node:test');
const assert=require('node:assert/strict');
const stylists=require('../product-stylist');
const rx=require('../raio-x');
const related=require('../setor01-related-sectors');
const prog=require('../prog-feira');

test('classifica todos os prefixos, mantendo 01.12 com Camila e sufixos completos',()=>{
    const rules={camila:['01.11','01.12','01.14','01.16'],joyce:['02.10','02.14','02.19','05.20','13.10','13.15','13.19'],thamires:['01.17','01.18','03.01','15.14','01.20','01.19'],ketlyn:['01.13','01.15']};
    for(const [name,prefixes] of Object.entries(rules))for(const prefix of prefixes) {
        for(const suffix of ['','.00.0000','.01.1000A']) assert.equal(stylists.classify(` ${prefix}${suffix} `),name,prefix+suffix);
    }
});
test('não confunde salas semelhantes nem adivinha estilista para códigos sem regra',()=>{
    for(const code of ['02.1.00.1000','13.1.00.1000']) assert.equal(stylists.classify(code),'none');
    for(const code of ['',null,undefined,'ON.12.0119A','01.10.00.1000','02.20.01.1000','13.20.00.1000','03.02.00.1000','01.120.00.1000','050.20.00.1000','02.100.00.1000','13.100.00.1000','101.12.00.1000']) assert.equal(stylists.classify(code),'none',String(code));
    assert.equal(stylists.label('none'),'Sem estilista');
});
test('Raio X combina estilista com setor, pendência e busca sem alterar consolidação',()=>{
    const codes=['01.12.00.1000A','01.13.00.1000','01.18.00.1000','13.15.00.1000','99.00.1000'];
    const records=codes.flatMap((codigo,i)=>[{codigo,op:String(i),setor:'01',cliente:'C&A',statusModelagem:'Lib corte',statusEstilo:'LIBERADO PARA PRODUÇÃO'},{codigo,op:String(i),setor:'D01'}]);
    const products=rx.build(records),f={search:'',sectors:[],client:'all',pending:'all',style:'all',model:'all',malote:'all'};
    for(const [id] of stylists.OPTIONS) assert.equal(rx.filter(products,{...f,stylist:id},related).length,1);
    assert.equal(rx.filter(products,{...f,stylist:'camila',sectors:['01'],pending:'cor',search:'1000A'},related).length,1);
    assert.equal(rx.filter(products,{...f,stylist:'joyce',search:'01.12'},related).length,0);
    assert.equal(rx.filter(products,{...f,stylist:'all'},related).length,5);
    assert.equal(products.length,5);
});
test('Prog Feira combina estilista com etiquetas, programação, paralelos e suas contagens',()=>{
    const products=[{codigo:'01.12.00.1000',key:'1',etiqueta:'CFA',customerProgram:'B44',sector:'01B',parallelSectors:{CO:['D01']}},{codigo:'13.15.00.1000',key:'2',etiqueta:'CFAN',customerProgram:'B45',sector:'01B',parallelSectors:{CO:['D01']}},{codigo:'01.12.00.2000',key:'3',etiqueta:'CGA',customerProgram:'B45',sector:'01A',parallelSectors:{CO:['D02']}},{codigo:'99.00.1000',key:'4',etiqueta:'CFA',customerProgram:'',sector:'01B',parallelSectors:{}}];
    const base=stylists.filter(prog.filterByParallelSectors(products,{color:'D01'}),'camila');
    assert.deepEqual(prog.getLabelOptions(base),[{value:'CFA',count:1}]);
    assert.equal(prog.getProgramOptions(base).find(o=>o.value==='B44').count,1);
    assert.equal(prog.filterByPrograms(prog.filterByLabels(base,['CFA']),['B44']).length,1);
    assert.equal(stylists.filter(products,'none').length,1);
    assert.equal(stylists.filter(products,'all').length,4);
});
