import {productTypes,specificationIssues} from './market-product-types.js';
// Deterministic comparison. No product attributes, tax status or prices are inferred.
export function safeProductUrl(value,chain){
 const url=new URL(value);const host={obs:'www.obsbygg.no',byggmax:'www.byggmax.no'}[chain];
 if(!host||url.protocol!=='https:'||url.hostname!==host||url.port||url.username||url.password)throw Error('Ugyldig produktadresse');
 return url.href;
}
export function normalizeOffer(offer,product){
 if(offer.currency!=='NOK'||!['inkl','ekskl'].includes(product.vat))throw Error('Ukjent valuta eller mva');
 const price=Number(offer.price);const content=Number(product.package_quantity);
 if(!Number.isFinite(price)||price<=0||price>1e7||!Number.isFinite(content)||content<=0)throw Error('Ugyldig pris eller pakningsinnhold');
 if(!['m','m2','stk'].includes(product.unit)||!['ordinary','campaign','member'].includes(product.price_kind))throw Error('Ukjent enhet eller pristype');
 const ore=Math.round(price*100);const exVat=product.vat==='inkl'?ore/1.25:ore;
 return {...offer,original_ore:ore,normalized_ore:Math.round(exVat/content),unit:product.unit,vat:'ekskl',price_kind:product.price_kind,conversion:`${price} NOK ${product.vat==='inkl'?'inkl.':'ekskl.'} MVA / ${content} ${product.unit}`};
}
export function matchProducts(a,b){
 const fields=Object.fromEntries(Object.entries(productTypes).map(([key,value])=>[key,value.fields]));
 if(a.kind!==b.kind||!fields[a.kind])return {status:'rejected',reason:'Ulik eller ukjent produkttype'};
 const missing=[...specificationIssues(a.kind,a.specs),...specificationIssues(b.kind,b.specs)];if(missing.length)return {status:'uncertain',reason:missing[0]};
 for(const k of fields[a.kind]){if(a.specs?.[k]===undefined||b.specs?.[k]===undefined)return {status:'uncertain',reason:'Mangler '+k};if(String(a.specs[k])!==String(b.specs[k]))return {status:'rejected',reason:'Ulik '+k};}
 const identical=['ean','nobb'].some(k=>a[k]&&b[k]&&a[k]===b[k]);
 return {status:identical?'identical':'equivalent',reason:identical?'Identifikator og spesifikasjoner stemmer':'Like dokumenterte spesifikasjoner'};
}
export function purchaseCost(required,packageQuantity,originalOre){
 if(![required,packageQuantity,originalOre].every(Number.isFinite)||required<0||packageQuantity<=0||originalOre<0)throw Error('Ugyldig kjøpsmengde');
 const packages=Math.ceil(required/packageQuantity);return {packages,purchased:packages*packageQuantity,costOre:packages*originalOre};
}
export function parseProductJsonLd(html,sourceId){
 const products=[];
 function visit(value){if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;const types=[value['@type']].flat();if(types.includes('Product'))products.push(value);if(value['@graph'])visit(value['@graph']);}
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(match[1]));}catch{/* malformed blocks are never used */}}
 const matching=products.filter(p=>[p.sku,p.productID,p.mpn,p.gtin,p.gtin13,p.gtin14].some(v=>String(v||'')===sourceId));
 if(matching.length!==1)throw Error('Kan ikke bekrefte riktig produkt-ID i strukturerte data');
 const product=matching[0];const offers=[product.offers].flat().filter(Boolean).filter(o=>o['@type']==='Offer');
 if(offers.length!==1)throw Error('Flere/ukjente tilbud krever egen verifisert adapter');
 const o=offers[0];if(o.priceSpecification||o.eligibleCustomerType||o.eligibleRegion)throw Error('Betinget eller sammensatt tilbud krever verifisert adapter');if(!o.price||o.priceCurrency!=='NOK')throw Error('Ingen entydig NOK-pris');
 return {name:product.name,source_id:sourceId,price:o.price,currency:o.priceCurrency,availability:o.availability||'unknown',valid_until:o.priceValidUntil||null};
}
export function selectCatalog(groups,products,observations,now=Date.now(),maxAgeHours=24){
 const prices=[];const offers=[];
 for(const group of groups){
  const candidates=products.filter(p=>p.group_id===group.id&&p.enabled&&p.approved);
  const ranked=[];
  for(const p of candidates){const o=observations.filter(o=>o.product_id===p.id&&o.accepted&&o.product_snapshot&&['group_id','source_id','url','unit','vat','price_kind','package_quantity','specs','store_id','area'].every(k=>JSON.stringify(o.product_snapshot[k]??null)===JSON.stringify(p[k]??null))).sort((a,b)=>b.checked_at.localeCompare(a.checked_at))[0];if(!o)continue;const age=now-Date.parse(o.checked_at);const fresh=age>=0&&age<=maxAgeHours*3600000&&(!o.valid_until||Date.parse(o.valid_until+'T23:59:59Z')>=now);const available=String(o.availability).endsWith('/InStock');const comparisons=candidates.filter(peer=>peer.id!==p.id&&peer.chain!==p.chain).map(peer=>matchProducts({...p,kind:group.kind},{...peer,kind:group.kind}));const comparison_status=comparisons.some(m=>m.status==='identical')?'identical':comparisons.some(m=>m.status==='equivalent')?'equivalent':'unpaired';offers.push({...o,product:p,fresh,comparison_status});if(fresh&&available&&!p.store_id&&!p.area&&!String(p.last_error||'').startsWith('Prisendring flagget')&&p.price_kind!=='member'&&p.unit===group.unit)ranked.push({p,o});}
  ranked.sort((a,b)=>a.o.normalized_ore-b.o.normalized_ore);
  if(ranked.length){const {p,o}=ranked[0];prices.push({prisnokkel:group.price_key,enhet:group.unit,pris:o.normalized_ore/100,kilde:p.chain+' · '+p.url,dato:o.checked_at.slice(0,10),valuta:'NOK',mva:'ekskl',checked_at:o.checked_at,product_id:p.id,original_ore:o.original_ore,package_price_ex_vat_ore:Math.round(p.vat==='inkl'?o.original_ore/1.25:o.original_ore),original_unit:p.original_unit,package_quantity:Number(p.package_quantity),conversion:o.conversion});}
 }
 return {prices,offers};
}
