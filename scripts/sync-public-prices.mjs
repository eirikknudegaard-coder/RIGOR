import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {publicSources,sourceUrl,robotsPolicy,sitemapLinks,materialPriority,readPublicProduct} from '../market-public-core.js';
const USER_AGENT='RIGOR-PriceCheck/1.0 (+https://rigor.no)';
export async function syncPublicPrices({previous={offers:[]},queue={urls:[],last_discovery:{}},fetcher=fetch,clock=()=>Date.now(),pause=ms=>new Promise(r=>setTimeout(r,ms)),maxProducts=120,maxSitemaps=16,budgetMs=600000}={}){
 const start=clock(),stamp=()=>new Date(clock()).toISOString(),report={started_at:stamp(),finished_at:null,checked:0,succeeded:0,failed:0,discovered:0,errors:[]};const offers=new Map((previous.offers||[]).map(o=>[o.id,{...o}]));const queued=new Map((queue.urls||[]).map(q=>[q.url,{...q}]));const discovery={...queue.last_discovery};const statuses=[];let budget=maxProducts;
 async function read(url,maxBytes){const r=await fetcher(url,{redirect:'error',headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/xml,text/plain'},signal:AbortSignal.timeout(15000)});if(!r.ok){const error=Error('HTTP '+r.status);error.status=r.status;throw error;}if(Number(r.headers.get('content-length'))>maxBytes)throw Error('Kildedokument for stort');const reader=r.body?.getReader();if(!reader)throw Error('Tom kilde');let bytes=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)throw Error('Kildedokument for stort');chunks.push(value);}}finally{await reader.cancel();}const body=Buffer.concat(chunks);return (url.endsWith('.gz')?gunzipSync(body,{maxOutputLength:maxBytes}):body).toString('utf8');}
 for(const source of publicSources){
  const status={chain:source.id,last_attempt_at:stamp(),robots_checked:false,discovered:0,checked:0,succeeded:0,failed:0,error:null};statuses.push(status);let stopped=false;
  try{
   const policy=robotsPolicy(await read(source.origin+'/robots.txt',200000));status.robots_checked=true;if(policy.delay>30)throw Error('Crawl-delay over 30 sekunder; kilde må bruke feed');
   let lastRequest=clock();async function fetchPage(url,maxBytes){sourceUrl(url,source);if(!policy.allows(url))throw Error('robots.txt blokkerer adressen');const wait=policy.delay*1000-(clock()-lastRequest);if(wait>0)await pause(wait);lastRequest=clock();return read(url,maxBytes);}
   // Discover only from retailer-published sitemaps, once a day. Keep the queue
   // between runs so already discovered material families are not lost.
   const cursor=discovery[source.id];
   if(!cursor||cursor.pending?.length||clock()-Date.parse(cursor.finished_at||cursor)>86400000){
    const maps=cursor?.pending?.length?[...cursor.pending]:[...policy.sitemaps];if(!maps.length)maps.push(source.origin+'/sitemap.xml');const seen=new Set(cursor?.pending?.length?cursor.seen:[]);let readCount=0,complete=true;
    while(maps.length&&readCount<maxSitemaps&&clock()-start<budgetMs){const url=maps.shift();if(seen.has(url))continue;seen.add(url);try{sourceUrl(url,source);const data=sitemapLinks(await fetchPage(url,8000000));readCount++;if(data.index){const children=data.urls.filter(u=>{try{return new URL(u).origin===source.origin;}catch{return false;}}).sort((a,b)=>Number(/product|produkt/i.test(b))-Number(/product|produkt/i.test(a)));maps.push(...children);}else{for(let url of data.urls){try{url=sourceUrl(url,source);const priority=materialPriority(url);if(!priority||!policy.allows(url)||queued.has(url)||queued.size>=20000)continue;queued.set(url,{url,chain:source.id,priority,last_attempt_at:null,next_attempt_at:null,error:null});status.discovered++;report.discovered++;}catch{/* cross-origin/invalid URLs never enter the queue */}}}}catch(e){complete=false;maps.push(url);seen.delete(url);readCount++;report.errors.push({chain:source.id,stage:'discovery',error:e.message});if([401,403,429].includes(e.status)){stopped=true;break;}}}
    // No fresh discovery timestamp when maps could not be checked. Partial
    // discovery is retried on the next run instead of silently stalling.
    discovery[source.id]={finished_at:complete&&!maps.length?stamp():null,pending:maps.slice(0,500),seen:[...seen].slice(0,500)};
   }
   const sourceBudget=Math.max(0,Math.min(budget,Math.ceil(maxProducts/publicSources.length)));
   const due=[...queued.values()].filter(q=>q.chain===source.id&&(!q.next_attempt_at||Date.parse(q.next_attempt_at)<=clock())).sort((a,b)=>(Date.parse(a.last_attempt_at)||0)-(Date.parse(b.last_attempt_at)||0)||b.priority-a.priority).slice(0,sourceBudget);
   for(const q of due){if(stopped||budget<=0||clock()-start>=budgetMs)break;report.checked++;status.checked++;budget--;q.last_attempt_at=stamp();q.next_attempt_at=new Date(clock()+21600000).toISOString();
    try{const html=await fetchPage(q.url,2000000);const offer=readPublicProduct(html,q.url,source,stamp());const old=offers.get(offer.id);if(old&&(offer.normalized_ore<old.normalized_ore*.5||offer.normalized_ore>old.normalized_ore*1.5))throw Error('Prisendring over 50 %: krever kontroll');offers.set(offer.id,offer);q.error=null;status.succeeded++;report.succeeded++;}
    catch(e){q.error=String(e.message).slice(0,300);q.next_attempt_at=new Date(clock()+(/Ingen entydig Product|Ikke en støttet byggevare/.test(q.error)?7*86400000:21600000)).toISOString();for(const o of offers.values())if(o.url===q.url)o.last_error=q.error;status.failed++;report.failed++;if([401,403,429].includes(e.status)){status.error=q.error;stopped=true;}}
   }
  }catch(e){status.error=String(e.message).slice(0,300);report.errors.push({chain:source.id,stage:'source',error:status.error});}
 }
 report.finished_at=stamp();return {catalog:{version:1,updated_at:report.finished_at,last_run:report,offers:[...offers.values()],sources:statuses},queue:{version:1,urls:[...queued.values()],last_discovery:discovery}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
 const previous=await read('data/market-prices.json',{offers:[]}),queue=await read('data/market-queue.json',{urls:[],last_discovery:{}});const result=await syncPublicPrices({previous,queue});await mkdir('data',{recursive:true});await writeFile('data/market-prices.json',JSON.stringify(result.catalog,null,2)+'\n');await writeFile('data/market-queue.json',JSON.stringify(result.queue,null,2)+'\n');console.log(JSON.stringify(result.catalog.last_run));if(!result.catalog.sources.some(s=>s.robots_checked))process.exitCode=1;
}
