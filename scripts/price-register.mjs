// Keep the catalogue and its retry queue together. In particular, do not
// replace a newer local register with a stale copy served during deployment.
export function validateRegister({catalog,queue}) {
 if(catalog?.version!==1||!Array.isArray(catalog.offers)||catalog.offers.length>20000||!Number.isFinite(Date.parse(catalog.updated_at)))throw Error('Ugyldig prisregister');
 if(queue?.version!==1||!Array.isArray(queue.urls)||queue.urls.length>20000)throw Error('Ugyldig kontrollkø');
 // Earlier registers did not stamp their queue. New runs stamp both files.
 if(queue.updated_at&&queue.updated_at!==catalog.updated_at)throw Error('Prisregister og kontrollkø er fra ulike kjøringer');
 return {catalog,queue};
}

export async function publishedRegister(current,baseUrl,{fetcher=fetch,clock=()=>Date.now()}={}) {
 const base=new URL(baseUrl);if(base.protocol!=='https:'||base.username||base.password)throw Error('Ugyldig registeradresse');
 async function read(file){
  const url=new URL('/data/'+file,base);url.searchParams.set('register_check',String(clock()));
  const response=await fetcher(url,{redirect:'error',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Prisregister svarte '+response.status);
  if(Number(response.headers.get('content-length'))>8000000)throw Error('Prisregisteret er for stort');
  const reader=response.body?.getReader();if(!reader)throw Error('Tomt prisregister');
  let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8000000)throw Error('Prisregisteret er for stort');chunks.push(value);}}finally{await reader.cancel();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }
 // No mutation of current if either file fails or belongs to another run.
 const [catalog,queue]=await Promise.all([read('market-prices.json'),read('market-queue.json')]);
 const incoming=validateRegister({catalog,queue});
 if(current.catalog?.offers?.length&&!incoming.catalog.offers.length)throw Error('Tomt register kan ikke erstatte eksisterende priser');
 try{validateRegister(current);}catch{return incoming;}
 return Date.parse(incoming.catalog.updated_at)>Date.parse(current.catalog.updated_at)?incoming:current;
}
