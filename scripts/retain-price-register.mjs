import {readFile,writeFile} from 'node:fs/promises';
import {publishedRegister,validateRegister} from './price-register.mjs';
// A regular app deployment must not replace the published registry with the
// empty seed from git. This same-origin copy has no supplier/AI/API calls.
let register={catalog:JSON.parse(await readFile('data/market-prices.json','utf8')),queue:JSON.parse(await readFile('data/market-queue.json','utf8'))};
try{register=await publishedRegister(register,'https://rigor.no');}
catch(e){
 // An outage must not deploy git's empty seed over the real price register.
 validateRegister(register);if(!register.catalog.offers.length)throw Error('Publisering stoppet for å bevare markedsprisene: '+e.message);
 console.log('Bruker lokalt prisregister; publisert kopi kunne ikke hentes:',e.message);
}
await writeFile('data/market-prices.json',JSON.stringify(register.catalog,null,2)+'\n');
await writeFile('data/market-queue.json',JSON.stringify(register.queue,null,2)+'\n');
console.log('Videreførte samlet prisregister og kontrollkø fra',register.catalog.updated_at);
