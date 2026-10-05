import {safeProductUrl,parseProductJsonLd} from './core.js';
// Separate adapters can be extended after source verification. Local/member prices
// are deliberately excluded: generic JSON-LD does not establish their context.
async function read(product:any,signal:AbortSignal){
 const url=safeProductUrl(product.url,product.chain);
 if(product.store_id||product.area)throw Error('Lokal pris krever verifisert butikkadapter');
 const response=await fetch(url,{signal,redirect:'error',headers:{'User-Agent':'RIGOR-PriceCheck/1.0','Accept':'text/html'}});
 if(!response.ok){const error:any=Error('Kilde svarte HTTP '+response.status);error.status=response.status;error.retryAfter=response.headers.get('Retry-After');throw error;}
 if(Number(response.headers.get('content-length'))>2000000)throw Error('Produktsiden er for stor');
 const reader=response.body?.getReader();if(!reader)throw Error('Tom kilde');let size=0,text='';const decoder=new TextDecoder();
 try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>2000000)throw Error('Produktsiden er for stor');text+=decoder.decode(chunk.value,{stream:true});}}finally{await reader.cancel();}
 return parseProductJsonLd(text,product.source_id);
}
export const adapters={obs:read,byggmax:read};
export async function checkRobots(chain:string,products:any[],signal:AbortSignal){
 const host=chain==='obs'?'https://www.obsbygg.no':'https://www.byggmax.no';
 const response=await fetch(host+'/robots.txt',{signal,redirect:'error'});
 if(!response.ok)throw Error('robots.txt kunne ikke kontrolleres: '+response.status);
 const text=await response.text();if(text.length>200000)throw Error('robots.txt for stor');
 // Conservative: collect applicable wildcard and RIGOR groups; longest rule wins.
 let applies=false,rules:any[]=[];let directives=false;
 for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim();const colon=line.indexOf(':');if(colon<0)continue;const key=line.slice(0,colon).toLowerCase(),value=line.slice(colon+1).trim();if(key==='user-agent'){if(directives){applies=false;directives=false;}applies=applies||value==='*'||/rigor/i.test(value);}else if(applies){directives=true;if(['allow','disallow'].includes(key)&&value)rules.push({allow:key==='allow',path:value});}}
 for(const p of products){const path=new URL(p.url).pathname;const matching=rules.filter(r=>new RegExp('^'+r.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replaceAll('*','.*').replace(/\\\$$/,'$')).test(path)).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));if(matching[0]&&!matching[0].allow)throw Error('robots.txt blokkerer produktsti');}
}
