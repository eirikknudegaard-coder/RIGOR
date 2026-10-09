import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidence,evidenceHtml} from './evidence-support.mjs';
import {readPublicProducts,publicSources} from '../market-public-core.js';
const source={...publicSources[0],tax_evidence:{url:'https://www.obsbygg.no/kjopsvilkar',vat:'inkl',statement:'Prisene er inklusiv mva.'}};
test('Live-checked Obs length SKU is priced per documented length, with 8.3 lm/m² consumption',()=>{
 const f=evidence('deck');const products=readPublicProducts(evidenceHtml(f),f.url,source,f.checkedAt);
 const board=products.find(p=>p.source_id==='ObsBygg-7040431913404');
 assert(board);assert.equal(board.unit,'m');assert.equal(board.package_quantity,3.6);assert.equal(board.original_ore,7164);assert.equal(board.normalized_ore,1592);assert.equal(board.materialConsumption.value,8.3);
});
test('Local/floating Obs price is excluded even when structured data says InStock',()=>{
 const f=evidence('deck2');assert.throws(()=>readPublicProducts(evidenceHtml(f),f.url,source,f.checkedAt),/lokal|lagersted|Betinget|fra-pris/i);
});
test('Consumption belongs to the selected cladding, never its recommended neighbors',()=>{
 const f=evidence('cladding-consumption');const p=readPublicProducts(evidenceHtml(f),f.url,source,f.checkedAt)[0];assert.equal(p.materialConsumption.value,7.7);
 const other=evidence('cladding');assert.equal(readPublicProducts(evidenceHtml(other),other.url,source,other.checkedAt)[0].materialConsumption,undefined);
});
test('Exact live insulation SKU has 2.8 m², distinct from Byggmakker 2.76 m²',()=>{
 const f=evidence('insulation'),p=readPublicProducts(evidenceHtml(f),f.url,source,f.checkedAt).find(p=>p.name.includes('100 MM'));
 assert.equal(p.package_quantity,2.8);assert.equal(p.original_ore,48900);assert.equal(p.package_price_ex_vat_ore,39120);
 const bm=evidence('bm-insulation');assert.equal(bm.observed.packageQuantity,2.76);assert.equal(bm.observed.referenceEligible,false);
});
test('Palema quantity requires actual spacing, not a universal 10 pieces per m²',async()=>{
 const {consumptionForProduct}=await import('../material-consumption.js');const f=evidence('palema'),p=readPublicProducts(evidenceHtml(f),f.url,source,f.checkedAt)[0];
 assert.equal(p.unit,'stk');assert.throws(()=>consumptionForProduct(p),/lekteavstand/);assert.throws(()=>consumptionForProduct(p,{lathSpacing:500}),/lekteavstand/);
 assert.equal(consumptionForProduct(p,{lathSpacing:375}).value,1e6/(300*375));
});
test('Collector blocks a disappeared live deck SKU and retains its history instead of silently replacing it',async()=>{
 const {syncPublicPrices}=await import('../scripts/sync-public-prices.mjs');const f=evidence('deck'),old=f.registerAtCheck;
 const fetcher=async url=>new Response(url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':url===source.vat_policy_url?'Prisene er inklusiv mva.':url===f.url?evidenceHtml(f):'',{status:url.startsWith(source.origin)?200:403});
 const result=await syncPublicPrices({previous:{offers:[old]},queue:{urls:[{url:f.url,chain:'obs'}],last_discovery:{obs:f.checkedAt,byggmax:f.checkedAt}},fetcher,clock:()=>Date.parse(f.checkedAt)+1000,pause:async()=>{},maxProducts:2});
 const retained=result.catalog.offers.find(o=>o.id===old.id);assert(retained);assert.match(retained.last_error||'',/variant.*ikke.*finnes|variant.*ikke.*tilgjengelig/i);assert.equal(retained.checked_at,old.checked_at);assert.equal(retained.normalized_ore,old.normalized_ore);
 assert(result.catalog.offers.some(o=>o.id==='obs:ObsBygg-7040431913428'&&!o.last_error));
});
test('Independent statistics on the real length variants equal the displayed median, without local prices',async()=>{
 const {buildMarketReference,requirementForRow}=await import('../market-reference.js');const f=evidence('deck'),products=readPublicProducts(evidenceHtml(f),f.url,source,f.checkedAt);
 const requirement=requirementForRow({priceKey:'terrace.new.deck',name:'Montere 28x120 impregnert terrassebord',unit:'m²',materialUnit:'m',quantity:50,materialQuantity:415});
 const stats=buildMarketReference({requirement,offers:products,now:Date.parse(f.checkedAt)}),prices=products.map(p=>Math.round(Number(p.original_ore)/1.25)/p.package_quantity/100).sort((a,b)=>a-b),expectedMedian=prices[Math.floor(prices.length/2)];
 assert.equal(stats.method,'median');assert.equal(stats.referencePrice,expectedMedian);assert(Math.abs(stats.meanPrice-prices.reduce((a,b)=>a+b,0)/prices.length)<1e-12);assert(Math.abs(stats.minPrice-Math.min(...prices))<1e-12);assert(Math.abs(stats.maxPrice-Math.max(...prices))<1e-12);assert.equal(stats.productCount,9);assert.equal(stats.supplierCount,1);assert.equal(stats.confidence,'medium');
});
