import {test} from 'node:test';import assert from 'node:assert/strict';
import {waitForPagesArtifact} from '../scripts/wait-pages-artifact.mjs';
const config={repository:'owner/repo',runId:'123',artifactId:'456',artifactName:'github-pages-123-2',token:'test-only'};
const artifact={id:456,name:config.artifactName,size_in_bytes:1234,expired:false};
test('Waits for the exact upload ID and current attempt, without selecting an old artifact',async()=>{
 let time=0,calls=0;const pauses=[];
 const id=await waitForPagesArtifact({...config,clock:()=>time,pause:async ms=>{time+=ms;pauses.push(ms);},fetcher:async(url,options)=>{assert(url.includes('/actions/runs/123/artifacts'));assert.equal(options.headers.Authorization,'Bearer test-only');return Response.json({artifacts:++calls===1?[{...artifact,id:111,name:'github-pages-123-1'}]:[artifact]});}});
 assert.equal(id,456);assert.equal(calls,2);assert.deepEqual(pauses,[5000,15000]);
});
test('Missing artifacts and transient API errors stop after a bounded wait',async()=>{
 for(const status of [200,503,429]){let time=0;await assert.rejects(waitForPagesArtifact({...config,timeoutMs:10000,clock:()=>time,pause:async ms=>{time+=ms;},fetcher:async()=>Response.json({artifacts:[]},{status})}),/in time/);}
});
test('Wrong IDs, duplicate names, expiry, empty packages and missing permissions cannot deploy',async()=>{
 for(const artifacts of [[{...artifact,id:789}],[artifact,artifact],[{...artifact,expired:true}],[{...artifact,size_in_bytes:0}]])await assert.rejects(waitForPagesArtifact({...config,fetcher:async()=>Response.json({artifacts}),pause:async()=>{throw Error('Should not settle invalid data');}}),/identity|Duplicate/);
 await assert.rejects(waitForPagesArtifact({...config,fetcher:async()=>new Response(null,{status:403})}),/HTTP 403/);
});
