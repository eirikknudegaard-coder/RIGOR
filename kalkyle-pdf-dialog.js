import {documentProfileKey,documentDate,validateDocumentProfile,preparePdfDocument} from './kalkyle-pdf-model.js?v=20261009-festemidler';
const $=id=>document.getElementById(id);
const profileFields=['company','organization','address','contact','email','phone'];
export async function normalizeLogo(file){
 if(!file||file.size>5*1024*1024)throw Error('Velg en PNG-, JPG- eller WebP-logo på maksimalt 5 MB.');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!png&&!jpeg&&!webp)throw Error('Logoen må være en PNG-, JPG- eller WebP-bildefil.');
 let image;try{image=await createImageBitmap(file);}catch{throw Error('Bildefilen kunne ikke leses. Velg en annen logo.');}
 try{
  if(image.width*image.height>16000000)throw Error('Logoen er for stor. Bruk et bilde med høyst 16 millioner piksler.');
  let limit=1000;
  while(limit>=250){
   const scale=Math.min(1,limit/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
   canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/png');
   if(data.length<=550000)return {data,width:canvas.width,height:canvas.height};
   limit=Math.floor(limit*.75);
  }
  throw Error('Logoen tar for stor plass. Bruk en enklere eller mindre bildefil.');
 }finally{image.close();}
}
export function setupPdfExport({storage,getData,saveProjectDetails}){
 let profile=validateDocumentProfile(),logo,busy=false,logoPending=false,logoTicket=0;
 function readProfile(){try{profile=validateDocumentProfile(JSON.parse(storage.getItem(documentProfileKey)||'{}'));}catch(error){profile=validateDocumentProfile();$('pdf-status').textContent=error.message;}logo=profile.logo;}
 function draftProfile(){return validateDocumentProfile({...Object.fromEntries(profileFields.map(k=>[k,$('pdf-'+k).value])),logo});}
 function options(){return {type:$('pdf-type').value,customer:$('pdf-customer').value,address:$('pdf-project-address').value,number:$('pdf-number').value,date:$('pdf-date').value,validUntil:$('pdf-valid-until').value,scope:$('pdf-scope').value,terms:$('pdf-terms').value};}
 function logoPreview(){const img=$('pdf-logo-preview');img.hidden=!logo;if(logo)img.src=logo.data;else img.removeAttribute('src');$('pdf-logo-placeholder').hidden=Boolean(logo);$('pdf-logo-remove').hidden=!logo;}
 function refresh(){
  if(busy||logoPending){$('pdf-download').disabled=true;return;}
  try{const model=preparePdfDocument({...getData(),profile:draftProfile(),options:options()});$('pdf-download').disabled=false;$('pdf-validation').textContent='Komplett grunnlag · '+model.items.length+' poster · '+new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK'}).format(model.totals.gross/100)+' inkl. MVA';}
  catch(error){$('pdf-download').disabled=true;$('pdf-validation').textContent=error.message;}
  $('pdf-valid-until-label').hidden=$('pdf-type').value!=='offer';
  $('pdf-mode-help').textContent=$('pdf-type').value==='offer'?'Kundetilbudet viser arbeidsoppgaver, materialliste, enhetspriser og totalsum. Interne kostnader og fortjeneste vises bare i beregningen.':'Beregningen viser arbeidstimer, materialliste med produkter og kjøpsmengder, grunntider, materialkostnader, kilder, koder og påslag.';
 }
 function open(){
  if(!getData().project?.id)return;
  $('pdf-status').textContent='';readProfile();logoTicket++;logoPending=false;$('pdf-profile-save').disabled=false;
  const data=getData(),saved=data.project.pdfOptions||{};
  for(const key of profileFields)$('pdf-'+key).value=profile[key];
  $('pdf-type').value=saved.type||'offer';$('pdf-customer').value=data.project.customer||'';$('pdf-project-address').value=data.project.address||'';$('pdf-number').value=data.project.number||'';
  $('pdf-date').value=documentDate();$('pdf-valid-until').value=saved.validUntil||'';$('pdf-scope').value=saved.scope??data.brief??'';$('pdf-terms').value=saved.terms||'';
  $('pdf-logo-file').value='';logoPreview();refresh();$('pdf-dialog').showModal();$('pdf-type').focus();
 }
 for(const id of ['export-pdf','project-pdf'])$(id).onclick=open;
 $('pdf-cancel').onclick=()=>{if(!busy){logoTicket++;$('pdf-dialog').close();}};
 $('pdf-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();else logoTicket++;});
 $('pdf-form').addEventListener('input',refresh);$('pdf-form').addEventListener('change',refresh);
 $('pdf-logo-file').onchange=async()=>{
  const file=$('pdf-logo-file').files[0];if(!file)return;const ticket=++logoTicket;
  logoPending=true;$('pdf-status').textContent='Behandler logoen …';$('pdf-download').disabled=true;$('pdf-profile-save').disabled=true;
  try{const normalized=await normalizeLogo(file);if(ticket!==logoTicket)return;logo=normalized;logoPreview();$('pdf-status').textContent='Logoen er klar. Lagre avsenderen eller last ned PDF for å beholde den.';}
  catch(error){if(ticket===logoTicket)$('pdf-status').textContent=error.message;}
  finally{if(ticket===logoTicket){logoPending=false;$('pdf-profile-save').disabled=false;refresh();}}
 };
 $('pdf-logo-remove').onclick=()=>{logoTicket++;logoPending=false;$('pdf-profile-save').disabled=false;logo=null;logoPreview();$('pdf-status').textContent='Logoen fjernes når du lagrer avsenderen eller laster ned PDF.';refresh();};
 $('pdf-profile-save').onclick=()=>{
  try{profile=draftProfile();storage.setItem(documentProfileKey,JSON.stringify(profile));$('pdf-status').textContent='Avsender og logo er lagret for din konto i denne nettleseren.';}
  catch(error){$('pdf-status').textContent='Avsenderen kunne ikke lagres. '+error.message;}
 };
 $('pdf-form').onsubmit=async event=>{
  event.preventDefault();if(busy||logoPending)return;
  const ticket=logoTicket;
  try{
   const chosenOptions=options(),model=preparePdfDocument({...getData(),profile:draftProfile(),options:chosenOptions});
   busy=true;for(const input of $('pdf-form').querySelectorAll('input,select,textarea,button'))input.disabled=true;
   $('pdf-status').textContent='Lager PDF …';
   const {generatePdf}=await import('./kalkyle-pdf.js?v=20261009-festemidler');const pdf=await generatePdf(model);
   if(ticket!==logoTicket||!$('pdf-dialog').open)return;
   let saved=true;profile=model.profile;
   try{storage.setItem(documentProfileKey,JSON.stringify(profile));}catch{saved=false;}
   try{if(!saveProjectDetails({...model.project,pdfOptions:chosenOptions}))saved=false;}catch{saved=false;}
   pdf.save(model.filename);$('pdf-status').textContent=saved?'PDF-en er lastet ned. Kontroller dokumentet før du sender det til kunden.':'PDF-en er lastet ned, men opplysningene kunne ikke lagres i nettleseren. Tidligere lagrede data er beholdt.';
  }catch(error){$('pdf-status').textContent=error.message||'PDF-en kunne ikke lages. Prøv igjen.';}
  finally{busy=false;for(const input of $('pdf-form').querySelectorAll('input,select,textarea,button'))input.disabled=false;refresh();}
 };
}
