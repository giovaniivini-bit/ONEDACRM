const REPORT_TIMES=['07:00','13:30'];
function getReportSlot(now=new Date()) {
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
    const value=type=>parts.find(part=>part.type===type).value;
    const time=`${value('hour')}:${value('minute')}`;
    if(!REPORT_TIMES.includes(time))return null;
    const day=`${value('year')}-${value('month')}-${value('day')}`;
    return {key:`${day}T${time}`,day,time,startedAt:now.toISOString()};
}
function requireReportSlot(now=new Date()) {
    const slot=getReportSlot(now);
    if(!slot)throw Object.assign(new Error('Relatórios são gerados somente às 07:00 e 13:30, horário de São Paulo.'),{status:409,code:'REPORT_SCHEDULE_CLOSED'});
    return slot;
}
module.exports={REPORT_TIMES,getReportSlot,requireReportSlot};
