const stylists = require('./product-stylist');
const raioX = require('./raio-x');
const {getRecordField} = require('./alerts-engine');
const {isEstampaStatusPendente} = require('./setor01-related-sectors');
const prog = require('./prog-feira');

const STYLIST_IDS = ['camila','ketlyn','joyce','thamires'];
const SECTIONS = [
    {key:'pedido-estampa',theme:'PEDIDO',title:'PRODUTOS COM PENDÊNCIA DE ESTAMPA'},
    {key:'pedido-aviamento',theme:'PEDIDO',title:'PRODUTOS COM PENDÊNCIA DE AVIAMENTO'},
    {key:'pedido-cor',theme:'PEDIDO',title:'PRODUTOS COM PENDÊNCIA DE COR'},
    {key:'amostra-atraso',theme:'AMOSTRA',title:'PRODUTOS EM ATRASO'},
    {key:'amostra-sem-data',theme:'AMOSTRA',title:'PRODUTOS SEM DATA DE ENTREGA VÁLIDA'},
    {key:'amostra-permanencia',theme:'AMOSTRA',title:'MAIS DE 15 DIAS EM 01A, 01B OU 1B2'}
];

// Project only fields used by Raio X / reports. As on the screen, consolidate
// sizes by full product code + order + sector before building Raio X products.
function normalizeOrderReportRecords(records) {
    const groups=new Map();
    for(const row of records || []) {
        const field=names=>{
            for(const name of names) {const value=getRecordField(row,[name]);if(value)return value;}
            return '';
        };
        const op=field(['Número','Numero','Nmero','OF','Ordem','OP']);
        const codigo=field(['Código','Codigo','Cdigo','Referência','Referencia','Produto','Cod Produto']);
        let setor=field(['SETOR','Setor Pendente','Setor Atual']).toUpperCase();
        if(/^\d$/.test(setor))setor=`0${setor}`;
        const key=JSON.stringify([op,setor,codigo.toUpperCase()]);
        const quantity=parseInt(field(['Qtde Original','Qtde','Quantidade','Qtd Original','Qtd']).replace(/[^0-9]/g,''),10)||0;
        if(groups.has(key)) {const group=groups.get(key);group.qtdeOriginal+=quantity;group.partes=[...new Set([...group.partes,field(['Parte','PARTE'])].filter(Boolean))];continue;}
        groups.set(key,{
            op,codigo,setor,qtdeOriginal:quantity,partes:[field(['Parte','PARTE'])].filter(Boolean),
            descSetor:field(['Desc Setor','Descrição Setor','Descricao Setor','Descrio Setor']),
            descricao:field(['Produto Descrição','Produto Descricao','Produto Descrio','Desc Produto','Descrição','Descricao']),
            statusEstilo:field(['Produto Status','Status Estilo','Situação Estilo','Situacao Estilo','Status Prod','Status Estampa','Sit Estilo','Desc Estilo']),
            semanaPedido:field(['Ped Desc Período','Ped Desc Periodo','Ped Desc Perodo','Ped Período','Ped Periodo','Ped Perodo','Desc Período OP','Desc Periodo OP','Desc Perodo OP','Período OP','Semana']),
            etiqueta:field(['Etiqueta','Etq','Desc Etiqueta','Cód Etiqueta','Cod Etiqueta']),
            diasParado:parseInt(field(['Dias Parado','Dias Parado Setor','Dias No Setor','Dias Parado no Setor','Dias']).replace(/[^0-9]/g,''),10)||0,
            cliente:field(['Desc Grupo Cli','Descricao Grupo Cli','Cliente Ped','Cliente','Grupo Cliente','Grupo Cli','Fantasia'])
        });
    }
    return [...groups.values()];
}

