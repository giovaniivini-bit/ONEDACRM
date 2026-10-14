(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CRMMpoFilters = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const people = { joyce:'Joyce', rayza:'Rayza', ana:'Ana', quadro:'Liberação de Quadro', mesa_amostra:'Mesa de Amostra', sem_pendencia:'Sem Pendências' };
    const groups = Object.fromEntries(['joyce','rayza','ana'].flatMap(person => [
        [person+'_terceiros', {person, label:'Terceiros pendentes '+people[person], text:'terceiros pendentes '+person}],
        [person+'_combinacao', {person, label:'Combinação pendente '+people[person], text:'pendente combinacao '+person}]
    ]));
    Object.assign(groups, {
        quadro:{person:'quadro',label:people.quadro,text:'pendente lib quadro'},
        mesa_amostra:{person:'mesa_amostra',label:people.mesa_amostra,text:'pend. mesa amostra'},
        sem_pendencia:{person:'sem_pendencia',label:people.sem_pendencia}
    });
    const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
    function responsibleKeys(summary, item) {
        return Object.keys(people).filter(key => (summary?.por_responsavel?.[key]?.itens || []).some(member => member.key === item.key));
    }
    function matchesGroup(item, group) {
        if (!group) return true;
        const definition = groups[group];
        if (!definition) return false;
        if (group === 'sem_pendencia') return item.tem_pendencia === false && !(item.pendencias || []).length;
        return (item.pendencias || []).some(text => normalize(text) === definition.text);
    }
    function deliveryInfo(value) {
        const raw = String(value ?? '').trim();
        let match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{4}))?$/);
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) match = [raw,iso[3],iso[2],iso[1]];
        if (match) {
            const day=Number(match[1]), month=Number(match[2]), year=match[3] ? Number(match[3]) : null;
            const check = new Date(Date.UTC(year ?? 2000,month-1,day));
            if ((!year || year >= 1000) && check.getUTCDate()===day && check.getUTCMonth()===month-1 && check.getUTCFullYear()===(year ?? 2000)) {
                const dd=String(day).padStart(2,'0'), mm=String(month).padStart(2,'0');
                return {key:`date:${year ?? 'unknown'}-${mm}-${dd}`,label:`${dd}/${mm}${year ? '/'+year : ''}`,order:[0,year ?? 0,month,day]};
            }
        }
        return raw ? {key:'raw:'+raw,label:'Data não reconhecida: '+raw,order:[1,0,0,0]} : {key:'missing',label:'Sem data de entrega',order:[2,0,0,0]};
    }
    function filterItems(summary, {person='',group='',delivery='',search=''} = {}) {
        const query=normalize(search);
        return (summary?.todas_pecas || []).filter(item => {
            const owners=responsibleKeys(summary,item);
            const haystack=[item.ref,item.cliente,item.fase,item.data_entrega,...(item.pendencias || []),...Object.values(item.previsoes || {}),item.obs_gerais,...owners.map(key=>people[key]),...(item.sources || []).map(source=>source.name)].join(' ');
            return (!person || owners.includes(person)) && matchesGroup(item,group) && (!delivery || deliveryInfo(item.data_entrega).key===delivery) && normalize(haystack).includes(query);
        });
    }
    function groupDeliveries(items) {
        const buckets=new Map();
        for (const item of items) {
            const info=deliveryInfo(item.data_entrega);
            if (!buckets.has(info.key)) buckets.set(info.key,{...info,items:[]});
            buckets.get(info.key).items.push(item);
        }
        return [...buckets.values()].sort((a,b) => {
            for (let i=0;i<a.order.length;i++) if(a.order[i]!==b.order[i]) return a.order[i]-b.order[i];
            return a.label.localeCompare(b.label,'pt-BR');
        });
    }
    return {people,groups,normalize,responsibleKeys,matchesGroup,deliveryInfo,filterItems,groupDeliveries};
});
