import {writeFile} from 'node:fs/promises';
// A regular app deployment must not replace the published registry with the
// empty seed from git. This same-origin copy has no supplier/AI/API calls.
for(const file of ['market-prices.json','market-queue.json']){
 try{const r=await fetch('https://rigor.no/data/'+file,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();if(text.length>8000000)throw Error('For stort register');const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data[file==='market-prices.json'?'offers':'urls']))throw Error('Ugyldig register');await writeFile('data/'+file,text);console.log('Videreførte',file);}catch(e){console.log('Ingen publisert kopi av',file,'–',e.message);}
}
