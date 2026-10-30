(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CRMCostura = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const PEOPLE = ['Jô', 'Cleide', 'Josi'];
    const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const nameOf = value => PEOPLE.find(name => norm(name) === norm(value));
    const sum = values => values.reduce((a,b) => a+b, 0);
    const cell = (rows, r, c) => rows[r]?.[c] ?? '';
    function number(value) {
        if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
        const text = String(value ?? '').trim();
        if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
        const n = Number(text.replace(',', '.'));
        return Number.isFinite(n) && n >= 0 ? n : null;
    }
    function todayKey(now = new Date()) {
        const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
        const get = type => parts.find(p => p.type === type).value;
        return `${get('year')}-${get('month')}-${get('day')}`;
    }
    function dateParts(value) {
        const match = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
        return match ? {day:Number(match[1]),month:Number(match[2]),year:match[3] ? Number(match[3].length === 2 ? '20'+match[3] : match[3]) : null} : null;
    }
    function dateKey(parts, year) {
        const y = parts.year || year;
        const date = new Date(Date.UTC(y, parts.month-1, parts.day));
        if (date.getUTCFullYear() !== y || date.getUTCMonth() !== parts.month-1 || date.getUTCDate() !== parts.day) return null;
        return date.toISOString().slice(0,10);
    }
    const addDays = (key, days) => new Date(Date.parse(key+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);

    function buildWeeks(rows, now = new Date()) {
        if (!Array.isArray(rows) || !rows.length) return [];
        const columns = [...new Set(rows.flatMap(row => (row || []).flatMap((value,c) => nameOf(value) ? [c] : [])))].sort((a,b) => a-b);
        const width = Math.max(...rows.map(row => row?.length || 0));
        const weeks = [];
        let previousStart = null;
        const today = todayKey(now);
        for (let k=0;k<columns.length;k++) {
            const c = columns[k], limit = columns[k+1] ?? width;
            const persons = PEOPLE.map(name => ({name,row:rows.findIndex(row => nameOf(row?.[c]) === name)})).filter(p => p.row >= 0);
            if (!persons.length) continue;
            const firstPerson = Math.min(...persons.map(p => p.row));
            let header = null;
            for (let r=0;r<firstPerson;r++) {
                const dates = [];
                for (let d=c+1;d<limit;d++) {
                    const parsed = dateParts(cell(rows,r,d));
                    if (parsed) dates.push({column:d,...parsed});
                }
                if (dates.length >= 3) header = dates;
            }
            if (!header) continue;
            let year = Number((previousStart || today).slice(0,4));
            if (!header[0].year) {
                const cycle = rows.map(row=>norm(row?.[c]).match(/^CQS SEMANA\s+(\d{4})$/)).find(Boolean);
                if (cycle) {
                    year = 2000+Number(cycle[1].slice(0,2));
                    if (header[0].month>=11 && Number(cycle[1].slice(2))<=10) year--;
                } else if (previousStart && header[0].month - Number(previousStart.slice(5,7)) > 6) year--;
                if (!cycle && !previousStart) {
                    const candidates = [year-1,year,year+1].map(y=>dateKey(header[0],y)).filter(Boolean);
                    candidates.sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(today))-Math.abs(Date.parse(b)-Date.parse(today)));
                    if (candidates[0]) year = Number(candidates[0].slice(0,4));
                }
            }
            let dayYear = year, previousMonth = header[0].month;
            const dates = header.map(d => {
                if (d.month < previousMonth && previousMonth-d.month > 6) dayYear++;
                previousMonth = d.month;
                return dateKey(d,dayYear);
            });
            const validDates = dates.length === 5 && dates.every((d,i)=>d && d === addDays(dates[0],i)) && new Date(dates[0]+'T12:00:00Z').getUTCDay() === 1;
            const issues = [];
            if (!validDates) issues.push('Datas não formam uma semana de segunda a sexta.');
            if (!dates[0] || !dates[dates.length-1]) continue;
            const people = persons.map(person => {
                const activities = [];
                let totalRow = -1;
                for (let r=person.row+1;r<rows.length;r++) {
                    const label = String(cell(rows,r,c)).trim();
                    if (norm(label) === 'TOTAL') { totalRow=r;break; }
                    if (nameOf(label) || norm(label).startsWith('QUANTIDADE DE AMOSTRAS')) break;
                    if (!label || /^[.\s]+$/.test(label)) continue;
                    const raw = header.map(d=>number(cell(rows,r,d.column)));
                    activities.push({label,values:raw.map(n=>n ?? 0),total:sum(raw.map(n=>n ?? 0)),hasEntries:raw.some(n=>n !== null)});
                }
                const values = header.map((d,i)=>sum(activities.map(a=>a.values[i])));
                if (totalRow >= 0 && header.some((d,i)=>number(cell(rows,totalRow,d.column)) !== null && number(cell(rows,totalRow,d.column)) !== values[i])) issues.push(`Total diário de ${person.name} diverge das atividades.`);
                return {name:person.name,values,total:sum(values),activities};
            });
            if (people.length !== PEOPLE.length) issues.push('Há costureira sem bloco de produção nesta semana.');
            const metaRow = rows.findIndex(row=>norm(row?.[c]).startsWith('QUANTIDADE DE AMOSTRAS DA SEMANA'));
            const targets = [];
            if (metaRow >= 0) {
                for (let r=metaRow+1;r<Math.min(rows.length,metaRow+25);r++) {
                    const label = String(cell(rows,r,c)).trim();
                    if (norm(cell(rows,r,c+2)).includes('MEDIA') || norm(label).startsWith('TOTAL')) break;
                    if (!label || /^[.\s]+$/.test(label)) continue;
                    targets.push({label,value:number(cell(rows,r,c+1))});
                }
            }
            const targetValues = targets.map(t=>t.value).filter(v=>v !== null);
            const target = targetValues.length ? sum(targetValues) : null;
            const values = header.map((d,i)=>sum(people.map(p=>p.values[i])));
            const total = sum(values);
            const id = `${dates[0]}-c${c}`;
            weeks.push({id,column:c,start:dates[0],end:dates[dates.length-1],dates,people,values,total,target,targets,issues,validDates,duplicate:false});
            previousStart = dates[0];
        }
        const seen = new Set();
        for (const week of weeks) {
            const key = `${week.start}/${week.end}`;
            if (seen.has(key)) { week.duplicate=true;week.issues.push('Datas repetidas: bloco mais à esquerda usado nas métricas.'); }
            seen.add(key);
        }
        return weeks;
    }

    function summarize(week, today = todayKey()) {
        if (!week) return null;
        const days = week.dates.length;
        const elapsed = week.dates.filter(d=>d<=today).length;
        const remainingDays = week.dates.filter(d=>d>=today).length;
        const attainment = week.target > 0 ? week.total*100/week.target : null;
        return {...week,days,elapsed,remainingDays,attainment,
            average:days ? week.total/days : null,
            dailyTarget:week.target !== null && days ? week.target/days : null,
            remaining:week.target === null ? null : Math.max(0,week.target-week.total),
            excess:week.target === null ? null : Math.max(0,week.total-week.target),
            status:week.target === null ? 'Meta não informada' : week.target === 0 ? 'Sem meta prevista' : week.total >= week.target ? 'Meta atingida' : week.end < today ? 'Meta não atingida' : 'Meta ainda não atingida',
            people:week.people.map(p=>({...p,average:days ? p.total/days : null,share:week.total ? p.total*100/week.total : 0}))};
    }

    function dashboard(weeks, now = new Date()) {
        const today = todayKey(now);
        const valid = (weeks || []).filter(w=>w.validDates && !w.duplicate).sort((a,b)=>b.start.localeCompare(a.start));
        const current = valid.find(w=>w.start<=today && addDays(w.start,6)>=today) || null;
        const latest = valid.find(w=>w.start<=today) || null;
        const closed = valid.filter(w=>w.end<today && w.id !== current?.id);
        const previous = current ? closed[0] : null;
        const closedTotal = sum(closed.map(w=>w.total));
        const withTarget = closed.filter(w=>w.target>0);
        return {today,current:summarize(current,today),latest:summarize(latest,today),previous:summarize(previous,today),
            history:(weeks || []).map(w=>summarize(w,today)).sort((a,b)=>b.start.localeCompare(a.start)||a.column-b.column),
            closed,closedTotal,closedAverage:closed.length ? closedTotal/closed.length : null,
            best:closed.reduce((best,w)=>!best || w.total>best.total ? w : best,null),
            targetWeeks:withTarget.length,metWeeks:withTarget.filter(w=>w.total>=w.target).length,
            people:PEOPLE.map(name=>{
                const available=closed.filter(w=>w.people.some(p=>p.name===name));
                const totals=available.map(w=>w.people.find(p=>p.name===name).total);
                const total=sum(totals),days=sum(available.map(w=>w.dates.length));
                return {name,total,weeks:available.length,average:available.length ? total/available.length : null,dailyAverage:days ? total/days : null,best:totals.length ? Math.max(...totals) : null,share:closedTotal ? total*100/closedTotal : 0};
            })};
    }
    return {PEOPLE,number,todayKey,buildWeeks,summarize,dashboard};
});
