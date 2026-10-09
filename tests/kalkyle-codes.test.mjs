import assert from 'node:assert/strict';
import {test} from 'node:test';
import {library,instantiate} from '../kalkyle-library.js';
import {codesFor,rowCodes,exportBasis,csvText} from '../kalkyle-codes.js';
import {calculate,roofGeometry} from '../kalkyle-engine.js';
import {wizardBrief,extractMeasurements} from '../kalkyle-assistant.js';
import {applyPrices} from '../kalkyle-prices.js';
const rates={wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
const element=library.find(e=>e.id==='roof.underlay');
const priced=()=>instantiate(element,30,1.1).map(r=>({...r,material:40,priceIssue:null,priceSource:'Leverandør',priceDate:'2026-10-06'}));

test('Alle bibliotekoppgaver har permanente, unike koder som følger kopier og omrekkefølge',()=>{
 const codes=library.flatMap(e=>e.tasks.map(t=>codesFor(e.id,t.id)));
 for(const key of ['work','purchase','sale']){assert.equal(new Set(codes.map(c=>c[key])).size,codes.length);for(const c of codes)assert.match(c[key],/^RG-[AMS]-\d{4}-\d{2}$/);}
 const a=instantiate(element,30,1.1,undefined,'-første'),b=instantiate(element,50,1,undefined,'-andre');
 assert.deepEqual(rowCodes(a[0]),rowCodes(b[0]));assert.equal(rowCodes(a[0]).salary,'');
 assert.match(codesFor('local.123.0','0').element,/^RG-E-L-/);
 const mapped={...a[0],codeMappings:{work:'TAK',salary:'',purchase:'VARE-1',sale:'SALG-1'}};
 assert.equal(rowCodes(mapped).work,'TAK');assert.equal(rowCodes(mapped).element,rowCodes(a[0]).element);
 assert.equal(rowCodes({...mapped,codeMappings:{salary:'101'}}).salary,'101');
});
test('Arbeidsplanen skiller planlagte timer fra lønn og blokkerer manglende normer',()=>{
 const rows=priced(),csv=exportBasis({rows,rates},'work');
 assert.equal(csv.length,4);assert.equal(csv[1][10],8.25);assert.match(csv[1][csv[0].indexOf('Status')],/faktisk timeregistrering/);
 assert.throws(()=>exportBasis({rows:[{...rows[0],requiresTime:true}],rates},'work'),/grunntid/);
 const withoutPrice=rows.map(r=>({...r,priceIssue:'mangler'}));assert.equal(exportBasis({rows:withoutPrice,rates},'work').length,4);
 assert.throws(()=>exportBasis({rows:withoutPrice,rates},'purchase'),/materialpriser/);
 assert.throws(()=>exportBasis({rows:withoutPrice,rates},'sale'),/komplett/);
});
test('Innkjøp bruker faktisk varenummer og hele pakninger, salg avstemmes mot kalkylens sum',()=>{
 const rows=priced();Object.assign(rows[0],{marketPurchasedQuantity:40,marketPackages:4,marketMaterialCost:1600});
 const offer={id:'offer',name:'Produkt',source_id:'SKU-123',chain:'obs',original_unit:'rull'};
 const purchase=exportBasis({rows,rates,offers:[offer],bindings:{[rows[0].priceKey]:'offer'}},'purchase');
 assert.equal(purchase[1][6],'SKU-123');assert.equal(purchase[1][11],40);assert.equal(purchase[1][12],4);assert.equal(purchase[1][15],1600);
 const sale=exportBasis({rows,rates},'sale');assert.equal(sale.length,7);
 assert(Math.abs(sale.slice(1).reduce((s,r)=>s+r[9],0)-calculate(rows,rates,30).price)<1e-8);
 assert.equal(exportBasis({rows:[{...rows[0],manualPrice:true}],rates,offers:[offer],bindings:{[rows[0].priceKey]:'offer'}},'purchase')[1][6],'');
 assert.throws(()=>exportBasis({rows:[{...rows[0],requiresQuantity:true,quantity:0}],rates},'purchase'),/mengder/);
 assert.throws(()=>exportBasis({rows,rates:{...rates,billing:0}},'sale'),/timesatser/);
});
test('CSV beskytter eksterne tekstfelt, bevarer norske tegn og nøyaktige tall',()=>{
 const text=csvText([['=HYPERLINK("x")','+SUM(1)', 'Ærlig kilde',2.25]]);
 assert(text.startsWith('\uFEFF'));assert(text.includes('"\'=HYPERLINK'));assert(text.includes('"\'+SUM'));assert(text.includes('Ærlig kilde'));assert(text.includes('"2.25"'));
});
test('Veiviserens merkede mål overstyrer gammel fritekst, projisert areal omregnes én gang',()=>{
 const s={job:'roof',roofType:'gable',area:100,angle:30,basis:'footprint',material:'tile',difficulty:1,battenSpacing:600,lathSpacing:350,roofWaste:10};
 const brief=wizardBrief(s,priced(),'Tidligere var taket 20 m² takflate med 45 grader.');
 const m=extractMeasurements(brief);assert.equal(m.area,100);assert.equal(m.angle,30);assert.equal(m.basis,'footprint');assert.equal(m.roofType,'gable');
 assert(Math.abs(roofGeometry({...s,...m}).area-115.4700538379)<1e-8);
 assert.equal(wizardBrief(s,priced(),brief),brief);assert(brief.includes('Montere sløyfer'));assert(brief.includes('Takstein'));
});
test('Dokumenterte manuelle priser beholder kilde og dato og utløper',()=>{
 const row={...priced()[0],manualPrice:true,manualPriceSource:'Proff varehus',manualPriceDate:'2026-10-06'};
 const price=applyPrices([row],'market',[],'2026-10-06')[0];assert.equal(price.priceSource,'Proff varehus');assert.equal(price.priceDate,'2026-10-06');assert.equal(price.priceIssue,null);
 assert.equal(applyPrices([row],'market',[],'2026-11-10')[0].priceIssue,'utdatert');
});
