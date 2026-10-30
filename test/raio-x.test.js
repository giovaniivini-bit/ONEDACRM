const test = require('node:test');
const assert = require('node:assert/strict');
const rx = require('../raio-x');
const helpers = require('../setor01-related-sectors');
const row = (setor, extra = {}) => ({ op: '123', codigo: '01.00.123A', setor, qtdeOriginal: 10, diasParado: 2, statusModelagem: 'Lib corte', statusEstilo: 'LIBERADO PARA PRODUÇÃO', cliente: 'C&A', ...extra });
const defaults = { search: '', sectors: [], client: 'all', pending: 'all', style: 'all', model: 'all', malote: 'all' };

test('nomes usam Desc Setor somente dos setores principais e eliminam repetições', () => {
    const names = rx.sectorNames([row('1', { descSetor: 'ESTILO' }), row('01', { descSetor: 'ESTILO' }), row('13', { descSetor: 'MODELAGEM' }), row('D01', { descSetor: 'COR' }), row('88', { descSetor: 'MALOTES' }), row('05', { descSetor: '' })]);
    assert.deepEqual(names, { '01': 'ESTILO', '13': 'MODELAGEM' });
});

test('consolida setores por OF e código completo sem multiplicar produtos ou peças', () => {
    const products = rx.build([row('01'), row('13', { diasParado: 5 }), row('D01'), row('X01'), row('88', { parte: 'D7' })]);
    assert.equal(products.length, 1);
    assert.deepEqual(products[0].sectors, ['01', '13']);
    assert.equal(products[0].qtdeOriginal, 10);
    assert.deepEqual(products[0].setorDias, [{ setor: '01', dias: 2 }, { setor: '13', dias: 5 }]);
    assert.deepEqual(products[0].setoresCor, ['D01']);
    assert.deepEqual(products[0].setoresAviamento, ['X01']);
    assert.deepEqual(products[0].malotes, ['88']);
});

test('não cruza variantes de produto ou OFs diferentes, nem cria cards secundários', () => {
    const products = rx.build([row('01'), row('13', { codigo: '01.00.123B' }), row('D01', { codigo: '01.00.123B' }), row('88', { op: '999', parte: 'D7' }), row('01', { codigo: '' }), row('01', { op: '' })]);
    assert.equal(products.length, 2);
    assert.deepEqual(products.find(p => p.codigo.endsWith('A')).setoresCor, []);
    assert.deepEqual(products.find(p => p.codigo.endsWith('B')).setoresCor, ['D01']);
    assert.ok(products.every(p => p.malotes.length === 0));
});

test('inclui todos os setores solicitados e normaliza setores numéricos', () => {
    const products = rx.build([...rx.SECTORS.map(s => row(s)), row('1'), row('088', { partes: ['D7'] }), row('83', { parte: 'D3' })]);
    assert.equal(products.length, 1);
    assert.deepEqual(products[0].sectors, rx.SECTORS);
    assert.deepEqual(products[0].malotes, ['88']);
    assert.equal(rx.build([row('D01'), row('X01'), row('83', { parte: 'D7' })]).length, 0);
});

test('filtros de cor, estilo, modelagem, setor, cliente, busca e malote se combinam', () => {
    const products = rx.build([row('01'), row('D01'), row('83', { partes: ['D7'] }), row('13', { op: '456', statusModelagem: 'Ag feira', statusEstilo: 'PENDENTE DESENVOLVIMENTO' }), row('X01', { op: '456' })]);
    const filter = f => rx.filter(products, { ...defaults, ...f }, helpers);
    assert.equal(filter({ pending: 'cor', style: 'liberados', model: 'Lib corte', sectors: ['01'], malote: '83', search: '123a', client: 'C&A' }).length, 1);
    assert.equal(filter({ pending: 'aviamento', style: 'pendentes', model: 'Ag feira', malote: 'none' }).length, 1);
    assert.equal(filter({ pending: 'ambas' }).length, 0);
    assert.equal(filter({ pending: 'nenhuma' }).length, 0);
    assert.equal(filter({ malote: '88' }).length, 0);
    assert.equal(filter({ style: 'liberados', model: 'Ag feira' }).length, 0);
    assert.equal(rx.build([]).length, 0);
});

test('seleção de setores aceita um ou vários por união, sem duplicar cards', () => {
    const products = rx.build([row('01'), row('13'), row('05', { op: '456' }), row('20', { op: '789' })]);
    const filter = sectors => rx.filter(products, { ...defaults, sectors }, helpers);
    assert.equal(filter([]).length, 3);
    assert.equal(filter(['01']).length, 1);
    assert.equal(filter(['01', '13']).length, 1);
    assert.equal(filter(['01', '05']).length, 2);
    assert.equal(filter(['43']).length, 0);
    assert.equal(filter(['01', '05', '20']).length, 3);
});

