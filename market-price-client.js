const url='https://hyqiqjuycivihsgjongj.supabase.co';
const publicKey='sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl';
let client;
export async function priceApi(action,values={}){
 if(!client){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm');client=createClient(url,publicKey);}
 const {data}=await client.auth.getSession();if(!data.session)throw Error('Logg inn i RIGOR-portalen først.');
 const r=await fetch(url+'/functions/v1/rigor-market-prices',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({action,...values}),signal:AbortSignal.timeout(action==='sync'?100000:20000)});
 let payload;try{payload=await r.json();}catch{throw Error('Prissynk er ikke aktivert på serveren ennå.');}if(!r.ok)throw Error(payload.error||'Pristjenesten er ikke tilgjengelig.');return payload;
}
