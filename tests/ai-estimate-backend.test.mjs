import {test} from 'node:test';import assert from 'node:assert/strict';
import {handleEstimate} from '../supabase/functions/rigor-ai-estimate/handler.ts';import {catalog} from '../supabase/functions/rigor-ai-estimate/catalog.js';import {library} from '../kalkyle-library.js';import {shortlist,extractMeasurements,validateProposal,clarificationQuestions,appendClarificationAnswers} from '../supabase/functions/rigor-ai-estimate/proposal.js';import {proposalRows} from '../kalkyle-assistant.js';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',RIGOR_OPENAI_KEY:'fixture-key'};
const brief='Saltak, 30 grader og 100 m² takflate. Ta med takstein, sløfyer, sutak og vannrenner.';
const proposal={summary:'Testforslag',items:[{elementId:'roof.underlay',taskIds:['underlay','battens','laths'],scope:'requested',reason:'Undertak, sløyfer og lekter'}],questions:['Hva er samlet lengde på takrennene?']};
function request(body={brief},token=true){return new Request('https://example.test',{method:'POST',headers:{Origin:'https://rigor.no','Content-Type':'application/json',...(token?{Authorization:'Bearer fixture-token'}:{})},body:JSON.stringify(body)});}
function setup(options={}){let calls=0,payload,logged;return {env:k=>options.noKey&&k==='RIGOR_OPENAI_KEY'?undefined:env[k],fetch:async(url,init)=>{if(url.endsWith('/auth/v1/user'))return options.badAuth?Response.json({},{status:401}):Response.json({id:'fixture-user'});if(url.endsWith('/rpc/portal_has_access'))return Response.json(!options.inactive);if(url.endsWith('/rpc/portal_is_admin'))return Response.json(!options.member);if(url.includes('portal_tool_access'))return Response.json(options.allowed?[{tool_key:'kalkyle'}]:[]);if(url.endsWith('/rpc/reserve_rigor_ai_estimate'))return options.quota?Response.json({message:options.quota===true?'Daily user limit reached':options.quota},{status:options.quotaStatus||400}):Response.json('reservation');if(url==='https://api.openai.com/v1/chat/completions'){calls++;payload=JSON.parse(init.body);return options.apiError?Response.json({},{status:429}):Response.json({choices:[{message:{content:JSON.stringify(options.proposal||proposal)}}],usage:{prompt_tokens:5000,completion_tokens:250}});}if(url.includes('/rigor_ai_estimate_usage?')){logged=JSON.parse(init.body);return options.logError?Response.json({},{status:500}):new Response(null,{status:204});}throw Error('Unexpected fixture URL '+url);},calls:()=>calls,payload:()=>payload,logged:()=>logged};}
test('Ingen AI-kall uten innlogging, secret og aktiv portalkonto',async()=>{for(const options of [{noKey:true},{badAuth:true},{inactive:true}]){const deps=setup(options);assert.notEqual((await handleEstimate(request(),deps)).status,200);assert.equal(deps.calls(),0);}const deps=setup();assert.equal((await handleEstimate(request({brief},false),deps)).status,401);});
test('Medlem må ha tildelt kalkyleverktøy',async()=>{let deps=setup({member:true});assert.equal((await handleEstimate(request(),deps)).status,403);assert.equal(deps.calls(),0);deps=setup({member:true,allowed:true});assert.equal((await handleEstimate(request(),deps)).status,200);});
test('Forbruksgrense og stor input stopper før fakturering',async()=>{const deps=setup({quota:true});assert.equal((await handleEstimate(request(),deps)).status,429);assert.equal(deps.calls(),0);const large=setup();assert.equal((await handleEstimate(request({brief:'x'.repeat(20000)}),large)).status,413);assert.equal(large.calls(),0);});
test('Forslag bruker serverbibliotek, begrenset output og lagrer kun tokenantall',async()=>{const deps=setup();const r=await handleEstimate(request(),deps);assert.equal(r.status,200);const result=await r.json();assert.equal(result.measurements.area,100);assert.equal(result.measurements.angle,30);assert.equal(result.measurements.roofType,'gable');assert.equal(deps.payload().max_completion_tokens,3000);assert(deps.payload().response_format.json_schema.strict);assert.equal(deps.payload().model,'gpt-4.1-mini');assert.deepEqual(deps.logged(),{input_tokens:5000,output_tokens:250});});
test('Ukjente ID-er og prisfelt avvises',async()=>{for(const output of [{...proposal,items:[{...proposal.items[0],elementId:'unknown'}]},{...proposal,price:999}]){const deps=setup({proposal:output});assert.equal((await handleEstimate(request(),deps)).status,502);}});
test('API-feil og feil i forbrukslogging bekreftes ikke som forslag',async()=>{for(const options of [{apiError:true},{logError:true}])assert.notEqual((await handleEstimate(request(),setup(options))).status,200);});
test('Helsetest bruker ingen AI-kall og viser bare tilkoblingsstatus',async()=>{const deps=setup();const r=await handleEstimate(new Request('https://test',{method:'GET'}),deps);assert.deepEqual(await r.json(),{ready:true});assert.equal(deps.calls(),0);});
test('Autoritativt katalogsnapshot samsvarer med standardbiblioteket',()=>{assert.deepEqual(catalog.map(e=>[e.id,e.tasks.map(t=>t.id)]),library.map(e=>[e.id,e.tasks.map(t=>t.id)]));assert(shortlist(brief,catalog).some(e=>e.id==='roof.underlay'));});
test('Mål leses bare fra entydige opplysninger; lengder og arbeidstid gjettes ikke',()=>{assert.equal(extractMeasurements('100 m² takflate og 50 m² vegg').area,null);assert.equal(extractMeasurements('100 m2').basis,null);assert.equal(extractMeasurements('Et nytt tak').angle,null);const e=library.find(e=>e.id==='roof.ridge');const rows=proposalRows(e,0,'-fixture');assert(rows.every(r=>r.requiresQuantity&&!r.requiresTime&&r.hours===e.tasks[0].hours));const unknown=proposalRows(library.find(e=>e.id==='roof.finish.pvc'),100,'-fixture');assert(unknown.every(r=>r.requiresTime&&r.hours===0));assert.throws(()=>validateProposal({...proposal,items:[{...proposal.items[0],taskIds:['invented']}]},catalog));});

