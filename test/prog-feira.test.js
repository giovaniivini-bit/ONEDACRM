const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeSector, parseDelivery, calculateDaysInSector, buildProducts, groupBySector } = require('../prog-feira');

test('normalizes the spreadsheet scientific notation used for sector 1E2', () => {
    assert.equal(normalizeSector('1,00E+02'), '1E2');
    assert.equal(normalizeSector('1.00E+02'), '1E2');
    assert.equal(normalizeSector('02B'), '02B');
});

test('builds one product from TIPO 1, 2 and 3 without tripling totals', () => {
    const records = [
        { NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01E', SETOR: 'ESTAMPARIA DE AMOSTRAS', ORDEM: '10', DT_SAIDA: '01/10/2026', TIPO: '1', QTDE_PEND: '4', SETOR_TING: 'M03', SETOR_FLUXO_EM: 'DES', FICHA: '09/10', IMG_PRODUTO: '01.11.00.7904' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', ORDEM: 'T51A - RNA', TIPO: '2' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01A', SETOR: 'PRE CADASTRAMENTO/DESENHO', DT_SAIDA: '10/08/2026', TIPO: '3', QTDE_PEND: '0' },
        { NUMERO: '77826', CODIGO: '01.11.00.7904', OP: '01E', SETOR: 'ESTAMPARIA DE AMOSTRAS', DT_SAIDA: '01/10/2026', TIPO: '3', QTDE_PEND: '4' }
    ];
    const products = buildProducts(records, new Date(2026, 9, 5));
    assert.equal(products.length, 1);
    assert.equal(products[0].codigo, '01.11.00.7904');
    assert.equal(products[0].numero, '77826');
    assert.equal(products[0].program, 'T51A - RNA');
    assert.equal(products[0].delivery, '09/10');
    assert.equal(products[0].isDes, true);
    assert.equal(products[0].daysInSector, 4);
    assert.equal(products[0].history.length, 2);
});

test('calculates elapsed calendar days in the current sector safely', () => {
    const now = new Date(2026, 9, 5, 23, 30);
    assert.equal(calculateDaysInSector('02/10/2026', now), 3);
    assert.equal(calculateDaysInSector('2026-10-04', now), 1);
    assert.equal(calculateDaysInSector('06/10/2026', now), 0);
    assert.equal(calculateDaysInSector('31/12/26', now), 0);
    assert.equal(calculateDaysInSector('31/12', now), 0);
    assert.equal(calculateDaysInSector('2026-10-04junk', now), null);
    assert.equal(calculateDaysInSector('data inválida', now), null);
});

test('renders the elapsed days on every Prog Feira card', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
    const lightCss = fs.readFileSync(path.join(__dirname, '..', 'light-theme.css'), 'utf8');
    assert.match(app, /prog-feira-days/);
    assert.match(app, /no setor atual/);
    assert.match(css, /\.prog-feira-days\.late/);
    assert.match(lightCss, /body\.light-mode \.prog-feira-days\.late/);
    assert.match(lightCss, /color:\s*#b91c1c/);
});

test('organiza Prog Feira em paginas de oito cards e quatro colunas no PDF', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(app, /index \+= 8/);
    assert.match(app, /prog-feira-sector prog-feira-print-page/);
    assert.match(app, /'prog-feira': 'print-prog-feira'/);
    assert.match(css, /body\.print-prog-feira \.prog-feira-grid[\s\S]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    assert.match(css, /grid-template-rows:repeat\(2,86mm\)/);
    assert.match(css, /body\.print-prog-feira \.prog-feira-print-page[\s\S]*break-after:page/);
    assert.match(html, /style\.css\?v=20261029-forecast-observations-1/);
    assert.match(html, /app\.js\?v=[\w-]+/);
});

test('groups products by the D36 sector order and parses delivery dates', () => {
    const products = buildProducts([
        { NUMERO: '2', CODIGO: 'B', OP: '02B', SETOR: 'CORTE AMOSTRAS', TIPO: '1', FICHA: '05/10' },
        { NUMERO: '1', CODIGO: 'A', OP: '01A', SETOR: 'PRE CADASTRAMENTO/DESENHO', TIPO: '1', FICHA: '04/10' }
    ], new Date(2026, 9, 5));
    assert.deepEqual(groupBySector(products).map(group => group.sector), ['01A', '02B']);
    assert.equal(parseDelivery('09/10', new Date(2026, 9, 5)).getFullYear(), 2026);
    assert.equal(parseDelivery('10/01', new Date(2026, 11, 20)).getFullYear(), 2027);
    assert.equal(parseDelivery('20/12', new Date(2026, 0, 10)).getFullYear(), 2025);
    assert.equal(parseDelivery('31/02', new Date(2026, 9, 5)), null);
});
const { filterByPrograms, getProgramOptions } = require('../prog-feira');
test('programação usa COD_CLIENTE atual, preserva variantes e não usa ORDEM como substituto', () => {
    const products = buildProducts([
        { NUMERO: '1', CODIGO: 'A', TIPO: '1', COD_CLIENTE: ' b43 ', OP: '02M' },
        { NUMERO: '2', CODIGO: 'B', TIPO: '1', 'COD CLIENTE': 'B42', OP: '02M' },
        { NUMERO: '3', CODIGO: 'C', TIPO: '1', COD_CLIENTE: '  ', OP: '02M' },
        { NUMERO: '3', CODIGO: 'C', TIPO: '2', ORDEM: 'B99' },
        { NUMERO: '4', CODIGO: 'D', TIPO: '1', COD_CLIENTE: 'B43 (W.ROT)', OP: '01F' }
    ]);
    assert.equal(products.find(p => p.codigo === 'C').program, 'B99');
    assert.equal(products.find(p => p.codigo === 'C').customerProgram, '');
    assert.deepEqual(filterByPrograms(products, ['B43', 'B42']).map(p => p.codigo).sort(), ['A', 'B']);
    assert.deepEqual(filterByPrograms(products, ['']).map(p => p.codigo), ['C']);
    assert.deepEqual(filterByPrograms(products, ['B43', '']).map(p => p.codigo).sort(), ['A', 'C']);
    assert.equal(filterByPrograms(products, []).length, 4);
    assert.equal(filterByPrograms(products, ['inexistente']).length, 0);
    assert.equal(filterByPrograms(products, ['b43']).length, 1);
    assert.deepEqual(getProgramOptions(products, ['B44']), [
        { value: 'B42', count: 1 }, { value: 'B43', count: 1 },
        { value: 'B43 (W.ROT)', count: 1 }, { value: 'B44', count: 0 }, { value: '', count: 1 }
    ]);
    assert.equal(filterByPrograms(products, ['B43', 'B43 (W.ROT)']).filter(p => p.sector === '01F').length, 1);
});
test('filtro de programação fica suspenso quando a coluna está indisponível e retoma a seleção depois', () => {
    const available = [{ customerProgram: 'B43' }, { customerProgram: '' }];
    const unavailable = [{ customerProgram: '' }, { customerProgram: '' }];
    for (const selected of [['B43'], ['']]) {
        assert.equal(filterByPrograms(unavailable, selected, false).length, 2);
        assert.equal(filterByPrograms(available, selected, true).length, 1);
    }
});

test('opção VAZIO permanece disponível mesmo sem produtos sem programação', () => {
    assert.deepEqual(getProgramOptions([{ customerProgram: 'B43' }]), [{ value: 'B43', count: 1 }, { value: '', count: 0 }]);
});
test('distribuição por setor calcula contagens, percentuais e setores extras sem omitir produtos', () => {
    const {getSectorDistribution} = require('../prog-feira');
    const products = [{sector:'01A',customerProgram:'B43'},{sector:'01A',customerProgram:'B43'},{sector:'02B',customerProgram:'B44'},{sector:'EXTRA',sectorLabel:'Extra',customerProgram:'B43'}];
    const rows = getSectorDistribution(products);
    assert.equal(rows.find(r => r.code === '01A').percent,50);
    assert.equal(rows.find(r => r.code === '02B').count,1);
    assert.equal(rows.find(r => r.code === 'EXTRA').percent,25);
    assert.equal(rows.reduce((sum,r) => sum+r.count,0),4);
    assert.equal(rows.reduce((sum,r) => sum+r.percent,0),100);
    assert.equal(getSectorDistribution(filterByPrograms(products,['B44'])).find(r=>r.code==='02B').percent,100);
    assert.ok(getSectorDistribution([]).every(r=>r.count===0 && r.percent===0));
});
const { normalizeSourceRecords, getSectorDistribution } = require('../prog-feira');
const erp = (part,flow,sector,extra={}) => ({ 'Número':'100', 'Código':'01.00.0001A', Parte:part, Fluxo:flow, Setor:sector, 'Desc Setor':sector, 'Qtde Pend':'4', Cor:'50', Tamanho:'6', 'Descrição2':' B44 ', Ficha:'30/10', 'Data Saída':'20/10/2026', ...extra });
test('nova base usa somente FE/D36 pendente e reúne fluxos paralelos pela OF e código exato',()=>{
    const records=[erp('FE','D36','01A'),erp('D6','D35','DES'),erp('TF','D43','M02'),erp('AV','D47','X01'),erp('CO','D41','D01'),erp('FE','D36','01B',{'Qtde Pend':'0','Código':'ZERO'}),erp('FE','D36','FIM',{'Código':'FINAL'}),erp('AV','D47','X01',{'Número':'OUTRA'}),erp('CO','D41','D01',{'Código':'01.00.0001'}),erp('FE','D35','DES',{'Código':'ERRADO'})];
    const products=buildProducts(records,new Date(2026,9,27));
    assert.equal(products.length,1);
    const p=products[0];assert.equal(p.customerProgram,'B44');assert.equal(p.delivery,'30/10');assert.equal(p.sector,'01A');assert.equal(p.isDes,true);assert.equal(p.quantity,4);
    assert.deepEqual(p.parallelPending.map(s=>s.sector),['DES','M02','X01','D01']);
    assert.equal(p.parallelPending[0].days,7);
    assert.equal(p.history.length,0,'a base ERP atual não deve inventar histórico');
});
test('estados resolvidos não viram pendência e ausência de TF não vira M00',()=>{
    const resolved=buildProducts([erp('FE','D36','02B'),erp('D6','D35','FIM'),erp('TF','D43','M03'),erp('AV','D47','X02'),erp('CO','D41','D02')])[0];
    assert.deepEqual(resolved.parallelPending,[]);assert.equal(resolved.isDes,false);assert.equal(resolved.ting,'M03');
    const missing=buildProducts([erp('FE','D36','02B')])[0];assert.equal(missing.ting,'');assert.equal(missing.tingInfo.label,'Não informado');assert.equal(missing.missingParallel.length,4);
});
test('repetições de grade não duplicam cards ou somam quantidades dos fluxos complementares',()=>{
    const records=[erp('FE','D36','01B'),erp('FE','D36','01B'),erp('FE','D36','01B',{Tamanho:'8'}),erp('FE','D36','02B'),erp('D6','D35','PCO'),erp('AV','D47','X01'),erp('AV','D47','X01')];
    const [p]=buildProducts(records);assert.equal(buildProducts(records).length,1);assert.equal(p.quantity,8);assert.deepEqual(p.mainSectors,['01B','02B']);assert.equal(p.parallelPending.length,2);
    assert.equal(filterByPrograms([p],['B44']).length,1);assert.equal(getSectorDistribution([p]).reduce((n,s)=>n+s.count,0),1);
});
test('quantidade preserva grades distribuídas em setores e reconhece estado resolvido com saldo zero',()=>{
    const [p]=buildProducts([erp('FE','D36','01A'),erp('FE','D36','02B',{Tamanho:'8','Qtde Pend':'6'}),erp('TF','D43','M03',{'Qtde Pend':'0'}),erp('AV','D47','X02',{'Qtde Pend':'0'})]);
    assert.equal(p.quantity,10);assert.equal(p.ting,'M03');assert.ok(!p.missingParallel.includes('Tingimento'));assert.ok(!p.missingParallel.includes('Aviamento'));assert.equal(p.parallelPending.length,0);
    assert.equal(buildProducts([erp('FE','D36','01A',{'Qtde Pend':'0'}),erp('CO','D41','D01')]).length,0);
});
test('dias de TF acompanham o setor real M00 a M03 e não usam a data do D36',()=>{
    const now=new Date(2026,9,27);
    for(const setor of ['M00','M01','M02','M03']){
        const [p]=buildProducts([erp('FE','D36','01A',{'Data Saída':'26/10/2026'}),erp('TF','D43',setor,{'Data Saída':'20/10/2026'})],now);
        assert.equal(p.daysInSector,1);assert.equal(p.tingDays,7);assert.equal(p.ting,setor);
    }
    const [missing]=buildProducts([erp('FE','D36','01A'),erp('TF','D43','M00',{'Data Saída':''})],now);assert.equal(missing.tingDays,null);
    const [absent]=buildProducts([erp('FE','D36','01A')],now);assert.equal(absent.tingDays,null);
});
test('filtros independentes de cor, tingimento caseiro e custo cruzam estados atuais inclusive resolvidos',()=>{
    const {filterByParallelSectors,getParallelFilterOptions}=require('../prog-feira');
    const ps=buildProducts([
        erp('FE','D36','01A'),erp('CO','D41','D01'),erp('TF','D43','M00'),erp('D6','D35','DES'),
        erp('FE','D36','02B',{'Número':'200'}),erp('CO','D41','D02',{'Número':'200','Qtde Pend':'0'}),erp('TF','D43','M03',{'Número':'200','Qtde Pend':'0'}),erp('D6','D35','FIM',{'Número':'200','Qtde Pend':'0'}),
        erp('FE','D36','01B',{'Número':'300'})
    ]);
    const ids=filters=>filterByParallelSectors(ps,filters).map(p=>p.numero);
    assert.deepEqual(ids({color:'D01',ting:'M00',cost:'DES'}),['100']);
    assert.deepEqual(ids({color:'D02',ting:'M03',cost:'FIM'}),['200']);
    assert.deepEqual(ids({color:'D01',cost:'FIM'}),[]);
    assert.deepEqual(ids({color:'unknown',ting:'unknown',cost:'unknown'}),['300']);
    assert.equal(ids({}).length,3);
    assert.equal(getParallelFilterOptions(ps,'cost').find(o=>o.value==='DES').count,1);
    assert.equal(getParallelFilterOptions(ps,'cost').find(o=>o.value==='FIM').count,1);
    assert.equal(getParallelFilterOptions(ps,'cost','CUSTOM').find(o=>o.value==='CUSTOM').count,0);
    assert.equal(filterByPrograms(filterByParallelSectors(ps,{cost:'DES'}),['B44']).length,1);
});
test('filtros por fluxo preservam compatibilidade legada e múltiplos estados sem confundir ausência',()=>{
    const {filterByParallelSectors}=require('../prog-feira');
    const legacy=buildProducts([{NUMERO:'1',CODIGO:'A',TIPO:'1',OP:'01A',SETOR_TING:'M02',SETOR_FLUXO_EM:'PCO'}]);
    assert.equal(filterByParallelSectors(legacy,{ting:'M02',cost:'PCO',color:'unknown'}).length,1);
    const ps=buildProducts([erp('FE','D36','01A'),erp('TF','D43','M00'),erp('TF','D43','M02')]);
    assert.equal(filterByParallelSectors(ps,{ting:'M00'}).length,1);
    assert.equal(filterByParallelSectors(ps,{ting:'M02'}).length,1);
});
test('setor complementar em branco é Sem informação e nunca vira opção vazia',()=>{
    const {filterByParallelSectors,getParallelFilterOptions}=require('../prog-feira');
    const ps=buildProducts([erp('FE','D36','01A'),erp('CO','D41',''),erp('TF','D43',''),erp('D6','D35','')]);
    assert.equal(filterByParallelSectors(ps,{color:'unknown',ting:'unknown',cost:'unknown'}).length,1);
    assert.equal(ps[0].tingDays,null);
    for(const kind of ['color','ting','cost'])assert.ok(getParallelFilterOptions(ps,kind).every(o=>o.value));
});
test('etiquetas vêm da parte FE, aparecem no card e filtram por união com ordem alfabética',()=>{
    const {getLabelOptions,filterByLabels,labelValues}=require('../prog-feira');
    const ps=buildProducts([erp('FE','D36','01A',{Etiqueta:' hxv '}),erp('FE','D36','01A',{'Número':'200',Etiqueta:'CFA'}),erp('FE','D36','01A',{'Número':'300',Etiqueta:'CFUN'}),erp('FE','D36','01A',{'Número':'400',Etiqueta:''}),erp('CO','D41','D01',{Etiqueta:'ERRADA'})]);
    assert.deepEqual(getLabelOptions(ps).map(o=>o.value),['CFA','CFUN','HXV','']);
    assert.deepEqual(labelValues(ps.find(p=>p.numero==='100')),['HXV']);
    assert.equal(filterByLabels(ps,['CFA','HXV']).length,2);
    assert.equal(filterByLabels(ps,['']).length,1);
    assert.equal(filterByLabels(ps,[]).length,4);
    assert.equal(filterByLabels(ps,['INDISPONIVEL'],false).length,4);
    assert.equal(getLabelOptions(ps.filter(p=>p.numero==='200'),['HXV']).find(o=>o.value==='HXV').count,0);
    assert.equal(filterByPrograms(filterByLabels(ps,['CFA']),['B44']).length,1);
});
test('etiquetas de grades diferentes são preservadas sem duplicar produtos ou contagens',()=>{
    const {getLabelOptions,filterByLabels}=require('../prog-feira');
    const ps=buildProducts([erp('FE','D36','01A',{Etiqueta:'CFA'}),erp('FE','D36','01A',{Etiqueta:'HXV',Tamanho:'8'}),erp('FE','D36','01A',{Etiqueta:'CFA'})]);
    assert.equal(ps.length,1);assert.equal(filterByLabels(ps,['CFA','HXV']).length,1);
    assert.deepEqual(getLabelOptions(ps),[{value:'CFA',count:1},{value:'HXV',count:1}]);
});
test('contadores agrupam etiquetas pelo prefixo sem duplicar produto no mesmo grupo',()=>{
    const {getLabelGroups}=require('../prog-feira');
    const products=[{key:'1',labels:['CFA','CFAN','CGA']},{key:'2',labels:['CFAN']},{key:'3',labels:['CGX']},{key:'4',labels:['58A']},{key:'5',labels:[]}];
    assert.deepEqual(getLabelGroups(products),[
        {prefix:'58',count:1,labels:['58A']},{prefix:'CF',count:2,labels:['CFA','CFAN']},
        {prefix:'CG',count:2,labels:['CGA','CGX']},{prefix:'',count:1,labels:[]}
    ]);
    assert.deepEqual(getLabelGroups([]),[]);
    assert.equal(getLabelGroups([products[0],products[0]])[0].count,1);
});
test('contadores acompanham etiquetas e filtros aplicados ao conjunto visível',()=>{
    const {getLabelGroups,filterByLabels,filterByParallelSectors}=require('../prog-feira');
    const products=[{key:'1',etiqueta:'CFA',customerProgram:'B44',sector:'01B',parallelSectors:{CO:['D01']}},{key:'2',etiqueta:'CFAN',customerProgram:'B45',sector:'01A',parallelSectors:{CO:['D02']}},{key:'3',etiqueta:'CGA',customerProgram:'B44',sector:'01B',parallelSectors:{CO:['D01']}}];
    const visible=filterByLabels(filterByPrograms(filterByParallelSectors(products,{color:'D01'}),['B44']),['CFA','CGA']).filter(p=>p.sector==='01B');
    assert.deepEqual(getLabelGroups(visible).map(g=>[g.prefix,g.count]),[['CF',1],['CG',1]]);
});
