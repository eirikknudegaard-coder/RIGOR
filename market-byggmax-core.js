import {publicSources,sourceUrl,materialKind} from './market-public-core.js';
const source=publicSources.find(s=>s.id==='byggmax');
// Read JSON literals only. Retailer JavaScript is never evaluated.
function literal(text,start){let depth=0,quoted=false,escaped=false;for(let i=start;i<text.length;i++){const c=text[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"'){quoted=true;continue;}if(c==='['||c==='{')depth++;if(c===']'||c==='}'){if(--depth===0)return JSON.parse(text.slice(start,i+1));}}throw Error('Ufullstendig produkt-JSON');}
function jsonAfter(text,pattern){const m=pattern.exec(text);if(!m)throw Error('Dokumenterte produktdata mangler');const start=m.index+m[0].length;return literal(text,start);}
function decode(text){return String(text).replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&aelig;/g,'æ').replace(/&oslash;/g,'ø').replace(/&aring;/g,'å').replace(/&nbsp;/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)));}
export function readByggmaxPage(html,url){
 sourceUrl(url,source);const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 const request=scripts.find(s=>s.includes('function fetchCsp()')),productId=request?.match(/const productId\s*=\s*'([^']+)'/)?.[1];
 if(!productId||!/^P-[a-z0-9-]+$/i.test(productId)||!request.includes('gcsp?productId=${productId}&storeId=${selectedShop}&customerType=${customerType}'))throw Error('Byggmax har endret offentlig prisendepunkt');
 const code=scripts.find(s=>s.includes('let productStructuredData = '));const products=jsonAfter(code||'',/let productStructuredData\s*=\s*(?=\[)/);
 if(!Array.isArray(products)||!products.length||products.length>100||products.some(p=>!p.sku||!p.name||p.offers?.priceCurrency!=='NOK'))throw Error('Ugyldige Byggmax-produktdata');
 const shops=jsonAfter(scripts.find(s=>s.includes('allShopList:'))||'',/allShopList:\s*(?=\[)/).map(s=>({chain:'byggmax',id:String(s.store_number),name:decode(s.name)}));
 const priceCode=scripts.find(s=>/function initPrice/.test(s))||'';const units=[...priceCode.matchAll(/full:\s*`\$\{displayPrice\} NOK(?:\/(m2|m|stk))?\$\{vatLabel\}`/g)].map(m=>m[1]||null);
 if(units.length!==1)throw Error('Byggmax prisenhet er ikke dokumentert');
 const visible=decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' '));
 const variantCode=scripts.find(s=>/"optionData"\s*:\s*\{/.test(s));const optionData=variantCode?jsonAfter(variantCode,/"optionData"\s*:\s*(?=\{)/):{};
 const packagePriceCode=scripts.some(s=>s.includes('NOK/pakke')&&s.includes('this.price = detail.bmxBasePrice.amount'));
 return {url,productId,products,shops,unit:units[0],visible,optionData,packagePriceCode};
}
export function byggmaxPriceUrl(page,storeId){if(!/^(0|[1-9]\d{0,5})$/.test(String(storeId))||String(storeId)!=='0'&&!page.shops.some(s=>s.id===String(storeId)))throw Error('Ukjent Byggmax-butikk');const url=new URL('/gcsp',source.origin);url.search=new URLSearchParams({productId:page.productId,storeId:String(storeId),customerType:'0'}).toString();return url.href;}
const positive=v=>{const n=Number(v);if(!Number.isFinite(n)||n<=0||n>1e7)throw Error('Ugyldig Byggmax-pris eller mengde');return n;};
export function readByggmaxPrices(page,data,storeId,tax,now=new Date().toISOString(),onReject=()=>{}){
 storeId=String(storeId);const evidenceUrl=byggmaxPriceUrl(page,storeId);if(data?.sku!==page.productId||String(data.selected_shop)!==storeId||!data.articles||typeof data.articles!=='object')throw Error('Byggmax prisdata gjelder en annen vare eller butikk');
 if(tax?.vat!=='inkl')throw Error('Byggmax MVA-status er ikke dokumentert');sourceUrl(tax.url,source);
 const observations=[];for(const [articleId,a] of Object.entries(data.articles)){let p;try{
  const matches=page.products.filter(p=>String(p.sku)===String(a.sku));if(matches.length!==1)throw Error('Varevariant mangler entydig dokumentasjon');p=matches[0];
  if(data.discontinued||a.discontinued||data.product_hide_statuses?.[articleId]===true)throw Error('Varen er utgått eller skjult i valgt butikk');
  // Never use a warehouse balance or an expected delivery as local stock.
  if(storeId==='0'?data.is_web_product_in_stock!==true||a.is_web_product_in_stock!==true:a.is_salable!==true||!(Number(a.qty)>0))throw Error('Ikke bekreftet på lager i valgt butikk');
  const kind=materialKind(p.name);if(!kind)throw Error('Ikke en støttet byggevare');const option=page.optionData?.[articleId];if(option&&String(option.sku)!==String(a.sku))throw Error('Variantmål gjelder en annen SKU');let unit=page.unit,quantity=1,quantityBasis='unit',originalUnit=unit,evidence='Byggmax gcsp: eksakt SKU og butikk; produktfelt NOK/'+(unit||'stykk'),label='';
  if(!unit&&['gypsum','boards'].includes(kind)){
   const dimensions=option?.subtitle||page.visible.match(/Gipsplate\s+(\d+(?:[.,]\d+)?\s*[x×]\s*\d{3,4}\s*[x×]\s*\d{3,4}\s*mm)/i)?.[1]||'';const d=dimensions.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d{3,4})\s*[x×]\s*(\d{3,4})\s*mm$/i);
   if(!d||!page.visible.includes('Antall stk')||!option&&page.products.length!==1)throw Error('Platens enhet eller mål mangler');unit='m2';quantity=positive(d[2])*positive(d[3])/1e6;if(option&&Math.abs(Number(option.package_size.replace(',','.'))-quantity)>.001)throw Error('Platemål og oppgitt areal samsvarer ikke');quantityBasis='package';originalUnit='plate';label=dimensions;evidence+='; én plate '+d[2]+'×'+d[3]+' mm';
  }
  if(!unit)throw Error('Byggmax prisenhet er ikke dokumentert');let price=positive(a.final_price);
  if(kind==='insulation'){
   const area=option?.subtitle?.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*m[²2](?:\s|$)/i);if(unit!=='m2'||!area||!page.packagePriceCode||!option.subtitle.trim())throw Error('Isolasjonsvariant og pakningsareal mangler');quantity=positive(area[1].replace(',','.'));if(Math.abs(Number(option.package_size.replace(',','.'))-quantity)>.001)throw Error('Pakningsareal samsvarer ikke');const packagePrice=positive(a.bmx_base_price);if(Math.abs(packagePrice-price*quantity)>.005*quantity+.01)throw Error('Pakkepris og m²-pris samsvarer ikke');price=packagePrice;quantityBasis='package';originalUnit='pakke';label=option.subtitle;evidence+='; samme SKU: '+label+'; bmx_base_price er produktfelt NOK/pakke';
  }
  const originalOre=Math.round(price*100),packageOre=Math.round(originalOre/1.25);const until=a.catalogrule_enddate||null;
  if(until&&(!/^\d{4}-\d{2}-\d{2}$/.test(until)||Date.parse(until+'T23:59:59Z')<Date.parse(now)))throw Error('Utløpt Byggmax-pris');
  const store=page.shops.find(s=>s.id===storeId);const address=new URL(p.offers.url);address.hash='';sourceUrl(address.href,source);
  // Retailer-declared canonical URLs may differ from sitemap aliases. The
  // exact article SKU must still match both product metadata and live stock.
  observations.push({id:'byggmax:'+a.sku+':'+storeId,chain:'byggmax',name:decode(p.name)+(label?' · '+label:''),url:address.href,source_page:page.url,source_id:String(a.sku),gtin:p.gtin13||p.gtin||null,kind,unit,vat:'inkl',price_kind:storeId==='0'?'public':'local',store_id:storeId==='0'?null:storeId,store_name:store?.name||null,stock_quantity:storeId==='0'?null:Number(a.qty),quantity_basis:quantityBasis,original_unit:originalUnit,package_quantity:quantity,original_ore:originalOre,package_price_ex_vat_ore:packageOre,normalized_ore:Math.round(packageOre/quantity),checked_at:now,valid_until:until,availability:'https://schema.org/InStock',vat_evidence:tax,evidence_url:evidenceUrl,evidence});
 }catch(e){onReject({source_id:String(a.sku||''),store_id:storeId,error:e.message});}}
 return observations;
}
