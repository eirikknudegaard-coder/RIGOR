import {calculate,roofGeometry,timeFactor} from './kalkyle-engine.js?v=20261007-arbeidstimer';
import {instantiate} from './kalkyle-library.js?v=20261008-ai-modes';
import {applyPrices} from './kalkyle-prices.js?v=20261009-qa';
import {applyTimeCatalog} from './kalkyle-time.js?v=20261008-ai-modes';
import {uniqueAssistantRows} from './kalkyle-task-overlap.js?v=20261007-overlapp';
import {annotateAiMaterial,matchesAiMaterial} from './kalkyle-ai-material.js?v=20261009-qa';
import {applyDetailedMaterialPrices} from './kalkyle-market-reference.js?v=20261009-qa';
import {roofConsumption} from './kalkyle-engine.js?v=20261007-arbeidstimer';
import {conversionSettings} from './kalkyle-mode-transition.js?v=20261009-qa';
export const EXPERIENCE_TYPES=['complete','material','hours','allowance'];
export const EXPERIENCE_SOURCES=['manual_experience','historical_job','completed_project','public_source','market_data'];
export function validateExperienceRate(rate,library,today=new Date().toISOString().slice(0,10)){
 const e=library.find(e=>e.id===rate?.elementId);
 if(!e||!Array.isArray(rate.taskIds)||!rate.taskIds.length||new Set(rate.taskIds).size!==rate.taskIds.length||rate.taskIds.some(id=>!e.tasks.some(t=>t.id===id)))throw Error('Velg ekte bibliotekoppgaver for erfaringstallet.');
 if(!EXPERIENCE_TYPES.includes(rate.type)||!EXPERIENCE_SOURCES.includes(rate.sourceType)||rate.unit!==e.unit)throw Error('Kontroller type, kildekategori og enhet.');
 if(![rate.min,rate.max].every(n=>Number.isFinite(n)&&n>=0&&n<=1e7)||rate.min>rate.max||rate.type==='hours'&&rate.max>10000)throw Error('Oppgi et gyldig intervall. Tall skal komme fra eget eller dokumentert grunnlag.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(rate.date)||!Number.isFinite(Date.parse(rate.date))||new Date(rate.date).toISOString().slice(0,10)!==rate.date||rate.date>today)throw Error('Oppgi en gyldig kildedato, ikke i fremtiden.');
 if(typeof rate.source!=='string'||!rate.source.trim()||rate.source.length>300||!['low','medium','high'].includes(rate.confidence))throw Error('Oppgi kilde og sikkerhet for erfaringstallet.');
 if(['region','notes','specification'].some(k=>rate[k]!==undefined&&(typeof rate[k]!=='string'||rate[k].length>500)))throw Error('Kildemerknaden er for lang.');
 return {id:String(rate.id||crypto.randomUUID()).slice(0,100),elementId:e.id,taskIds:[...rate.taskIds],type:rate.type,unit:rate.unit,min:rate.min,max:rate.max,sourceType:rate.sourceType,source:rate.source.trim(),date:rate.date,region:rate.region||'',confidence:rate.confidence,notes:rate.notes||'',specification:rate.specification||''};
}
const noMarkup=rates=>({...rates,laborMarkup:0,materialMarkup:0});
const costRow=(quantity,material,hours=0,factor=1)=>({enabled:true,quantity,materialQuantity:quantity,material,hours,factor});
// No percentage interval is invented: min/max come from supplied source data.
// The current engine computes wages, markup, package costs and VAT at every level.
export function buildSimpleEstimate({proposal,context,library,rates,settings,priceMode,prices=[],timeCatalog=[],existingRows=[],offers=[],bindings={}}){
 existingRows=existingRows.filter(row=>!row.wizardGenerated||row.userEdited);
 if(!rates||!['wage','direct','indirect','billing','laborMarkup','materialMarkup'].every(k=>Number.isFinite(rates[k])&&rates[k]>=0)||rates.billing<=0||rates.billing>100)throw Error('Kontroller prosjektets timepris og påslag.');
 const sources=[],uncertainties=[],items=[];let low=0,high=0,hoursLow=0,hoursHigh=0,materialLow=0,materialHigh=0,otherLow=0,otherHigh=0;
 const budgetSettings=conversionSettings(settings,context);
 const occupied=new Set();
 const records=(context.priceBasis?.experienceRates||[]).map(rate=>validateExperienceRate(rate,library));
 for(const item of proposal.items.filter(i=>i.scope!=='optional').sort((a,b)=>Number(a.scope!=='requested')-Number(b.scope!=='requested'))){
  const element=library.find(e=>e.id===item.elementId);if(!element)throw Error('Ukjent bibliotekpost.');
  let quantity=item.quantity;
  if(quantity===null||quantity===undefined){quantity=element.unit==='m²'&&context.facts.domain!=='mixed'?context.facts.area:null;
   if(element.unit==='m²'&&context.facts.domain==='roof'&&context.measurements.basis==='footprint')quantity=context.measurements.angle!==null&&context.measurements.roofType!=='mansard'?roofGeometry({...settings,...context.measurements}).area:null;
  }
  const subset={...element,tasks:element.tasks.filter(t=>item.taskIds.includes(t.id)&&!existingRows.some(r=>r.taskKey===element.id+'.'+t.id&&!r.enabled))};
  const savedScope=existingRows.filter(r=>subset.tasks.some(t=>r.taskKey===element.id+'.'+t.id));
  if(savedScope.length===subset.tasks.length&&new Set(savedScope.map(r=>r.quantity)).size===1)quantity=savedScope[0].quantity;
  const base=instantiate(subset,quantity??0,timeFactor(element,budgetSettings),item.taskIds,'-budget');
  const unique=uniqueAssistantRows(base,[...occupied].map(taskKey=>({taskKey,unit:element.unit})));
  unique.rows.forEach(r=>occupied.add(r.taskKey));if(!unique.rows.length)continue;
  const actualTaskIds=unique.rows.map(r=>r.taskKey.slice(element.id.length+1));
  const matches=records.filter(r=>r.elementId===element.id&&r.taskIds.length===actualTaskIds.length&&r.taskIds.every(id=>actualTaskIds.includes(id)));
  const record=type=>matches.find(r=>r.type===type);
  let totalLow=0,totalHigh=0,workLow=0,workHigh=0,matLow=0,matHigh=0,other=0,complete=quantity!==null&&quantity>0;
  const missing=[];
  if(!complete)missing.push('Mengde mangler');
  else if(record('complete')){
   const r=record('complete');totalLow=calculate([costRow(quantity,r.min)],noMarkup(rates),1).price;totalHigh=calculate([costRow(quantity,r.max)],noMarkup(rates),1).price;
   sources.push(r);missing.push('Fordeling mellom arbeid og materiell er ikke dokumentert i komplett erfaringspris');
   if(record('hours')){const hr=record('hours');workLow=quantity*hr.min;workHigh=quantity*hr.max;sources.push(hr);}
  }else{
   const old=existingRows.filter(r=>unique.rows.some(candidate=>candidate.taskKey===r.taskKey));
   let detail=applyTimeCatalog(unique.rows,timeCatalog).map(row=>{const saved=old.find(r=>r.taskKey===row.taskKey);return saved?{...saved}:row;});
   if(detail.some(r=>['quantity','materialQuantity','material','hours','factor'].some(k=>!Number.isFinite(r[k])||r[k]<0)))throw Error('Kontroller manuelle mengder, priser og grunntider før budsjettet beregnes.');
   detail=applyDetailedMaterialPrices(detail.map(r=>roofConsumption(annotateAiMaterial(r,context.facts,offers),budgetSettings)),{mode:priceMode==='example'?'market':priceMode,importedPrices:priceMode==='import'?prices:[],marketPrices:priceMode==='market'?prices:[],offers,bindings,detailed:true});
   if(priceMode==='market')detail=detail.map(r=>{const offer=offers.find(o=>o.id===bindings[r.priceKey]);return !r.manualPrice&&r.aiSpecification&&offer&&!matchesAiMaterial(r,offer)?{...r,material:0,marketMaterialCost:undefined,priceIssue:'Valgt vare passer ikke oppgitt spesifikasjon'}:r;});
   const hr=record('hours');
   if(hr){workLow=quantity*hr.min;workHigh=quantity*hr.max;sources.push(hr);}
   else{
    const timed=detail.filter(r=>!r.requiresTime);const time=calculate(timed.map(r=>({...r,material:0,marketMaterialCost:0})),rates,1);workLow=workHigh=time.hours;
    sources.push(...timed.map(r=>({type:'hours',source:r.timeSource,date:'',confidence:r.timeEstimate?'low':'medium',notes:r.timeNote||''})));
    if(timed.length!==detail.length){complete=false;missing.push('Grunntid mangler');}
   }
   const mr=record('material');
   if(mr){matLow=quantity*mr.min;matHigh=quantity*mr.max;sources.push(mr);}
   else{
    const priced=detail.filter(r=>!r.priceIssue);
    matLow=matHigh=priced.reduce((sum,r)=>sum+(r.marketMaterialCost??r.materialQuantity*r.material),0);
    sources.push(...priced.filter(r=>r.priceKey).map(r=>({type:'material',source:r.priceSource,date:r.priceDate,confidence:'medium'})));
    if(priced.length!==detail.length){complete=false;missing.push('Materialgrunnlag mangler');}
   }
   const allowance=record('allowance');
   const subtotal=(work,material,extra)=>calculate([costRow(1,material+extra,work)],rates,1).price;
   totalLow=subtotal(workLow,matLow,allowance?.min||0);totalHigh=subtotal(workHigh,matHigh,allowance?.max||0);
   if(allowance){sources.push(allowance);otherLow+=allowance.min;otherHigh+=allowance.max;other=allowance.max;}
  }
  low+=totalLow;high+=totalHigh;hoursLow+=workLow;hoursHigh+=workHigh;materialLow+=matLow;materialHigh+=matHigh;
  if(!complete)uncertainties.push(element.name+': '+missing.join(', '));
  if(savedScope.length)missing.push('Eksisterende oppgaver bruker sine lagrede mengder, priser og grunntider');
  items.push({elementId:element.id,name:element.name,quantity,unit:element.unit,priceMin:totalLow,priceMax:totalHigh,hoursMin:workLow,hoursMax:workHigh,materialMin:matLow,materialMax:matHigh,other,complete,notes:missing});
 }
 const total=value=>calculate([costRow(1,value)],noMarkup(rates),1);
 const a=total(low),b=total(high),complete=items.length>0&&items.every(i=>i.complete);
 return {status:complete?'budget':'partial',items,hours:{min:hoursLow,max:hoursHigh},material:{min:materialLow,max:materialHigh},other:{min:otherLow,max:otherHigh},price:{min:a.price,max:b.price},gross:{min:a.gross,max:b.gross},sources,assumptions:context.assumptions,uncertainties:[...context.uncertainties,...uncertainties],confidence:sources.some(s=>s.confidence==='low')||!complete?'low':'medium'};
}