test('Brukerens takeksempel ber om vinkel og arealgrunnlag, og bruker svarene',()=>{
 const text='Skal bytte tak. Det er saltak, ca 20m2. Hele taket utenom takstoler skal byttes. Ta med undertak, sutak, sløyfer og takstein samt vindskier.';
 const q=clarificationQuestions(text);assert.deepEqual(q.map(q=>q.id),['roof-angle','roof-basis']);
 const answered=appendClarificationAnswers(text,q,{'roof-angle':'30','roof-basis':'Målt takflate'});
 assert.deepEqual(extractMeasurements(answered),{area:20,angle:30,roofType:'gable',basis:'surface'});assert.equal(clarificationQuestions(answered).length,0);
 assert.throws(()=>appendClarificationAnswers(text,q,{'roof-angle':'90'}));
});
test('Kledning avklarer materiale, retning, profil, areal og etterisolering uten å gjette',()=>{
 const text='Jeg skal bytte kledning.';const q=clarificationQuestions(text);
 assert.deepEqual(q.map(q=>q.id),['cladding-material','cladding-direction','cladding-profile','cladding-area','cladding-insulation']);
 const answered=appendClarificationAnswers(text,q,{'cladding-material':'Trekledning','cladding-direction':'Stående (vertikal)','cladding-profile':'Dobbelfals 19 × 148 mm','cladding-area':'40','cladding-insulation':'Nei, eksisterende isolasjon beholdes'});
 assert.equal(clarificationQuestions(answered).length,0);assert(answered.includes('Kledningsretning: Stående'));
 assert.equal(appendClarificationAnswers(text,q,{}),text);
 assert.throws(()=>appendClarificationAnswers('x'.repeat(7999),q,{'cladding-profile':'Dobbelfals'}));
});
test('Taktype etterspørres, og mansardtak har to egne vinkelfelt',()=>{
 assert(clarificationQuestions('Bytte tak på huset').some(q=>q.id==='roof-type'));
 const text='Mansardtak på 100 m² takflate med takstein';const q=clarificationQuestions(text);
 assert.deepEqual(q.map(q=>q.id),['roof-angle-lower','roof-angle-upper']);
 assert.equal(clarificationQuestions(appendClarificationAnswers(text,q,{'roof-angle-lower':'65','roof-angle-upper':'30'})).length,0);
});
test('Det strukturerte API-svaret begrenses til gyldige oppgaver i hvert element',async()=>{
 const deps=setup();assert.equal((await handleEstimate(request(),deps)).status,200);
 const variants=deps.payload().response_format.json_schema.schema.properties.items.items.anyOf;
 for(const branch of variants){const id=branch.properties.elementId.enum[0],e=catalog.find(e=>e.id===id);assert(e);assert.deepEqual(branch.properties.taskIds.items.enum,e.tasks.map(t=>t.id));}
 const duplicated={...proposal,items:[proposal.items[0],{...proposal.items[0],taskIds:['battens','battens']}]};
 const r=await handleEstimate(request(),setup({proposal:duplicated}));assert.equal(r.status,200);assert.equal((await r.json()).items.length,1);
});
test('Ventetid, dagsgrense og serverfeil får forskjellige svar',async()=>{
 for(const [quota,status,code] of [['Please wait before retrying',429,'cooldown'],['Daily user limit reached',429,'daily_limit'],['permission denied',503,'quota_unavailable']]){
  const deps=setup({quota});const r=await handleEstimate(request(),deps);assert.equal(r.status,status);assert.equal((await r.json()).code,code);assert.equal(deps.calls(),0);
 }
});
test('Terrassefilter stopper kledningsspørsmål og deler faglige spesifikasjoner',async()=>{
 const text='Jeg skal bytte terrassebord og bjelkelag på en terrasse på 50 m².';
 const output={summary:'Avklar materialvalg',items:[{elementId:'terrace.strip.joists',taskIds:['step0','step1'],scope:'requested',reason:'Eksisterende bord og bjelkelag skal rives'}],questions:['Ønskes stående eller liggende terrassebord?','Hvilket materiale og profil ønskes på terrassebordene?','Hva er arealet på terrassen (m²)?']};
 const deps=setup({proposal:output});const response=await handleEstimate(request({brief:text}),deps);assert.equal(response.status,200);
 const value=await response.json();assert(!value.questions.some(q=>/stående|liggende|arealet/.test(q)));
 assert(value.questions.includes('Hvilket materiale ønsker du til terrassebordene?'));
 assert(value.questions.includes('Hvilken overflate ønsker du på terrassebordene?'));
 const system=deps.payload().messages[0].content;assert(system.includes('Spør aldri om terrassebord er stående eller liggende'));assert(system.includes('spenn og belastning'));
});
test('Nye moduser bruker serverens fakta og validerte referanser; ubesvarte spørsmål begrenses',async()=>{
 for(const mode of ['simple_estimator','detailed_copilot']){
  const deps=setup();const response=await handleEstimate(request({brief,mode,context:{questionsAnswered:[]}}),deps);assert.equal(response.status,200);const value=await response.json();assert.equal(value.mode,mode);assert.equal(value.context.facts.area,100);assert(value.questions.length<=1);assert.equal(value.items[0].quantity,100);assert.equal(deps.payload().messages[1].content.includes(mode),true);assert.equal(deps.calls(),1);
 }
 for(const body of [{brief,mode:'fake'},{brief,mode:'simple_estimator',context:{price:999}},{brief,mode:'simple_estimator',context:{questionsAnswered:'fake'}}]){const deps=setup();assert.equal((await handleEstimate(request(body),deps)).status,400);assert.equal(deps.calls(),0);}
});
test('Providergrensen kan bruke en annen adapter uten å endre kalkyle eller sikkerhetskontroller',async()=>{
 const deps=setup();let received;deps.provider={async run(input){received=input;return {value:proposal,usage:{prompt_tokens:10,completion_tokens:20}};}};
 const response=await handleEstimate(request({brief,mode:'detailed_copilot'}),deps);assert.equal(response.status,200);assert.equal(received.mode,'detailed_copilot');assert.equal(received.context.facts.area,100);assert.equal(deps.calls(),0);assert.deepEqual(deps.logged(),{input_tokens:10,output_tokens:20});
 const inactive=setup({inactive:true});inactive.provider={async run(){throw Error('Must not call');}};assert.equal((await handleEstimate(request({brief,mode:'simple_estimator'}),inactive)).status,403);
});
