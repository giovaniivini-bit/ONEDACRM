(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMAutomaticReportGroups = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    // Highlight only PP SAMPLE and the nearest date in its sentence, never unrelated dates.
    function getHighlightSegments(value) {
        const text=String(value || ''), ranges=[];
        const phrases=/[^;|.!?\n]+[;|.!?\n]?/g;
        for(const phrase of text.matchAll(phrases)) {
            const samples=[...phrase[0].matchAll(/\bPP\s+SAMPLE\b/gi)];
            const dates=[...phrase[0].matchAll(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g)];
            for(const sample of samples) {
                ranges.push([phrase.index+sample.index,phrase.index+sample.index+sample[0].length]);
                const nearby=dates.map(date=>({date,distance:Math.min(Math.abs(date.index-(sample.index+sample[0].length)),Math.abs(sample.index-(date.index+date[0].length)))})).filter(entry=>entry.distance<=40).sort((a,b)=>a.distance-b.distance)[0];
                if(nearby)ranges.push([phrase.index+nearby.date.index,phrase.index+nearby.date.index+nearby.date[0].length]);
            }
        }
        const segments=[];let start=0,active=false;
        for(let i=0;i<=text.length;i++) {
            const highlighted=i<text.length&&ranges.some(([from,to])=>i>=from&&i<to);
            if(highlighted!==active || i===text.length) {if(i>start)segments.push({text:text.slice(start,i),highlight:active});start=i;active=highlighted;}
        }
        return segments;
    }
    function getComplementLines(item) {
        const entries=item.complements || [], multi=new Set(entries.map(entry=>entry.numero).filter(Boolean)).size>1;
        const values=new Map();
        for(const entry of entries) {
            const key=JSON.stringify([entry.label,entry.value]);
            if(!values.has(key))values.set(key,{...entry,orders:[]});
            const orders=values.get(key).orders;if(entry.numero&&!orders.includes(entry.numero))orders.push(entry.numero);
        }
        return [...values.values()].map(entry=>`${entry.label}${multi?` (OF ${entry.orders.join(', ')})`:''}: ${entry.value}`);
    }
    function formatForecastLine(entry) {
        const label=entry.kind==='sent'?'env. cliente':entry.kind==='forecast'?'prev.':'previsão';
        return `${entry.sector} ${label}: ${entry.value}${entry.name?` | ${entry.name}`:''}`;
    }
    function getReportCardItems(item) {
        if(!item.forecasts?.length)return [item];
        if(item.consolidated) {
            const cards=[];
            for(let start=0;start<item.forecasts.length;start+=20)cards.push({...item,forecasts:item.forecasts.slice(start,start+20),continuation:start>0,forecastPart:start>0?'continuação':''});
            return cards;
        }
        const cards=[];
        for(let start=0;start<item.forecasts.length;start+=4)cards.push({...item,forecasts:item.forecasts.slice(start,start+4),
            forecastPart:item.forecasts.length>4?`${Math.floor(start/4)+1}/${Math.ceil(item.forecasts.length/4)}`:''});
        return cards;
    }
    function groupReportItems(report) {
        if(report.sections) return report.sections.map(section=>({
            key:section.key,title:`${section.theme} / ${section.title}`,
            items:report.items.filter(item=>item.groupKey===section.key)
        }));
        if (report.type === 'malotes') return ['88','83'].map(sector => ({
            key:sector, title:`Setor ${sector} - Malotes`,
            items:report.items.filter(item => String(item.sector).replace(/^0(?=\d{2}$)/,'') === sector)
        }));
        if (!report.grouping) return [{ key:'all', title:'', items:report.items }];
        const groups = new Map();
        for (const item of report.items) {
            const key = item.groupKey || 'other';
            if (!groups.has(key)) groups.set(key, { key, title:item.groupLabel || key, items:[] });
            groups.get(key).items.push(item);
        }
        return [...groups.values()];
    }
    function formatProductSummary(item) {
        if(!item.consolidated)return item.numero?`OF ${item.numero}`:'';
        return `${item.orderCount} OF(s) • ${item.partsKnown?item.partCount+' parte(s)':item.partCount?item.partCount+' parte(s) identificada(s)':'Partes não informadas'}`;
    }
    function getReportCardHeight(item) { return item.consolidated?248+Math.max(0,(item.forecasts?.length || 0)-4)*9:248; }
    return { getHighlightSegments,getComplementLines,groupReportItems, formatForecastLine, getReportCardItems,formatProductSummary,getReportCardHeight };
});
