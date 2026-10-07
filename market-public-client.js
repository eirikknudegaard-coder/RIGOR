import {publicSources,sourceUrl,normalizePublicOffer} from './market-public-core.js?v=20261007-avklaringer';
export async function loadPublicCatalog(){
 const r=await fetch('./data/market-prices.json?price_check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Det offentlige prisregisteret er ikke tilgjengelig ('+r.status+').');const text=await r.text();if(text.length>8000000)throw Error('Prisregisteret er for stort');const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.offers)||data.offers.length>20000||!Array.isArray(data.sources))throw Error('Ugyldig prisregister');
 if(data.stores!==undefined&&(!Array.isArray(data.stores)||data.stores.length>100||data.stores.some(s=>s.chain!=='byggmax'||!/^\d{1,6}$/.test(s.id)||typeof s.name!=='string'||!s.name.trim())))throw Error('Ugyldig butikkliste');
 const ids=new Set();for(const o of data.offers){const source=publicSources.find(s=>s.id===o.chain);if(!source||ids.has(o.id)||typeof o.id!=='string'||typeof o.name!=='string'||!o.name.trim()||!['inkl','ekskl'].includes(o.vat)||!Number.isFinite(o.package_quantity)||o.package_quantity<=0||!Number.isSafeInteger(o.original_ore)||!Number.isSafeInteger(o.normalized_ore)||!Number.isSafeInteger(o.package_price_ex_vat_ore)||!Number.isFinite(Date.parse(o.checked_at))||o.store_id&&(o.price_kind!=='local'||!(data.stores||[]).some(s=>s.chain===o.chain&&s.id===o.store_id)))throw Error('Ugyldig leverandørpris');sourceUrl(o.url,source);ids.add(o.id);}
 // Existing confirmed observations retain their original timestamp and error.
 // This unit correction must not pretend an old or failed price was refreshed.
 return {...data,offers:data.offers.map(normalizePublicOffer)};
}
