import {test} from 'node:test';import assert from 'node:assert/strict';
import {handleImportMap} from '../supabase/functions/rigor-import-map/handler.ts';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',RIGOR_OPENAI_KEY:'secret-test'};
const mapping={prisnokkel:0,enhet:1,pris:2,kilde:null,dato:null,valuta:null,mva:null};
const body={headers:['Post','Enhet','Pris'],rows:[['roof.cover.metal','m2','100']]};
function request(data=body,auth=true){return new Request('https://example.test',{method:'POST',headers:{Origin:'https://rigor.no','Content-Type':'application/json',...(auth?{Authorization:'Bearer token'}:{})},body:JSON.stringify(data)});}
function setup(options={}){
 let aiCalls=0,logged=null;
 const deps={env:k=>env[k],fetch:async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'user-id'});
  if(url.endsWith('/rpc/portal_has_access'))return Response.json(true);
  if(url.endsWith('/rpc/portal_is_admin'))return Response.json(!options.notAdmin);
  if(url.endsWith('/rpc/reserve_rigor_ai_import'))return options.quota?Response.json({}, {status:400}):Response.json('reservation-id');
  if(url.startsWith('https://api.openai.com')){aiCalls++;const payload=JSON.parse(init.body);assert.equal(payload.max_completion_tokens,1000);assert(payload.response_format.json_schema.strict);return Response.json({choices:[{message:{content:JSON.stringify(options.mapping||mapping)}}],usage:{prompt_tokens:500,completion_tokens:70}});}
  if(url.includes('/rigor_ai_import_usage?')){logged=JSON.parse(init.body);return new Response(null,{status:204});}
  throw Error('Unexpected route');
 }};return {deps,aiCalls:()=>aiCalls,logged:()=>logged};
}
test('Innlogging kreves før noen API-kall',async()=>{const s=setup();assert.equal((await handleImportMap(request(body,false),s.deps)).status,401);assert.equal(s.aiCalls(),0);});
test('Manglende API-nøkkel gir tydelig utilgjengelig-status',async()=>{const s=setup();s.deps.env=k=>k==='RIGOR_OPENAI_KEY'?undefined:env[k];assert.equal((await handleImportMap(request(),s.deps)).status,503);});
test('Vanlige brukere kan ikke utløse fakturerbare kall',async()=>{const s=setup({notAdmin:true});assert.equal((await handleImportMap(request(),s.deps)).status,403);assert.equal(s.aiCalls(),0);});
test('Avviser for stort utvalg før OpenAI-kallet',async()=>{const s=setup();assert.equal((await handleImportMap(request({...body,rows:Array(9).fill(body.rows[0])}),s.deps)).status,400);assert.equal(s.aiCalls(),0);});
test('Daglig grense blokkerer AI',async()=>{const s=setup({quota:true});assert.equal((await handleImportMap(request(),s.deps)).status,429);assert.equal(s.aiCalls(),0);});
test('Gyldig strukturert forslag returneres med tokenforbruk',async()=>{const s=setup();const response=await handleImportMap(request(),s.deps);assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.mapping,mapping);assert.deepEqual(s.logged(),{input_tokens:500,output_tokens:70});assert.equal(s.aiCalls(),1);assert(!JSON.stringify(data).includes('secret-test'));});
test('Duplikate AI-koblinger avvises',async()=>{const s=setup({mapping:{...mapping,enhet:0}});assert.equal((await handleImportMap(request(),s.deps)).status,502);});
