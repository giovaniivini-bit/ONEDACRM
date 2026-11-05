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
        if(groups.has(key)) {groups.get(key).qtdeOriginal+=quantity;continue;}
        groups.set(key,{
            op,codigo,setor,qtdeOriginal:quantity,
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

function buildStylistReports(orderRecords, sampleProducts, reference, day) {
    const orders=raioX.build(orderRecords);
    const activeSamples=sampleProducts.filter(p=>p.sector!=='01Z'&&p.quantity>0);
    const byProduct=(a,b)=>a.codigo.localeCompare(b.codigo,'pt-BR')||a.numero.localeCompare(b.numero);
    return STYLIST_IDS.map(id=>{
        const items=[];
        let invalidDeliveries=0, invalidMovement=0;
        const add=(key,p,reason,extra={})=>items.push({
            numero:String(p.numero || p.op || ''),codigo:p.codigo,imageCode:p.imageCode || p.codigo,
            sector:p.sector || p.sectors?.join(' / ') || '',sectorLabel:p.sectorLabel || p.descSetor || '',
            delivery:p.delivery || '',etiqueta:p.etiqueta || '',reason,groupKey:key,...extra
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
            const extra={theme:'AMOSTRA',customerProgram:p.customerProgram,daysInSector:p.daysInSector,movementDate:p.movementDate,quantity:p.quantity};
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
        const order=new Map(SECTIONS.map((s,i)=>[s.key,i]));
        items.sort((a,b)=>order.get(a.groupKey)-order.get(b.groupKey)||(a.groupKey==='amostra-atraso'?b.sortDate.localeCompare(a.sortDate):0)||byProduct(a,b));
        return {type:`estilista-${id}`,stylist:id,title:`${stylists.label(id)} - Pendências de pedidos e amostras`,
            grouping:'stylist',sections:SECTIONS,countLabel:'pendências',
            description:'PEDIDO: pendências de estampa, aviamento (X01) e cor (D01) do Raio X. AMOSTRA: entregas vencidas, sem data válida ou mais de 15 dias em 01A/01B/1B2. Um produto pode aparecer em mais de um subtema.',
            warnings:[invalidDeliveries?`${invalidDeliveries} entregas inválidas incluídas em sem data válida.`:'',invalidMovement?`${invalidMovement} amostras sem movimentação válida não foram classificadas por permanência.`:''].filter(Boolean).join(' '),
            uniqueProducts:new Set(items.map(p=>`${p.numero}|${p.codigo}`)).size,items};
    });
}

module.exports={STYLIST_IDS,SECTIONS,normalizeOrderReportRecords,buildStylistReports};
