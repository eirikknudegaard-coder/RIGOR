import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {synchronizeAccessories} from '../kalkyle-accessories.js';
import {library,instantiate} from '../kalkyle-library.js';
import {createEstimateContext,proposalForMode} from '../kalkyle-ai-modes.js';
import {buildSimpleEstimate} from '../kalkyle-simple-estimator.js';
import {calculate,roofConsumption,timeFactor} from '../kalkyle-engine.js';
import {applyDetailedMaterialPrices} from '../kalkyle-market-reference.js';
import {annotateAiMaterial} from '../kalkyle-ai-material.js';
import {applyMaterialConsumption,consumptionForProduct} from '../material-consumption.js';
import {selectedPrices} from '../market-public-core.js';
import {conversionRows,conversionSettings,benchmarkDiff} from '../kalkyle-mode-transition.js';
const load=name=>JSON.parse(readFileSync(new URL('./fixtures/evidence/'+name+'.json',import.meta.url)));
const catalog=load('benchmark-catalog'),fixtures=load('benchmark-projects');
test('Conversion removes untouched wizard seed work and preserves actual user edits',()=>{
 const rows=[{taskKey:'roof.removal.cover',wizardGenerated:true},{taskKey:'roof.underlay.underlay',wizardGenerated:true,userEdited:true},{taskKey:'custom.1',userEdited:true}];
 assert.deepEqual(conversionRows(rows,{scope:[{elementId:'terrace.new.deck',taskIds:['deck']}]}).map(r=>r.taskKey),['roof.underlay.underlay','custom.1']);
});
for(const project of fixtures.cases)test(project.id+': same scope, rates, physical quantities and <=20% transition difference',()=>{
 mock.timers.enable({apis:['Date'],now:Date.parse(catalog.updated_at)});
 try{
 const rates=fixtures.rates,initialSettings={job:'roof',area:project.area,angle:30,basis:'surface',difficulty:1,roofType:'gable',lathSpacing:375,battenSpacing:600,roofWaste:0};
 const experienceRates=project.experience.map(([elementId,type,value,source],i)=>({id:'rate'+i,elementId,type,taskIds:project.scope.find(s=>s[0]===elementId)[1],unit:'m²',min:value,max:value,sourceType:'public_source',source,date:catalog.updated_at.slice(0,10),confidence:'medium'}));
 const context=createEstimateContext(project.brief,{experienceRates}),settings=conversionSettings(initialSettings,context);
 assert.equal(context.facts.area,project.area);assert.equal(context.measurements.basis,project.id==='roof'?'surface':null);
 if(project.id==='terrace'){assert.equal(context.facts.joists,'retain');assert.equal(context.facts.deckDimension,'28x120');}
 const proposal=proposalForMode({summary:project.name,questions:[],items:project.scope.map(([elementId,taskIds])=>({elementId,taskIds,reason:'Oppgitt arbeid',scope:'requested'}))},library,context,'simple_estimator');
 const simple=buildSimpleEstimate({proposal,context:proposal.context,library,rates,settings,priceMode:'market',offers:catalog.offers});assert.equal(simple.status,'partial');assert(simple.materials.some(m=>m.quantity===null),'Tilbehørsmengder kan ikke oppfinnes fra arealet');
 let rows=proposal.items.flatMap(item=>{const element=library.find(e=>e.id===item.elementId);return instantiate(element,item.quantity,timeFactor(element,settings),item.taskIds).map(r=>roofConsumption(annotateAiMaterial(r,context.facts,catalog.offers),settings));});
 for(let i=0;i<rows.length;i++){const r=rows[i];if(r.priceKey==='terrace.new.deck')Object.assign(r,{hours:.35,requiresTime:false,manualTime:true});const o=catalog.offers.find(o=>o.id===project.choices[r.priceKey]);if(o)rows[i]={...applyMaterialConsumption(r,consumptionForProduct(o,{lathSpacing:375})),materialPriceChoice:'product'};if(project.manual?.[r.priceKey]!==undefined)Object.assign(rows[i],{manualPrice:true,material:project.manual[r.priceKey],manualPriceSource:'Benchmarkforutsetning'});}
 rows=applyDetailedMaterialPrices(rows,{mode:'market',marketPrices:selectedPrices(catalog.offers,project.choices),offers:catalog.offers,bindings:project.choices,detailed:true});
 assert(rows.every(r=>!r.priceIssue&&!r.requiresTime));
 // This older benchmark explicitly covers the main materials only. Its range
 // remains unchanged, while the BOM now marks the absent accessory quantities.
 const accessories=synchronizeAccessories(rows).filter(r=>r.materialOnly);assert(accessories.length>0);assert(accessories.every(r=>r.requiresMaterialQuantity));
 const detailed=calculate(rows,rates,project.area),diff=benchmarkDiff(simple,detailed);
 for(const[key,quantity]of Object.entries(project.expectedQuantity))assert.equal(rows.find(r=>r.priceKey===key).materialQuantity,quantity);
 assert(diff.pass,JSON.stringify(diff));assert.equal(diff.largeDifference,false);assert.equal(detailed.hours,simple.hours.min);assert.equal(detailed.vat,detailed.price*.25);
 assert.equal(rows.filter(r=>r.taskKey.includes('terrace.new.joists')||r.taskKey.includes('railing')).length,0);
 }finally{mock.timers.reset();}
});
