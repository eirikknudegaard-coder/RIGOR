import {normalizeOffer,matchProducts,safeProductUrl,selectCatalog} from './core.js';
import {adapters,checkRobots} from './adapters.ts';
const base=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
async function db(path:string,method='GET',body?:unknown){const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Databaseoperasjon feilet ('+r.status+')');return r.status===204?null:r.json();}
async function member(token:string){const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});if(!r.ok)return null;const user=await r.json();const members=await db('portal_users?user_id=eq.'+encodeURIComponent(user.id)+'&select=role,active');return members[0]?.active?members[0]:null;}
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
async function run(force:boolean){
 const id=await db('rpc/claim_rigor_price_job','POST',{});if(!id)return {status:'already_running_or_recent'};
 let succeeded=0,failed=0;const start=Date.now();const signal=AbortSignal.timeout(80000);
 try{
  const sources=await db('rigor_price_sources?enabled=eq.true&permitted=eq.true');
  for(const source of sources){if(Date.now()-start>60000)break;if(!force&&source.last_started_at&&Date.now()-Date.parse(source.last_started_at)<source.interval_hours*3600000)continue;
   const products=await db('rigor_price_products?chain=eq.'+source.chain+'&enabled=eq.true&approved=eq.true&order=last_attempt_at.asc.nullsfirst&limit=20');
   if(!products.length)continue;
   await db('rigor_price_sources?chain=eq.'+source.chain,'PATCH',{last_started_at:new Date().toISOString()});
   let sourceError='';try{await checkRobots(source.chain,products,signal);}catch(e){sourceError=String(e.message).slice(0,500);}
   for(const p of products){if(Date.now()-start>65000)break;const attempted=new Date().toISOString();
    try{if(sourceError)throw Error(sourceError);let offer;
     for(let attempt=0;attempt<2;attempt++){try{offer=await adapters[source.chain](p,AbortSignal.any([signal,AbortSignal.timeout(8000)]));break;}catch(e){if(attempt||!([429,502,503,504].includes(e.status)))throw e;const ra=Number(e.retryAfter);const retryDate=Date.parse(e.retryAfter);const delay=Number.isFinite(ra)&&ra>0?ra*1000:Number.isFinite(retryDate)?Math.max(0,retryDate-Date.now()):2000;if(delay>5000)throw e;await new Promise(r=>setTimeout(r,delay));}}
     const normalized=normalizeOffer(offer,p);const previous=await db('rigor_price_observations?product_id=eq.'+p.id+'&accepted=eq.true&order=checked_at.desc&limit=1');const old=previous[0];const suspicious=old&&(normalized.normalized_ore<old.normalized_ore*.5||normalized.normalized_ore>old.normalized_ore*1.5);const checked=new Date().toISOString();
     await db('rigor_price_observations','POST',{product_id:p.id,job_id:id,checked_at:checked,product_snapshot:p,original_ore:normalized.original_ore,normalized_ore:normalized.normalized_ore,unit:normalized.unit,conversion:normalized.conversion,availability:normalized.availability,valid_until:normalized.valid_until,accepted:!suspicious,flag:suspicious?'Prisendring over 50 % krever kontroll':null});
     await db('rigor_price_products?id=eq.'+p.id,'PATCH',{last_attempt_at:attempted,...(!suspicious?{last_success_at:checked}:{}),last_error:suspicious?'Prisendring flagget; siste gyldige pris beholdt':null});if(suspicious)failed++;else succeeded++;
    }catch(e){failed++;await db('rigor_price_products?id=eq.'+p.id,'PATCH',{last_attempt_at:attempted,last_error:String(e.message).slice(0,500)});}
   }
  }
  await db('rigor_price_jobs?id=eq.'+id,'PATCH',{finished_at:new Date().toISOString(),status:'completed',succeeded,failed});return {id,status:'completed',succeeded,failed};
 }catch(e){await db('rigor_price_jobs?id=eq.'+id,'PATCH',{finished_at:new Date().toISOString(),status:'failed',succeeded,failed,error:String(e.message).slice(0,500)});throw e;}
}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});if(request.method!=='POST')return response({error:'POST kreves'},405);
 if(!base||!key)return response({error:'Serveroppsett mangler'},503);
 try{
  if(Number(request.headers.get('content-length'))>30000)return response({error:'For stor forespørsel'},413);const raw=await request.text();if(raw.length>30000)return response({error:'For stor forespørsel'},413);const body=JSON.parse(raw);const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');const scheduleKey=Deno.env.get('RIGOR_PRICE_JOB_KEY');
  // Scheduler requires a dedicated secret; database service keys never go to the browser.
  if(body.action==='sync'&&scheduleKey&&token===scheduleKey)return response(await run(false));
  const user=await member(token);if(!user)return response({error:'Logg inn med aktiv portalkonto'},401);
  if(body.action==='catalog'){const groups=await db('rigor_price_groups');const products=await db('rigor_price_products?approved=eq.true&enabled=eq.true');const observations=await db('rigor_price_observations?accepted=eq.true&order=checked_at.desc&limit=2000');const sources=await db('rigor_price_sources?enabled=eq.true&permitted=eq.true');return response({...selectCatalog(groups,products.filter(p=>sources.some(s=>s.chain===p.chain)),observations),groups});}
  if(user.role!=='admin')return response({error:'Administrator kreves'},403);
  if(body.action==='sync')return response(await run(true));
  if(body.action==='admin'){const [sources,groups,products,jobs,observations]=await Promise.all(['rigor_price_sources','rigor_price_groups','rigor_price_products','rigor_price_jobs?order=started_at.desc&limit=20','rigor_price_observations?order=checked_at.desc&limit=100'].map(p=>db(p)));return response({sources,groups,products,jobs,observations});}
  if(body.action==='source'){if(!['obs','byggmax'].includes(body.chain)||typeof body.enabled!=='boolean'||typeof body.permitted!=='boolean'||!Number.isInteger(body.interval_hours)||body.interval_hours<6||body.interval_hours>168||typeof body.permission_note!=='string'||body.permission_note.length>1000||(body.permitted&&!body.permission_note.trim()))throw Error('Dokumenter tillatelse og kontroller robots.txt før aktivering');return response(await db('rigor_price_sources?chain=eq.'+body.chain,'PATCH',{enabled:body.enabled,permitted:body.permitted,permission_note:body.permission_note,interval_hours:body.interval_hours}));}
  if(body.action==='group'){const g=body.group;if(!g||!['timber','decking','gypsum','insulation'].includes(g.kind)||!['m','m2','stk'].includes(g.unit)||!String(g.name||'').trim()||String(g.name).length>160||!/^[a-z][a-z0-9_.-]{1,99}$/.test(g.price_key)||!g.specs||Array.isArray(g.specs))throw Error('Ugyldig produktgruppe');return response(await db('rigor_price_groups','POST',{name:g.name,price_key:g.price_key,kind:g.kind,unit:g.unit,specs:g.specs}));}
  if(body.action==='product'){const p=body.product;safeProductUrl(p.url,p.chain);const groups=await db('rigor_price_groups?id=eq.'+encodeURIComponent(p.group_id));if(!groups[0])throw Error('Produktgruppe mangler');if(p.unit!==groups[0].unit)throw Error('Ulik sammenligningsenhet');const match=matchProducts({...groups[0],specs:groups[0].specs},{kind:groups[0].kind,specs:p.specs});if(p.approved&&(!['identical','equivalent'].includes(match.status)||!String(p.approval_note||'').trim()))throw Error('Koblingen mangler like spesifikasjoner eller godkjenningsnotat');normalizeOffer({price:1,currency:'NOK'},p);if(!String(p.source_id||'').trim()||!String(p.name||'').trim()||!String(p.original_unit||'').trim())throw Error('Produkt-ID, navn og originalenhet kreves');const values={group_id:p.group_id,chain:p.chain,source_id:p.source_id,name:p.name,url:p.url,ean:p.ean||null,nobb:p.nobb||null,specs:p.specs,original_unit:p.original_unit,package_quantity:p.package_quantity,unit:p.unit,vat:p.vat,price_kind:p.price_kind,store_id:p.store_id||null,area:p.area||null,approved:Boolean(p.approved),approval_note:p.approval_note||'',enabled:Boolean(p.enabled)};return response(await db(p.id?'rigor_price_products?id=eq.'+encodeURIComponent(p.id):'rigor_price_products',p.id?'PATCH':'POST',values));}
  return response({error:'Ukjent handling'},400);
 }catch(e){return response({error:String(e.message).slice(0,500)},400);}
});
