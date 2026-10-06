import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishedRegister,validateRegister} from '../scripts/price-register.mjs';

function register(time,count=1){return {catalog:{version:1,updated_at:time,offers:Array.from({length:count},(_,i)=>({id:'product-'+i})),price_history:[{checked_at:time}]},queue:{version:1,updated_at:time,urls:[{url:'https://www.obsbygg.no/lekt',last_attempt_at:time}]}};}
const old=register('2026-10-06T15:08:54.742Z',32),fresh=register('2026-10-06T15:18:27.682Z',48);
function source(bundle,failedFile){return async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(url.origin,'https://rigor.no');if(url.pathname.endsWith(failedFile||'never'))return new Response('unavailable',{status:503});return Response.json(url.pathname.endsWith('market-prices.json')?bundle.catalog:bundle.queue);};}

test('A later publication restores prices, history and retry queue together',async()=>{const got=await publishedRegister(old,'https://rigor.no',{fetcher:source(fresh)});assert.equal(got.catalog.offers.length,48);assert.deepEqual(got.queue,fresh.queue);assert.deepEqual(got.catalog.price_history,fresh.catalog.price_history);});
test('A stale CDN response cannot roll back a newer local register',async()=>{assert.equal(await publishedRegister(fresh,'https://rigor.no',{fetcher:source(old)}),fresh);});
test('Failure of either file cannot partially replace the current register',async()=>{for(const file of ['market-prices.json','market-queue.json']){const current=structuredClone(old),before=structuredClone(current);await assert.rejects(publishedRegister(current,'https://rigor.no',{fetcher:source(fresh,file)}),/503/);assert.deepEqual(current,before);}});
test('Files served from different collection runs are rejected',async()=>{const mixed={catalog:fresh.catalog,queue:old.queue};assert.throws(()=>validateRegister(mixed),/ulike kjøringer/);await assert.rejects(publishedRegister(old,'https://rigor.no',{fetcher:source(mixed)}),/ulike kjøringer/);});
test('A newer empty response cannot erase existing prices and history',async()=>{await assert.rejects(publishedRegister(old,'https://rigor.no',{fetcher:source(register(fresh.catalog.updated_at,0))}),/Tomt register/);});
test('Existing unstamped queues remain readable; invalid or oversized data are rejected',()=>{const legacy=structuredClone(old);delete legacy.queue.updated_at;assert.deepEqual(validateRegister(legacy),legacy);assert.throws(()=>validateRegister({...old,queue:{version:1,urls:new Array(20001)}}));assert.throws(()=>validateRegister({...old,catalog:{...old.catalog,updated_at:'invalid'}}));});
