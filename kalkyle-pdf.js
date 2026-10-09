const bronze=[128,93,65],ink=[37,40,43],muted=[93,97,102];
const number=value=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(value).replace(/\u00a0|\u202f/g,' ');
const money=ore=>new Intl.NumberFormat('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(ore/100).replace(/\u00a0|\u202f/g,' ')+' kr';
const displayDate=value=>value.split('-').reverse().join('.');
let dependencies;
async function loadDependencies(){
 if(!dependencies)dependencies=(async()=>{
  await import('./vendor/pdf/jspdf.umd.min.js');
  const font=async file=>{const response=await fetch(new URL('./vendor/pdf/'+file,import.meta.url));if(!response.ok)throw Error('PDF-skriften kunne ikke lastes. Prøv igjen.');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
  const [regular,bold]=await Promise.all([font('DejaVuSans.ttf'),font('DejaVuSans-Bold.ttf')]);
  return {jsPDF:globalThis.jspdf.jsPDF,regular,bold};
 })().catch(error=>{dependencies=null;throw error;});
 return dependencies;
}
export async function generatePdf(model){
 const {jsPDF,regular,bold}=await loadDependencies();
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
 pdf.addFileToVFS('DejaVuSans.ttf',regular);pdf.addFont('DejaVuSans.ttf','Document','normal');
 pdf.addFileToVFS('DejaVuSans-Bold.ttf',bold);pdf.addFont('DejaVuSans-Bold.ttf','Document','bold');
 pdf.setProperties({title:model.title+' - '+model.project.name,author:model.profile.company,subject:model.type==='offer'?'Kundetilbud':'Kalkyle og beregningsgrunnlag',creator:'RIGOR kalkyleverksted'});
 const left=16,right=194,width=right-left,bottom=274;let y;
 function text(value,x,at,{size=9,bold=false,color=ink,align='left'}={}){pdf.setFont('Document',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(String(value).replace(/\u00a0|\u202f/g,' '),x,at,{align});}
 function lines(value,w,size=9){pdf.setFont('Document','normal');pdf.setFontSize(size);return pdf.splitTextToSize(String(value).replace(/\u00a0|\u202f/g,' '),w);}
 function header(compact=false){
  const p=model.profile;
  const companyLines=lines(p.company||'Beregning',110,compact?12:17);
  const shown=compact?companyLines.slice(0,2):companyLines;
  shown.forEach((line,i)=>text(line,left,22+i*(compact?5:7),{size:compact?12:17,bold:true}));
  const contact=[p.organization?'Org.nr. '+p.organization:'',p.address,p.contact,[p.email,p.phone].filter(Boolean).join(' · ')].filter(Boolean);
  let cy=22+shown.length*(compact?5:7)+2;
  if(!compact){for(const line of lines(contact.join('\n'),117,8)){text(line,left,cy,{size:8,color:muted});cy+=4;}}
  if(p.logo){const limitWidth=compact?34:48,limitHeight=compact?18:27,scale=Math.min(limitWidth/p.logo.width,limitHeight/p.logo.height),w=p.logo.width*scale,h=p.logo.height*scale;pdf.addImage(p.logo.data,'PNG',right-w,15,w,h,undefined,'FAST');}
  const rule=Math.max(compact?37:57,cy+3);
  pdf.setDrawColor(...bronze);pdf.setLineWidth(.7);pdf.line(left,rule,right,rule);
  y=rule+(compact?8:13);text(model.title,left,y,{size:compact?12:22,bold:true});
  if(compact){text(model.project.number?'Nr. '+model.project.number:displayDate(model.date),right,y,{size:8,color:muted,align:'right'});y+=9;}else y+=11;
 }
 function ensure(height,repeat){if(y+height>bottom){pdf.addPage();header(true);if(repeat)repeat();}}
 function paragraph(value,{size=9,color=ink,spacing=4.5}={}){for(const line of lines(value,width,size)){ensure(spacing);text(line,left,y,{size,color});y+=spacing;}y+=3;}
 function heading(value){const wrapped=lines(value,width-4,11);ensure(wrapped.length*5+7);y+=3;for(const line of wrapped){text(line,left,y,{size:11,bold:true,color:bronze});y+=5;}y+=2;}
 function keyValue(label,value,{bold=false}={}){ensure(7);text(label,left,y,{bold});text(value,right,y,{bold,align:'right'});y+=6.5;}
 header();
 const metaLeft=['KUNDE',model.project.customer||'Ikke oppgitt',model.project.address].filter(Boolean);
 const metaRight=[model.project.number?'Dokumentnr. '+model.project.number:'','Dato: '+displayDate(model.date),model.type==='offer'&&model.validUntil?'Gyldig til: '+displayDate(model.validUntil):''].filter(Boolean);
 const a=lines(metaLeft.join('\n'),102),b=lines(metaRight.join('\n'),66);const top=y;
 a.forEach((line,i)=>text(line,left,top+i*4.5,{size:9,bold:i===0}));b.forEach((line,i)=>text(line,right,top+i*4.5,{size:9,align:'right',color:muted}));y+=Math.max(a.length,b.length)*4.5+7;
 heading(model.project.name);
 if(model.scope)paragraph(model.scope);
 if(model.type==='offer'){
  paragraph('Tilbudet omfatter postene nedenfor. Alle postpriser er ekskl. MVA.',{size:8,color:muted});
  const columns=[{name:'Post',x:left,w:75},{name:'Mengde',x:105,w:15,align:'right'},{name:'Enhet',x:109,w:12},{name:'Pris/enhet',x:158,w:34,align:'right'},{name:'Sum',x:right,w:33,align:'right'}];
  function tableHeader(){pdf.setFillColor(244,240,234);pdf.rect(left,y-4,width,9,'F');for(const c of columns)text(c.name,c.x,y,{size:8,bold:true,color:muted,align:c.align});y+=9;}
  tableHeader();
  for(const group of model.groups){
   const gl=lines(group.title,width-8,9);ensure(gl.length*4.5+18,tableHeader);
   pdf.setFillColor(241,233,223);pdf.rect(left,y-4,width,gl.length*4.5+5,'F');gl.forEach((line,i)=>text(line,left+3,y+i*4.5,{size:9,bold:true,color:bronze}));y+=gl.length*4.5+7;
   for(const item of group.items){
    const title=lines(item.name,75,8.5),code=lines('Salgskode: '+item.codes.sale,75,6.5),h=title.length*4.5+code.length*3.5+5;
    ensure(h,tableHeader);const rowY=y;
    title.forEach((line,i)=>text(line,left,rowY+i*4.5,{size:8.5}));code.forEach((line,i)=>text(line,left,rowY+title.length*4.5+i*3.5,{size:6.5,color:muted}));
    text(number(item.quantity),105,rowY,{size:8,align:'right'});text(item.unit,109,rowY,{size:8});text(item.quantity>0?money(Math.round(item.price/item.quantity*100)):'-',158,rowY,{size:8,align:'right'});text(money(item.priceOre),right,rowY,{size:8,bold:true,align:'right'});
    y+=h;pdf.setDrawColor(230,225,218);pdf.setLineWidth(.2);pdf.line(left,y-3,right,y-3);
   }
  }
  if(model.totals.rowRounding)keyValue('Avrundingsjustering av postsummer',money(model.totals.rowRounding));
 }else{
  heading('Satser og beregningsgrunnlag');
  paragraph('Prisgrunnlag: '+({market:'Kontrollerte markedspriser og eventuelle registrerte leverandørpriser',import:'Importert prisliste',example:'Eksempelpriser - ikke dokumenterte markedspriser'}[model.priceMode]||model.priceMode),{size:8,color:muted});
  for(const [label,value] of [['Grunnlønn',money(Math.round(model.rates.wage*100))+'/time'],['Direkte kostnader',number(model.rates.direct)+' %'],['Indirekte kostnader',number(model.rates.indirect)+' %'],['Faktureringsgrad',number(model.rates.billing)+' %'],['Timekostnad',money(Math.round(model.totals.hourly*100))],['Arbeidspåslag',number(model.rates.laborMarkup)+' %'],['Timepris til kunde',money(Math.round(model.totals.hourly*(1+model.rates.laborMarkup/100)*100))],['Materialpåslag',number(model.rates.materialMarkup)+' %']])keyValue(label,value);
  paragraph('Arbeidstimer = arbeidsmengde × grunntid × tidsfaktor. Arbeidspris og materialpris nedenfor inkluderer sine respektive påslag.',{size:8,color:muted});
  for(const group of model.groups){
   heading(group.title);
   for(const item of group.items){
    ensure(35);paragraph(item.name,{size:10});
    paragraph('Arbeidskode: '+item.codes.work+' · Innkjøpskode: '+item.codes.purchase+' · Salgskode: '+item.codes.sale+(item.codes.salary?' · Lønnsart: '+item.codes.salary:''),{size:7,color:muted,spacing:3.5});
    paragraph('Arbeid: '+number(item.quantity)+' '+item.unit+' × '+number(item.hours)+' t/'+item.unit+' × faktor '+number(item.factor)+' = '+number(item.workHours)+' timer. Arbeidspris: '+money(item.laborOre),{size:8});
    paragraph('Materiell: '+number(item.materialQuantity)+' '+(item.materialUnit||item.unit)+' × '+money(Math.round(item.material*100))+'/'+(item.materialUnit||item.unit)+'. Innkjøpskostnad: '+money(Math.round((item.marketMaterialCost??item.materialQuantity*item.material)*100))+'. Materialpris med påslag: '+money(item.materialOre),{size:8});
    if(item.marketPackages!==undefined)paragraph('Innkjøp: '+number(item.marketPackages)+' pakninger / '+number(item.marketPurchasedQuantity)+' '+item.materialUnit+'. Pakningsavrunding inngår i materialkostnaden.',{size:8,color:muted});
    paragraph('Priskilde: '+(item.priceSource||'Ingen materialkostnad')+(item.priceDate?' · '+item.priceDate:''),{size:7,color:muted,spacing:3.5});
    paragraph('Grunntid: '+(item.timeSource||'Registrert i prosjektet')+(item.timeEstimate?' (foreløpig)':'')+(item.timeNote?' · '+item.timeNote:''),{size:7,color:muted,spacing:3.5});
    keyValue('Postsum ekskl. MVA',money(item.priceOre),{bold:true});y+=3;
   }
  }
 }
 if(model.materials?.length){
  heading('Materialliste');
  paragraph('Materialene inngår i postprisene ovenfor og kommer ikke i tillegg til totalsummen. Behov er beregnet forbruk; kjøpsmengde tar med dokumentert pakningsavrunding. Frakt er ikke inkludert.',{size:8,color:muted});
  function materialHeader(){pdf.setFillColor(244,240,234);pdf.rect(left,y-4,width,9,'F');text('Materiale / produkt',left,y,{size:8,bold:true});text('Behov',146,y,{size:8,bold:true,align:'right'});text('Kjøpsmengde',right,y,{size:8,bold:true,align:'right'});y+=9;}
  ensure(18);materialHeader();
  for(const material of model.materials){
   const product=lines(material.name,108,8.5),details=['Til: '+material.task];
   if(material.needsProduct)details.push('Materialtype – konkret produkt er ikke valgt');
   if(model.type==='calculation'&&material.supplierSku)details.push('Varenummer: '+material.supplierSku+(material.supplier?' · '+material.supplier:''));
   const description=lines(details.join('\n'),108,7),purchase=lines(number(material.purchaseQuantity)+' '+material.unit+(material.packages!==null?'\n'+number(material.packages)+' '+material.packageUnit:''),43,8);
   const height=Math.max(product.length*4.5+description.length*3.5,purchase.length*4)+7;
   ensure(height,materialHeader);const start=y;
   product.forEach((line,i)=>text(line,left,start+i*4.5,{size:8.5,bold:true}));description.forEach((line,i)=>text(line,left,start+product.length*4.5+i*3.5,{size:7,color:muted}));
   text(number(material.quantity)+' '+material.unit,146,start,{size:8,align:'right'});purchase.forEach((line,i)=>text(line,right,start+i*4,{size:8,align:'right'}));
   y+=height;pdf.setDrawColor(230,225,218);pdf.setLineWidth(.2);pdf.line(left,y-3,right,y-3);
  }
 }
 ensure(model.type==='offer'?38:76);heading('Sammendrag');
 if(model.type==='calculation'){
  keyValue('Beregnet arbeidstid',number(model.totals.hours)+' timer');
  keyValue('Arbeidspris med påslag',money(model.totals.labor));keyValue('Materialpris med påslag',money(model.totals.material));
  keyValue('Kostnad før påslag',money(model.totals.cost));keyValue('Kalkulert fortjeneste',money(model.totals.profit));
 }
 keyValue('Sum ekskl. MVA',money(model.totals.price),{bold:true});keyValue('MVA (25 %)',money(model.totals.vat));
 if(model.totals.vatRounding)keyValue('Øreavrunding',money(model.totals.vatRounding));
 ensure(14);pdf.setFillColor(...bronze);pdf.rect(left,y-4,width,11,'F');text('Totalt inkl. MVA',left+3,y+2,{bold:true,size:11,color:[255,255,255]});text(money(model.totals.gross),right-3,y+2,{bold:true,size:11,color:[255,255,255],align:'right'});y+=17;
 if(model.terms){heading('Forutsetninger og avgrensninger');paragraph(model.terms);}
 if(model.type==='offer')paragraph('Enhetsprisene er avrundet. Postsummer beregnes med uavrundede satser.',{size:7,color:muted});
 const pages=pdf.getNumberOfPages();for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setDrawColor(225,219,212);pdf.setLineWidth(.2);pdf.line(left,282,right,282);text((model.profile.company||model.project.name).slice(0,65),left,287,{size:7,color:muted});text('Side '+page+' av '+pages,right,287,{size:7,color:muted,align:'right'});}
 return pdf;
}
