const fs = require('node:fs');
const PDFDocument = require('pdfkit');
const { groupReportItems,formatForecastLine,getReportCardItems,formatProductSummary,getReportCardHeight } = require('./automatic-report-groups');

function planReportPages(report) {
    const width=841.89, height=595.28, bottom=height-24, gap=8, cardHeight=214;
    const cardWidth=(width-48-gap*3)/4;
    if (report.type === 'malotes') {
        const groups=groupReportItems(report);
        const count=Math.max(1,...groups.map(group=>Math.ceil(group.items.length/4)));
        return Array.from({length:count},(_,number)=>{
            const top=number===0?77:58, split=height/2;
            const halfCardHeight=Math.min(cardHeight,split-top-22-8);
            const page={cards:[],headings:[],emptyTexts:[]};
            groups.forEach((group,index)=>{
                const y=index===0?top:split+8;
                page.headings.push({title:`${group.title} (${group.items.length} produtos)${number?' - continuação':''}`,y});
                const items=group.items.slice(number*4,number*4+4);
                if(!items.length)page.emptyTexts.push({text:'Sem malotes deste setor nesta folha.',y:y+30});
                items.forEach((item,column)=>page.cards.push({item,x:24+column*(cardWidth+gap),y:y+22,width:cardWidth,height:halfCardHeight}));
            });
            return page;
        });
    }
    const pages=[];
    let page, y;
    const nextPage=()=>{page={cards:[],headings:[]};pages.push(page);y=pages.length===1?93:58;};
    nextPage();
    const heading=(title)=>{
        if(title) {page.headings.push({title,y});y+=22;}
    };
    groupReportItems(report).forEach((group,index)=>{
        if(index && report.sections && report.items.length) {
            // Each theme starts at the top of its own sheet.
            nextPage();
        }
        if (!group.items.length) {
            if(report.sections) {
                if(y+50>bottom)nextPage();
                heading(group.title);
                (page.emptyTexts ||= []).push({text:'Nenhuma pendência neste subtema.',y});
                y+=28;
            }
            return;
        }
        if(index && report.grouping==='delivery') {
            // Preserve a half sheet of whitespace between dates, including
            // whitespace crossing the page boundary (without blank pages).
            y-=gap;
            let space=(bottom-58)/2;
            while(space>bottom-y) {space-=Math.max(0,bottom-y);nextPage();}
            y+=space;
        } else if(index && !report.sections) y+=18;
        if(y+(group.title?22:0)+cardHeight>bottom) nextPage();
        heading(group.title);
        const cards=group.items.flatMap(getReportCardItems);
        for(let start=0;start<cards.length;start+=4) {
            const row=cards.slice(start,start+4), rowHeight=Math.max(...row.map(getReportCardHeight));
            if(y+rowHeight>bottom) {nextPage();heading(group.title ? `${group.title} (continuação)` : '');}
            row.forEach((item,column)=>page.cards.push({item,x:24+column*(cardWidth+gap),y,width:cardWidth,height:rowHeight}));
            y+=rowHeight+gap;
        }
    });
    return pages;
}

