const fs = require('node:fs');
const PDFDocument = require('pdfkit');
const { groupReportItems } = require('./automatic-report-groups');

function planReportPages(report) {
    const width=841.89, height=595.28, bottom=height-24, gap=8, cardHeight=214;
    const cardWidth=(width-48-gap*3)/4;
    const pages=[];
    let page, y;
    const nextPage=()=>{page={cards:[],headings:[]};pages.push(page);y=pages.length===1?93:58;};
    nextPage();
    const heading=(title)=>{
        if(title) {page.headings.push({title,y});y+=22;}
    };
    groupReportItems(report).forEach((group,index)=>{
        if (!group.items.length) return;
        if(index && report.grouping==='delivery') {
            // Preserve a half sheet of whitespace between dates, including
            // whitespace crossing the page boundary (without blank pages).
            y-=gap;
            let space=(bottom-58)/2;
            while(space>bottom-y) {space-=Math.max(0,bottom-y);nextPage();}
            y+=space;
        } else if(index) y+=18;
        if(y+(group.title?22:0)+cardHeight>bottom) nextPage();
        heading(group.title);
        for(let start=0;start<group.items.length;start+=4) {
            if(y+cardHeight>bottom) {nextPage();heading(group.title ? `${group.title} (continuação)` : '');}
            group.items.slice(start,start+4).forEach((item,column)=>page.cards.push({item,x:24+column*(cardWidth+gap),y,width:cardWidth,height:cardHeight}));
            y+=cardHeight+gap;
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
                    try {return await resolveImage(item);} catch (_) {return null;}
                })));
                if(streamError) throw streamError;
            }
            doc.addPage();
            const w=doc.page.width;
            const first=pageNumber===0;
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#122234').text(report.title,24,18,{width:w-48,height:20});
            line(`Referência: ${report.referenceDay.split('-').reverse().join('/')} | Gerado: ${new Date(report.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} | ${report.items.length} ${report.type==='cores'?'pendências':'produtos'} | Folha ${pageNumber+1} de ${pages.length}`,24,38,w-48,8);
            const top=first?93:58;
            if(first) {
                line(report.description,24,51,w-48,8,'#263445',20);
                if(report.warnings) line(report.warnings,24,73,w-48,7,'#a14d00',16);
            }
            if(!report.items.length) { line('Nenhum produto atende aos critérios nesta sincronização.',24,top,w-48,12); continue; }
            for(const section of layout.headings) {
                doc.roundedRect(24,section.y,w-48,18,3).fill('#e0f2fe');
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#075985').text(section.title,30,section.y+3,{width:w-60,height:14});
            }
            layout.cards.forEach(({item,x,y,width:cw,height:ch},i) => {
                const reasonHeight=report.type==='cores'?40:22;
                const imgH=ch-54-reasonHeight;
                doc.roundedRect(x,y,cw,ch,5).fillAndStroke('#ffffff','#cbd5e1');
                if(images[i]) {
                    try { doc.image(images[i],x+3,y+3,{fit:[cw-6,imgH],align:'center',valign:'center'}); }
                    catch (_) { line('Imagem indisponível',x+5,y+imgH/2,cw-10,9,'#64748b'); }
                } else line('Imagem indisponível',x+5,y+imgH/2,cw-10,9,'#64748b');
                const b=y+imgH+5;
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#075985').text(item.codigo,x+5,b,{width:cw-10,height:12,ellipsis:true});
                line(`${item.numero?`OF ${item.numero} | `:''}${item.sector} - ${item.sectorLabel}`,x+5,b+13,cw-10,7,'#334155',18);
                line(`${item.detailLabel || 'Entrega'}: ${item.delivery || 'Não informada'} | ${item.etiqueta || ''}`,x+5,b+31,cw-10,7,'#334155',12);
                doc.roundedRect(x+4,b+44,cw-8,reasonHeight,3).fill('#fff1e6');
                line(item.reason,x+7,b+47,cw-14,7,'#9a3412',reasonHeight-4);
            });
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
