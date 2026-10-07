import {getPortalClient} from './portal-session.js?v=20261007-innlogging';
const endpoint='https://hyqiqjuycivihsgjongj.supabase.co/functions/v1/rigor-ai-estimate';
const publicKey='sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl';let client;
export async function assistantStatus(fetcher=fetch){
 try{
  const r=await fetcher(endpoint,{headers:{apikey:publicKey},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(r.status===404)return {ready:false,state:'missing-function'};
  if(r.status===401||r.status===403)return {ready:false,state:'gateway-auth'};
  if(!r.ok)return {ready:false,state:'unavailable'};
  const data=await r.json();
  if(data.ready===true)return {ready:true,state:'ready'};
  if(data.ready===false)return {ready:false,state:'missing-secrets'};
  return {ready:false,state:'unavailable'};
 }catch{return {ready:false,state:'unavailable'};}
}
export async function requestEstimate(brief){
 if(!client)client=await getPortalClient();
 const {data}=await client.auth.getSession();if(!data.session)throw Error('Logg inn i RIGOR-portalen før du bruker AI-assistenten.');
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({brief}),signal:AbortSignal.timeout(60000)});let result;try{result=await r.json();}catch{throw Error('AI-funksjonen er ikke tilgjengelig på serveren.');}if(!r.ok)throw Error(result.error||'Kunne ikke lage AI-forslag.');return result;
}
