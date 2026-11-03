(function(root,factory) {
    const api=factory();
    if(typeof module==='object'&&module.exports) module.exports=api;
    if(root) root.CRMProductStylist=api;
})(typeof globalThis!=='undefined'?globalThis:this,function() {
    'use strict';
    const OPTIONS=[['camila','Camila'],['ketlyn','Ketlyn'],['joyce','Joyce'],['thamires','Thamires'],['none','Sem estilista']];
    const RULES=[
        ['camila',/^01\.(?:11|12|14|16)(?:\.|$)/],
        ['joyce',/^(?:02\.1\d|05|13\.1\d)(?:\.|$)/],
        ['thamires',/^(?:01\.(?:17|18|19|20)|03\.01|15)(?:\.|$)/],
        ['ketlyn',/^01\.(?:13|15)(?:\.|$)/]
    ];
    function classify(code) {
        const value=String(code??'').trim();
        return RULES.find(([,pattern])=>pattern.test(value))?.[0]||'none';
    }
    function filter(products,selected='all') {
        return (products||[]).filter(product=>selected==='all'||classify(product.codigo)===selected);
    }
    const label=value=>OPTIONS.find(([id])=>id===value)?.[1]||'Todos';
    return {OPTIONS,classify,filter,label};
});
