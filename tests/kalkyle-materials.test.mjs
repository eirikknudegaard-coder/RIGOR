import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialList,materialForRow,selectedProductSnapshot} from '../kalkyle-materials.js';
import {preparePdfDocument} from '../kalkyle-pdf-model.js';
import {exportBasis} from '../kalkyle-codes.js';
const catalog=JSON.parse(readFileSync(new URL('./fixtures/evidence/benchmark-catalog.json',import.meta.url)));
const product=catalog.offers.find(o=>o.id==='obs:ObsBygg-7040431913428');
const row={id:'deck',taskKey:'terrace.new.deck.deck',elementId:'terrace.new.deck',name:'Montere terrassebord',enabled:true,quantity:50,unit:'m²',materialQuantity:415,materialUnit:'m',material:15.92,hours:.35,factor:1,priceKey:'terrace.new.deck',materialPriceChoice:'product',priceBasis:'product',selectedProduct:selectedProductSnapshot(product),marketPackages:99,marketPurchasedQuantity:415.8,marketMaterialCost:6619.14};
const options={offers:catalog.offers,bindings:{[row.priceKey]:product.id},priceMode:'market'};
const rates={wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
test('Real selected deck product carries identity, 415 m need and 99 whole boards into the material list',()=>{
 const original=structuredClone(row),material=materialForRow(row,options);
 assert.equal(material.name,product.name);assert.equal(material.supplierSku,product.source_id);assert.equal(material.quantity,415);assert.equal(material.purchaseQuantity,415.8);assert.equal(material.packages,99);assert.equal(material.cost,6619.14);assert.equal(material.needsProduct,false);assert.deepEqual(row,original);
 assert.equal(materialForRow(row,{...options,offers:[]}).name,product.name);
 assert.equal(materialForRow(row,{...options,priceMode:'import'}).name,product.name,'An explicit per-row SKU remains active when the global price mode changes');
 assert.equal(materialForRow({...row,priceIssue:'mangler'},{...options,offers:[]}).price,null);
});
test('Reference, imported and manual price choices never pretend to purchase the previous SKU',()=>{
 for(const basis of ['market_reference','imported_agreement']){
  const material=materialForRow({...row,priceBasis:basis,materialPriceChoice:basis==='market_reference'?'reference':'import',aiSpecification:{dimension:'28x120',treatment:'impregnert'}},options);
  assert.match(material.name,/Terrassebord.*28x120/);assert.notEqual(material.name,product.name);assert.equal(material.supplierSku,'');assert.equal(material.packages,null);assert.equal(material.purchaseQuantity,415);assert.equal(material.needsProduct,true);
 }
 const manual=materialForRow({...row,manualPrice:true,manualProduct:'Kundens eget 28x120 terrassebord',manualPriceSource:'Avtale med varehus',material:10},options);
 assert.equal(manual.name,'Kundens eget 28x120 terrassebord');assert.equal(manual.productId,'');assert.equal(manual.cost,4150);assert.equal(manual.supplier,'Avtale med varehus');
});
test('Demolition without materials, excluded tasks and service allowances do not become a goods list',()=>{
 const rows=[row,{...row,enabled:false},{...row,priceKey:null,manualPrice:false,name:'Rive terrassebord'},{...row,priceKey:'roof.waste.waste',name:'Avfall'},{...row,priceKey:'extension.foundation.foundation',name:'Grunnarbeid'},{...row,materialUnit:'rs',name:'Avsetning'}];
 assert.equal(materialList(rows,options).length,1);
 assert.equal(materialForRow({...row,priceKey:'foundation.slab.concrete',materialPriceChoice:'reference',priceBasis:'market_reference',name:'Støping og overflatebearbeiding'},options).name,'Betong','Physical foundation materials must not be removed as a service allowance');
 const missing=materialForRow({...row,materialQuantity:null,materialPriceChoice:'reference',priceBasis:'market_reference',material:null},options);assert.equal(missing.quantity,null);assert.equal(missing.cost,null);assert.equal(missing.price,null);
});
test('PDF offer and calculation get physical materials without changing any quote totals',()=>{
 const input={rows:[row],rates,project:{id:'project',name:'Terrasse Ås',customer:'Ødegård'},profile:{company:'Bygg AS'},offers:catalog.offers,bindings:options.bindings,options:{date:'2026-10-09'}};
 for(const type of ['offer','calculation']){
  const model=preparePdfDocument({...input,options:{...input.options,type}});
  assert.equal(model.materials[0].name,product.name);assert.equal(model.materials[0].quantity,415);assert.equal(model.materials[0].purchaseQuantity,415.8);
  assert.equal(model.totals.price,model.items.reduce((sum,item)=>sum+item.priceOre,0)+model.totals.rowRounding);
 }
});
test('Work, purchase and sales exports name the actual goods and keep the same sales sum',()=>{
 const input={rows:[row],rates,...options};
 const work=exportBasis(input,'work');assert.equal(work[1][work[0].indexOf('Materiale / produkt')],product.name);assert.equal(work[1][work[0].indexOf('Materialbehov')],415);
 const purchase=exportBasis(input,'purchase');assert.equal(purchase[1][5],product.name);assert.equal(purchase[1][6],product.source_id);assert.equal(purchase[1][9],415);assert.equal(purchase[1][11],415.8);assert.equal(purchase[1][12],99);
 const sale=exportBasis(input,'sale');assert.equal(sale[1][5],'Montere terrassebord');assert.equal(sale[2][5],product.name);
 assert(Math.abs(sale.slice(1).reduce((sum,line)=>sum+line[9],0)-(17.5*1265.625+6619.14*1.2))<1e-8);
 const reference=exportBasis({...input,rows:[{...row,materialPriceChoice:'reference',priceBasis:'market_reference',marketMaterialCost:undefined,marketPackages:undefined,marketPurchasedQuantity:undefined}]},'purchase');assert.equal(reference[1][6],'');assert.equal(reference[1][11],415);
});
