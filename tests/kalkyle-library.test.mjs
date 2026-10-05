import {test} from 'node:test';import assert from 'node:assert/strict';
import {library,instantiate,searchLibrary,roofTypes} from '../kalkyle-library.js';
import {roofGeometry,propose,calculate} from '../kalkyle-engine.js';
import {applyPrices} from '../kalkyle-prices.js';
const base={job:'roof',area:100,angle:30,basis:'footprint',material:'metal',difficulty:1,options:['removal','underlay','cover','rig','waste']};
test('Fem taktyper og riktig arealomregning',()=>{
 assert.equal(Object.keys(roofTypes).length,5);
 for(const type of ['shed','gable','hip'])assert(Math.abs(roofGeometry({...base,roofType:type}).area-115.4700538)<1e-5);
 assert.equal(roofGeometry({...base,roofType:'flat',angle:0}).area,100);
 const mansard=roofGeometry({...base,roofType:'mansard',lowerAngle:60,upperShare:50});assert(Math.abs(mansard.area-157.7350269)<1e-5);
 assert.equal(roofGeometry({...base,roofType:'mansard',basis:'surface'}).area,100);
});
test('Flatt tak med membran foreslår fast underlag; valm får egen målt detalj',()=>{
 const flat=propose({...base,roofType:'flat',material:'membrane'});assert(flat.some(r=>r.elementId==='roof.deck'));assert(!flat.some(r=>r.elementId==='roof.underlay'));
 const hip=propose({...base,roofType:'hip',hipLength:12,ridgeLength:8,edgeLength:30,options:[...base.options,'details']});assert.equal(hip.find(r=>r.elementId==='roof.hip').quantity,12);
 const unknown=propose({...base,roofType:'hip',options:['details']});assert(unknown.every(r=>!r.enabled||r.requiresQuantity));
});
test('Element inneholder enkeltoppgaver med separat materiellmengde og enhet',()=>{
 const element=library.find(e=>e.id==='roof.underlay');const rows=instantiate(element,100,1,['battens']);assert.equal(rows.length,1);assert.equal(rows[0].quantity,100);assert.equal(rows[0].materialQuantity,167);assert.equal(rows[0].materialUnit,'m');
 const record={prisnokkel:rows[0].priceKey,enhet:'m',pris:10,kilde:'Test',dato:'2026-10-05',valuta:'NOK',mva:'ekskl'};
 const priced=applyPrices(rows,'import',[record],'2026-10-05');const rates={wage:0,direct:0,indirect:0,billing:100,laborMarkup:0,materialMarkup:0};assert.equal(calculate(priced,rates,100).cost,1670);
 assert.equal(applyPrices(rows,'import',[{...record,enhet:'m2'}],'2026-10-05')[0].priceIssue,'feil enhet');
});
test('Søk og filtre fungerer over elementer og oppgaver',()=>{
 assert(searchLibrary(library,{search:'sveise'}).some(e=>e.id==='roof.cover.membrane'));
 assert(searchLibrary(library,{type:'Nybygg'}).every(e=>e.type==='Nybygg'||e.type==='Alle'));
 assert(searchLibrary(library,{trade:'Betong'}).every(e=>e.trade==='Betong'));
});
test('Utvidet bibliotek har unike nøkler og beskrivelser for hvert element',()=>{
 assert(library.length>=70);assert.equal(new Set(library.map(e=>e.id)).size,library.length);
 for(const e of library){assert(e.description?.length>20,e.id);assert(e.quantityNote?.length>20,e.id);assert(e.excludes?.length>10,e.id);assert.equal(new Set(e.tasks.map(t=>t.id)).size,e.tasks.length);}
});
test('Nye elementer krever oppgitt tid og gir ingen eksempelpris',()=>{
 const e=library.find(e=>e.id==='roof.finish.pvc');const rows=instantiate(e,100);assert(rows.every(r=>r.requiresTime));assert(rows.every(r=>r.needsExamplePrice));assert(applyPrices(rows,'example',[]).every(r=>r.priceIssue));
 const removal=instantiate(library.find(e=>e.id==='roof.remove.tile'),100);assert(removal.every(r=>r.priceKey===null));assert(removal.every(r=>r.requiresTime));
});
test('Sløyfer og lekter bruker valgt avstand og svinn',()=>{
 const rows=propose({...base,battenSpacing:600,lathSpacing:350,roofWaste:10,basis:'surface'});
 assert(Math.abs(rows.find(r=>r.priceKey==='roof.underlay.sloyfer').materialQuantity-183.3333333)<1e-5);
 assert(Math.abs(rows.find(r=>r.priceKey==='roof.underlay.lekter').materialQuantity-314.2857143)<1e-5);
});
