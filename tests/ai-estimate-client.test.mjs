import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistantStatus} from '../ai-estimate-client.js';

test('Only a confirmed server response enables paid AI requests',async()=>{
 const status=await assistantStatus(async(url,options)=>{assert(url.endsWith('/rigor-ai-estimate'));assert.equal(options.cache,'no-store');assert(!options.method||options.method==='GET');return Response.json({ready:true});});
 assert.deepEqual(status,{ready:true,state:'ready'});
});
test('A missing function is distinguished from missing configuration',async()=>{
 assert.deepEqual(await assistantStatus(async()=>Response.json({code:'NOT_FOUND'},{status:404})),{ready:false,state:'missing-function'});
 assert.deepEqual(await assistantStatus(async()=>Response.json({ready:false})),{ready:false,state:'missing-secrets'});
});
test('Gateway auth failures do not falsely report a missing OpenAI key',async()=>{
 for(const code of [401,403])assert.deepEqual(await assistantStatus(async()=>new Response(null,{status:code})),{ready:false,state:'gateway-auth'});
});
test('Temporary errors, invalid JSON and network failure cannot enable AI',async()=>{
 for(const fetcher of [async()=>new Response(null,{status:503}),async()=>new Response('invalid'),async()=>Response.json({ready:'true'}),async()=>{throw Error('offline');}])assert.deepEqual(await assistantStatus(fetcher),{ready:false,state:'unavailable'});
});
