import {interpretDescription} from './language.js';
import {fact,setFact,markUnknown,labels,valueLabels} from './context.js';
import {nextQuestion,questionFor} from './conversation.js';
import {buildLoadPath} from './load-path.js';
import {buildStructuralModel} from './load-engine.js';
import {analyzeStructure,explainResult} from './analysis.js';
import {validateInterpretation,validateFocus} from './ai-contract.js';
import {constructionAiStatus,requestConstruction} from './ai-client.js';
import {renderLoadPath,renderBeam,renderDiagrams} from './diagram-renderer.js';
const $=id=>document.getElementById(id);
const node=(tag,text,cls='')=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const fmt=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(n);
const describe=v=>typeof v==='boolean'?v?'Ja':'Nei':typeof v==='number'?fmt(v):valueLabels[v]||v;
const state={context:null,result:null,question:null,proposals:[],aiReady:false,busy:false,revision:0};
const examples={wall:'Trenger jeg en drager her? Bindingsverk c/c 600, 2x8 og saltak med 25 graders vinkel. Jeg vil fjerne ca. 3 meter av veggen.',beam:'Jeg vil undersøke en fritt opplagt drager med spenn på 3,2 meter. Jevnt fordelt last på 4 kN/m. Drager 115x315 mm, limtre GL30c.',cantilever:'Jeg vil kontrollere en bjelke. Den er fast innspent i venstre ende og har spenn på 1,5 meter. Punktlast på 2 kN, 1,5 meter fra innspent ende.'};
function message(text){$('construction-message').textContent=text;}
function resetResult(){state.result=null;state.proposals=[];state.revision++;}
function basisRow(id,value,status,source,editable=false){
 const tr=node('tr'),name=node('td',labels[id]||id),data=node('td',describe(value)),provenance=node('td');provenance.append(node('span',{KNOWN:'Oppgitt',ASSUMED:'Antatt',DERIVED:'Utledet',REQUIRED:'Må avklares'}[status]+' · '+status,'basis-status'),node('span',source));
 if(editable){try{questionFor(id);const b=node('button','Endre','secondary');b.type='button';b.onclick=()=>{state.question=questionFor(id);renderQuestion();$('construction-question-card').scrollIntoView({block:'nearest',behavior:'smooth'});};name.append(b);}catch{}}
 tr.append(name,data,provenance);$('construction-facts').append(tr);
}
function showList(container,values){container.replaceChildren();const ul=node('ul');for(const v of values)ul.append(node('li',v));container.append(ul);}
function renderQuestion(){
 const q=state.question;const card=$('construction-question-card');card.hidden=!q;
 if(!q||state.proposals.length){card.hidden=true;return;}
 $('construction-question-title').textContent=q.label;$('construction-question-help').textContent=q.help;$('construction-answer-error').textContent='';
 const input=node(q.type==='select'?'select':'input');input.id='construction-current-answer';input.required=true;input.setAttribute('aria-labelledby','construction-question-title');input.setAttribute('aria-describedby','construction-question-help');
 if(q.type==='select'){
  const option=node('option','Velg et svar');option.value='';input.append(option);
  for(const [value,label]of q.options){const option=node('option',label);option.value=String(value);input.append(option);}
  if(state.context.facts[q.id])input.value=String(fact(state.context,q.id));
 }else {input.type=q.type==='number'?'text':'text';input.maxLength=q.type==='number'?25:400;if(q.type==='number'){input.inputMode='decimal';input.placeholder='Oppgi et mål eller tall';}if(state.context.facts[q.id])input.value=String(fact(state.context,q.id));}
 $('construction-answer-field').replaceChildren(input);
 for(const b of $('construction-answer').querySelectorAll('button,input,select'))b.disabled=state.busy;
}
function renderBasis(model){
 $('construction-facts').replaceChildren();
 for(const [id,f]of Object.entries(state.context.facts))if(id!=='sectionRequested')basisRow(id,f.value,f.status,f.source,true);
 for(const f of model.derived)basisRow(f.id,f.value,'DERIVED',f.text);
 for(const f of model.assumptions)basisRow(f.id,f.value??'Foreløpig forutsetning','ASSUMED',f.text);
 const result=state.result;
 if(result?.checks?.deflection&&!state.context.facts.deflectionRatio)basisRow('deflectionRatio',result.checks.deflection.ratio,result.checks.deflection.criterionStatus,result.checks.deflection.criterionSource,true);
 for(const id of new Set([...model.required,...state.context.unknowns]))basisRow(id,'Uavklart','REQUIRED',state.context.unknowns.includes(id)?'Brukeren har svart «Dette vet jeg ikke». Dette er ikke kontrollert.':'Opplysningen trengs før tall beregnes.',true);
 $('construction-load-basis').replaceChildren();
 const loadBasis=$('construction-load-basis');
 if(model.loadSource)loadBasis.append(node('p','Lastkilde: '+model.loadSource+' · '+describe(model.loadBasis)));
 loadBasis.append(node('p','Statisk system: '+(valueLabels[model.system]||'Uavklart')+(model.spanM?' · beregningsspenn '+fmt(model.spanM)+' m':'')));
 if(result?.beam)loadBasis.append(node('p','Vertikallast: '+fmt(result.beam.loads.qNPerM/1000)+' kN/m langs hele spennet'+(result.beam.loads.points.length?' + '+result.beam.loads.points.map(p=>fmt(p.forceN/1000)+' kN ved '+fmt(p.xM)+' m').join(', '):'')));
 if(model.material){const p=node('p',model.material.reference+' '),a=node('a','Åpne materialkilden');a.href=model.material.source;a.target='_blank';a.rel='noopener noreferrer';p.append(a);if(model.material.densitySource){const density=node('a','Tetthetskilde');density.href=model.material.densitySource;density.target='_blank';density.rel='noopener noreferrer';p.append(document.createTextNode(' · '),density);}loadBasis.append(p);}
 const checks=$('construction-checks');checks.replaceChildren();
 if(result?.checks){showList(checks,result.checks.performed);checks.prepend(node('h3','Utført'));checks.append(node('h3','Ikke kontrollert'));const list=node('ul');result.checks.notPerformed.forEach(t=>list.append(node('li',t)));checks.append(list);}else checks.append(node('p','Lastveien er vurdert ut fra opplysningene. Det er ikke utført en tallberegning ennå.'));
 const technical=$('construction-technical');technical.replaceChildren();$('construction-diagrams').replaceChildren();
 if(result?.beam){
  technical.append(node('p','Analysemetode: lineær elastisk Euler–Bernoulli-bjelke. Beregning i SI-enheter, vertikale laster nedover. Ingen FEM- eller metodemeny er nødvendig.'));
  const formulas=result.beam.system==='simple'?['RA = qL/2 + ΣP(L−a)/L','RB = qL + ΣP − RA','M(x) = RA·x − qx²/2 − ΣP·max(x−a, 0)','EI·w(x) = −RA·x³/6 + qx⁴/24 + ΣP·max(x−a, 0)³/6 + C·x','C velges slik at w(0) = w(L) = 0. Positiv w er nedover.']:['RA = qL + ΣP','Innspenningsmoment = qL²/2 + ΣP·a','M(x) = −q(L−x)²/2 − ΣP·max(a−x, 0)','wq(x) = qx²(6L²−4Lx+x²)/(24EI)','wP(x≤a) = Px²(3a−x)/(6EI); wP(x≥a) = Pa²(3x−a)/(6EI)'];
  if(model.section)formulas.push(...model.section.formulas,model.section.axis);
  showList(technical,formulas);technical.prepend(node('p','Analysemetode: lineær elastisk Euler–Bernoulli-bjelke. SI-enheter; bare oppgitte vertikale laster.'));
  if(result.checks.stress)technical.append(node('p','Elastisk bøyespenning '+fmt(result.checks.stress.bendingMPa)+' MPa og skjærspenning '+fmt(result.checks.stress.shearMPa)+' MPa. '+result.checks.stress.note));
  renderDiagrams($('construction-diagrams'),result.beam);
  const pre=node('pre',JSON.stringify({structuralModel:{system:model.system,spanM:model.spanM,loads:result.beam.loads,section:model.section,material:model.material?.id},equilibrium:result.beam.equilibrium},null,2));technical.append(pre);
 }else technical.append(node('p','Diagrammer og formler vises når en støttet tallberegning er gjennomført.'));
 $('construction-download').disabled=!result?.beam;
}
function render(){
 if(!state.context)return;const model=buildStructuralModel(state.context),path=buildLoadPath(state.context);
 $('construction-workspace').hidden=false;$('construction-ai-review').hidden=!state.proposals.length;
 $('construction-calculate').disabled=!model.ready||state.busy||state.proposals.length>0;
 $('construction-calculate').textContent=state.result?.beam?'Beregn på nytt':'Beregn';
 const calculated=Boolean(state.result?.beam);$('construction-results').hidden=!calculated;
 $('construction-level').textContent=calculated?'ORIENTERENDE BEREGNING':'FORELØPIG VURDERING';
 $('construction-assessment-heading').textContent=calculated?'Dette viser beregningen.':'Lastveien først.';
 const explanation=$('construction-explanation');explanation.replaceChildren();
 const paragraphs=state.result?explainResult(state.result).paragraphs:path.findings.map(f=>f.text);paragraphs.forEach(t=>explanation.append(node('p',t)));
 const missing=model.required.map(id=>labels[id]||id);$('construction-required').hidden=!missing.length&&model.ready;
 $('construction-required').textContent=missing.length?'Før tall kan beregnes må dette avklares: '+missing.join(', ')+'.':model.ready&&!calculated?'Grunnlaget er klart for en orienterende beregning. Velg «Beregn».':model.ready?'':'Det foreligger ikke et komplett, støttet lastgrunnlag for tallberegning. Vurderingen av lastveien er tilgjengelig.';
 $('construction-limitations').replaceChildren(...model.limitations.map(t=>node('li',t)));
 $('construction-forces-only').hidden=fact(state.context,'sectionRequested')!==true;
 if(calculated){
  const b=state.result.beam,metrics=$('construction-metrics');metrics.replaceChildren();
  for(const [title,value]of [['Vertikallast',fmt(b.totalN/1000)+' kN'],['Største moment',fmt(b.maxMoment.absoluteNm/1000)+' kNm'],['Største skjærkraft',fmt(b.maxShearN/1000)+' kN'],['Nedbøyning',b.maxDeflection?fmt(b.maxDeflection.downM*1000)+' mm':'Ikke beregnet']]){const wrap=node('div');wrap.append(node('dt',title),node('dd',value));metrics.append(wrap);}
  renderBeam($('construction-beam'),b);$('construction-section').hidden=fact(state.context,'sectionRequested')===true;$('construction-ai-explain').disabled=!state.aiReady||state.busy;
 }
 $('construction-load-path-heading').textContent=path.nodes[0]==='Tak'?'Fra tak til fundament.':'Fra last til fundament.';
 renderLoadPath($('construction-load-path'),path);renderBasis(model);renderQuestion();
}
function renderProposals(){
 const container=$('construction-proposals');container.replaceChildren();
 state.proposals.forEach((f,i)=>{const label=node('label',undefined,'proposal'),check=node('input');check.type='checkbox';check.dataset.proposalIndex=i;check.checked=!state.context.facts[f.field];label.append(check,document.createTextNode((labels[f.field]||f.field)+': '+describe(f.value)),node('small','Sitat: «'+f.evidence+'»'+(state.context.facts[f.field]?' · Erstatt registrert verdi bare hvis dette er riktig.':'')));container.append(label);});
}
function advance(){state.question=nextQuestion(state.context);render();}
$('construction-start').onsubmit=async event=>{
 event.preventDefault();const brief=$('construction-brief').value.trim();if(brief.length<10)return;
 for(const detail of document.querySelectorAll('#construction-basis, #construction-basis details'))detail.open=false;
 state.context=interpretDescription(brief);resetResult();state.busy=state.aiReady;advance();const ticket=state.revision;
 if(!state.aiReady){message('AI er ikke tilgjengelig akkurat nå. Du kan bruke den faglige spørreflyten og beregningsmotoren.');return;}
 message('AI tolker beskrivelsen. Alle foreslåtte opplysninger må kontrolleres.');$('construction-submit').disabled=true;
 try{const response=await requestConstruction({action:'interpret',brief});if(ticket!==state.revision)return;
  const validated=validateInterpretation({facts:response.facts?.map(({field,value,evidence})=>({field,value,evidence}))},brief);
  state.proposals=validated.facts.filter(f=>fact(state.context,f.field)!==f.value);renderProposals();message(state.proposals.length?'Kontroller tolkningen under før vi bruker opplysningene.':'De entydige opplysningene er registrert. Vi spør bare om det som trengs videre.');
 }catch(error){if(ticket===state.revision)message(error.message+' Du kan fortsette med spørreflyten.');}
 finally{if(ticket===state.revision){state.busy=false;$('construction-submit').disabled=false;advance();}}
};
$('construction-confirm').onclick=()=>{
 for(const check of $('construction-proposals').querySelectorAll('input:checked')){const f=state.proposals[Number(check.dataset.proposalIndex)];state.context=setFact(state.context,f.field,f.value,'Brukerbekreftet AI-tolkning: «'+f.evidence+'»');}
 resetResult();message('Valgte opplysninger er bekreftet. Beregninger bruker bare dette grunnlaget.');advance();
};
$('construction-reject').onclick=()=>{resetResult();message('AI-tolkningen er forkastet. Registrerte opplysninger er beholdt.');advance();};
$('construction-answer').onsubmit=event=>{
 event.preventDefault();if(!state.question||state.busy)return;
 const q=state.question,input=$('construction-current-answer');let value=input.value.trim();
 if(q.type==='select')value=q.options.find(([v])=>String(v)===value)?.[0];else if(q.type==='number'){if(!/^\d+(?:[.,]\d+)?$/.test(value)){$('construction-answer-error').textContent='Oppgi ett tall med punktum eller komma som desimaltegn.';return;}value=Number(value.replace(',','.'));}
 try{state.context=setFact(state.context,q.id,value);resetResult();message('Svaret er registrert.');advance();}catch(e){$('construction-answer-error').textContent=e.message;}
};
$('construction-unknown').onclick=()=>{if(!state.question||state.busy)return;state.context=markUnknown(state.context,state.question.id);resetResult();message('Opplysningen er beholdt som uavklart. Vi setter ikke inn en gjettet verdi.');advance();};
$('construction-calculate').onclick=()=>{if(!state.context||state.busy||state.proposals.length)return;try{state.result=analyzeStructure(state.context);render();message(state.result.beam?'Beregningen er utført med det viste grunnlaget.':'Viser foreløpig vurdering. Tallgrunnlaget er fortsatt uavklart.');}catch(e){state.result=null;render();message(e.message);}};
$('construction-section').onclick=()=>{state.context=setFact(state.context,'sectionRequested',true,'Brukeren ønsker nedbøyningsanalyse');resetResult();advance();$('construction-question-card').scrollIntoView({block:'nearest',behavior:'smooth'});};
$('construction-forces-only').onclick=()=>{state.context=setFact(state.context,'sectionRequested',false,'Brukeren ønsker bare lastanalyse');resetResult();advance();};
$('construction-ai-explain').onclick=async()=>{
 if(!state.result||state.busy)return;const ticket=state.revision;state.busy=true;render();message('AI prioriterer blant de kontrollerte resultatene. Tallene beregnes fortsatt av motoren.');
 try{const response=await requestConstruction({action:'explain',context:state.context});if(ticket!==state.revision)return;
  const id=validateFocus({focusId:response.explanation?.focusId},state.result.findings.map(f=>f.id));
  // Never render free model text or model-produced numbers, even from the API.
  const explanation=explainResult(state.result,id);$('construction-explanation').replaceChildren(...explanation.paragraphs.map(t=>node('p',t)));message('Forklaringen bygger på de samme beregnede resultatene.');
 }catch(e){if(ticket===state.revision)message(e.message);}finally{if(ticket===state.revision){state.busy=false;$('construction-ai-explain').disabled=!state.aiReady;$('construction-calculate').disabled=!buildStructuralModel(state.context).ready;renderQuestion();}}
};
$('construction-download').onclick=()=>{
 if(!state.result?.beam)return;const blob=new Blob([JSON.stringify({product:'RIGOR Konstruksjon',version:1,generatedAt:new Date().toISOString(),...state.result},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='rigor-konstruksjon-beregningsgrunnlag.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function clear(){state.revision++;state.busy=false;state.context=null;state.result=null;state.proposals=[];state.question=null;$('construction-workspace').hidden=true;$('construction-brief').value='';$('construction-submit').disabled=false;message('');$('construction-brief').focus();}
$('construction-reset').onclick=clear;
$('construction-brief').oninput=()=>{if(state.context){state.revision++;state.context=null;state.result=null;state.busy=false;state.proposals=[];$('construction-workspace').hidden=true;$('construction-submit').disabled=false;message('Beskrivelsen er endret. Start vurderingen på nytt for å bruke den nye teksten.');}};
for(const b of document.querySelectorAll('[data-construction-example]'))b.onclick=()=>{clear();$('construction-brief').value=examples[b.dataset.constructionExample];};
async function refreshAi(){const ticket=++refreshAi.version;$('construction-ai-status').disabled=true;const status=await constructionAiStatus();if(ticket!==refreshAi.version)return;state.aiReady=status.ready;$('construction-ai-status').textContent=status.ready?'AI klar':'Faglig spørreflyt';$('construction-ai-status').title=status.ready?'AI-tolkning er tilgjengelig. Klikk for ny kontroll.':'AI er ikke tilgjengelig. Spørreflyt og beregning kan brukes. Klikk for ny kontroll.';$('construction-ai-status').disabled=false;$('construction-submit').textContent=status.ready?'Start med AI →':'Start vurdering →';if(state.context)render();}
refreshAi.version=0;$('construction-ai-status').onclick=refreshAi;void refreshAi();
