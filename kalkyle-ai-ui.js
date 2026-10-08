import {createEstimateContext,questionPlan,AI_MODES} from './kalkyle-ai-modes.js?v=20261008-ai-modes';
import {answerContext,detailedContext,estimateInput} from './kalkyle-estimate-context.js?v=20261008-ai-modes';
import {estimateAI} from './kalkyle-estimate-ai.js?v=20261008-ai-modes';
import {validateModeResult} from './kalkyle-detailed-copilot.js?v=20261008-ai-modes';
import {buildSimpleEstimate,validateExperienceRate,EXPERIENCE_SOURCES} from './kalkyle-simple-estimator.js?v=20261008-ai-modes';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',maximumFractionDigits:0}).format(n);
const number=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(n);
const range=(r,format=money)=>r.min===r.max?format(r.min):format(r.min)+'–'+format(r.max);
const factLabels={area:'Areal',railingLength:'Rekkverkslengde',deckDimension:'Terrasseborddimensjon',joists:'Bjelkelag',access:'Tilkomst',claddingDirection:'Kledningsretning',insulationThickness:'Isolasjonstykkelse',insulationMaterial:'Isolasjonsmateriale',insulationBrand:'Produktmerke',battenDimension:'Utlekting',claddingProfile:'Kledningsprofil',deckTreatment:'Terrassebordbehandling'};
const factValue=(key,value)=>({retain:'Beholdes',replace:'Skiftes',normal:'Normal',difficult:'Krevende',horizontal:'Liggende',vertical:'Stående'}[value]||value)+(key==='area'?' m²':key==='railingLength'?' m':key==='insulationThickness'?' mm':'');
const factTexts=context=>Object.entries(context.facts).filter(([key,value])=>key!=='domain'&&value!==null).map(([key,value])=>(factLabels[key]||key)+': '+factValue(key,value));
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
export function setupAiModes({getState,saveContext,showProposal,renderQuestionFields,openProject,switchDetailed}){
 let ticket=0,busy=false,context=null,proposal=null,next=null,lastProject=null,modeChosen=false;
 const label=el('label','AI-rolle');label.className='ai-mode-choice';const mode=el('select');mode.id='ai-mode';mode.add(new Option('Forenklet – budsjettanslag','simple_estimator'));mode.add(new Option('Detaljert – bibliotekassistent','detailed_copilot'));label.append(mode);$('job-brief').before(label);
 const panel=el('section',undefined,'ai-budget');panel.id='ai-budget';panel.hidden=true;$('assistant-preview').before(panel);
 const link=el('link');link.rel='stylesheet';link.href=new URL('./kalkyle-ai-ui.css?v=20261008-ai-modes',import.meta.url);document.head.append(link);
 function setBusy(value){busy=value;for(const id of ['brief-generate','wizard-ai-review','assistant-continue','assistant-preliminary'])$(id).disabled=value||(['brief-generate','wizard-ai-review'].includes(id)&&!getState().ready);mode.disabled=value;}
 function clear(){ticket++;panel.hidden=true;$('assistant-clarification').hidden=true;context=null;proposal=null;next=null;}
 function currentMode(){if(!modeChosen)mode.value=getState().mode==='simple'?'simple_estimator':'detailed_copilot';return mode.value;}
 mode.onchange=()=>{modeChosen=true;clear();$('assistant-preview').hidden=true;$('brief-status').textContent=mode.value==='simple_estimator'?'Beskriv jobben for et foreløpig budsjettanslag.':'Beskriv oppgavene du vil finne i biblioteket.';};
 function persist(){if(!saveContext({...context,mode:mode.value,proposal}))throw Error('AI-grunnlaget kunne ikke lagres. Tidligere prosjektdata er beholdt.');}
 function ask(question){next=question;renderQuestionFields($('assistant-clarification-fields'),[question]);$('assistant-clarification').hidden=false;$('assistant-preview').hidden=true;$('assistant-clarification-heading').textContent='Én avklaring først';$('assistant-continue').textContent='Svar og fortsett →';$('brief-status').textContent='Avklar det som påvirker pris eller riktig bibliotekvalg. Du kan også se et foreløpig resultat.';}
 function list(parent,title,values){if(!values.length)return;parent.append(el('h4',title));const ul=el('ul');for(const text of [...new Set(values)])ul.append(el('li',text));parent.append(ul);}
 function renderBudget(){
  if(!proposal||mode.value!=='simple_estimator')return;
  const state=getState(),budget=buildSimpleEstimate({...state,proposal,context});panel.replaceChildren();panel.hidden=false;
  panel.append(el('h3',budget.status==='budget'?'Foreløpig budsjettanslag':'Foreløpig budsjett – kjent delsum'));
  panel.append(el('p',range(budget.gross)+(budget.status==='budget'?' inkl. MVA':' inkl. MVA, før uavklarte poster'),'ai-budget-price'));
  panel.append(el('p',range(budget.price)+' ekskl. MVA · '+(budget.status==='budget'?'Budsjett, ikke et ferdig tilbud.':'Ingen komplett totalpris før manglende grunnlag er avklart.')));
  panel.append(el('p','Anslaget gjelder arbeidsomfanget nedenfor. Kalkylepostene beholdes til du velger å legge til oppgaver. Sikkerhet: '+(budget.confidence==='low'?'lav; kontroller manglende grunnlag og foreløpige tider.':'middels; kontroller kilder og forutsetninger.'),'muted'));
  const dl=el('dl');for(const [name,value] of [['Kjente arbeidstimer',range(budget.hours,number)+' t'],['Kjent materialkost før påslag',range(budget.material)],['Andre dokumenterte avsetninger før påslag',range(budget.other)]]){const row=el('div');row.append(el('dt',name),el('dd',value));dl.append(row);}panel.append(dl);
  list(panel,'Arbeidsomfang – AI-forslag',budget.items.map(item=>item.name+' · '+(item.quantity===null?'mengde mangler':number(item.quantity)+' '+item.unit)+' · '+range({min:item.priceMin,max:item.priceMax})+' ekskl. MVA'+(!item.complete?' (ufullstendig)':'')));
  list(panel,'Merknader til arbeidsomfanget',budget.items.flatMap(item=>item.notes.map(note=>item.name+': '+note)));
  list(panel,'Oppgitt av bruker',factTexts(context));list(panel,'Synlige budsjettforutsetninger',budget.assumptions);list(panel,'Må avklares / usikkerheter',budget.uncertainties);
  list(panel,'Valgfrie presiseringer – stopper ikke anslaget',(context.suggestions||[]).map(s=>s.text));
  const details=el('details'),summary=el('summary','Pris- og tidskilder');details.append(summary);list(details,'Grunnlag',budget.sources.map(s=>s.source+(s.date?' · '+s.date:'')+(s.region?' · '+s.region:'')+(s.confidence?' · sikkerhet: '+({low:'lav',medium:'middels',high:'høy'}[s.confidence]):'')+(s.notes?' · '+s.notes:'')));panel.append(details);
  experienceEditor(panel);
  const detailed=el('button','Gjør denne detaljert');detailed.type='button';detailed.id='ai-make-detailed';detailed.onclick=()=>{context=detailedContext(context);modeChosen=true;mode.value='detailed_copilot';switchDetailed();persist();run({reuse:true,preliminary:true});};panel.append(detailed);
 }
 function experienceEditor(parent){
  const details=el('details');details.id='ai-experience-editor';details.append(el('summary','Registrer et erfaringstall for dette prosjektet'));
  details.append(el('p','Ingen erfaringstall er forhåndsutfylt. Registrer egne dokumenterte tall eller kildebelagte intervaller. Disse brukes bare i budsjettet og endrer ikke markedspriser, detaljerte poster eller eksport.','muted'));
  const form=el('form'),fields=el('div',undefined,'fields');
  function field(id,title,type='text'){const l=el('label',title),input=el(type==='select'?'select':'input');input.id=id;if(type!=='select')input.type=type;l.append(input);fields.append(l);return input;}
  const element=field('ai-rate-element','Arbeidspakke','select');for(const item of proposal.items.filter(i=>i.scope!=='optional'))element.add(new Option(getState().library.find(e=>e.id===item.elementId).name,item.elementId));
  const type=field('ai-rate-type','Hva dekker tallet?','select');for(const [key,label] of [['complete','Komplett salgspris ekskl. MVA per arbeidsenhet (inkl. påslag)'],['material','Samlet materialkost ekskl. MVA per arbeidsenhet'],['hours','Arbeidstimer per arbeidsenhet'],['allowance','Fast kostnadsavsetning ekskl. MVA for arbeidspakken']])type.add(new Option(label,key));
  const min=field('ai-rate-min','Fra','number'),max=field('ai-rate-max','Til (samme tall for fast verdi)','number');for(const n of [min,max]){n.min=0;n.max=10000000;n.step='any';n.required=true;}
  const sourceType=field('ai-rate-source-type','Kildekategori','select');const names=['Manuelt registrert erfaringstall','RIGOR historisk jobb','Gjennomført prosjekt','Dokumentert offentlig kilde','Kontrollerte markedsdata'];EXPERIENCE_SOURCES.forEach((key,i)=>sourceType.add(new Option(names[i],key)));
  const source=field('ai-rate-source','Kilde / prosjekt / referanse');source.required=true;source.maxLength=300;const date=field('ai-rate-date','Kildedato','date');date.required=true;
  const confidence=field('ai-rate-confidence','Sikkerhet','select');for(const [key,name] of [['low','Lav'],['medium','Middels'],['high','Høy']])confidence.add(new Option(name,key));
  const region=field('ai-rate-region','Region (valgfritt)');region.maxLength=500;const notes=field('ai-rate-notes','Innhold og avgrensning');notes.maxLength=500;
  form.append(fields);const units=el('p',undefined,'muted');const showUnits=()=>{const e=getState().library.find(e=>e.id===element.value);units.textContent=type.value==='allowance'?'Fast avsetning for hele den valgte arbeidspakken.':(type.value==='hours'?'timer/':'kr/')+e.unit+' · Tallet skal dekke alle foreslåtte oppgaver i arbeidspakken.';};element.onchange=showUnits;type.onchange=showUnits;showUnits();form.append(units);
  const message=el('p');message.id='ai-rate-status';message.setAttribute('role','status');const add=el('button','Lagre erfaringstall');add.type='submit';form.append(message,add);
  form.onsubmit=event=>{event.preventDefault();try{const item=proposal.items.find(i=>i.elementId===element.value),e=getState().library.find(e=>e.id===item.elementId),rate=validateExperienceRate({elementId:e.id,taskIds:item.taskIds,type:type.value,unit:e.unit,min:Number(min.value),max:Number(max.value),sourceType:sourceType.value,source:source.value,date:date.value,confidence:confidence.value,region:region.value,notes:notes.value,specification:context.brief.slice(0,500)},getState().library);const previous=context.priceBasis.experienceRates;context.priceBasis.experienceRates=[...previous.filter(r=>r.elementId!==rate.elementId||r.type!==rate.type),rate];try{persist();}catch(error){context.priceBasis.experienceRates=previous;throw error;}renderBudget();$('brief-status').textContent='Erfaringstallet er lagret med kilde og brukt i budsjettet. Detaljkalkylen er beholdt.';}catch(error){message.textContent=error.message;}};
  details.append(form);
  for(const rate of context.priceBasis.experienceRates){const value=range(rate,rate.type==='hours'?number:money)+(rate.type==='allowance'?' for arbeidspakken':(rate.type==='hours'?' t/':'/')+rate.unit);const row=el('p',getState().library.find(e=>e.id===rate.elementId)?.name+' · '+value+' · '+rate.source+' · '+rate.date+' ');const remove=el('button','Fjern');remove.type='button';remove.className='secondary';remove.onclick=()=>{const previous=context.priceBasis.experienceRates;context.priceBasis.experienceRates=previous.filter(r=>r.id!==rate.id);try{persist();renderBudget();}catch(error){context.priceBasis.experienceRates=previous;$('brief-status').textContent=error.message;}};row.append(remove);details.append(row);}
  parent.append(details);
 }
 async function run({preliminary=false,reuse=false}={}){
  const state=getState();if(!state.ready||busy)return;if(!state.project?.id){openProject();return;}
  const brief=estimateInput({text:$('job-brief').value}).brief;if(brief.length<10){$('brief-status').textContent='Skriv minst ti tegn om jobben.';return;}
  if(!reuse||!context||context.brief!==brief){const saved=state.project.aiContext;context=createEstimateContext(brief,{questionsAnswered:saved?.brief===brief?saved.questionsAnswered:[],experienceRates:saved?.priceBasis?.experienceRates||[],scope:saved?.brief===brief?saved.scope||[]:[]});proposal=null;}
  currentMode();lastProject=state.project.id;
  const plan=questionPlan(context,mode.value);const question=plan.questions[0];
  if(!preliminary&&question){ask(question);try{persist();}catch(error){$('brief-status').textContent=error.message;}return;}
  const requestTicket=++ticket,projectId=state.project.id,chosenMode=mode.value;setBusy(true);$('assistant-clarification').hidden=true;panel.hidden=true;$('assistant-preview').hidden=true;$('brief-status').textContent=chosenMode==='simple_estimator'?'Lager et foreløpig budsjettomfang fra biblioteket og tilgjengelige kilder …':'Finner bibliotekoppgavene du har bedt om …';
  try{const response=await estimateAI.run({mode:chosenMode,context});if(requestTicket!==ticket||projectId!==getState().project?.id||context?.brief!==$('job-brief').value.trim())return;
   const result=validateModeResult(response,state.library,context,chosenMode);proposal=result;context=result.context;persist();
   // The existing preview and application path retain duplicate checks and edits.
   showProposal({...result,questions:[]},context.brief);$('assistant-questions').hidden=true;
   if(chosenMode==='simple_estimator')renderBudget();else{panel.replaceChildren();panel.hidden=false;list(panel,'Oppgitt av bruker',factTexts(context));list(panel,'Må avklares / avgrensninger',context.uncertainties);list(panel,'Valgfrie presiseringer',(context.suggestions||[]).map(s=>s.text));}
   $('brief-status').textContent='Forslaget er klart. Beregningen bruker prosjektets satser. Oppgaver legges til først etter din kontroll.';
  }catch(error){if(requestTicket===ticket)$('brief-status').textContent=error.message||'AI-forslaget kunne ikke lages. Tidligere poster er beholdt.';}
  finally{setBusy(false);}
 }
 $('assistant-clarification-form').onsubmit=event=>{event.preventDefault();if(!next||!context)return;const input=$('assistant-clarification-fields').querySelector('[data-clarification]');if(!input.checkValidity()){input.reportValidity();return;}try{context=answerContext(context,next,input.value);$('job-brief').value=context.brief;persist();run({reuse:true});}catch(error){$('brief-status').textContent=error.message;}};
 $('assistant-preliminary').onclick=()=>run({reuse:true,preliminary:true});
 $('job-brief').addEventListener('input',clear);$('project-back').addEventListener('click',()=>{clear();modeChosen=false;});
 for(const [id,value] of [['simple','simple_estimator'],['detailed','detailed_copilot']])$(id)?.addEventListener('click',()=>{modeChosen=false;mode.value=value;});
 $('project-workspace').addEventListener('input',event=>{if(event.target.closest('#job-composer'))return;if(proposal&&mode.value==='simple_estimator')setTimeout(()=>{try{renderBudget();}catch(error){$('brief-status').textContent=error.message;}},0);});
 new MutationObserver(()=>{const state=getState();if(state.project?.id===lastProject)return;clear();lastProject=state.project?.id;modeChosen=false;currentMode();const saved=state.project?.aiContext;if(saved?.brief!==$('job-brief').value.trim()||!saved?.proposal)return;try{context=createEstimateContext(saved.brief,{questionsAnswered:saved.questionsAnswered,experienceRates:saved.priceBasis.experienceRates,scope:saved.scope||[]});mode.value=AI_MODES.includes(saved.mode)?saved.mode:mode.value;proposal=validateModeResult(saved.proposal,state.library,context,mode.value);context=proposal.context;if(mode.value==='simple_estimator')renderBudget();}catch(error){$('brief-status').textContent='Lagret AI-grunnlag må kontrolleres: '+error.message;}}).observe($('project-title'),{childList:true});
 return {run,clear};
}
