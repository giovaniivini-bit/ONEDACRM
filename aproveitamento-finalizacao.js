(function(root,factory) {
    const api=factory(typeof module==='object'&&module.exports?require('./aproveitamento-dates'):root.CRMAproveitamentoDates);
    if(typeof module==='object'&&module.exports)module.exports=api;
    if(root)root.CRMAproveitamentoFinalizacao=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(dates) {
    const normalizeHeader=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const productKey=value=>String(value??'').trim().toUpperCase();
    const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const STATUS_LABELS={matched:'',missing:'Sem data de finalização',invalid:'Data de finalização inválida',conflict:'Datas divergentes — revisar',unavailable:'Fonte de finalização indisponível'};

    function parseMatrix(matrix) {
        const rows=(matrix || []).filter(row=>row.some(value=>String(value??'').trim()));
        const headers=(rows[0] || []).map(normalizeHeader);
        const codeIndex=headers.findIndex(h=>['produto','codigo','codigoproduto','codigodoproduto','referencia'].includes(h));
        const dateIndex=headers.findIndex(h=>['datafinalizacao','datadefinalizacao','datafinalizacaodaamostra','datadefinalizacaodaamostra'].includes(h));
        if(codeIndex<0 || dateIndex<0)throw new Error('A planilha de finalização precisa das colunas PRODUTO e DATA DE FINALIZAÇÃO DA AMOSTRA.');
        return rows.slice(1).flatMap(row=>{
            const code=productKey(row[codeIndex]);
            if(!code)return [];
            const raw=String(row[dateIndex]??'').trim();
            const date=dates.parse(raw,'dmy');
            return [{PRODUTO:code,DATA_FINALIZACAO:date?iso(date):'',invalidDate:Boolean(raw&&!date)}];
        });
    }

    function join(records,payload) {
        const available=payload?.success===true&&Array.isArray(payload.records);
        const index=new Map();
        if(available)for(const row of payload.records) {
            const key=productKey(row.PRODUTO);
            if(!key)continue;
            if(!index.has(key))index.set(key,{values:new Set(),invalid:false});
            const entry=index.get(key);
            if(row.DATA_FINALIZACAO) {
                const date=/^\d{4}-\d{2}-\d{2}$/.test(row.DATA_FINALIZACAO)&&dates.parse(row.DATA_FINALIZACAO);
                if(date)entry.values.add(iso(date));else entry.invalid=true;
            }
            if(row.invalidDate)entry.invalid=true;
        }
        return (records || []).map(row=>{
            const key=productKey(row.PRODUTO || row.CODIGO || row.IMG_PRODUTO);
            const entry=index.get(key);
            const values=[...(entry?.values || [])].sort();
            const status=!available?'unavailable':values.length>1?'conflict':entry?.invalid?'invalid':values.length===1?'matched':'missing';
            return {...row,CRM_FINALIZACAO:{date:status==='matched'?values[0]:'',status,dates:values}};
        });
    }

    function summarize(records) {
        const counts={matched:0,missing:0,invalid:0,conflict:0,unavailable:0};
        for(const row of records || [])counts[row.CRM_FINALIZACAO?.status || 'missing']++;
        return counts;
    }
    return {parseMatrix,join,summarize,productKey,STATUS_LABELS};
});
