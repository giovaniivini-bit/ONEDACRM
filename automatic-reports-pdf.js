const fs = require('node:fs');
const PDFDocument = require('pdfkit');

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
        for (let start=0; start<Math.max(1,report.items.length); start+=8) {
            if(streamError) throw streamError;
            const pageItems=report.items.slice(start,start+8);
            const images=[];
            for(let i=0;i<pageItems.length;i+=4) {
                images.push(...await Promise.all(pageItems.slice(i,i+4).map(async item=>{
                    try {return await resolveImage(item);} catch (_) {return null;}
                })));
                if(streamError) throw streamError;
            }
            doc.addPage();
            const w=doc.page.width, h=doc.page.height;
            const first=start===0;
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#122234').text(report.title,24,18,{width:w-48,height:20});
            line(`Referência: ${report.referenceDay.split('-').reverse().join('/')} | Gerado: ${new Date(report.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} | ${report.items.length} produtos | Folha ${Math.floor(start/8)+1}`,24,38,w-48,8);
            const top=first?93:58;
            if(first) {
                line(report.description,24,51,w-48,8,'#263445',20);
                if(report.warnings) line(report.warnings,24,73,w-48,7,'#a14d00',16);
            }
            if(!report.items.length) { line('Nenhum produto atende aos critérios nesta sincronização.',24,top,w-48,12); continue; }
            const gap=8, cw=(w-48-gap*3)/4, ch=(h-top-24-gap)/2;
            pageItems.forEach((item,i) => {
                const x=24+(i%4)*(cw+gap),y=top+Math.floor(i/4)*(ch+gap), imgH=ch-76;
                doc.roundedRect(x,y,cw,ch,5).fillAndStroke('#ffffff','#cbd5e1');
                if(images[i]) {
                    try { doc.image(images[i],x+3,y+3,{fit:[cw-6,imgH],align:'center',valign:'center'}); }
                    catch (_) { line('Imagem indisponível',x+5,y+imgH/2,cw-10,9,'#64748b'); }
                } else line('Imagem indisponível',x+5,y+imgH/2,cw-10,9,'#64748b');
                const b=y+imgH+5;
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#075985').text(item.codigo,x+5,b,{width:cw-10,height:12,ellipsis:true});
                line(`OF ${item.numero} | ${item.sector} - ${item.sectorLabel}`,x+5,b+13,cw-10,7,'#334155',18);
                line(`Entrega: ${item.delivery || 'Não informada'} | ${item.etiqueta || ''}`,x+5,b+31,cw-10,7,'#334155',12);
                doc.roundedRect(x+4,b+44,cw-8,22,3).fill('#fff1e6');
                line(item.reason,x+7,b+47,cw-14,7,'#9a3412',18);
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
module.exports={createPdfRenderer};
