import {interpretationSchema,validateInterpretation,focusSchema,validateFocus} from '../../../construction/ai-contract.js';
import {validateContext} from '../../../construction/context.js';
import {analyzeStructure,explainResult} from '../../../construction/analysis.js';
import {openAIConstructionProvider,type ConstructionProvider} from './provider.ts';
type Dependencies={env:(key:string)=>string|undefined,fetch:typeof fetch,provider?:ConstructionProvider};
export async function handleConstruction(request:Request,deps:Dependencies){
 const origins=(deps.env('RIGOR_ALLOWED_ORIGINS')||'https://rigor.no,https://www.rigor.no,https://eirikknudegaard-coder.github.io').split(',').map(s=>s.trim()),origin=request.headers.get('Origin');
 const cors={'Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store'}});
 if(origin&&!origins.includes(origin))return reply(403,{error:'Origin er ikke tillatt.'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const url=deps.env('SUPABASE_URL'),anon=deps.env('SUPABASE_ANON_KEY'),service=deps.env('SUPABASE_SERVICE_ROLE_KEY'),key=deps.env('RIGOR_OPENAI_KEY');
 if(request.method==='GET')return reply(200,{ready:Boolean(url&&anon&&service&&(key||deps.provider))});
 if(request.method!=='POST')return reply(405,{error:'Bruk POST.'});
 const token=request.headers.get('Authorization');if(!token?.startsWith('Bearer '))return reply(401,{error:'Logg inn i RIGOR-portalen først.'});
 if(!url||!anon||!service||(!key&&!deps.provider))return reply(503,{error:'AI-tolkning er ikke aktivert. Beregningsmotoren og spørreflyten kan fortsatt brukes.'});
 if(deps.env('RIGOR_AI_PROVIDER')&&deps.env('RIGOR_AI_PROVIDER')!=='openai'&&!deps.provider)return reply(503,{error:'Valgt AI-leverandør er ikke konfigurert.'});
 const call=(target:string,init:RequestInit)=>deps.fetch(target,{...init,signal:AbortSignal.timeout(40000)});
 try{
  const auth={apikey:anon,Authorization:token,'Content-Type':'application/json'};
  const userR=await call(url+'/auth/v1/user',{headers:auth});if(!userR.ok)return reply(401,{error:'Innloggingen er utløpt.'});const user=await userR.json();if(typeof user?.id!=='string')return reply(401,{error:'Ugyldig konto.'});
  const activeR=await call(url+'/rest/v1/rpc/portal_has_access',{method:'POST',headers:auth,body:'{}'});if(!activeR.ok||await activeR.json()!==true)return reply(403,{error:'Aktiv portalkonto kreves.'});
  const adminR=await call(url+'/rest/v1/rpc/portal_is_admin',{method:'POST',headers:auth,body:'{}'});if(!adminR.ok)return reply(503,{error:'Tilgangskontrollen er utilgjengelig.'});const admin=await adminR.json();if(typeof admin!=='boolean')return reply(503,{error:'Tilgangen kunne ikke bekreftes.'});
  const toolR=await call(url+'/rest/v1/portal_tools?tool_key=eq.konstruksjon&select=tool_key,enabled',{headers:auth});if(!toolR.ok)return reply(503,{error:'Verktøytilgangen kunne ikke kontrolleres.'});const tools=await toolR.json();if(!Array.isArray(tools)||tools.length>1)return reply(503,{error:'Ugyldig verktøytilgang.'});
  if(tools.length&&tools[0].enabled!==true)return reply(403,{error:'Konstruksjonsverktøyet er deaktivert.'});
  if(!admin){if(!tools.length)return reply(403,{error:'Konstruksjonsverktøyet må være registrert og tildelt kontoen din.'});const accessR=await call(url+'/rest/v1/portal_tool_access?user_id=eq.'+encodeURIComponent(user.id)+'&tool_key=eq.konstruksjon&select=tool_key',{headers:auth});if(!accessR.ok)return reply(503,{error:'Verktøytildelingen kunne ikke kontrolleres.'});const access=await accessR.json();if(!Array.isArray(access)||!access.some(a=>a.tool_key==='konstruksjon'))return reply(403,{error:'Konstruksjonsverktøyet må være tildelt kontoen din.'});}
  const reader=request.body?.getReader();if(!reader)return reply(400,{error:'Beskriv konstruksjonen først.'});let size=0,raw='';const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>40000){await reader.cancel();return reply(413,{error:'Beskrivelsen er for stor.'});}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();
  let input,analysis,schema;try{
   input=JSON.parse(raw);
   if(!input||!['interpret','explain'].includes(input.action)||Object.keys(input).some(k=>!(input.action==='interpret'?['action','brief']:['action','context']).includes(k)))throw Error();
   if(input.action==='interpret'){if(typeof input.brief!=='string'||input.brief.trim().length<10||input.brief.length>8000)throw Error();schema=interpretationSchema();}
   else {analysis=analyzeStructure(validateContext(input.context));schema=focusSchema(analysis.findings.map(f=>f.id));}
  }catch{return reply(400,{error:'Beskrivelse eller konstruksjonsmodell er ugyldig. Ingen opplysninger er endret.'});}
  const serviceHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const quotaR=await call(url+'/rest/v1/rpc/reserve_rigor_ai_construction',{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_user_id:user.id})});
  if(!quotaR.ok){const detail=await quotaR.json().catch(()=>null);if(detail?.message==='Please wait before retrying')return reply(429,{error:'Vent 45 sekunder mellom AI-forespørsler. Beregningen og svarene er beholdt.',code:'cooldown',retryAfter:45});if(['Daily user limit reached','Daily project limit reached'].includes(detail?.message))return reply(429,{error:'Dagens grense for AI-tolkning er nådd. Spørreflyt og beregning fungerer fortsatt.',code:'daily_limit'});return reply(503,{error:'AI-forbruk kunne ikke kontrolleres. Dette er en serverfeil, ikke en nådd dagsgrense.',code:'quota_unavailable'});}
  const reservation=await quotaR.json();if(typeof reservation!=='string')return reply(503,{error:'Ugyldig forbruksreservasjon.'});
  const result=await (deps.provider||openAIConstructionProvider(deps)).run({action:input.action,brief:input.brief,findings:analysis?.findings,schema});
  if(result.error)return reply(502,{error:result.error==='provider_quota'?'OpenAI-kontoen mangler tilgjengelig API-saldo. Beregningen er beholdt.':result.error==='provider_auth'?'OpenAI-nøkkelen på serveren ble avvist.':'AI-tjenesten er midlertidig utilgjengelig. Beregningen er beholdt.',code:result.error});
  const usage=result.usage;if(!Number.isInteger(usage?.prompt_tokens)||usage.prompt_tokens<0||!Number.isInteger(usage?.completion_tokens)||usage.completion_tokens<0)return reply(502,{error:'AI-forbruk kunne ikke bekreftes.'});
  const logged=await call(url+'/rest/v1/rigor_ai_construction_usage?id=eq.'+encodeURIComponent(reservation),{method:'PATCH',headers:serviceHeaders,body:JSON.stringify({input_tokens:usage.prompt_tokens,output_tokens:usage.completion_tokens})});if(!logged.ok)return reply(503,{error:'AI-forbruket kunne ikke registreres.'});
  if(result.finishReason==='length')return reply(502,{error:'AI-tolkningen ble for lang. Bruk en kortere beskrivelse.',code:'output_too_long'});
  try{
   const value=typeof result.value==='string'?JSON.parse(result.value):result.value;
   if(input.action==='interpret')return reply(200,{...validateInterpretation(value,input.brief),requiresConfirmation:true});
   const focus=validateFocus(value,analysis.findings.map(f=>f.id));return reply(200,{explanation:explainResult(analysis,focus)});
  }catch{return reply(502,{error:'AI-svaret kunne ikke kontrolleres mot opplysningene eller beregningsmotoren. Ingen verdier er endret.',code:'interpretation_invalid'});}
 }catch{return reply(503,{error:'AI-tolkningen er utilgjengelig. Beregningsmotoren og de registrerte svarene er beholdt.'});}
}
