import {test} from 'node:test';import assert from 'node:assert/strict';
import {library} from '../kalkyle-library.js';
import {createEstimateContext,questionPlan,proposalForMode} from '../kalkyle-ai-modes.js';
import {answerContext,detailedContext,estimateInput} from '../kalkyle-estimate-context.js';
import {buildSimpleEstimate,validateExperienceRate} from '../kalkyle-simple-estimator.js';
import {validateModeResult} from '../kalkyle-detailed-copilot.js';
import {calculate} from '../kalkyle-engine.js';
import {instantiate} from '../kalkyle-library.js';
import {uniqueAssistantRows} from '../kalkyle-task-overlap.js';
import {annotateAiMaterial,matchesAiMaterial} from '../kalkyle-ai-material.js';
const rates={wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
const settings={job:'roof',area:100,angle:30,basis:'surface',difficulty:1};
const item=id=>({elementId:id,taskIds:library.find(e=>e.id===id).tasks.map(t=>t.id),reason:'Testarbeid',scope:'requested'});
const output=ids=>({summary:'Testforslag',items:ids.map(item),questions:[]});
const detailed='Lag detaljert kalkyle for etterisolering av 140 m² yttervegg. Eksisterende kledning rives. 100 mm Hunton trefiberisolasjon, vindsperre, 48x48 utlekting og liggende dobbelfals kledning.';
const experience=(id,type,min,max=min)=>({id:'fixture-'+id+'-'+type,elementId:id,taskIds:item(id).taskIds,type,unit:library.find(e=>e.id===id).unit,min,max,sourceType:'manual_experience',source:'Testfixture, ikke en offentlig norm',date:'2026-10-01',confidence:'medium'});
test('Good simple input has no blocking questions; facts retain dimensions and railing length',()=>{
 const c=createEstimateContext('Bytte terrassebord og bjelkelag. Terrasse på 35 m² i bakkenivå. 28x120 impregnert terrassebord og 12 meter rekkverk.');
 assert.equal(questionPlan(c,'simple_estimator').questions.length,0);assert.equal(c.facts.railingLength,12);assert.equal(c.facts.deckDimension,'28x120');assert.equal(c.facts.joists,'replace');assert(c.assumptions.some(s=>s.includes('Fundamentutbedring')));
});
test('One relevant question at a time, answers are retained, never more than three before first budget',()=>{
 let c=createEstimateContext('Skal rive gammel terrasse og bygge ny. Ca. 35 m². 28x120 impregnert terrassebord og omtrent 12 meter rekkverk.');
 let q=questionPlan(c,'simple_estimator').questions[0];assert.equal(q.id,'terrace-joists');c=answerContext(c,q,'Skiftes');q=questionPlan(c,'simple_estimator').questions[0];assert.equal(q.id,'terrace-access');c=answerContext(c,q,'I bakkenivå / lav terrasse');assert.equal(questionPlan(c,'simple_estimator').questions.length,0);
 const unknown=createEstimateContext('Jeg skal bytte tak på huset.');assert(questionPlan(unknown,'simple_estimator').questions.length<=3);
 assert.equal(questionPlan({...unknown,questionsAnswered:[0,1,2].map(i=>({id:'test'+i,answer:'Uavklart'}))},'simple_estimator').questions.length,0);
});
test('Detailed wall specifications do not trigger repeat questions; missing area gives exactly one relevant question',()=>{
 const c=createEstimateContext(detailed);assert.equal(questionPlan(c,'detailed_copilot').questions.length,0);assert.equal(c.facts.claddingDirection,'horizontal');assert.equal(c.facts.insulationThickness,100);assert.equal(c.facts.insulationMaterial,'trefiber');
 const noArea=createEstimateContext('Legg inn 100 mm Hunton trefiberisolasjon på ytterveggen, ny vindsperre, 48x48 utlekting og liggende kledning.');assert.deepEqual(questionPlan(noArea,'detailed_copilot').questions.map(q=>q.id),['wall-area']);
 const model=output(['insulation.insulation','insulation.cladding']);model.questions=['Skal du ha isolasjon?','Hvor stort er arealet?','Skal kledningen være stående eller liggende?'];
 const value=proposalForMode(model,library,c,'detailed_copilot');assert.equal(value.questions.length,0);assert(value.items.every(i=>i.quantity===140&&i.unit==='m²'));assert(!value.context.uncertainties.some(q=>model.questions.includes(q)));
});
test('Model questions cannot become a large questionnaire; unknown IDs, model totals and unsafe quantities are rejected or rebuilt',()=>{
 const c=createEstimateContext(detailed);const model=output(['insulation.cladding']);model.questions=Array.from({length:15},(_,i)=>'Mulig detalj '+i+'?');assert.equal(proposalForMode(model,library,c,'simple_estimator').questions.length,0);
 assert.throws(()=>proposalForMode(output(['insulation.cladding']),[],c,'detailed_copilot'));
 assert.throws(()=>validateModeResult({...model,total:123},library,c,'detailed_copilot'));
 const result=validateModeResult({...model,items:model.items.map(i=>({...i,quantity:999999}))},library,c,'detailed_copilot');assert.equal(result.items[0].quantity,140);
});
test('Known experience ranges generate budget using the unchanged engine and project markup; missing data never invent prices',()=>{
 const raw=output(['terrace.new.deck']);const context=createEstimateContext('Ny terrasse på 35 m² i bakkenivå. Bjelkelag beholdes. 28x120 terrassebord.');
 context.priceBasis.experienceRates=[experience('terrace.new.deck','material',100,120),experience('terrace.new.deck','hours',.5,.7)];const proposal=proposalForMode(raw,library,context,'simple_estimator');
 const budget=buildSimpleEstimate({proposal,context,library,rates,settings,priceMode:'market'});
 const low=calculate([{enabled:true,quantity:35,materialQuantity:35,material:100,hours:.5,factor:1}],rates,35);const high=calculate([{enabled:true,quantity:35,materialQuantity:35,material:120,hours:.7,factor:1}],rates,35);
 assert.equal(budget.status,'partial');assert(budget.materials.some(m=>m.name==='Terrasseskruer'&&m.quantity===null));assert(budget.uncertainties.some(u=>u.includes('festemidler')));assert.equal(budget.price.min,low.price);assert.equal(budget.price.max,high.price);assert.equal(budget.gross.max,high.gross);
 const unknown=buildSimpleEstimate({proposal,context:{...context,priceBasis:{experienceRates:[]}},library,rates,settings,priceMode:'example'});assert.equal(unknown.status,'partial');assert.equal(unknown.price.min,0);assert(unknown.uncertainties.some(u=>u.includes('grunnlag')||u.includes('Grunntid')));
});
test('Experience prices have provenance, exact work coverage and units; complete sales prices never get markup twice',()=>{
 for(const patch of [{source:''},{unit:'m'},{min:10,max:1},{date:'2999-01-01'},{elementId:'fake'},{taskIds:['fake']}])assert.throws(()=>validateExperienceRate({...experience('terrace.new.deck','material',20),...patch},library));
 const context=createEstimateContext('Ny terrasse på 35 m² i bakkenivå. Bjelkelag beholdes.');context.priceBasis.experienceRates=[experience('terrace.new.deck','complete',900,1100)];
 const budget=buildSimpleEstimate({proposal:proposalForMode(output(['terrace.new.deck']),library,context,'simple_estimator'),context,library,rates,settings,priceMode:'market'});assert.equal(budget.price.min,35*900);assert.equal(budget.gross.max,35*1100*1.25);
});
test('Detailed copilot preserves edited rows and cannot add duplicates on rerun; budget computation is pure',()=>{
 const e=library.find(e=>e.id==='insulation.cladding'),existing=instantiate(e,70).map(r=>({...r,manualPrice:true,material:321,manualTime:true,hours:.77}));const before=structuredClone(existing);
 const c=createEstimateContext(detailed),proposal=proposalForMode(output([e.id]),library,c,'detailed_copilot');const candidates=instantiate(e,140);assert.equal(uniqueAssistantRows(candidates,existing).rows.length,0);
 const budget=buildSimpleEstimate({proposal,context:c,library,rates,settings,priceMode:'market',existingRows:existing});assert.equal(budget.items[0].quantity,70);assert.deepEqual(existing,before);
 const excluded=existing.map(r=>({...r,enabled:false}));assert.equal(buildSimpleEstimate({proposal,context:c,library,rates,settings,priceMode:'market',existingRows:excluded}).items.length,0);
});
test('Explicit material, brand, dimension and profile survive and restrict product matches',()=>{
 const c=createEstimateContext(detailed);assert.equal(c.facts.battenDimension,'48x48');assert.equal(c.facts.claddingProfile,'Dobbelfals');
 const row=annotateAiMaterial(instantiate(library.find(e=>e.id==='insulation.insulation'),140)[1],c.facts);
 assert(!matchesAiMaterial(row,{name:'Glava mineralull 100 mm'}));assert(matchesAiMaterial(row,{name:'Hunton trefiberisolasjon 100 mm'}));assert(!matchesAiMaterial(row,{name:'Hunton trefiberisolasjon 50 mm'}));
 const frame=annotateAiMaterial(instantiate(library.find(e=>e.id==='insulation.insulation'),140)[0],c.facts);assert(matchesAiMaterial(frame,{name:'48x48 Lekt'}));assert(!matchesAiMaterial(frame,{name:'23x48 Lekt'}));
 assert.throws(()=>proposalForMode(output(['wall.cladding.vertical']),library,c,'detailed_copilot'));
});
test('EstimateContext is reusable for detailed mode and accepts text or future speech without textarea coupling',()=>{
 const input=estimateInput({text:'  Ny terrasse i bakkenivå  ',source:'speech_to_text'});const c=createEstimateContext(input.brief);assert.deepEqual(detailedContext(c),c);assert.notEqual(detailedContext(c),c);assert.throws(()=>estimateInput({text:42}));
});
