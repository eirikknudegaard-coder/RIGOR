import {pathToFileURL} from 'node:url';
export async function waitForPagesArtifact({repository,runId,artifactId,artifactName,token,fetcher=fetch,clock=Date.now,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=120000}){
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository)||!/^\d+$/.test(String(runId))||!/^\d+$/.test(String(artifactId))||!/^github-pages-\d+-\d+$/.test(artifactName)||!token)throw Error('Missing or invalid Pages artifact configuration');
 const deadline=clock()+timeoutMs;
 while(clock()<deadline){
  const response=await fetcher('https://api.github.com/repos/'+repository+'/actions/runs/'+runId+'/artifacts?per_page=100',{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
  if(response.ok){
   const data=await response.json();if(!Array.isArray(data.artifacts))throw Error('Invalid artifact metadata');
   const matches=data.artifacts.filter(a=>a.name===artifactName);
   if(matches.length>1)throw Error('Duplicate artifact name for the current attempt');
   if(matches.length){
    const artifact=matches[0];
    if(String(artifact.id)!==String(artifactId)||artifact.expired||!Number.isSafeInteger(artifact.size_in_bytes)||artifact.size_in_bytes<=0)throw Error('Pages artifact identity, expiry or size does not match the upload');
    // The deployment action reads a separate artifact index. Allow that index
    // to catch up after the exact uploaded ID becomes visible in the REST API.
    await pause(15000);return artifact.id;
   }
  }else if(response.status!==429&&response.status<500)throw Error('Artifact metadata HTTP '+response.status);
  await pause(5000);
 }
 throw Error('Uploaded Pages artifact did not become visible in time');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const artifactId=await waitForPagesArtifact({repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,artifactId:process.env.PAGES_ARTIFACT_ID,artifactName:process.env.PAGES_ARTIFACT_NAME,token:process.env.GITHUB_TOKEN});
 console.log('Confirmed uploaded Pages artifact '+artifactId+' for this attempt');
}
