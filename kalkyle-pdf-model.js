import {calculate} from './kalkyle-engine.js?v=20261007-arbeidstimer';
import {rowCodes} from './kalkyle-codes.js?v=20261009-festemidler';
import {materialList} from './kalkyle-materials.js?v=20261009-festemidler';
import {materialQuantityMissing} from './kalkyle-accessories.js?v=20261009-festemidler';

export const documentProfileKey='rigor-document-profile-v1';
const clean=(value,max=300)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max);
export const documentDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function validateDocumentProfile(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Avsenderopplysningene kunne ikke leses.');
 const profile={version:1};
 for(const key of ['company','organization','address','contact','email','phone'])profile[key]=clean(value[key]);
 if(value.logo){
  const logo=value.logo;
  if(typeof logo.data!=='string'||logo.data.length>550000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(logo.data)||!Number.isInteger(logo.width)||!Number.isInteger(logo.height)||logo.width<1||logo.height<1||logo.width>1200||logo.height>1200)throw Error('Den lagrede logoen er ugyldig. Last opp logoen på nytt.');
  profile.logo={data:logo.data,width:logo.width,height:logo.height};
 }
 return profile;
}
const ore=value=>Math.round(value*100);
export function preparePdfDocument({rows,rates,project,profile,options={},brief='',area=1,priceMode='market',offers=[],bindings={}}){
 if(!project?.id)throw Error('Åpne eller opprett et prosjekt før du eksporterer PDF.');
 const selected=rows?.filter(r=>r.enabled)||[];
 if(!selected.length)throw Error('Kalkylen er tom. Legg til oppgavene som skal inngå.');
 if(selected.length>500||selected.some(r=>['quantity','material','materialQuantity','hours','factor'].some(k=>!Number.isFinite(r[k])||r[k]<0)||r.priceIssue||r.requiresTime||r.requiresQuantity&&r.quantity===0||materialQuantityMissing(r)))throw Error('Avklar manglende priser, mengder og grunntider før PDF-eksport.');
 if(!rates||['wage','direct','indirect','billing','laborMarkup','materialMarkup'].some(k=>!Number.isFinite(rates[k])||rates[k]<0)||rates.billing<=0||rates.billing>100)throw Error('Kontroller timepris og påslag før PDF-eksport.');
 const sender=validateDocumentProfile(profile),type=options.type==='calculation'?'calculation':'offer';
 if(type==='offer'&&priceMode==='example'&&selected.some(r=>r.priceKey&&!r.manualPrice))throw Error('Velg markedspriser eller registrer leverandørpriser før du lager et kundetilbud. Eksempelpriser kan eksporteres som beregning.');
 const customer=clean(options.customer??project.customer),address=clean(options.address??project.address),number=clean(options.number??project.number,50);
 if(type==='offer'&&(!sender.company||!customer))throw Error('Oppgi bedriftens navn og kunde for et ferdig tilbud.');
 const date=options.date||documentDate(),validUntil=options.validUntil||'';
 if(!validDate(date)||validUntil&&(!validDate(validUntil)||validUntil<date))throw Error('Kontroller dokumentdato og gyldighetsdato.');
 const calculation=calculate(selected,rates,Number.isFinite(area)&&area>0?area:1);
 if(['cost','price','hours','profit','vat','gross','hourly'].some(k=>!Number.isFinite(calculation[k])))throw Error('Beregningen inneholder ugyldige beløp.');
 const items=calculation.items.map(r=>({...r,name:clean(r.name),elementName:clean(r.elementName||r.name),category:clean(r.category),codes:rowCodes(r),priceOre:ore(r.price),laborOre:ore(r.laborPrice),materialOre:ore(r.materialPrice),costOre:ore(r.cost)}));
 const groups=[];
 for(const item of items){const key=item.elementId||item.id;let group=groups.find(g=>g.key===key);if(!group){group={key,title:item.elementName,items:[]};groups.push(group);}group.items.push(item);}
 const totals={price:ore(calculation.price),vat:ore(calculation.vat),gross:ore(calculation.gross),cost:ore(calculation.cost),profit:ore(calculation.profit),hours:calculation.hours,hourly:calculation.hourly,labor:ore(items.reduce((sum,r)=>sum+r.laborPrice,0)),material:ore(items.reduce((sum,r)=>sum+r.materialPrice,0))};
 totals.rowRounding=totals.price-items.reduce((sum,r)=>sum+r.priceOre,0);
 totals.vatRounding=totals.gross-totals.price-totals.vat;
 const title=type==='offer'?'Tilbud':'Beregning';
 const safeName=clean(project.name,80).replace(/[^\p{L}\p{N}._-]+/gu,'-').replace(/^-+|-+$/g,'')||'prosjekt';
 const materials=materialList(selected,{offers,bindings,priceMode}).map(material=>Object.fromEntries(Object.entries(material).map(([key,value])=>[key,typeof value==='string'?clean(value):value])));
 return {type,title,priceMode,filename:(type==='offer'?'tilbud-':'beregning-')+safeName+'.pdf',project:{name:clean(project.name),customer,address,number},profile:sender,date,validUntil,scope:clean(options.scope??brief,8000),terms:clean(options.terms,6000),items,groups,materials,rates:{...rates},totals};
}
