import {readFile} from 'node:fs/promises';

// Apply only AI estimate setup, preserving existing portal and price tables.
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw Error('SUPABASE_ACCESS_TOKEN mangler. Legg Supabase-deploytilgangen i sikre miljøinnstillinger.');
const endpoint='https://api.supabase.com/v1/projects/hyqiqjuycivihsgjongj/database/query';
async function query(sql){
 const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(60000)});
 // Do not log API bodies, credentials or database records.
 if(!response.ok)throw Error('Supabase-oppsettet kunne ikke utføres (HTTP '+response.status+').');
 return response.json();
}
const prerequisite=await query("select to_regprocedure('public.portal_has_access()') is not null and to_regprocedure('public.portal_is_admin()') is not null and to_regclass('public.portal_tool_access') is not null as ready;");
if(prerequisite?.[0]?.ready!==true)throw Error('Eksisterende portaloppsett mangler. Ingen AI-oppsett er endret.');
const sql=await readFile(new URL('../supabase/migrations/202610060001_ai_estimate_limits.sql',import.meta.url),'utf8');
await query('begin;\n'+sql+'\ncommit;');
console.log('AI-forbruksregister og forespørselsgrenser er klare. Eksisterende registrerte forbruk er bevart.');
