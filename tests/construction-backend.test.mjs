import {test} from 'node:test';import assert from 'node:assert/strict';
import {handleConstruction} from '../supabase/functions/rigor-ai-construction/handler.ts';
import {emptyContext,setFact} from '../construction/context.js';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',RIGOR_OPENAI_KEY:'test-key'};
const brief='Jeg vil lage en åpning på 3,2 meter i veggen.';
const output={facts:[{field:'openingM',value:3.2,evidence:'åpning på 3,2 meter'}]};
const req=(body={action:'interpret',brief},token=true,origin='https://rigor.no')=>new Request('https://test',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer test-token'}:{})},body:JSON.stringify(body)});
function fixture(options={}){
 let calls=0,payload,logged;const urls=[];
 return {env:k=>options.noKey&&k==='RIGOR_OPENAI_KEY'?undefined:env[k],fetch:async(url,init)=>{
  urls.push(url);if(url.endsWith('/auth/v1/user'))return options.badAuth?Response.json({},{status:401}):Response.json({id:'verified-user'});
  if(url.endsWith('/rpc/portal_has_access'))return Response.json(!options.inactive);
  if(url.endsWith('/rpc/portal_is_admin'))return Response.json(!options.member);
  if(url.includes('/portal_tools?'))return options.toolError?Response.json({},{status:500}):Response.json(options.unregistered?[]:[{tool_key:'konstruksjon',enabled:!options.disabled}]);
  if(url.includes('/portal_tool_access?'))return Response.json(options.allowed?[{tool_key:'konstruksjon'}]:options.kalkyle?[{tool_key:'kalkyle'}]:[]);
  if(url.endsWith('/rpc/reserve_rigor_ai_construction'))return options.quota?Response.json({message:options.quota},{status:400}):Response.json('reservation');
  if(url.includes('/rigor_ai_construction_usage?')){logged=JSON.parse(init.body);return new Response(null,{status:options.logError?503:204});}
  if(url==='https://api.openai.com/v1/chat/completions'){calls++;payload=JSON.parse(init.body);return options.providerError?Response.json({error:{code:'insufficient_quota'}},{status:429}):Response.json({choices:[{finish_reason:options.truncated?'length':'stop',message:{content:JSON.stringify(options.output||output)}}],usage:options.badUsage?{}:{prompt_tokens:100,completion_tokens:20}});}
  throw Error('Unexpected test URL');
 },calls:()=>calls,payload:()=>payload,logged:()=>logged,urls:()=>urls};
}
test('Health and preflight do not bill AI; origin, authentication and active portal access are enforced',async()=>{
 const d=fixture();assert.deepEqual(await (await handleConstruction(new Request('https://test'),d)).json(),{ready:true});assert.equal((await handleConstruction(new Request('https://test',{method:'OPTIONS',headers:{Origin:'https://rigor.no'}}),d)).status,204);assert.equal(d.calls(),0);
 for(const [options,status]of [[{noKey:true},503],[{badAuth:true},401],[{inactive:true},403],[{disabled:true},403],[{toolError:true},503]]){const deps=fixture(options);assert.equal((await handleConstruction(req(),deps)).status,status);assert.equal(deps.calls(),0);}
 assert.equal((await handleConstruction(req(undefined,false),d)).status,401);assert.equal((await handleConstruction(req(undefined,true,'https://evil.test'),d)).status,403);
});
test('Construction grants are independent of calculation access and verified-user filtered',async()=>{
 for(const options of [{member:true},{member:true,kalkyle:true},{member:true,unregistered:true,allowed:true}]){const d=fixture(options);assert.equal((await handleConstruction(req(),d)).status,403);assert.equal(d.calls(),0);}
 const d=fixture({member:true,allowed:true});assert.equal((await handleConstruction(req(),d)).status,200);assert(d.urls().some(u=>u.includes('user_id=eq.verified-user&tool_key=eq.konstruksjon')));
 assert.equal((await handleConstruction(req(),fixture({unregistered:true}))).status,200);
});
test('Strict bounded input and quota errors stop before provider billing',async()=>{
 for(const body of [{action:'fake',brief},{action:'interpret',brief,moment:999},{action:'interpret',brief:'x'.repeat(20000)},{action:'explain',context:{version:1,result:{approved:true}}}]){const d=fixture();assert.equal((await handleConstruction(req(body),d)).status,400);assert.equal(d.calls(),0);}
 const large=fixture();assert.equal((await handleConstruction(req({action:'interpret',brief:'x'.repeat(40001)}),large)).status,413);assert.equal(large.calls(),0);
 for(const [quota,status,code]of [['Please wait before retrying',429,'cooldown'],['Daily user limit reached',429,'daily_limit'],['permission denied',503,'quota_unavailable']]){const d=fixture({quota}),r=await handleConstruction(req(),d);assert.equal(r.status,status);assert.equal((await r.json()).code,code);assert.equal(d.calls(),0);}
});
test('Only quoted proposals are returned; material values and calculation outputs are excluded from AI schema',async()=>{
 const d=fixture(),r=await handleConstruction(req(),d);assert.equal(r.status,200);const data=await r.json();assert.equal(data.requiresConfirmation,true);assert.equal(data.facts[0].status,'PROPOSED');assert.equal(d.payload().model,'gpt-4.1-mini');assert(d.payload().response_format.json_schema.strict);assert.equal(d.payload().max_completion_tokens,2200);assert.deepEqual(d.logged(),{input_tokens:100,output_tokens:20});
 const schema=JSON.stringify(d.payload().response_format);assert(!schema.includes('momentNm'));assert(!schema.includes('ePa'));assert(!schema.includes('approved'));
 assert.equal((await handleConstruction(req(),fixture({output:{facts:output.facts,approved:true}}))).status,502);
 for(const bad of [{facts:[{...output.facts[0],value:10}]},{facts:[{field:'heightMm',value:198,evidence:'2x8'}]}]){const dep=fixture({output:bad}),response=await handleConstruction(req(),dep);assert.equal(response.status,200);const parsed=await response.json();assert.deepEqual(parsed.facts,[]);assert.equal(parsed.partial,true);}
 for(const options of [{providerError:true},{badUsage:true},{logError:true},{truncated:true}])assert.notEqual((await handleConstruction(req(),fixture(options))).status,200);
});
test('The terrace question keeps evidenced intent and c/c when an invented drager dimension is rejected',async()=>{
 const text='Hvor mange søyler trenger jeg på min terrasse? Jeg legger dobbel langsgående bjelke og enkle cc60 bjelker på tvers. Hvor bør de plasseres?';
 const proposed={facts:[{field:'goal',value:'plan_terrace',evidence:'Hvor mange søyler trenger jeg på min terrasse'},{field:'spacingMm',value:600,evidence:'cc60'},{field:'widthMm',value:96,evidence:'dobbel langsgående bjelke'}]};
 const d=fixture({output:proposed}),r=await handleConstruction(req({action:'interpret',brief:text,schemaVersion:2}),d),data=await r.json();
 assert.equal(r.status,200);assert.equal(data.facts.length,2);assert.equal(data.facts[0].value,'plan_terrace');assert.equal(data.facts[1].value,600);assert.deepEqual(data.rejectedFields,['widthMm']);assert.equal(data.partial,true);assert.equal(data.requiresConfirmation,true);assert.equal(d.calls(),1);
 const legacy=await handleConstruction(req({action:'interpret',brief:text}),fixture({output:proposed}));assert.equal(legacy.status,200);assert.deepEqual((await legacy.json()).facts.map(f=>f.field),['spacingMm']);
});
test('Wall interpretation keeps 2x6 studs and rejects invented size, member role and double-beam construction',async()=>{
 const text='trenger jeg en drager her? Bindingsverk cc 600, 2x6" vertikalesøyler, med dobbel hver 1.2m. Saltak med 25 graders vinkel. Jeg vil fjerne 2 meter av veggen';
 const proposed={facts:[{field:'openingM',value:2,evidence:'fjerne 2 meter'},{field:'nominalSection',value:'2x8',evidence:'2x6"'},{field:'memberRole',value:'beam',evidence:'trenger jeg en drager her?'},{field:'sectionConstruction',value:'multiple_members',evidence:'dobbel hver 1.2m'}]};
 const d=fixture({output:proposed}),r=await handleConstruction(req({action:'interpret',brief:text,schemaVersion:2}),d),data=await r.json();
 assert.equal(r.status,200);assert.deepEqual(data.facts.map(f=>f.field),['openingM']);assert.deepEqual(data.rejectedFields,['nominalSection','memberRole','sectionConstruction']);assert.equal(data.partial,true);
 const correct={facts:[{field:'nominalSection',value:'2x6',evidence:'2x6"'},{field:'memberRole',value:'column',evidence:'vertikalesøyler'}]};
 const valid=await handleConstruction(req({action:'interpret',brief:text,schemaVersion:2}),fixture({output:correct}));
 assert.equal(valid.status,200);assert.deepEqual((await valid.json()).facts.map(f=>f.value),['2x6','column']);
});
test('Explanation is rebuilt from the deterministic model and supports an independent provider adapter',async()=>{
 let c=emptyContext('En drager for orienterende lastanalyse');for(const [k,v]of Object.entries({goal:'check_beam',system:'simple',spanM:4,loadChoice:'line',lineLoadKnM:2,loadBasis:'documented',loadSource:'K-01'}))c=setFact(c,k,v);
 const d=fixture({output:{focusId:'support_result'}}),r=await handleConstruction(req({action:'explain',context:c}),d);assert.equal(r.status,200);const data=await r.json();assert.match(data.explanation.paragraphs[0],/4 kN/);assert.equal(data.explanation.focusId,'support_result');assert(!JSON.stringify(data).includes('godkjent løsning'));
 const fake=fixture({output:{focusId:'support_result',moment:999,approval:true}});assert.equal((await handleConstruction(req({action:'explain',context:c}),fake)).status,502);
 const alternate=fixture();alternate.provider={run:async input=>({value:output,usage:{prompt_tokens:1,completion_tokens:2}})};assert.equal((await handleConstruction(req(),alternate)).status,200);assert.equal(alternate.calls(),0);assert.deepEqual(alternate.logged(),{input_tokens:1,output_tokens:2});
});
