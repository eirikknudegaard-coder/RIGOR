// Separate, read-only verification. Never writes data/ or calls a publishing API.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readPublicProducts,publicSources} from '../market-public-core.js';
const output=process.env.RIGOR_LIVE_QA_OUTPUT||'/tmp/rigor-live-price-verification';
const get=async url=>{const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('HTTP '+response.status);return response.text();};
function productsIn(html){
 const products=[];
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{
  const visit=value=>{if(Array.isArray(value))return value.forEach(visit);if(!value||typeof value!=='object')return;if(value['@type']==='Product')products.push(value);if(value.hasVariant)visit(value.hasVariant);if(value['@graph'])visit(value['@graph']);};visit(JSON.parse(match[1]));
 }catch{}
 return products;
}
function ownPage(html){
 const assignment=html.indexOf('window.CURRENT_PAGE');if(assignment<0)return {};
 const start=html.indexOf('{',assignment),tail=html.slice(start,html.indexOf('</script>',start));
 // JSON.parse, never eval; try complete object endings, independent of pricing rules.
 for(let end=tail.lastIndexOf('}');end>=0;end=tail.lastIndexOf('}',end-1))try{return JSON.parse(tail.slice(0,end+1));}catch{}
 return {};
}
function expected(product,page){
 const offer=[product.offers].flat()[0],length=String(product.size||'').match(/^(\d+(?:[.,]\d+)?)\s*M$/i),name=String(product.name||'');
 let unit=null,quantity=1;
 const thickness=String(product.size||'').match(/^(\d+)\s*MM$/i);
 const pack=thickness&&String(page.productControlText||'').match(new RegExp('(?:^|\\n)\\s*-?\\s*'+thickness[1]+'\\s*mm,\\s*leveres i pakker[^0-9]*([0-9]+[.,][0-9]+)\\s*m[²2]','i'));
 const roll=name.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*M\b/i);
 const reference=offer?.priceSpecification?.referenceQuantity;
 if(length){unit='m';quantity=Number(length[1].replace(',','.'));}
 else if(pack){unit='m2';quantity=Number(pack[1].replace(',','.'));}
 else if(roll){unit='m2';quantity=Number(roll[1].replace(',','.'))*Number(roll[2].replace(',','.'));}
 else if(reference){unit={MTR:'m',MTK:'m2',C62:'stk'}[reference.unitCode]||null;quantity=Number(reference.value||1);}
 else if(page.variationCode===product.sku){unit={m:'m',meter:'m',m2:'m2',stk:'stk'}[page.price?.unitName]||null;}
 if(!unit||!Number.isFinite(quantity)||quantity<=0)throw Error('Live enhet/pakning kunne ikke dokumenteres uavhengig');
 const originalOre=Math.round(Number(offer.price)*100),netOre=Math.round(originalOre/1.25);
 return {name:name+(product.size?' · '+product.size:''),sku:product.sku,dimensions:name.match(/\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?/i)?.[0]||product.size||null,originalOre,netOre,normalizedOre:Math.round(netOre/quantity),unit,quantity,vat:'inkl',availability:offer.availability,public:!page.price?.showFromPrice&&!page.price?.hasPriceDifferences&&!page.price?.isMemberPrice};
}
function compare(offer,html,checkedAt){
 const product=productsIn(html).find(p=>p.sku===offer.source_id),page=ownPage(html);
 const record={id:offer.id,url:offer.url,register:{name:offer.name,originalOre:offer.original_ore,normalizedOre:offer.normalized_ore,unit:offer.unit,packageQuantity:offer.package_quantity,checkedAt:offer.checked_at,error:offer.last_error||null},rawSha256:createHash('sha256').update(html).digest('hex')};
 if(!product)return {...record,status:'FAIL',reason:'SKU finnes ikke lenger på produktsiden'};
 const live=expected(product,page),age=Date.parse(checkedAt)-Date.parse(offer.checked_at);
 const differenceOre=offer.normalized_ore-live.normalizedOre;
 const pass=differenceOre===0&&offer.original_ore===live.originalOre&&offer.package_quantity===live.quantity&&offer.unit===live.unit&&offer.vat===live.vat&&offer.name===live.name&&live.public&&/\/InStock$/.test(live.availability)&&!offer.last_error&&age>=0&&age<=86400000;
 return {...record,live,differenceOre,status:pass?'PASS':'FAIL',reason:pass?null:'Avvik i pris/navn/enhet/pakning, betinget pris, lager, kildefeil eller alder'};
}
export async function verifyLivePrices(){
 await mkdir(output,{recursive:true});
 const registerUrl='https://rigor.no/data/market-prices.json',catalog=JSON.parse(await get(registerUrl)),checkedAt=new Date().toISOString();
 const taxText=await get(publicSources[0].vat_policy_url);
 if(!/Prisene er inklusiv mva\./i.test(taxText))throw Error('Obs MVA-vilkår kunne ikke bekreftes');
 const source={...publicSources[0],tax_evidence:{vat:'inkl',url:publicSources[0].vat_policy_url,checked_at:checkedAt,statement:'Prisene er inklusiv mva.'}};
 const result={checkedAt,registerUrl,registerUpdatedAt:catalog.updated_at,totalOffers:catalog.offers.length,checks:[],candidateChecks:[],otherSources:[],excludedHistorical:catalog.offers.filter(o=>o.last_error).map(o=>({id:o.id,error:o.last_error,checkedAt:o.checked_at}))};
 const controls=[['Hunton 100 mm','insulation',/2113834/,/100 MM/],['Grunnet kledning med spor','cladding-consumption',/2100566/],['48x48 lekt','battens',/2291095/],['23x48 sløyfe','sloyfer',/2291056/],['36x48 lekt','laths',/2291060/],['Undertak','underlay',/2139208/],['Terrassebord 28x120','deck',/2151132/],['Palema takstein','palema',/3001211/]];
 for(const[label,fixtureName,urlPattern,namePattern]of controls){
  const fixture=JSON.parse(await readFile(new URL('./fixtures/evidence/'+fixtureName+'-2026-10-09.json',import.meta.url)));
  const relevant=catalog.offers.filter(o=>o.chain==='obs'&&urlPattern.test(o.url)&&(!namePattern||namePattern.test(o.name))),offer=relevant.find(o=>!o.last_error&&Date.parse(checkedAt)-Date.parse(o.checked_at)<=86400000)||relevant[0];
  try{const html=await get(offer?.url||fixture.url);result.checks.push(offer?{label,...compare(offer,html,checkedAt)}:{label,status:'FAIL',reason:'Mangler i publisert register'});}
  catch(error){result.checks.push({label,status:'FAIL',reason:error.message});}
  try{
   // New variants are verified at the current family URL, separately from an obsolete saved URL.
   const html=await get(fixture.url),candidates=readPublicProducts(html,fixture.url,source,checkedAt).filter(o=>!namePattern||namePattern.test(o.name));
   const candidate=candidates[0];if(!candidate)throw Error('Ingen kvalifisert produktvariant');
   result.candidateChecks.push({label,...compare(candidate,html,checkedAt),scope:'Local corrected collector; not published'});
  }catch(error){result.candidateChecks.push({label,status:'FAIL',reason:error.message});}
 }
 for(const name of ['bm-insulation','monter-tile','monter-cladding']){
  const fixture=JSON.parse(await readFile(new URL('./fixtures/evidence/'+name+'-2026-10-09.json',import.meta.url)));
  try{const html=await get(fixture.url),products=productsIn(html);result.otherSources.push({source:fixture.source,url:fixture.url,status:'CHECKED',rawSha256:createHash('sha256').update(html).digest('hex'),products:products.map(p=>({name:p.name,sku:p.sku,offer:p.offers})),referenceEligible:false,reason:fixture.observed?.reason||'Ingen ubetinget pris med enhet, MVA og bekreftet lager som kvalifiserer til registeret'});}catch(e){result.otherSources.push({source:fixture.source,url:fixture.url,status:'BLOCKED',reason:e.message});}
 }
 result.pass=result.checks.every(c=>c.status==='PASS');result.candidatePass=result.candidateChecks.every(c=>c.status==='PASS');await writeFile(output+'/report.json',JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=await verifyLivePrices();console.log(JSON.stringify({checkedAt:report.checkedAt,registerOffers:report.totalOffers,published:report.checks.map(c=>({label:c.label,status:c.status,reason:c.reason,differenceOre:c.differenceOre})),correctedCollector:report.candidateChecks.map(c=>({label:c.label,status:c.status,reason:c.reason})),otherSources:report.otherSources.map(s=>({source:s.source,status:s.status,referenceEligible:s.referenceEligible})),report:output+'/report.json'},null,2));if(!report.pass||!report.candidatePass)process.exitCode=1;
}