function buildStylistReports(orderRecords, sampleProducts, reference, day, sources={}) {
    const enrich=products=>raioX.enrichWithSheets(products,sources.colorRecords,sources.trimRecords);
    const orderParts=new Map();
    for(const row of orderRecords) {
        const key=JSON.stringify([String(row.op).trim(),String(row.codigo).trim().toUpperCase()]);
        if(!orderParts.has(key))orderParts.set(key,new Set());
        for(const part of row.partes || [])orderParts.get(key).add(String(part).trim().toUpperCase());
    }
    const orders=enrich(raioX.build(orderRecords)).map(p=>({...p,reportParts:[...(orderParts.get(JSON.stringify([String(p.op).trim(),String(p.codigo).trim().toUpperCase()])) || [])]}));
    const activeSamples=enrich(sampleProducts.filter(p=>p.sector!=='01Z'&&p.quantity>0).map(p=>({...p,
        setoresCor:p.parallelPending?.some(row=>row.part==='CO'&&row.sector==='D01')?['D01']:[],
        setoresAviamento:p.parallelPending?.some(row=>row.part==='AV'&&row.sector==='X01')?['X01']:[]
    })));
    const forecasts=p=>[['D01',p.colorSheet],['X01',p.trimSheet]].flatMap(([sector,sheet])=>{
        if(!sheet)return [];
        if(!sheet.available || !sheet.items.length)return [{sector,kind:'missing',label:'Previsão',value:sheet.available?'Não informada':'Fonte indisponível',name:''}];
        return sheet.items.map(item=>({sector,kind:item.delivery.kind,label:item.delivery.label,value:item.delivery.value,
            name:[item.name,item.description].filter(Boolean).join(' / ')}));
    });
    const byProduct=(a,b)=>a.codigo.localeCompare(b.codigo,'pt-BR')||a.numero.localeCompare(b.numero);
    return STYLIST_IDS.map(id=>{
        const items=[];
        let invalidDeliveries=0, invalidMovement=0;
        const add=(key,p,reason,extra={})=>items.push({
            numero:String(p.numero || p.op || ''),parts:p.reportParts || (p.theme==='AMOSTRA'?['FE']:[]),codigo:p.codigo,imageCode:p.imageCode || p.codigo,
            sector:p.sector || p.sectors?.join(' / ') || '',sectorLabel:p.sectorLabel || p.descSetor || '',
            delivery:p.delivery || '',etiqueta:p.etiqueta || '',reason,groupKey:key,forecasts:forecasts(p),...extra
        });
        for(const p of stylists.filter(orders,id)) {
            const extra={theme:'PEDIDO',week:p.semanaPedido,description:p.descricao,customer:p.cliente,
                quantity:p.qtdeOriginal,sectorLabel:p.setorDias.map(s=>`${s.setor}: ${s.dias} dias`).join(' | '),
                styleStatus:p.estilo.join(' / '),detailLabel:'Semana pedido',delivery:p.semanaPedido || 'Não informada'};
            const pendingStatuses=p.estilo.filter(isEstampaStatusPendente);
            if(pendingStatuses.length)add('pedido-estampa',p,pendingStatuses.join(' | '),extra);
            if(p.setoresAviamento.includes('X01'))add('pedido-aviamento',p,'Pendência de aviamento - setor X01',extra);
            if(p.setoresCor.includes('D01'))add('pedido-cor',p,'Pendência de cor - setor D01',extra);
        }
        for(const p of stylists.filter(activeSamples,id)) {
            const key=prog.deliveryKey(p,reference);
            const extra={parts:['FE'],theme:'AMOSTRA',customerProgram:p.customerProgram,daysInSector:p.daysInSector,movementDate:p.movementDate,quantity:p.quantity};
            if(key && key<day)add('amostra-atraso',p,`Entrega ${key.split('-').reverse().join('/')} em atraso`,{...extra,sortDate:key});
            if(!key) {
                const invalid=Boolean(String(p.delivery || '').trim()&&!/^[-—–]+$/.test(p.delivery));
                if(invalid)invalidDeliveries++;
                add('amostra-sem-data',p,invalid?`Data de entrega inválida: ${p.delivery}`:'Sem data de entrega informada',extra);
            }
            if(['01A','01B','1B2'].includes(p.sector)) {
                if(p.daysInSector==null)invalidMovement++;
                else if(p.daysInSector>15)add('amostra-permanencia',p,`${p.sector}: ${p.daysInSector} dias no setor (limite 15)`,extra);
            }
        }
        const consolidated=consolidateStylistItems(items);
        const order=new Map(SECTIONS.map((s,i)=>[s.key,i]));
        consolidated.sort((a,b)=>order.get(a.groupKey)-order.get(b.groupKey)||(a.groupKey==='amostra-atraso'?b.sortDate.localeCompare(a.sortDate):0)||byProduct(a,b));
        return {type:`estilista-${id}`,stylist:id,title:`${stylists.label(id)} - Pendências de pedidos e amostras`,
            grouping:'stylist',sections:SECTIONS,countLabel:'produtos/tema',
            description:'PEDIDO: pendências de estampa, aviamento (X01) e cor (D01) do Raio X. AMOSTRA: entregas vencidas, sem data válida ou mais de 15 dias em 01A/01B/1B2. Um produto pode aparecer em mais de um subtema.',
            warnings:[invalidDeliveries?`${invalidDeliveries} entregas inválidas incluídas em sem data válida.`:'',invalidMovement?`${invalidMovement} amostras sem movimentação válida não foram classificadas por permanência.`:''].filter(Boolean).join(' '),
            uniqueProducts:new Set(consolidated.map(p=>p.codigo.trim().toUpperCase())).size,items:consolidated};
    });
}

function consolidateStylistItems(items) {
    const groups=new Map();
    for(const item of items) {
        const key=JSON.stringify([item.groupKey,String(item.codigo).trim().toUpperCase()]);
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(item);
    }
    return [...groups.values()].map(rows=>{
        const first=rows[0];
        const orders=[...new Set(rows.map(row=>String(row.numero || '').trim()).filter(Boolean))];
        const partRefs=[...new Set(rows.flatMap(row=>(row.parts || []).map(part=>JSON.stringify([String(row.numero || '').trim(),String(part).trim().toUpperCase()]))))];
        const join=field=>[...new Set(rows.map(row=>row[field]).filter(value=>value!==undefined&&value!==null&&value!==''))].join(' | ');
        const forecasts=[...new Map(rows.flatMap(row=>row.forecasts || []).map(entry=>[JSON.stringify(entry),entry])).values()];
        return {...first,consolidated:true,orders,orderCount:orders.length,partCount:partRefs.length,partsKnown:rows.every(row=>row.parts?.length),
            occurrences:rows,forecasts,reason:join('reason'),sector:join('sector'),sectorLabel:join('sectorLabel'),delivery:join('delivery'),
            movementDate:join('movementDate'),daysInSector:rows.some(row=>row.daysInSector!=null)?Math.max(...rows.filter(row=>row.daysInSector!=null).map(row=>row.daysInSector)):null,
            etiqueta:join('etiqueta'),description:join('description'),styleStatus:join('styleStatus'),customerProgram:join('customerProgram'),
            quantity:rows.reduce((total,row)=>total+(Number(row.quantity)||0),0)};
    });
}
module.exports={STYLIST_IDS,SECTIONS,normalizeOrderReportRecords,buildStylistReports,consolidateStylistItems};