test('preserva status divergentes entre setores e não considera status desconhecido liberado', () => {
    const products = rx.build([row('01'), row('13', { statusModelagem: 'Ag feira', statusEstilo: 'PENDENTE DESENVOLVIMENTO' }), row('05', { op: '456', statusEstilo: 'DESCONHECIDO' })]);
    assert.deepEqual(products[0].modelagem, ['Lib corte', 'Ag feira']);
    assert.equal(rx.filter(products, { ...defaults, style: 'pendentes' }, helpers).length, 1);
    assert.equal(rx.filter(products, { ...defaults, style: 'liberados' }, helpers).length, 1);
});
test('Raio X imprime com margem segura e campos legíveis sem compressão de badges', () => {
    const fs = require('node:fs');
    const css = fs.readFileSync(require('node:path').join(__dirname, '../style.css'), 'utf8');
    const app = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
    assert.match(css, /@page raio-x-report\s*\{[^}]*margin:12mm !important/);
    assert.match(css, /\.rx-print-grid\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(css, /#raioXPrintReport \.rx-card\s*\{[^}]*height:auto[^}]*overflow:visible/);
    assert.match(app, /cards\.slice\(offset, offset \+ 6\)/);
    assert.match(app, /class="rx-print-details"/);
});
test('Raio X inclui pendência dupla em cor e aviamento sem alterar filtro exclusivo do Setor01', () => {
    const target = { op: '77817', codigo: '01.16.00.7896' };
    const products = rx.build([
        row('01', target), row('D01', target), row('X01', target),
        row('01', {op:'2'}), row('D01', {op:'2'}),
        row('01', {op:'3'}), row('X01', {op:'3'}), row('01', {op:'4'})
    ]);
    const ids = pending => rx.filter(products, {...defaults,pending},helpers).map(p=>p.op).sort();
    assert.deepEqual(ids('cor'),['2','77817']);
    assert.deepEqual(ids('aviamento'),['3','77817']);
    assert.deepEqual(ids('ambas'),['77817']);
    assert.deepEqual(ids('nenhuma'),['4']);
    assert.equal(rx.filter(products,{...defaults,pending:'cor',search:target.codigo,sectors:['01']},helpers).length,1);
    assert.equal(rx.filter(products,{...defaults,pending:'aviamento',client:'Outro'},helpers).length,0);
    const both=products.find(p=>p.op===target.op);
    assert.equal(helpers.matchesPending(both,'cor'),false);
    assert.equal(helpers.matchesPending(both,'aviamento'),false);
    assert.equal(helpers.matchesPending(both,'ambas'),true);
});
test('cruza planilhas por produto completo e prioriza envio ao cliente em cada linha',()=>{
    const ps=rx.build([row('01'),row('D01'),row('X01')]);
    const colors=[{PRODUTO:' 01.00.123a ',COR:'AZUL',PANTONE:'19-4001','ENV CLIENTE':'20/10/2026','PREVISÃO':'10/10/2026'},{PRODUTO:'01.00.123A',COR:'VERDE','ENV CLIENTE':'','PREVISÃO':'30/10/2026'},{PRODUTO:'01.00.123',COR:'ERRADA'}];
    const trims=[{PRODUTO:'01.00.123A','TIPO AVIAMENTO':'BOTÃO','DESCRIÇÃO':'18 mm','ENV. CLIENTE':'22/10/2026','PREVISÃO':'10/10/2026'},{PRODUTO:'01.00.123A','TIPO AVIAMENTO':'ETIQUETA','ENV. CLIENTE':'','PREVISÃO':'31/10/2026'}];
    const [p]=rx.enrichWithSheets(ps,colors,trims);
    assert.equal(p.colorSheet.items.length,2);assert.equal(p.trimSheet.items.length,2);
    assert.equal(p.colorSheet.items[0].name,'AZUL');assert.equal(p.colorSheet.items[0].description,'19-4001');
    assert.deepEqual(p.colorSheet.items[0].delivery,{kind:'sent',label:'Enviado ao cliente',value:'20/10/2026'});
    assert.deepEqual(p.colorSheet.items[1].delivery,{kind:'forecast',label:'Previsão',value:'30/10/2026'});
    assert.equal(p.trimSheet.items[0].description,'18 mm');assert.equal(p.trimSheet.items[0].delivery.kind,'sent');assert.equal(p.trimSheet.items[1].delivery.value,'31/10/2026');
    assert.equal(ps[0].colorSheet,undefined,'não muta os produtos da consolidação');
});
test('não usa recebido como envio nem mistura sufixos ou produtos sem pendência ativa',()=>{
    const ps=rx.build([row('01'),row('D01'),row('X01'),row('01',{op:'2',codigo:'01.00.123B'})]);
    const colors=[{PRODUTO:'01.00.123A',COR:'BRANCO',RECEBIDO:'20/10/2026','ENV CLIENTE':'—',PREVISAO:'30/10/2026'}];
    const trims=[{PRODUTO:'01.00.123A','TIPO AVIAMENTO':'CORDÃO','ENV. CLIENTE':'#VALUE!',PREVISAO:'-'},{PRODUTO:'01.00.123B','TIPO AVIAMENTO':'NÃO DEVE MOSTRAR'}];
    const enriched=rx.enrichWithSheets(ps,colors,trims);const a=enriched.find(p=>p.op==='123');const b=enriched.find(p=>p.op==='2');
    assert.equal(a.colorSheet.items[0].delivery.kind,'forecast');assert.equal(a.trimSheet.items[0].delivery.kind,'missing');
    assert.equal(b.colorSheet,null);assert.equal(b.trimSheet,null);
});
test('distingue planilha indisponível de produto ausente e preserva dados textuais sem inventar datas',()=>{
    const ps=rx.build([row('01'),row('D01'),row('X01')]);
    const [missing]=rx.enrichWithSheets(ps,[],null);assert.equal(missing.colorSheet.available,true);assert.deepEqual(missing.colorSheet.items,[]);assert.equal(missing.trimSheet.available,false);
    const [text]=rx.enrichWithSheets(ps,[{produto:'01.00.123A',cor:'CREME','enviado ao cliente':'COM O MALOTE 27','previsao':'DEFINIR'}],[]);
    assert.equal(text.colorSheet.items[0].delivery.value,'COM O MALOTE 27');assert.equal(text.colorSheet.items[0].delivery.kind,'sent');
});
test('planilha sem OF complementa todas as OFs do código exato e mantém itens após a linha 50',()=>{
    const ps=rx.build([row('01'),row('D01'),row('01',{op:'2'}),row('D01',{op:'2'})]);
    const colors=[...Array.from({length:50},(_,i)=>({PRODUTO:'OUTRO'+i,COR:'OUTRA'})),{PRODUTO:'01.00.123A',COR:'AZUL',PREVISAO:'30/10/2026'}];
    const enriched=rx.enrichWithSheets(ps,colors,[]);assert.equal(enriched.length,2);assert.ok(enriched.every(p=>p.colorSheet.items.length===1&&p.colorSheet.items[0].name==='AZUL'));
});
test('linha que contém apenas o produto não cria complemento sem informação',()=>{
    const ps=rx.build([row('01'),row('D01'),row('X01')]);
    const [p]=rx.enrichWithSheets(ps,[{PRODUTO:'01.00.123A',COR:'-',PANTONE:'','ENV CLIENTE':'',PREVISAO:''}],[{PRODUTO:'01.00.123A'}]);
    assert.deepEqual(p.colorSheet.items,[]);assert.deepEqual(p.trimSheet.items,[]);
});

test('observações do Raio X mantêm linha e sufixo, inclusive observação como única informação',()=>{
    const ps=rx.build([row('01'),row('D01'),row('X01')]);
    const colors=[{PRODUTO:'01.00.123A',COR:'AZUL',PANTONE:'19-4001',OBS:'Primeira linha\nAguardar cliente'},{PRODUTO:'01.00.123A',COR:'VERDE','OBSERVAÇÃO':'Outro item'},{PRODUTO:'01.00.123',COR:'ERRADA',OBS:'Não misturar'}];
    const trims=[{PRODUTO:'01.00.123A','OBSERVACOES':'<script>texto</script>'},{PRODUTO:'01.00.123A','TIPO AVIAMENTO':'BOTÃO',OBS:'  '}];
    const [p]=rx.enrichWithSheets(ps,colors,trims);
    assert.deepEqual(p.colorSheet.items.map(i=>i.observation),['Primeira linha\nAguardar cliente','Outro item']);
    assert.equal(p.colorSheet.items[0].description,'19-4001');
    assert.deepEqual(p.trimSheet.items.map(i=>i.observation),['<script>texto</script>','']);
});

test('busca do topo aplica e limpa filtro mesmo sem botão de limpar no HTML',()=>{
    const fs=require('node:fs'),vm=require('node:vm');
    const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
    const source=app.slice(app.indexOf('        // Filtro de Busca do Topo'),app.indexOf('        // Switcher de Visão'));
    let inputHandler;let renders=0;
    const input={addEventListener:(event,fn)=>{if(event==='input')inputHandler=fn;}};
    const state={filters:{search:''}};
    vm.runInNewContext(source,{state,document:{getElementById:id=>id==='headerSearchInput'?input:null},applyFiltersAndRender:()=>renders++});
    inputHandler({target:{value:' 01.16.32.0273 '}});
    assert.equal(state.filters.search,'01.16.32.0273');assert.equal(renders,1);
    inputHandler({target:{value:'ON.12.0119A'}});
    assert.equal(state.filters.search,'on.12.0119a');assert.equal(renders,2);
    inputHandler({target:{value:''}});
    assert.equal(state.filters.search,'');assert.equal(renders,3);
});
