const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const prog = require('./prog-feira');

function referenceDay(now) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now);
}
function buildReports(records, now = new Date()) {
    const day = referenceDay(now);
    const reference = new Date(`${day}T12:00:00`);
    const rows = prog.normalizeSourceRecords(records);
    const products = prog.buildProducts(rows, reference);
    const byKey = new Map(products.map(p => [p.key, p]));
    const ting = new Map();
    let missingMovement = 0;
    for (const r of rows) {
        const s = prog.normalizeSector(r.OP);
        if (!['M00', 'M02'].includes(s) || Number(r.TIPO) !== 1 || !(Number(String(r.QTDE_PEND).replace(',', '.')) > 0)) continue;
        if (r.PARTE !== 'TF' || r.FLUXO !== 'D43') continue;
        if (!r.NUMERO || !r.CODIGO) continue;
        const date = prog.parseMovementDate(r.DT_SAIDA, reference);
        const age = date && date <= reference ? prog.calculateDaysInSector(r.DT_SAIDA, reference) : null;
        if (age == null) { missingMovement++; continue; }
        const limit = s === 'M00' ? 5 : 7;
        if (age <= limit) continue;
        const key = `${r.NUMERO}|${String(r.CODIGO).toUpperCase()}`;
        const old = ting.get(key);
        const reason = { sector: s, days: age, limit, date: r.DT_SAIDA };
        if (!old) ting.set(key, { product: byKey.get(key) || {
            key, numero: r.NUMERO, codigo: r.CODIGO, imageCode: r.IMG_PRODUTO || r.CODIGO,
            sector: s, sectorLabel: r.SETOR, delivery: r.FICHA, customerProgram: r.COD_CLIENTE,
            etiqueta: r.ETIQUETA, notes: r.OBS, ting: s
        }, reasons: [reason] });
        else {
            const same = old.reasons.find(x => x.sector === s);
            if (!same) old.reasons.push(reason);
            else if (age > same.days) Object.assign(same, reason);
        }
    }
    const item = (p, reason) => ({
        numero: String(p.numero || ''), codigo: String(p.codigo || ''), imageCode: String(p.imageCode || p.codigo || ''),
        sector: String(p.sector || ''), sectorLabel: String(p.sectorLabel || ''), delivery: String(p.delivery || ''),
        customerProgram: String(p.customerProgram || ''), etiqueta: String(p.etiqueta || ''), notes: String(p.notes || ''),
        ting: String(p.ting || ''), reason
    });
    const aging = [...ting.values()].map(({ product, reasons }) => item(product, reasons.map(r => `${r.sector}: ${r.days} dias (limite ${r.limit})`).join(' | ')));
    let missingDelivery = 0;
    const late = [];
    for (const p of products) {
        if (p.sector === '01Z' || !(p.quantity > 0)) continue;
        const date = prog.parseDelivery(p.delivery, reference);
        if (!date) { missingDelivery++; continue; }
        const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        if (dateKey < day) {
            const days = Math.round((Date.UTC(reference.getFullYear(),reference.getMonth(),reference.getDate()) - Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())) / 86400000);
            late.push(item(p, `Entrega ${p.delivery}: ${days} ${days===1?'dia':'dias'} em atraso`));
        }
    }
    const sort = list => list.sort((a,b) => a.codigo.localeCompare(b.codigo, 'pt-BR') || a.numero.localeCompare(b.numero));
    return [
        { type:'tingimento', title:'Permanência em M00 e M02', description:'Produtos com saldo pendente em M00 há mais de 5 dias ou M02 há mais de 7 dias. Dias corridos desde a movimentação no próprio fluxo TF/D43.', warnings: missingMovement ? `${missingMovement} linhas sem data válida de movimentação não foram classificadas.` : '', items:sort(aging) },
        { type:'entregas', title:'Prog Feira - entregas em atraso', description:'Produtos ativos do Prog Feira com entrega anterior à data de referência. Entregas para hoje não são atraso. Datas sem ano seguem a mesma regra do Prog Feira.', warnings: missingDelivery ? `${missingDelivery} produtos sem entrega válida não foram classificados.` : '', items:sort(late) }
    ].map(report => ({ ...report, referenceDay:day }));
}

function createReportStore({ directory, renderPdf, now = () => new Date() }) {
    let running = Promise.resolve();
    const indexPath = path.join(directory, 'index.json');
    const readIndex = () => {
        if (!fs.existsSync(indexPath)) return [];
        const result = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        if (!Array.isArray(result)) throw new Error('Índice de relatórios inválido');
        return result;
    };
    const atomic = (file, value) => { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value)); fs.renameSync(tmp,file); };
    return {
        list: () => readIndex(),
        read(id) {
            if (!/^[a-f0-9]{32}-(tingimento|entregas)$/.test(id)) return null;
            const meta = readIndex().find(r => r.id === id);
            return meta ? { report:JSON.parse(fs.readFileSync(path.join(directory,`${id}.json`),'utf8')), pdf:path.join(directory,`${id}.pdf`) } : null;
        },
        generate(records, sourceTimestamp) {
            const job = async () => {
                if (!Array.isArray(records) || !records.length) throw new Error('Fonte indisponível: relatórios anteriores foram preservados');
                const generatedAt = now();
                const reports = buildReports(records, generatedAt);
                const batch = crypto.randomBytes(16).toString('hex');
                fs.mkdirSync(directory,{recursive:true});
                const metas = [];
                for (const report of reports) {
                    const id = `${batch}-${report.type}`;
                    const snapshot = { ...report, id, generatedAt:generatedAt.toISOString(), sourceTimestamp };
                    const pdf = path.join(directory,`${id}.pdf`);
                    await renderPdf(snapshot, `${pdf}.tmp`);
                    fs.renameSync(`${pdf}.tmp`, pdf);
                    atomic(path.join(directory,`${id}.json`), snapshot);
                    metas.push({ id, type:report.type, title:report.title, referenceDay:report.referenceDay, generatedAt:snapshot.generatedAt, sourceTimestamp, count:report.items.length, warnings:report.warnings });
                }
                atomic(indexPath, [...metas, ...readIndex()]);
                return metas;
            };
            const pending = running.then(job);
            running = pending.catch(() => {});
            return pending;
        }
    };
}
module.exports = { referenceDay, buildReports, createReportStore };