function createPdfRenderer(resolveImage) {
    return async (report, target) => {
        const doc = new PDFDocument({ size:'A4', layout:'landscape', margin:24, autoFirstPage:false, info:{ Title:report.title, Author:'Oneda CRM' } });
        const output = fs.createWriteStream(target);
        let streamError;
        const done = new Promise((resolve,reject) => {
            output.on('finish',resolve);
            const fail=error=>{streamError=error;reject(error);};
            output.on('error',fail); doc.on('error',fail);
        });
        // Attach immediately: file errors may occur while an image request is pending.
        done.catch(()=>{});
        doc.pipe(output);
        const line = (text,x,y,width,size=8,color='#263445',height=24) => {
            doc.font('Helvetica').fontSize(size).fillColor(color).text(String(text || ''),x,y,{width,height,ellipsis:true,lineGap:0});
        };
        try {
        const pages=planReportPages(report);
        for (const [pageNumber,layout] of pages.entries()) {
            if(streamError) throw streamError;
            const pageItems=layout.cards.map(card=>card.item);
            const images=[];
            for(let i=0;i<pageItems.length;i+=4) {
                images.push(...await Promise.all(pageItems.slice(i,i+4).map(async item=>{
                    try {return item.continuation?null:await resolveImage(item);} catch (_) {return null;}
                })));
                if(streamError) throw streamError;
            }
            doc.addPage();
            const w=doc.page.width;
            const first=pageNumber===0;
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#122234').text(report.title,24,18,{width:w-48,height:20});
            line(`Referência: ${report.referenceDay.split('-').reverse().join('/')} | Gerado: ${new Date(report.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} | ${report.items.length} ${report.countLabel || (report.type==='cores'?'pendências':'produtos')}${report.stylist?` | ${report.uniqueProducts} ${report.items.some(item=>item.consolidated)?'produtos únicos':'produtos/OFs'}`:''} | ${report.items.some(item=>item.consolidated)?'Cards - ':''}Folha ${pageNumber+1} de ${pages.length}`,24,38,w-48,8);
            const top=first?93:58;
            if(first) {
                line(report.description,24,51,w-48,8,'#263445',20);
                if(report.warnings) line(report.warnings,24,73,w-48,7,'#a14d00',16);
            }
            if(!report.items.length && report.type!=='malotes'&&!report.sections) { line('Nenhum produto atende aos critérios nesta sincronização.',24,top,w-48,12); continue; }
            for(const section of layout.headings) {
                doc.roundedRect(24,section.y,w-48,18,3).fill('#e0f2fe');
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#075985').text(section.title,30,section.y+3,{width:w-60,height:14});
            }
            for(const empty of layout.emptyTexts || []) line(empty.text,30,empty.y,w-60,10,'#64748b');
            layout.cards.forEach(({item,x,y,width:cw,height:ch},i) => {
                const hasForecasts=Boolean(report.stylist&&item.forecasts?.length);
                const reasonHeight=report.type==='cores'?40:22;
                const extraHeight=report.stylist?28:0;
                const imgH=item.consolidated?110:ch-54-reasonHeight-extraHeight;
                doc.roundedRect(x,y,cw,ch,5).fillAndStroke('#ffffff','#cbd5e1');
                if(images[i]) {
                    try { doc.image(images[i],x+3,y+3,{fit:[cw-6,imgH-(hasForecasts?4:0)],align:'center',valign:'center'}); }
                    catch (_) { line('Imagem indisponível',x+5,y+imgH/2,cw-10,9,'#64748b'); }
                } else line(item.continuation?'Detalhes — continuação':'Imagem indisponível',x+5,y+imgH/2,cw-10,9,'#64748b');
                const b=y+imgH+(hasForecasts?1:5);
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#075985').text(item.codigo,x+5,b,{width:cw-10,height:12,ellipsis:true});
                if(hasForecasts) {
                    const sectors=item.theme==='PEDIDO'?item.sectorLabel.replace(/:\s*(\d+)\s*dias?/g,' $1d').replace(/\s*\|\s*/g,' / '):`${item.sector} - ${item.sectorLabel}`;
                    line(`${formatProductSummary(item)} | ${sectors}${item.forecastPart?` | Prev. ${item.forecastPart}`:''}`,x+5,b+12,cw-10,7,'#334155',9);
                    line(`${item.detailLabel || 'Entrega'}: ${item.delivery || 'Não informada'} | ${item.etiqueta || ''}`,x+5,b+21,cw-10,7,'#334155',9);
                    line(item.theme==='PEDIDO'?`${item.description || ''} | ${item.quantity} peças`:`Prog.: ${item.customerProgram || '—'} | ${item.quantity} peças | ${item.consolidated?'até ':''}${item.daysInSector ?? '—'} dias no setor`,x+5,b+30,cw-10,7,'#334155',9);
                    line(item.theme==='PEDIDO'?`Status: ${item.styleStatus || 'Não informado'}`:`Mov.: ${item.movementDate || 'Não informada'}`,x+5,b+39,cw-10,7,'#334155',9);
                    doc.roundedRect(x+4,b+48,cw-8,18,3).fill('#fff1e6');
                    line(item.reason,x+7,b+49,cw-14,7,'#9a3412',17);
                    item.forecasts.forEach((entry,n)=>line(formatForecastLine(entry),x+5,b+66+n*9,cw-10,7,'#075985',9));
                    return;
                }
                line(`${formatProductSummary(item)?`${formatProductSummary(item)} | `:''}${item.sector} - ${item.sectorLabel}`,x+5,b+13,cw-10,7,'#334155',18);
                line(`${item.detailLabel || 'Entrega'}: ${item.delivery || 'Não informada'} | ${item.etiqueta || ''}`,x+5,b+31,cw-10,7,'#334155',12);
                if(report.stylist) {
                    line(item.theme==='PEDIDO'?`${item.description || ''} | ${item.quantity || 0} peças`:`Prog.: ${item.customerProgram || '—'} | ${item.quantity} peças | ${item.consolidated?'até ':''}${item.daysInSector ?? '—'} dias no setor`,x+5,b+44,cw-10,7,'#334155',12);
                    line(item.theme==='PEDIDO'?`Status: ${item.styleStatus || 'Não informado'}`:`Movimentação: ${item.movementDate || 'Não informada'}`,x+5,b+57,cw-10,7,'#334155',12);
                }
                doc.roundedRect(x+4,b+44+extraHeight,cw-8,reasonHeight,3).fill('#fff1e6');
                line(item.reason,x+7,b+47+extraHeight,cw-14,7,'#9a3412',reasonHeight-4);
            });
        }
        if(report.items.some(item=>item.consolidated&&(item.occurrences.length>1||item.forecasts.length>4))) {
            doc.addPage();
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#122234').text('Detalhamento de OFs e partes',24,24,{width:doc.page.width-48});
            doc.moveDown(.5);
            doc.font('Helvetica').fontSize(8).text('As fotos e os totais estão nos cards por produto. Abaixo, os vínculos originais de cada tema, sem repetir imagens.');
            for(const group of groupReportItems(report)) {
                if(!group.items.some(item=>item.consolidated&&(item.occurrences.length>1||item.forecasts.length>4)))continue;
                doc.moveDown();
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#075985').text(group.title,{width:doc.page.width-48});
                for(const item of group.items) {
                    if(!item.consolidated || (item.occurrences.length<=1&&item.forecasts.length<=4))continue;
                    doc.moveDown(.5);
                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#122234').text(`${item.codigo} — ${formatProductSummary(item)}`,{width:doc.page.width-48});
                    doc.font('Helvetica').fontSize(8).fillColor('#334155');
                    for(const row of item.occurrences) {
                        const details=[`OF ${row.numero || 'Não informada'}`,`Partes: ${row.parts?.join(', ') || 'Não informadas'}`,
                            `Setor: ${row.sector} (${row.sectorLabel || ''})`,row.reason,
                            `${row.detailLabel || 'Entrega'}: ${row.delivery || 'Não informada'}`,row.etiqueta?`Etiqueta: ${row.etiqueta}`:'',
                            row.description,row.styleStatus?`Status: ${row.styleStatus}`:'',row.quantity!=null?`${row.quantity} peças`:'',
                            row.movementDate?`Mov.: ${row.movementDate}`:'',row.daysInSector!=null?`${row.daysInSector} dias no setor`:''
                        ].filter(Boolean).join(' | ');
                        doc.text(details,{width:doc.page.width-48,lineGap:2});
                    }
                    for(const forecast of item.forecasts || [])doc.text(formatForecastLine(forecast),{width:doc.page.width-48,lineGap:2});
                }
            }
        }
        doc.end();
        await done;
        } catch(error) {
            doc.destroy(); output.destroy();
            throw error;
        }
    };
}
module.exports={createPdfRenderer,planReportPages};
