import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMarketReference,normalizeReferenceOffer,productSpecification,requirementForRow,createReferenceSnapshot,validReferenceSnapshot,referenceIsNewer} from '../market-reference.js';
import {applyDetailedMaterialPrices,useReference} from '../kalkyle-market-reference.js';
import {selectedPrices} from '../market-public-core.js';
import {calculate} from '../kalkyle-engine.js';
import {exportBasis} from '../kalkyle-codes.js';
import {preparePdfDocument} from '../kalkyle-pdf-model.js';
const now=Date.parse('2026-10-08T12:00:00Z'),stamp=new Date(now).toISOString();
const requirement={productType:'decking',unit:'m',specification:{thicknessMm:28,widthMm:120,material:'wood',treatment:'pressure_treated'}};
const row={id:'terrace.new.deck:deck',taskKey:'terrace.new.deck.deck',elementId:'terrace.new.deck',name:'Montere 28x120 impregnert terrassebord',priceKey:'terrace.new.deck',enabled:true,unit:'m²',materialUnit:'m',materialQuantity:100,materialRatio:10,quantity:10,hours:.5,factor:1,material:0,requiresTime:false};
const rates={wage:283,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
function offer(price,id='a',supplier='obs',extra={}) {return {id:supplier+':'+id,source_id:id,chain:supplier,name:'Terrassebord 28x120 trykkimpregnert',kind:'decking',unit:'m',price_kind:'public',vat:'inkl',original_ore:Math.round(price*125),package_price_ex_vat_ore:Math.round(price*100),normalized_ore:Math.round(price*100),package_quantity:1,quantity_basis:'unit',original_unit:'m',checked_at:stamp,availability:'https://schema.org/InStock',url:'https://'+supplier+'.example.test/'+id,evidence:'Dokumentert produktpris/enhet',...extra};}
const offers=[offer(28.4,'a'),offer(31.8,'b','supplier-b'),offer(35.9,'c','supplier-c')];
const build=(os=offers,r=requirement)=>buildMarketReference({requirement:r,offers:os,now});
const apply=(rs=[row],options={})=>applyDetailedMaterialPrices(rs,{mode:'market',detailed:true,offers,now,...options});
test('Tre likeverdige produkter fra ulike leverandører gir median og sporbar statistikk',()=>{
 const r=build();assert(r.usable);assert.equal(r.referencePrice,31.8);assert.equal(r.meanPrice,(28.4+31.8+35.9)/3);assert.equal(r.minPrice,28.4);assert.equal(r.maxPrice,35.9);assert.equal(r.productCount,3);assert.equal(r.supplierCount,3);assert.equal(r.confidence,'medium');assert.equal(r.sources[1].productId,'b');
});
test('Median tåler en ekstrem pris; fem gode produkter fra flere leverandører gir høy sikkerhet',()=>{
 const r=build([...offers,offer(32,'d'),offer(3000,'e','supplier-b')]);assert.equal(r.referencePrice,32);assert.equal(r.confidence,'high');assert.equal(r.maxPrice,3000);
});
test('Dimensjoner, behandling, materiale, premium og varetype må være sammenlignbare',()=>{
 const bad=[offer(1,'wide','obs',{name:'34x145 impregnert terrassebord'}),offer(1,'composite','obs',{name:'28x120 kompositt terrassebord'}),offer(1,'royal','obs',{name:'28x120 Royalimpregnert terrassebord'}),offer(1,'timber','obs',{name:'28x120 impregnert konstruksjonsvirke',kind:'timber'}),offer(1,'second','obs',{name:'28x120 impregnert terrassebord 2 sortering'}),offer(1,'premium','obs',{name:'Premium 28x120 impregnert terrassebord'})];
 assert.equal(build([...offers,...bad]).productCount,3);
});
test('100 mm trefiberisolasjon avviser 70 mm, mineralull og vindsperreplater',()=>{
 const r={productType:'insulation',unit:'m2',specification:{thicknessMm:100,material:'wood_fibre',application:'thermal_building'}};
 const material=(name,id)=>offer(100,id,'obs',{kind:'insulation',unit:'m2',name});
 const os=[material('Trefiberisolasjon 100 mm','a'),material('Trefiberisolasjon 70 mm','b'),material('Mineralull bygningsisolasjon 100 mm','c'),material('Trefiberplate vindsperre 100 mm','d'),material('Trefiberisolasjon 100 mm','e')];
 assert.equal(build(os,r).productCount,2);
});
test('489 kr inkl. MVA for dokumentert 2,8 m² pakke normaliseres uten enhetsavrunding',()=>{
 const o=offer(489,'pack','obs',{name:'Trefiberisolasjon 100 mm',kind:'insulation',unit:'m2',original_ore:48900,package_price_ex_vat_ore:39120,normalized_ore:13971,package_quantity:2.8,quantity_basis:'package',original_unit:'pakke'});
 assert.equal(normalizeReferenceOffer(o,'m2',now).normalizedPrice,489/1.25/2.8);
 assert.equal(normalizeReferenceOffer({...o,unit:'pakke'},'m2',now),null);
 assert.equal(normalizeReferenceOffer({...o,evidence:''},'m2',now),null);
});
test('Ekskl. MVA og inkl. MVA gir samme internpris; inkonsistente beløp avvises',()=>{
 assert.equal(normalizeReferenceOffer(offer(100),'m',now).normalizedPrice,100);
 assert.equal(normalizeReferenceOffer(offer(100,'net','obs',{vat:'ekskl',original_ore:10000}),'m',now).normalizedPrice,100);
 assert.equal(normalizeReferenceOffer(offer(100,'broken','obs',{original_ore:10000}),'m',now),null);
});
test('Gamle, fremtidige, mislykkede, lokale, utsolgte og ukjente enheter brukes ikke',()=>{
 const changes=[{checked_at:new Date(now-86400001).toISOString()},{checked_at:new Date(now+1).toISOString()},{last_error:'HTTP 403'},{price_kind:'local',store_id:'123'},{unit:'pakke'},{availability:'https://schema.org/OutOfStock'},{currency:'EUR'},{vat:'unknown'},{valid_until:'2026-10-07'},{quantity_basis:'unknown'}];
 for(const change of changes)assert.equal(normalizeReferenceOffer(offer(100,'bad','obs',change),'m',now),null,JSON.stringify(change));
});
test('Samme SKU teller én gang; siste feil kan ikke gjenopplive gammel pris',()=>{
 assert.equal(build([offer(10),offer(20,'a','obs',{checked_at:new Date(now-1000).toISOString()}),offer(30,'b')]).productCount,2);
 assert.equal(build([offer(10,'a','obs',{checked_at:new Date(now-1000).toISOString()}),offer(20,'a','obs',{last_error:'feil'}),offer(30,'b')]).productCount,1);
});
test('Uklart produktgrunnlag gir ingen pris; én vare får lav sikkerhet og brukes ikke automatisk',()=>{
 const r=build([offer(31.8)]);assert.equal(r.confidence,'low');assert(!r.usable);assert.throws(()=>createReferenceSnapshot(r));
 assert.equal(build(offers,{productType:'decking',unit:'m',specification:{thicknessMm:28,widthMm:120}}).referencePrice,null);
 assert.equal(apply([row],{offers:[offers[0]]})[0].priceIssue,'Markedsreferanse mangler');
});
test('AI-spesifikasjon velger bare behov, ikke pris eller produkt',()=>{
 const requirement=requirementForRow({...row,name:'Montere terrassebord',aiSpecification:{dimension:'28x120',treatment:'impregnert'}});assert.equal(requirement.specification.widthMm,120);assert.equal(build(offers,requirement).referencePrice,31.8);
 const unknown=productSpecification({kind:'battens',name:'48x48 Lekt'});assert.equal(unknown.treatment,undefined);
 assert.equal(requirementForRow({...row,priceKey:'insulation.kledning',name:'Montere kledning'}).productType,'cladding');
 assert.equal(requirementForRow({...row,priceKey:'insulation.vindsperre',name:'Montere vindsperre'}),null);
 assert.equal(requirementForRow({...row,priceKey:'insulation.rig',name:'Stillas og sikring'}),null);
 assert.equal(requirementForRow({...row,priceKey:'local.wood',name:'Montere 23x48 ubehandlet lekt'}).productType,'battens');
});
test('Manuell pris og gyldig import går foran markedsreferanse, feil enhet og gamle importer gjør det ikke',()=>{
 const imported={prisnokkel:row.priceKey,enhet:'m',pris:20,kilde:'Avtale A',dato:'2026-10-08',valuta:'NOK',mva:'ekskl'};
 assert.equal(apply([row],{importedPrices:[imported]})[0].material,20);
 assert.equal(apply([row],{importedPrices:[imported]})[0].priceBasis,'imported_agreement');
 assert.equal(apply([{...row,manualPrice:true,material:42}],{importedPrices:[imported]})[0].material,42);
 assert.equal(apply([row],{importedPrices:[{...imported,enhet:'m2'}]})[0].material,31.8);
 assert.equal(apply([row],{importedPrices:[{...imported,dato:'2026-08-01'}]})[0].material,31.8);
});
test('Prisøyeblikk beholdes ved senere prisregister, utløp og frakoblet kilde',()=>{
 const original=apply()[0],saved=JSON.parse(JSON.stringify(original));assert(validReferenceSnapshot(saved.priceSnapshot,requirement));
 const later=now+12*86400000,next=offers.map(o=>({...o,checked_at:new Date(later).toISOString(),original_ore:o.original_ore*2,package_price_ex_vat_ore:o.package_price_ex_vat_ore*2,normalized_ore:o.normalized_ore*2}));
 const updated=applyDetailedMaterialPrices([saved],{mode:'market',detailed:true,offers:next,now:later})[0];assert.equal(updated.material,31.8);assert.deepEqual(updated.priceSnapshot,original.priceSnapshot);
 assert.equal(apply([saved],{offers:[],now:later})[0].material,31.8);
 const newer=buildMarketReference({requirement,offers:next,now:later});assert(referenceIsNewer(saved.priceSnapshot,newer));assert.equal(useReference(saved,requirement,newer).priceSnapshot.price,63.6);
});
test('Spesifikasjonsendring eller skadet snapshot gjenbruker ikke feil pris',()=>{
 const saved=apply()[0];assert.equal(apply([{...saved,materialUnit:'m2',materialRequirement:{...requirement,unit:'m2'}}])[0].material,0);
 assert.equal(apply([{...saved,priceSnapshot:{...saved.priceSnapshot,price:1}}])[0].material,0);
});
test('Delvis ny kildekontroll varsles; eksplisitt valg bytter mellom import og referanse',()=>{
 const saved=apply()[0],partial=offers.map((o,i)=>i?o:{...o,checked_at:new Date(now+1000).toISOString()});
 const next=buildMarketReference({requirement,offers:partial,now:now+1000});assert(referenceIsNewer(saved.priceSnapshot,next));assert.equal(next.observedAt,stamp);
 const imported={prisnokkel:row.priceKey,enhet:'m',pris:20,kilde:'Avtale',dato:'2026-10-08'};
 const chosen=useReference(saved,requirement,build());assert.equal(apply([chosen],{importedPrices:[imported]})[0].material,31.8);
 assert.equal(apply([{...chosen,materialPriceChoice:'import'}],{importedPrices:[imported]})[0].material,20);
});
test('Konkrete produktvalg beholder SKU og pakningsavrunding, også etter valgt referanse',t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const o=offer(20,'pack','obs',{package_quantity:4,original_ore:10000,package_price_ex_vat_ore:8000,normalized_ore:2000,quantity_basis:'package',original_unit:'pakke'}),bindings={[row.priceKey]:o.id};
 const saved=apply()[0],r=apply([({...saved,materialPriceChoice:'product',materialQuantity:5})],{marketPrices:selectedPrices([o],bindings,now),bindings})[0];
 assert.equal(r.material,20);assert.equal(r.marketPackages,2);assert.equal(r.marketMaterialCost,160);assert.equal(r.priceBasis,'product');
});
test('Referansen har ingen SKU-pakningsavrunding; eksisterende motor og eksport bruker samme verdi',()=>{
 const r=apply()[0];assert.equal(r.marketMaterialCost,undefined);
 const result=calculate([r],rates,10);assert.equal(result.items[0].materialPrice,100*31.8*1.2);
 const csv=exportBasis({rows:[r],rates,project:{name:'Test'},bindings:{},offers,priceMode:'market'},'sale');assert(csv.length>1);
 const pdf=preparePdfDocument({rows:[r],rates,project:{id:'test',name:'Test',customer:'Kunde'},profile:{company:'RIGOR test'},options:{type:'calculation'},priceMode:'market'});assert.equal(pdf.totals.price,Math.round(result.price*100));
});
test('Forenklet lager ikke nye referanser og modulen muterer aldri innkommende data',()=>{
 const original=structuredClone([row]),before=structuredClone(original);assert.equal(apply(original,{detailed:false})[0].priceSnapshot,undefined);assert.equal(apply(original,{detailed:false})[0].priceIssue,'mangler');assert.deepEqual(original,before);
 apply(original);assert.deepEqual(original,before);
});
