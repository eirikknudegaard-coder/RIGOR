import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentedConsumption,applyMaterialConsumption,familyConsumption} from '../material-consumption.js';
import {readFileSync} from 'node:fs';
import {applyPrices} from '../kalkyle-prices.js';
import {selectedPrices} from '../market-public-core.js';
const source='https://www.obsbygg.no/produkt/2151132',checkedAt='2026-10-09T10:00:00Z';
test('Documented consumption converts work area to actual length, without inventing joints or waste',()=>{
 const c=documentedConsumption('Beregn forbruk på 8,3 lm per m².',{source,checkedAt});
 const r=applyMaterialConsumption({unit:'m²',quantity:50,materialUnit:'m²',materialQuantity:50},c);
 assert.equal(r.materialQuantity,415);assert.equal(r.materialUnit,'m');assert.equal(r.materialRatio,8.3);
 assert.equal(applyMaterialConsumption({...r,quantity:100},documentedConsumption('Forbruk: 7,7 lm per m2.',{source,checkedAt})).materialQuantity,770);
 assert.equal(documentedConsumption('28x120 terrassebord',{source,checkedAt}),null);
 assert.equal(familyConsumption([{materialConsumption:c},{materialConsumption:{...c,value:8.2}}]),null);
 assert.equal(familyConsumption([{materialConsumption:c},{}]),null);
 assert.equal(applyMaterialConsumption({...r,manualMaterialQuantity:true,materialQuantity:500},c).materialQuantity,500);
 assert.equal(applyMaterialConsumption(r,{...c,value:8.2},{explicit:true}).materialQuantity,410);
});
test('Exact real SKU packaging determines whole packs, while work and material units stay separate',t=>{
 const catalog=JSON.parse(readFileSync(new URL('./fixtures/evidence/benchmark-catalog.json',import.meta.url))),bm=JSON.parse(readFileSync(new URL('./fixtures/evidence/bm-insulation-2026-10-09.json',import.meta.url)));
 t.mock.timers.enable({apis:['Date'],now:Date.parse(catalog.updated_at)});
 const row={priceKey:'insulation.isolasjon100',unit:'m²',materialUnit:'m²',quantity:100,materialQuantity:100};
 const priced=applyPrices([row],'market',selectedPrices(catalog.offers,{[row.priceKey]:'obs:ObsBygg-7022611099016'}),catalog.updated_at.slice(0,10))[0];
 assert.equal(priced.marketPackages,36);assert.equal(priced.marketPurchasedQuantity,100.8);assert.equal(priced.marketMaterialCost,14083.2);
 assert.equal(bm.observed.packageQuantity,2.76);assert.equal(Math.ceil(100/bm.observed.packageQuantity),37);assert.equal(bm.observed.referenceEligible,false);
 for(const [unit,quantity]of [['m2',100],['m',30],['stk',12]])assert.equal(applyMaterialConsumption({unit,quantity}, {value:1,materialUnit:unit,workUnit:unit,source,checkedAt,sourceType:'manufacturer_or_retailer_documentation'}).materialQuantity,quantity);
 t.mock.timers.reset();
});
