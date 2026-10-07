import {test} from 'node:test';
import assert from 'node:assert/strict';
import {library,instantiate} from '../kalkyle-library.js';
import {proposalRows,terraceProposalArea,extractMeasurements} from '../kalkyle-assistant.js';
import {calculate} from '../kalkyle-engine.js';
import {applyTimeCatalog,parseTimeCsv,restoreAssistantTimes} from '../kalkyle-time.js';
import {exportBasis} from '../kalkyle-codes.js';
const rates={wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
const deck=library.find(e=>e.id==='terrace.strip.deck'),joists=library.find(e=>e.id==='terrace.strip.joists');
test('AI terrace area is used only for one unambiguous terrace surface, never lengths, counts or mixed work',()=>{
 const brief='Rive terrassebord på en terrasse på 50 m².';assert.equal(terraceProposalArea(deck,brief,extractMeasurements(brief)),50);
 for(const text of ['Rive terrasse på 50 m² og tak på 60 m².','Rive terrasse og bytte tak på 50 m².','Rive terrasse og kledning på 50 m².','Rive terrasse på 50 m² og terrasse på 20 m².','Rive terrasse.'])assert.equal(terraceProposalArea(deck,text,extractMeasurements(text)),null);
 assert.equal(terraceProposalArea(library.find(e=>e.id==='terrace.strip.handrail'),brief,extractMeasurements(brief)),null);
 assert.equal(terraceProposalArea(library.find(e=>e.id==='terrace.strip.stairs'),brief,extractMeasurements(brief)),null);
 assert.equal(terraceProposalArea(library.find(e=>e.id==='foundation.slab'),brief,extractMeasurements(brief)),null);
});
test('50 m² of deck removal includes person-hours and configured customer hourly price, without material cost',()=>{
 const rows=instantiate(deck,50),result=calculate(rows,rates,50);
 assert.deepEqual(result.items.map(r=>r.workHours),[10,2.5]);assert.equal(result.hours,12.5);assert.equal(result.price,15820.3125);
 assert(rows.every(r=>!r.requiresTime&&r.timeEstimate&&r.timeSource==='RIGOR-planleggingsanslag'&&r.timeNote.includes('gjenbruk')));
 assert.equal(calculate(rows,{...rates,wage:600},50).price,18984.375);
 assert.equal(calculate(instantiate(joists,50),rates,50).hours,17.5);
 assert.equal(calculate(rows.map(r=>({...r,enabled:false})),rates,50).price,0);
 assert.equal(calculate(instantiate(deck,50,1.15),rates,50).hours,14.375);
 const sale=exportBasis({rows,rates},'sale');assert.equal(sale.length,3);assert(sale.slice(1).every(r=>r[4]==='Arbeid'&&r[7]==='t'));
 assert.equal(sale.slice(1).reduce((sum,r)=>sum+r[9],0),15820.3125);
});
test('Older AI and library snapshots regain missing reviewed estimates, with manual and imported values taking priority',()=>{
 for(const fromAssistant of [true,false]){
  const old=instantiate(deck,50).map(r=>({...r,hours:0,requiresTime:true,timeSource:'',fromAssistant}));
  const restored=restoreAssistantTimes(old,{difficulty:1});assert.deepEqual(restored.map(r=>r.hours),[.2,.05]);assert(restored.every(r=>!r.requiresTime));
 }
 const manual=proposalRows(deck,50,'-ai-old').map(r=>({...r,manualTime:true,hours:.6,requiresTime:false,manualFactor:true,factor:1.9}));
 assert(restoreAssistantTimes(manual,{difficulty:1}).every(r=>r.hours===.6&&r.factor===1.9));
 const imported=applyTimeCatalog(instantiate(deck,50),parseTimeCsv('oppgavenokkel;enhet;timer_per_enhet;tidsfaktor;kilde\nterrace.strip.deck.step0;m2;0,4;;Bedriftsnorm'));
 assert.equal(imported[0].hours,.4);assert.equal(imported[0].timeEstimate,false);assert.equal(imported[0].timeNote,'');assert.equal(restoreAssistantTimes(imported,{} )[0].hours,.4);
 const zero=restoreAssistantTimes([{...imported[0],hours:0,requiresTime:false}],{});assert.equal(zero[0].hours,0);
 const unknown=instantiate(library.find(e=>e.id==='roof.finish.pvc'),50);assert(restoreAssistantTimes(unknown,{}).every(r=>r.requiresTime));
});
