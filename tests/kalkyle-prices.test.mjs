import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const {parseCsv,validatePrices,priceStatus,applyPrices}=await import('data:text/javascript;base64,'+readFileSync(new URL('../kalkyle-prices.js',import.meta.url)).toString('base64'));
const header='prisnokkel;enhet;pris;kilde;dato;valuta;mva\n';
const row='roof.cover.metal;m2;123,45;"Leverandør; Oslo";2026-10-05;NOK;ekskl';
const prices=parseCsv(header+row);
test('CSV med desimalkomma, sitert kilde og BOM',()=>{assert.equal(parseCsv('\uFEFF'+header+row)[0].pris,123.45);assert.equal(prices[0].kilde,'Leverandør; Oslo');});
test('Avviser feil enhet, MVA, blank pris, duplikat og ugyldig dato',()=>{
 for(const [from,to] of [['m2','pakke'],['ekskl','inkl'],['123,45',''],['2026-10-05','2026-02-30']])assert.throws(()=>parseCsv(header+row.replace(from,to)));
 assert.throws(()=>parseCsv(header+row+'\n'+row));assert.throws(()=>validatePrices([]));
});
test('Priser blir utdaterte etter 30 dager og fremtidige datoer avvises',()=>{
 assert.equal(priceStatus(prices[0],'2026-11-04'),'gyldig');assert.equal(priceStatus(prices[0],'2026-11-05'),'utdatert');assert.equal(priceStatus(prices[0],'2026-10-04'),'fremtidig');
});
test('Mangler gir ingen eksempelpris; gyldige importer og manuelle priser brukes',()=>{
 const rows=[{priceKey:'roof.cover.metal',material:290,exampleMaterial:290},{priceKey:'roof.rig',material:90,exampleMaterial:90},{priceKey:null,material:0}];
 const result=applyPrices(rows,'import',prices,'2026-10-05');assert.equal(result[0].material,123.45);assert.equal(result[1].material,0);assert.equal(result[1].priceIssue,'mangler');assert.equal(result[2].priceIssue,null);
 assert.equal(applyPrices(result,'example',[])[0].material,290);
 assert.equal(applyPrices([{...rows[0],manualPrice:true,material:321}],'market',[])[0].material,321);
 assert.equal(applyPrices(rows,'market',prices,'2026-11-05')[0].priceIssue,'utdatert');
});
