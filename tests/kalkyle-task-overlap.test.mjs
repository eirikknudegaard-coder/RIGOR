import test from 'node:test';
import assert from 'node:assert/strict';
import {library,instantiate} from '../kalkyle-library.js';
import {calculate} from '../kalkyle-engine.js';
import {reviewAssistantTasks,uniqueAssistantRows,findWorkOverlaps,workKey} from '../kalkyle-task-overlap.js';

const deck=library.find(e=>e.id==='terrace.strip.deck'),joists=library.find(e=>e.id==='terrace.strip.joists');
const selection=(element,scope='requested',selected=true)=>({elementId:element.id,taskIds:element.tasks.map(t=>t.id),scope,selected});
const rows=(element,instance='')=>instantiate(element,50,1,element.tasks.map(t=>t.id),instance);
const rates={wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};

test('overlapping deck packages keep boards once plus joists and cleanup in either order',()=>{
 for(const elements of [[joists,deck],[deck,joists]]){
  const plans=reviewAssistantTasks(elements.map(e=>selection(e)),[],library);
  assert.equal(plans.flatMap(p=>p.tasks.filter(t=>t.included)).length,3);
  assert.equal(plans.flatMap(p=>p.tasks.filter(t=>t.blocked)).length,1);
  const result=uniqueAssistantRows(elements.flatMap(e=>rows(e)),[]);
  assert.equal(result.rows.length,3);assert.equal(result.skipped.length,1);
  assert.equal(result.rows.filter(r=>r.name==='Demontere terrassebord').length,1);
  const cost=calculate(result.rows,rates,50);assert.equal(cost.hours,20);assert.equal(cost.price,25312.5);
 }
});

test('repeated AI proposals respect existing, excluded and partially present work',()=>{
 const existing=rows(deck,'-old').slice(0,1);
 Object.assign(existing[0],{hours:.42,factor:1.3,manualTime:true,manualPrice:true,material:23,enabled:false});
 const before=structuredClone(existing);
 const plans=reviewAssistantTasks([selection(joists),selection(deck)],existing,library);
 assert.equal(plans[0].tasks[0].blocked.kind,'existing');assert.equal(plans[0].tasks[0].blocked.row.enabled,false);
 assert.equal(plans.flatMap(p=>p.tasks.filter(t=>t.included)).length,2);
 const unique=uniqueAssistantRows([ ...rows(joists),...rows(deck)],existing);
 assert.deepEqual(unique.rows.map(r=>r.name),['Demontere bjelkelag','Renske festemidler']);
 assert.equal(uniqueAssistantRows([...rows(joists),...rows(deck)],existing.concat(unique.rows)).rows.length,0);
 assert.deepEqual(existing,before);
 // Changing an AI quantity never silently overwrites a saved quantity or
 // reintroduces a deliberately excluded task. Separate areas use the library.
 assert.equal(uniqueAssistantRows([{...rows(deck)[0],quantity:75}],existing).rows.length,0);
});

test('requested work has priority; deselected work releases overlap to another package',()=>{
 let plans=reviewAssistantTasks([selection(deck,'optional',true),selection(joists)],[],library);
 assert.equal(plans[0].tasks[0].blocked.kind,'proposal');assert.equal(plans[1].tasks[0].included,true);
 plans=reviewAssistantTasks([selection(joists,'requested',false),selection(deck)],[],library);
 assert.equal(plans[1].tasks[0].included,true);
 const first={...selection(joists),selectedTaskIds:['step1']};
 plans=reviewAssistantTasks([first,selection(deck)],[],library);
 assert.equal(plans[1].tasks[0].included,true);
});

test('known shared roof and wind-barrier operations are handled across packages',()=>{
 for(const ids of [['roof.remove.structure','roof.strip.battens'],['insulation.cladding','wall.cladding.horizontal'],['insulation.cladding','wall.cladding.vertical']]){
  const elements=ids.map(id=>library.find(e=>e.id===id)),candidates=elements.flatMap(e=>rows(e));
  const unique=uniqueAssistantRows(candidates,[]);
  assert.equal(unique.skipped.length,1,ids.join(' / '));
  assert.equal(reviewAssistantTasks(elements.map(e=>selection(e)),[],library).flatMap(p=>p.tasks.filter(t=>t.included)).length,candidates.length-1);
 }
});

test('matching names, different products, work surfaces and units remain separate',()=>{
 const wall=library.find(e=>e.id==='interior.wall.gypsum'),ceiling=library.find(e=>e.id==='interior.ceiling.gypsum');
 const a=instantiate(wall,50),b=instantiate(ceiling,50);
 assert.equal(a[0].name,b[0].name);
 assert.equal(uniqueAssistantRows([...a,...b],[]).rows.length,a.length+b.length);
 const board=rows(deck)[0];assert.notEqual(workKey(board),workKey({...board,unit:'m'}));
 assert.equal(uniqueAssistantRows([{...board,unit:'m'}],[board]).rows.length,1);
 assert.equal(uniqueAssistantRows([{id:'custom',name:board.name,unit:'m²'}],[board]).rows.length,1);
});

test('saved overlaps are flagged without changing rows or combining separate quantities',()=>{
 const saved=[...rows(deck,'-ai-one'),...rows(joists,'-ai-two')],before=structuredClone(saved);
 const overlaps=findWorkOverlaps(saved);assert.equal(overlaps.length,1);assert.equal(overlaps[0].length,2);
 assert.deepEqual(saved,before);
 saved[2].quantity=40;assert.equal(findWorkOverlaps(saved).length,0);
 saved[2].quantity=50;saved[0].enabled=false;assert.equal(findWorkOverlaps(saved).length,0);
 saved[0].enabled=true;saved[0].quantity=0;saved[2].quantity=0;assert.equal(findWorkOverlaps(saved).length,0);
});
