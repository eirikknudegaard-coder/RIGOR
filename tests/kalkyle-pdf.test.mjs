import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePdfDocument,validateDocumentProfile,documentDate} from '../kalkyle-pdf-model.js';
import {calculate} from '../kalkyle-engine.js';
const rates={wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
const row={id:'one',taskKey:'roof.underlay.underlay',elementId:'roof.underlay',elementName:'Undertak',name:'Legge undertak ÆØÅ',unit:'m²',materialUnit:'m²',quantity:30,materialQuantity:30,hours:.2,factor:1.1,material:40,enabled:true,priceSource:'Verifisert leverandør',priceDate:'2026-10-08'};
const input={rows:[row],rates,project:{id:'project',name:'Takbytte Ås',customer:'Kunde Ødegård',address:'Ærligveien 1',number:'42'},profile:{company:'Bygg AS'},options:{date:'2026-10-08'},brief:'Bytte tak'};
test('PDF uses the same enabled rows, rates and totals without mutating the calculation',()=>{
 const original=structuredClone(input),model=preparePdfDocument({...input,rows:[row,{...row,id:'excluded',enabled:false,material:999999,name:'Excluded'}]});
 const result=calculate([row],rates,1);
 assert.equal(model.items.length,1);assert.equal(model.items[0].codes.sale.startsWith('RG-'),true);
 for(const k of ['price','gross','vat','cost','profit'])assert.equal(model.totals[k],Math.round(result[k]*100));
 assert.equal(model.totals.hours,result.hours);assert.equal(model.totals.hourly,result.hourly);
 assert.equal(model.totals.price,model.items.reduce((sum,r)=>sum+r.priceOre,0)+model.totals.rowRounding);
 assert.equal(model.totals.gross,model.totals.price+model.totals.vat+model.totals.vatRounding);
 assert.deepEqual(input,original);assert.equal(model.filename,'tilbud-Takbytte-Ås.pdf');
});
test('Incomplete data, invalid rates and invalid offer metadata cannot become a finished offer',()=>{
 for(const patch of [{priceIssue:'utdatert'},{requiresTime:true},{requiresQuantity:true,quantity:0},{hours:NaN},{materialQuantity:-1}])assert.throws(()=>preparePdfDocument({...input,rows:[{...row,...patch}]}));
 assert.throws(()=>preparePdfDocument({...input,rows:[]}));assert.throws(()=>preparePdfDocument({...input,rates:{...rates,billing:0}}));
 assert.throws(()=>preparePdfDocument({...input,profile:{}}),/bedriftens navn/);
 assert.throws(()=>preparePdfDocument({...input,project:{...input.project,customer:''}}),/kunde/);
 assert.throws(()=>preparePdfDocument({...input,options:{date:'2026-02-30'}}),/dato/);
 assert.throws(()=>preparePdfDocument({...input,options:{date:'2026-10-08',validUntil:'2026-10-07'}}),/dato/);
 assert.throws(()=>preparePdfDocument({...input,project:{}}),/prosjekt/);
 assert.throws(()=>preparePdfDocument({...input,priceMode:'example',rows:[{...row,priceKey:'roof.underlay.undertak'}]}),/Eksempelpriser/);
 assert.equal(preparePdfDocument({...input,priceMode:'example',rows:[{...row,priceKey:'roof.underlay.undertak'}],options:{type:'calculation'}}).type,'calculation');
});
test('Calculation metadata, manual costs, package rounding and projected hours survive into the document',()=>{
 const model=preparePdfDocument({...input,options:{type:'calculation',date:'2026-10-08',terms:'Kun angitte poster'},rows:[{...row,marketMaterialCost:1600,marketPackages:4,marketPurchasedQuantity:40,timeSource:'Målt tid',codeMappings:{work:'LØNN-1',purchase:'KJØP-1',sale:'SALG-1',salary:'101'}}]});
 assert.equal(model.title,'Beregning');assert.equal(model.items[0].marketMaterialCost,1600);
 assert.equal(model.items[0].marketPackages,4);assert.equal(model.items[0].timeSource,'Målt tid');
 assert.equal(model.items[0].materialOre,192000);assert.equal(model.terms,'Kun angitte poster');
 assert.equal(model.items[0].codes.work,'LØNN-1');assert.equal(model.items[0].codes.purchase,'KJØP-1');assert.equal(model.items[0].codes.sale,'SALG-1');assert.equal(model.items[0].codes.salary,'101');
 assert.equal(preparePdfDocument({...input,profile:{},project:{...input.project,customer:''},options:{type:'calculation',date:'2026-10-08'}}).type,'calculation');
});
test('Sender logos accept only bounded normalized PNG data and document dates use Oslo time',t=>{
 for(const logo of [{data:'https://example.test/logo.png',width:100,height:20},{data:'data:image/svg+xml,<svg/>',width:100,height:20},{data:'data:image/png;base64,iVBORw0KGgo'+ 'A'.repeat(550000),width:100,height:20},{data:'data:image/png;base64,iVBORw0KGgoAAA=',width:0,height:20}])assert.throws(()=>validateDocumentProfile({logo}));
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-08T22:30:00Z')});assert.equal(documentDate(),'2026-10-09');
});
