// All imported prices are per calculation unit, NOK and excluding VAT.
export const MAX_PRICE_AGE_DAYS = 30;
export function readCsv(text) {
 if (text.length > 2_000_000) throw Error('Prislisten er for stor (maks 2 MB).');
 text=text.replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/,1)[0];
 const separator=first.includes(';')?';':',';
 const records=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c==='"'){if(value||closed)throw Error('Ugyldige anførselstegn i CSV.');quoted=true;continue;}
  if(c===separator){row.push(value.trim());value='';closed=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))records.push(row);row=[];value='';closed=false;}
  else{if(closed&&!/\s/.test(c))throw Error('Ugyldig CSV-felt.');value+=c;}
 }
 if(quoted)throw Error('Uavsluttet anførselstegn i CSV.');
 row.push(value.trim());if(row.some(Boolean))records.push(row);
 if(records.length<2)throw Error('Prislisten mangler priser.');
 return records;
}
export function parseCsv(text) {
 const records=readCsv(text);
 const headers=records.shift().map(v=>v.toLowerCase());
 const required=['prisnokkel','enhet','pris','kilde','dato','valuta','mva'];
 if(required.some(k=>!headers.includes(k))||new Set(headers).size!==headers.length)throw Error('Bruk kolonnene i CSV-malen: '+required.join(', ')+'.');
 return validatePrices(records.map((r,i)=>{
  if(r.length!==headers.length)throw Error('Feil antall kolonner på linje '+(i+2)+'.');
  return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));
 }));
}
export function validatePrices(records) {
 if(!Array.isArray(records)||!records.length||records.length>10000)throw Error('Prislisten må inneholde 1–10 000 priser.');
 const keys=new Set();
 return records.map((r,i)=>{
  if(!r||typeof r!=='object')throw Error('Ugyldig prisrad.');
  const key=String(r.prisnokkel||'').trim();
  const price=typeof r.pris==='number'?r.pris:Number(String(r.pris).replace(',','.'));
  const date=String(r.dato||'');
  const source=String(r.kilde||'').trim();
  if(!/^[a-z][a-z0-9_.-]{1,99}$/.test(key)||keys.has(key))throw Error('Manglende, ugyldig eller duplisert prisnøkkel på rad '+(i+1)+'.');
  if(String(r.pris).trim()===''||!Number.isFinite(price)||price<0||price>1e7)throw Error('Ugyldig pris på rad '+(i+1)+'.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Dato må være en gyldig dato i format ÅÅÅÅ-MM-DD.');
  if(!source||source.length>300)throw Error('Hver pris må ha en kilde.');
  if(r.valuta!=='NOK'||r.mva!=='ekskl'||!['m2','m','stk','rs'].includes(r.enhet))throw Error('Prisene må være NOK, ekskl. MVA, i m2, m, stk eller rs. Omregn pakningspriser før import.');
  let market={};if(r.checked_at!==undefined){if(!Number.isFinite(Date.parse(r.checked_at))||!Number.isFinite(r.package_quantity)||r.package_quantity<=0||!Number.isSafeInteger(r.package_price_ex_vat_ore)||r.package_price_ex_vat_ore<0)throw Error('Ugyldig markedspris eller pakningsinnhold.');if(r.quantity_basis!==undefined&&!['unit','package'].includes(r.quantity_basis))throw Error('Ugyldig prisenhetsgrunnlag.');market={quantity_basis:r.quantity_basis||'package',checked_at:r.checked_at,package_quantity:r.package_quantity,package_price_ex_vat_ore:r.package_price_ex_vat_ore,original_unit:String(r.original_unit||'pakke')};}
  keys.add(key);return {...market,prisnokkel:key,enhet:r.enhet,pris:price,kilde:source,dato:date,valuta:'NOK',mva:'ekskl'};
 });
}
export function priceStatus(record,today=new Date().toISOString().slice(0,10)) {
 if(!record)return 'mangler';
 if(record.checked_at){const age=Date.now()-Date.parse(record.checked_at);if(age<0)return 'fremtidig';if(age>86400000)return 'utdatert';}
 const age=(Date.parse(today)-Date.parse(record.dato))/86400000;
 return age<0?'fremtidig':age>MAX_PRICE_AGE_DAYS?'utdatert':'gyldig';
}
export function applyPrices(rows,mode,records,today) {
 const catalog=new Map(records.map(r=>[r.prisnokkel,r]));
 return rows.map(original=>{
  const r={...original,marketMaterialCost:undefined,marketPackages:undefined,marketPurchasedQuantity:undefined};
  if(mode==='example'&&r.needsExamplePrice&&!r.manualPrice)return {...r,material:0,priceSource:'Ingen eksempelpris',priceDate:'',priceIssue:'pris må registreres'};
  if(mode==='example')return {...r,material:r.manualPrice?r.material:(r.exampleMaterial??r.material),priceSource:r.manualPrice?'Manuelt satt':'Eksempelpris',priceDate:'',priceIssue:null};
  if(r.manualPrice){const status=r.manualPriceDate?priceStatus({dato:r.manualPriceDate},today):'gyldig';return {...r,priceSource:r.manualPriceSource||'Manuelt satt',priceDate:r.manualPriceDate||'',priceIssue:status==='gyldig'?null:status};}
  if(!r.priceKey)return {...r,material:0,priceSource:'Ingen materialkostnad',priceDate:'',priceIssue:null};
  const p=catalog.get(r.priceKey);let status=priceStatus(p,today);
  const unit=(r.materialUnit||r.unit||'m²').replace('m²','m2');if(status==='gyldig'&&p.enhet!==unit)status='feil enhet';
  const purchase=status==='gyldig'&&mode==='market'&&p.checked_at&&p.quantity_basis!=='unit'?{marketPackages:Math.ceil((r.materialQuantity??r.quantity)/p.package_quantity),marketPurchasedQuantity:Math.ceil((r.materialQuantity??r.quantity)/p.package_quantity)*p.package_quantity,marketMaterialCost:Math.ceil((r.materialQuantity??r.quantity)/p.package_quantity)*p.package_price_ex_vat_ore/100}:{};
  return {...r,...purchase,material:status==='gyldig'?p.pris:0,priceSource:(p?.kilde||'')+(p?.quantity_basis==='unit'?' · enhetspris; pakningsavrunding og frakt ikke inkludert':'')+(purchase.marketPackages!==undefined?' · kjøp '+purchase.marketPackages+' '+p.original_unit+' / '+purchase.marketPurchasedQuantity+' '+p.enhet+' · frakt ikke inkludert':''),priceDate:p?.dato||'',priceIssue:status==='gyldig'?null:status};
 });
}
