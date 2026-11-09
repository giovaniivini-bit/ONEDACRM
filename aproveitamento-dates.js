(function(root,factory) {
    const api=factory();
    if(typeof module==='object'&&module.exports)module.exports=api;
    if(root)root.CRMAproveitamentoDates=api;
})(typeof globalThis!=='undefined'?globalThis:this,function() {
    // Commercial export: M/D/YYYY. Finalization sheet: D/M/YYYY.
    // Native date inputs use YYYY-MM-DD; the source determines the order.
    // Validate calendar components so 8/31 never rolls into month 31.
    function parse(value,order='mdy') {
        const raw=String(value??'').trim();
        const us=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if(!us&&!iso)return null;
        const year=Number(us?us[3]:iso[1]),month=Number(us?us[order==='dmy'?2:1]:iso[2]),day=Number(us?us[order==='dmy'?1:2]:iso[3]);
        const date=new Date(year,month-1,day);
        return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?date:null;
    }
    function format(value) {
        const date=parse(value);
        return date?`${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`:'Não informada';
    }
    return {parse,format};
});
