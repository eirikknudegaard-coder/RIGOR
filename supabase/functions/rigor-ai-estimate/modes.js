import {extractMeasurements,clarificationQuestions,validateProposal} from './proposal.js';
import {cleanTerraceQuestions} from './terrace-questions.js';
import {knowledgeFor} from './knowledge/index.js';
export const AI_MODES=['simple_estimator','detailed_copilot'];
export function requireMode(mode){if(!AI_MODES.includes(mode))throw Error('Ukjent AI-modus.');return mode;}
const last=(text,re)=>[...text.matchAll(re)].at(-1)?.[1]||null;
export function createEstimateContext(brief,{questionsAnswered=[],experienceRates=[],scope=[]}={}){
 if(typeof brief!=='string'||brief.length>8000)throw Error('Ugyldig beskrivelse.');
 if(!Array.isArray(questionsAnswered)||questionsAnswered.length>30||questionsAnswered.some(a=>!a||typeof a.id!=='string'||a.id.length>100||typeof a.answer!=='string'||a.answer.length>500))throw Error('Ugyldige avklaringer.');
 if(!Array.isArray(experienceRates)||experienceRates.length>100)throw Error('Maks 100 erfaringstall per prosjekt.');
 const text=brief.toLocaleLowerCase('nb'),modules=knowledgeFor(brief),measurements=extractMeasurements(brief);
 const wallArea=last(text,/(?:^|\n)kledningsareal:\s*(\d+(?:[.,]\d+)?)\s*m[²2]/g);
 if(wallArea&&modules.length===1&&modules[0].id==='exterior_wall')measurements.area=Number(wallArea.replace(',','.'));
 const n=value=>value===null?null:Number(value.replace(',','.'));
 const length=n(last(text,/(\d+(?:[.,]\d+)?)\s*(?:meter|m)\s+(?:terrasse)?rekkverk\b/g)||last(text,/(?:rekkverk(?:slengde)?|lengde rekkverk):?\s*(\d+(?:[.,]\d+)?)\s*(?:meter|m)\b/g));
 const dimension=last(text,/(\d{2,3}\s*[x×]\s*\d{2,3})\s*(?:mm)?\s*(?:(?:trykk)?impregnert[e]?\s+)?terrassebord/g)||last(text,/terrassebord(?:dimensjon)?:?\s*(\d{2,3}\s*[x×]\s*\d{2,3})/g);
 const joists=/bjelkelag[^.\n]*(?:behold|bevares)|(?:behold|bevare)[^.\n]*bjelkelag/.test(text)?'retain':/bjelkelag[^.\n]*(?:skift|bytt|rives|nytt)|(?:skift|bytt|rive|nytt)[^.\n]*bjelkelag|komplett (?:ny|utskift)/.test(text)?'replace':null;
 const access=/normal (?:tilkomst|adkomst)|bakkenivå|i bakkenivå|lav terrasse|terrassehøyde:\s*(?:i bakkenivå|lav)/.test(text)?'normal':/krevende (?:tilkomst|adkomst)|høy terrasse|terrassehøyde:\s*høy/.test(text)?'difficult':null;
 const facts={domain:modules.length===1?modules[0].id:modules.length?'mixed':'other',area:measurements.area,railingLength:length,deckDimension:dimension,joists,access,claddingDirection:/kledningsretning:\s*stående|stående (?:\w+\s+){0,2}kledning|vertikal/.test(text)?'vertical':/kledningsretning:\s*liggende|liggende (?:\w+\s+){0,2}kledning|horisontal.*kledning/.test(text)?'horizontal':null,
  insulationThickness:n(last(text,/(\d{2,3})\s*mm\s*(?:\w+\s+){0,2}(?:isolasjon|trefiber|hunton)/g)),insulationMaterial:/hunton|trefiber/.test(text)?'trefiber':/mineralull|glassull|steinull/.test(text)?'mineralull':null,insulationBrand:/hunton/.test(text)?'Hunton':null,
  battenDimension:last(text,/(\d{2,3}\s*[x×]\s*\d{2,3})\s*(?:mm)?\s*(?:utlekting|lekting|lekter)/g),claddingProfile:/dobbelfals/.test(text)?'Dobbelfals':/enkelfals/.test(text)?'Enkelfals':null,deckTreatment:/impregnert[^.\n]*terrassebord|terrassebord[^.\n]*impregnert/.test(text)?'impregnert':null};
 facts.claddingTreatment=/grunnet[^.\n]*kledning|kledning[^.\n]*grunnet/.test(text)?'grunnet':null;
 facts.claddingDimension=last(text,/(\d{2,3}\s*[x×]\s*\d{2,3})\s*(?:mm)?\s*(?:[\wæøå]+\s+){0,3}kledning/g);
 const scopeKeys=['elementId','taskIds','quantity','unit','origin','reason','scope'];
 if(!Array.isArray(scope)||scope.length>30||scope.some(item=>!item||Object.keys(item).some(k=>!scopeKeys.includes(k))||typeof item.elementId!=='string'||item.elementId.length>100||!Array.isArray(item.taskIds)||!item.taskIds.length||item.taskIds.length>100||item.taskIds.some(id=>typeof id!=='string'||id.length>100)||!['m²','m','stk','rs'].includes(item.unit)||item.reason!==undefined&&(typeof item.reason!=='string'||item.reason.length>500)||item.scope!==undefined&&!['requested','related','optional'].includes(item.scope)||item.origin!==undefined&&!['ai_suggestion','user'].includes(item.origin)||item.quantity!==null&&(!Number.isFinite(item.quantity)||item.quantity<0||item.quantity>1000000)))throw Error('Ugyldig tidligere arbeidsomfang.');
 return {version:1,brief,facts,measurements,scope:structuredClone(scope),questionsAnswered:questionsAnswered.map(a=>({id:a.id,answer:a.answer})),
  assumptions:modules.flatMap(m=>m.assumptions).filter(a=>!(facts.access&&/tilkomst/.test(a))&&!(measurements.basis&&/arealgrunnlag/.test(a))),
  priceBasis:{experienceRates:[...experienceRates]},uncertainties:modules.flatMap(m=>m.cautions),suggestions:[],knowledge:modules.map(m=>m.id)};
}
export function questionPlan(context,mode,labels=[]){
 requireMode(mode);const {brief,facts,measurements,questionsAnswered}=context,text=brief.toLocaleLowerCase('nb');const questions=[];
 const add=(id,label,type,extra,priority='CRITICAL')=>questions.push({id,label,type,...extra,priority});
 const number=(id,label,prefix,unit,min=.01,max=100000)=>add(id,label,'number',{prefix,unit,min,max});
 const choice=(id,label,prefix,options,priority)=>add(id,label,'select',{prefix,options},priority);
 if(facts.domain==='terrace'){
  if(facts.area===null)number('terrace-area','Hvor stort areal gjelder terrassen? (m²)','Terrasseareal','m²');
  const onlyDemolition=/bare riving|kun riving|kun rive/.test(text)||/\brive|\briving/.test(text)&&!/\b(ny|nye|bygge|montere|skifte|bytte|utskift)/.test(text);
  if(!onlyDemolition&&facts.joists===null)choice('terrace-joists','Skal eksisterende bjelkelag beholdes eller skiftes?','Bjelkelag',['Beholdes','Skiftes']);
  if(!onlyDemolition&&!facts.access&&!/\d+(?:[.,]\d+)?\s*(?:meter|m)\s*(?:over terreng|høy)/.test(text))choice('terrace-access','Er terrassen i bakkenivå, eller høyt oppe med krevende tilkomst?','Terrassehøyde',['I bakkenivå / lav terrasse','Høy terrasse / krevende tilkomst']);
 }else if(facts.domain==='exterior_wall'){
  if(facts.area===null)number('wall-area','Hvor stort veggareal skal kalkuleres? (m²)','Kledningsareal','m²');
  if(mode==='detailed_copilot'&&/kledning/.test(text)&&!facts.claddingDirection)choice('wall-direction','Skal kledningen være liggende eller stående?','Kledningsretning',['Liggende (horisontal)','Stående (vertikal)'],'IMPORTANT');
 }else if(facts.domain==='roof'){
  const q=clarificationQuestions(brief).filter(q=>q.id!=='roof-basis');
  for(const item of q.sort((a,b)=>(a.id==='roof-area'?-1:0)-(b.id==='roof-area'?-1:0)))questions.push({...item,priority:'CRITICAL'});
 }else if(facts.area===null){
  const candidates=clarificationQuestions(brief);if(candidates.length)questions.push({...candidates.find(q=>q.type==='number')||candidates[0],priority:'CRITICAL'});
 }
 const answered=new Set(questionsAnswered.map(q=>q.id));
 const pending=questions.filter(q=>!answered.has(q.id));
 // Free model prose never becomes a blocking question. These are visible
 // uncertainties until they match an ordinary, unanswered domain question.
 const alreadyKnown=label=>{
  const q=label.toLocaleLowerCase('nb');
  return /areal|kvadratmeter|m²|\bm2\b/.test(q)&&facts.area!==null||/takvinkel|takhelning/.test(q)&&measurements.angle!==null||/taktype/.test(q)&&measurements.roofType!==null||/stående|liggende|kledningsretning/.test(q)&&(facts.domain==='terrace'||facts.claddingDirection!==null)||/bjelkelag/.test(q)&&facts.joists!==null||/tilkomst|adkomst|bakkenivå/.test(q)&&facts.access!==null||/isolasjon/.test(q)&&/isolasjon/.test(text)&&!/hvor|mengde|pris/.test(q)||/terrassebord/.test(q)&&/dimensjon/.test(q)&&facts.deckDimension!==null;
 };
 const extra=cleanTerraceQuestions(labels,brief).filter(label=>!questions.some(q=>q.label===label)&&!alreadyKnown(label)).slice(0,5).map(label=>({label,priority:'OPTIONAL'}));
 return {next:pending[0]||null,questions:pending.slice(0,mode==='simple_estimator'?Math.max(0,3-questionsAnswered.length):3),uncertainties:extra};
}
export function proposalForMode(value,allowed,context,mode){
 requireMode(mode);validateProposal(value,allowed);
 const items=value.items.map(item=>{const element=allowed.find(e=>e.id===item.elementId);let quantity=null;
  if(context.facts.claddingDirection==='horizontal'&&element.id==='wall.cladding.vertical'||context.facts.claddingDirection==='vertical'&&element.id==='wall.cladding.horizontal'||context.facts.joists==='retain'&&element.id==='terrace.new.joists'&&item.scope==='requested')throw Error('Bibliotekforslaget motsier oppgitte valg.');
  if(element.unit==='m²'&&context.facts.domain!=='mixed')quantity=context.measurements.area;
  if(element.unit==='m'&&/rekkverk|railing/.test(element.name+' '+element.id))quantity=context.facts.railingLength;
  // Projected roof area requires the existing client's geometry calculation.
  if(element.unit==='m²'&&context.facts.domain==='roof'&&context.measurements.basis==='footprint')quantity=null;
  return {...item,quantity,unit:element.unit,materialSelection:{deckDimension:context.facts.deckDimension,insulationMaterial:context.facts.insulationMaterial,insulationThickness:context.facts.insulationThickness},assumption:quantity===null?'Mengde må avklares':'Oppgitt av bruker'};
 });
 const plan=questionPlan(context,mode,value.questions),scope=items.map(item=>({elementId:item.elementId,taskIds:item.taskIds,quantity:item.quantity,unit:item.unit,reason:item.reason,scope:item.scope,origin:'ai_suggestion'}));
 const suggestions=plan.uncertainties.map(q=>({priority:'OPTIONAL',text:/overflate.*terrassebord/.test(q.label.toLocaleLowerCase('nb'))?'Overflate på terrassebord kan presiseres ved valg av produkt.':/andre ønsker.*terrassebord/.test(q.label.toLocaleLowerCase('nb'))?'Eventuelle spesialønsker til terrassebord kan vurderes før bestilling.':'Mulig presisering senere: '+q.label}));
 return {...value,items,questions:plan.questions.slice(0,1).map(q=>q.label),mode,context:{...context,scope,suggestions}};
}
