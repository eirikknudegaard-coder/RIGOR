import {getPortalClient} from '../portal-session.js?v=20261007-innlogging';
const endpoint='https://hyqiqjuycivihsgjongj.supabase.co/functions/v1/rigor-ai-construction';
const apikey='sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl';
export async function constructionAiStatus(fetcher=fetch){
 try{const r=await fetcher(endpoint,{headers:{apikey},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)return {ready:false,state:r.status===404?'missing':'unavailable'};return await r.json().then(d=>({ready:d.ready===true,state:d.ready===true?'ready':'inactive'}));}catch{return {ready:false,state:'unavailable'};}
}
export async function requestConstruction(payload,fetcher=fetch){
 const client=await getPortalClient(),{data}=await client.auth.getSession();if(!data?.session?.access_token)throw Error('Logg inn i portalen før du bruker AI.');
 const r=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
 const dataR=await r.json().catch(()=>null);if(!r.ok)throw Error(dataR?.error||'AI-tjenesten kunne ikke svare. Beregningen og svarene er beholdt.');if(!dataR)throw Error('AI-svaret kunne ikke leses.');return dataR;
}
