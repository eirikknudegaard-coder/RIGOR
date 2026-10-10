import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {synchronizeAccessories,materialQuantityMissing,setAccessoryQuantity,setAccessoryRecipe,accessoryDefinitions} from '../kalkyle-accessories.js';
import {library,instantiate} from '../kalkyle-library.js';
import {applyDetailedMaterialPrices} from '../kalkyle-market-reference.js';
import {calculate} from '../kalkyle-engine.js';
import {materialList,selectedProductSnapshot} from '../kalkyle-materials.js';
import {exportBasis,rowCodes} from '../kalkyle-codes.js';
import {preparePdfDocument} from '../kalkyle-pdf-model.js';
import {fastenerPackCount,normalizePublicOffer,readPublicProduct,publicSources,usableOffer,selectedPrices,offersForRow,materialKind} from '../market-public-core.js';
import {createEstimateContext,proposalForMode} from '../kalkyle-ai-modes.js';
import {buildSimpleEstimate} from '../kalkyle-simple-estimator.js';
const evidence=JSON.parse(readFileSync(new URL('./fixtures/evidence/deck-screws-2026-10-09.json',import.meta.url))),offer=evidence.observation;
const parent=()=>instantiate(library.find(e=>e.id==='terrace.new.deck'),50,1,undefined,'-test').map(r=>({...r,hours:.35,requiresTime:false,manualPrice:true,material:10,materialRatio:8.3,materialQuantity:415}))[0];
const rates={wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
const priceRows=rows=>applyDetailedMaterialPrices(rows,{mode:'market',marketPrices:selectedPrices([offer],{[rows[1].priceKey]:offer.id},Date.parse(offer.checked_at)),offers:[offer],bindings:{[rows[1].priceKey]:offer.id},detailed:true,now:Date.parse(offer.checked_at)});
test('Approved installation produces one material-only dependency; reruns, saved exclusions and parent removal are stable',()=>{
 const p=parent(),rows=synchronizeAccessories([p]);assert.equal(rows.length,2);assert.equal(rows[1].name,'Terrasseskruer');assert.equal(rows[1].hours,0);assert.equal(rows[1].factor,1);assert(materialQuantityMissing(rows[1]));
 assert.equal(synchronizeAccessories(rows)[1],rows[1],'UI callbacks retain the live row');assert.equal(synchronizeAccessories(rows).length,2);
 p.enabled=false;assert.equal(synchronizeAccessories(rows)[1].enabled,false);p.enabled=true;assert.equal(synchronizeAccessories(rows)[1].enabled,true);
 rows[1].accessoryExcluded=true;assert.equal(synchronizeAccessories(rows)[1].enabled,false);
 assert.deepEqual(synchronizeAccessories([rows[1]]),[]);assert.equal(rowCodes(rows[1]).purchase,'RG-M-0161-01-901');
 rows[1].material=null;assert.equal(synchronizeAccessories(rows)[1].material,null,'An empty manual price must not silently become free material');
});
test('Roof, wall and membrane accessories are explicit; removal and already combined fastening packages do not get duplicate allowances',()=>{
 const ids=['terrace.new.deck','roof.underlay','roof.cover.tile','roof.cover.metal','insulation.cladding','wall.cladding.vertical'];
 const types=new Set(ids.flatMap(id=>synchronizeAccessories(instantiate(library.find(e=>e.id===id),100)).filter(r=>r.materialOnly).map(r=>r.accessoryType)));
 for(const key of Object.keys(accessoryDefinitions))assert(types.has(key),key);
 for(const id of ['roof.finish.concrete','roof.finish.steel','roof.detail.gutters','terrace.strip.deck']){const rows=instantiate(library.find(e=>e.id===id),50);assert.equal(synchronizeAccessories(rows).length,rows.length,id);}
});
test('The documented 28x120/c600 choice supplies 1350 screws for 50m²; manual consumption and parent area changes persist',()=>{
 const rows=synchronizeAccessories([parent()]);setAccessoryRecipe(rows[1],'deck_28x120_cc600');assert.equal(rows[1].materialQuantity,1350);assert.equal(materialQuantityMissing(rows[1]),false);
 rows[0].quantity=100;synchronizeAccessories(rows);assert.equal(rows[1].materialQuantity,2700);
 setAccessoryQuantity(rows[1],2800);assert.equal(rows[1].accessoryRecipe,null);const restored=synchronizeAccessories(JSON.parse(JSON.stringify(rows)));assert.equal(restored[1].materialQuantity,2800);assert.equal(restored[1].materialRatio,28);
 assert.throws(()=>setAccessoryRecipe({...rows[1],accessoryType:'wind_tape'},'deck_28x120_cc600'));assert.throws(()=>setAccessoryQuantity(rows[1],0));
});
test('Real 1000-piece screw package prices need as two whole boxes, without adding any work hours',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse(offer.checked_at)});
 let rows=synchronizeAccessories([parent()]);setAccessoryRecipe(rows[1],'deck_28x120_cc600');rows[1].materialPriceChoice='product';rows[1].selectedProduct=selectedProductSnapshot(offer);rows=priceRows(rows);
 assert.equal(rows[1].marketPackages,2);assert.equal(rows[1].marketPurchasedQuantity,2000);assert.equal(rows[1].marketMaterialCost,478.4);
 assert.equal(calculate(rows,rates,50).hours,calculate([rows[0]],rates,50).hours);assert(Math.abs(calculate(rows,rates,50).price-calculate([rows[0]],rates,50).price-574.08)<1e-8);
 setAccessoryQuantity(rows[1],2001);rows=priceRows(rows);assert.equal(rows[1].marketPackages,3);assert.equal(rows[1].marketMaterialCost,717.6);
});
test('Unknown quantities stay unknown in BOM, block customer/purchase exports, and do not prevent the work plan',()=>{
 const rows=synchronizeAccessories([parent()]);rows[1].manualPrice=true;rows[1].material=1;rows[1].priceIssue=null;
 assert.equal(materialList(rows)[1].quantity,null);assert.equal(materialList(rows)[1].purchaseQuantity,null);assert.equal(materialList(rows)[1].cost,null);
 assert.throws(()=>exportBasis({rows,rates},'purchase'),/mengder/);assert.throws(()=>exportBasis({rows,rates},'sale'),/mengder/);assert.equal(exportBasis({rows,rates},'work').length,2);
 assert.throws(()=>preparePdfDocument({rows,rates,project:{id:'test'},profile:{},options:{type:'calculation'}}),/mengder/);
});
test('A real priced fastener appears in the PDF model, purchase and sales lists, with original stable element code and zero wages',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse(offer.checked_at)});
 let rows=synchronizeAccessories([parent()]);setAccessoryRecipe(rows[1],'deck_28x120_cc600');rows[1].materialPriceChoice='product';rows[1].selectedProduct=selectedProductSnapshot(offer);rows=priceRows(rows);
 const data={rows,rates,project:{id:'test',name:'Test',customer:'Kunde'},offers:[offer],bindings:{[rows[1].priceKey]:offer.id},priceMode:'market'};
 const pdf=preparePdfDocument({...data,profile:{company:'Testbygg'},options:{type:'offer'}});assert.equal(pdf.materials[1].name,offer.name);assert.equal(pdf.materials[1].packages,2);assert.equal(pdf.materials[1].quantity,1350);assert.equal(pdf.materials[1].cost,478.4);
 assert.equal(pdf.items[1].workHours,0);assert.equal(pdf.totals.price,Math.round(calculate(rows,rates,1).price*100));
 const buy=exportBasis(data,'purchase');assert.equal(buy[2][5],offer.name);assert.equal(buy[2][6],offer.source_id);assert.equal(buy[2][9],1350);assert.equal(buy[2][11],2000);assert.equal(buy[2][12],2);assert.equal(buy[2][15],478.4);
 const sale=exportBasis(data,'sale');assert.equal(sale.filter(r=>r[5]===offer.name).length,1);assert.equal(exportBasis(data,'work').length,2);
});
test('AI budget includes the dependency even when the provider omits it; saved accessory inputs complete the budget once',()=>{
 mock.timers.enable({apis:['Date'],now:Date.parse(offer.checked_at)});
 try{const context=createEstimateContext('Ny terrasse på 50 m². Bjelkelag beholdes. 28x120 impregnerte terrassebord.'),proposal=proposalForMode({summary:'Terrasse',questions:[],items:[{elementId:'terrace.new.deck',taskIds:['deck'],scope:'requested',reason:'Bestilt'}]},library,context,'simple_estimator');
 let rows=synchronizeAccessories([parent()]);setAccessoryRecipe(rows[1],'deck_28x120_cc600');rows[1].materialPriceChoice='product';rows[1].selectedProduct=selectedProductSnapshot(offer);rows=priceRows(rows);
 const data={proposal,context,library,rates,settings:{difficulty:1},priceMode:'market',offers:[offer],bindings:{[rows[1].priceKey]:offer.id},prices:selectedPrices([offer],{[rows[1].priceKey]:offer.id}),existingRows:rows};
 const budget=buildSimpleEstimate(data);assert.equal(budget.status,'budget');assert.equal(budget.materials[1].name,offer.name);assert.equal(budget.materials[1].quantity,1350);assert(Math.abs(budget.price.min-calculate(rows,rates,50).price)<1e-8);
 const unknown=buildSimpleEstimate({...data,existingRows:[rows[0]]});assert.equal(unknown.status,'partial');assert(unknown.materials.some(m=>m.name===offer.name&&m.quantity===null));
 }finally{mock.timers.reset();}
});
test('Exact SKU count overrides the retail piece label; ambiguous/missing counts are quarantined and wallpaper is not tape',()=>{
 const html=evidence.raw.jsonLd.map(j=>'<script type="application/ld+json">'+JSON.stringify(j)+'</script>').join('')+'<script>window.CURRENT_PAGE='+JSON.stringify(evidence.raw.currentPage)+'</script>';
 const actual=readPublicProduct(html,evidence.url,{...publicSources[0],tax_evidence:offer.vat_evidence},offer.checked_at);assert.equal(actual.package_quantity,1000);assert.equal(actual.package_price_ex_vat_ore,23920);assert(usableOffer(actual,Date.parse(offer.checked_at)));
 assert.equal(fastenerPackCount('Skruer 4.2x55 mm – 1000 PK'),1000);assert.equal(fastenerPackCount('Skruer A200 · 4.2 X 75'),200);assert.equal(fastenerPackCount('Skruer A200 100-pk'),null);assert.equal(fastenerPackCount('Skruer 4,2x55 mm A4'),null);
 const old={...offer,quantity_basis:'unit',package_quantity:1,normalized_ore:23920,original_unit:'stk'};assert.equal(normalizePublicOffer(old).normalized_ore,24);assert.equal(normalizePublicOffer(old).checked_at,old.checked_at);assert.equal(normalizePublicOffer(old).package_quantity,1000);
 const bad=normalizePublicOffer({...old,name:'Terrasseskrue A4 4,2x55 mm'});assert(bad.last_error);assert(!usableOffer(bad,Date.parse(offer.checked_at)));
 const row=synchronizeAccessories([parent()])[1];assert.equal(offersForRow(row,[offer,{...offer,name:'Gipsskrue 1000 stk'}],Date.parse(offer.checked_at)).length,1);
 assert.equal(materialKind('Storeys EasyUp tapet'),null);assert.equal(materialKind('Isola vindsperretape'),'tape');assert.equal(materialKind('Isola sløyfebånd 50mm x15m'),'hardware');
});
