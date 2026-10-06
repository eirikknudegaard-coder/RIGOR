const endpoint='https://hyqiqjuycivihsgjongj.supabase.co/functions/v1/rigor-ai-estimate';
const publicKey='sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl';let client;
export async function assistantStatus(){try{const r=await fetch(endpoint,{headers:{apikey:publicKey},signal:AbortSignal.timeout(10000)});if(!r.ok)return false;return (await r.json()).ready===true;}catch{return false;}}
export async function requestEstimate(brief){
 if(!client){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm');client=createClient('https://hyqiqjuycivihsgjongj.supabase.co',publicKey);}
 const {data}=await client.auth.getSession();if(!data.session)throw Error('Logg inn i RIGOR-portalen før du bruker AI-assistenten.');
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({brief}),signal:AbortSignal.timeout(60000)});let result;try{result=await r.json();}catch{throw Error('AI-funksjonen er ikke tilgjengelig på serveren.');}if(!r.ok)throw Error(result.error||'Kunne ikke lage AI-forslag.');return result;
}
