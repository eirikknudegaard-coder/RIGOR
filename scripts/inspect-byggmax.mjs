import {writeFile} from 'node:fs/promises';
import {publicSources,robotsPolicy,sourceUrl} from '../market-public-core.js';
const source=publicSources.find(s=>s.id==='byggmax'),agent='RIGOR-PriceCheck/1.0 (+https://rigor.no)';
const robotsResponse=await fetch(source.origin+'/robots.txt',{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':agent}});
if(!robotsResponse.ok)throw Error('robots HTTP '+robotsResponse.status);
const robots=await robotsResponse.text(),policy=robotsPolicy(robots),samples=[],assets=[];
for(const url of ['https://storage.googleapis.com/bm-prd-ui-no/loader.js',source.origin+'/kundeservice/kj%C3%B8psvilk%C3%A5r']){
 if(new URL(url).origin===source.origin&&!policy.allows(url))continue;
 await new Promise(r=>setTimeout(r,policy.delay*1000));
 try{const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':agent}});if(!r.ok)throw Error('HTTP '+r.status);const body=await r.text();if(body.length>4000000)throw Error('Oversized asset');assets.push({url,text:body});}catch(e){assets.push({url,error:e.message});}
}
for(const path of ['/23x48-lekt-p08123048','/48x98-konstruksjonsvirke-c24-p08148098','/trefiberisolasjon-hunton-nativo-p16293','/gipsplate-p07525']){
 const url=sourceUrl(source.origin+path,source);if(!policy.allows(url))continue;await new Promise(r=>setTimeout(r,policy.delay*1000));
 try{const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':agent}});if(!response.ok)throw Error('HTTP '+response.status);const html=await response.text();if(html.length>4000000)throw Error('Oversized document');
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(v=>/function initPrice|function initQtyField|function initStock|function stockStatus|function initStore|function initProduct|custom-stock-price|csp-data|shopNumber|selected_shop/.test(v)).map(v=>v.replace(/(["']?(?:form_key|formKey)["']?\s*[:=]\s*)["'][^"']*["']/gi,'$1"[redacted]"').slice(0,140000));
 // Only public product/price code; never record cookies, request headers or form keys.
 const attrs=[...html.matchAll(/<[^>]*itemprop=["'](?:price|priceCurrency|availability|sku|name)[^>]*>/gi)].map(m=>m[0]).slice(0,30);
 const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(m=>/vilk|beting|terms/i.test(m[1]+' '+m[2])).map(m=>({url:new URL(m[1],source.origin).href,text:m[2].replace(/<[^>]*>/g,' ')})).slice(0,20);
 const unit=[...html.matchAll(/.{0,100}(?:package-unit|salesUnit|unitLabel|quantity_unit|unit_name|packageQuantity|package_size|NOBB|EAN|m2|m²)[\s\S]{0,220}/gi)].slice(-30).map(m=>m[0]);
 samples.push({url,title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1],scripts,attrs,links,unit,script_urls:[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,20)});
 }catch(e){samples.push({url,error:e.message});}
}
await writeFile('data/byggmax-inspection.json',JSON.stringify({checked_at:new Date().toISOString(),robots,samples,assets},null,2)+'\n');
const esc=s=>s.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
for(const s of samples){console.log('::notice title=Byggmax document::'+esc(JSON.stringify({url:s.url,title:s.title,error:s.error,attrs:s.attrs,links:s.links}).slice(0,6000)));for(const script of s.scripts||[]){console.log('::notice title=Byggmax price code::'+esc(JSON.stringify({url:s.url,code:script.slice(0,4500)})));}}
