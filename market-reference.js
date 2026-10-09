// A price reference is a calculation basis, never a purchasable SKU.
// Matching, normalization and statistics deliberately have no UI or AI dependency.
export const REFERENCE_MAX_AGE_MS = 86400000;
export const REFERENCE_VERSION = 1;
const units = {m:'m',lm:'m',meter:'m','m²':'m2',m2:'m2',stk:'stk',kg:'kg',liter:'liter',l:'liter'};
export const referenceUnit = value => units[String(value || '').toLowerCase().trim()] || null;
const text = value => String(value || '').toLocaleLowerCase('nb').replaceAll('×','x').replaceAll(',','.');
const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1e7;
const knownTypes = ['decking','battens','timber','cladding','insulation'];
const aliases = {terrace_board:'decking',batten:'battens',structural_timber:'timber',wood_cladding:'cladding'};
const specFields = ['thicknessMm','widthMm','material','treatment','grade','profile','application','lambda','brand'];
const numericFields = ['thicknessMm','widthMm','lambda'];
const treatments = ['pressure_treated','royal','thermal','untreated','primed','painted'];
const materials = ['wood','pine','spruce','wood_fibre','glass_wool','stone_wool','mineral_wool','composite'];
function dimensions(name) {
 const matches = [...name.matchAll(/(?:^|[^0-9.])(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*\d+(?:\.\d+)?)?\s*(?:mm)?(?=$|[^a-z0-9.])/g)];
 const unique = [...new Map(matches.map(m=>[m[1]+'x'+m[2],[Number(m[1]),Number(m[2])]])).values()];
 return unique.length === 1 ? unique[0] : [];
}
// These exact terms provide evidence. Absence of a term never proves untreated,
// standard grade, a particular lambda or a structural application.
export function productSpecification(offer) {
 const name = text(offer.name), kind = aliases[offer.kind] || offer.kind;
 const spec = {};
 if (['decking','battens','timber','cladding'].includes(kind)) {
  const [thickness,width] = dimensions(name);
  if (thickness) Object.assign(spec,{thicknessMm:thickness,widthMm:width});
  if (/royal/.test(name)) spec.treatment='royal';
  else if (/termo|varmebehandlet/.test(name)) spec.treatment='thermal';
  else if (/ubehandlet/.test(name)) spec.treatment='untreated';
  else if (/trykkimpregnert|impregnert|\bimpr\./.test(name)) spec.treatment='pressure_treated';
  else if (/ferdigmalt|malt\b/.test(name)) spec.treatment='painted';
  else if (/grunnet/.test(name)) spec.treatment='primed';
  if (/kompositt/.test(name)) spec.material='composite';
  else if (/\bfuru\b|termofuru/.test(name)) spec.material='pine';
  else if (/\bgran\b/.test(name)) spec.material='spruce';
  else if (/terrassebord|lekt|rekke|sløyfe|konstruksjonsvirke|trekledning/.test(name)) spec.material='wood';
  if (/\b[ck]\s*\d{2}\b/.test(name)) spec.grade=name.match(/\b([ck])\s*(\d{2})\b/)[1].toUpperCase()+name.match(/\b[ck]\s*(\d{2})\b/)[1];
  else if (/(?:2|andre)[ .-]*sort|b[- ]?vare/.test(name)) spec.grade='second';
  else if (/premium|eksklusiv/.test(name)) spec.grade='premium';
  if (/dobbelfals/.test(name)) spec.profile=/rettkant/.test(name)?'dobbelfals rettkant':/60\s*(?:gr|grader)/.test(name)?'dobbelfals 60':'dobbelfals';
  else if (/enkelfals/.test(name)) spec.profile='enkelfals';
  else if (/rektangulær|rektangular/.test(name)) spec.profile='rektangulær';
  if (kind==='decking') spec.profile=/rillet|riller/.test(name)?'rillet':/glatt/.test(name)?'glatt':undefined;
 }
 if (kind==='insulation') {
  const sizes = [...new Set([...name.matchAll(/(?:^|[^0-9.])(\d{2,3}(?:\.\d+)?)\s*mm\b/g)].map(m=>Number(m[1])))];
  if (sizes.length===1) spec.thicknessMm=sizes[0];
  if (/trefiberisolasjon/.test(name)) spec.material='wood_fibre';
  else if (/glassull/.test(name)) spec.material='glass_wool';
  else if (/steinull/.test(name)) spec.material='stone_wool';
  else if (/mineralull/.test(name)) spec.material='mineral_wool';
  if (/trefiberisolasjon|bygningsisolasjon/.test(name)) spec.application='thermal_building';
  if (/vindsperre|trinnlyd|lydplate|markplate|grunnmur|trefiberplate|blåse|blase/.test(name)) spec.application='other';
  const lambda=name.match(/(?:lambda|λ)\s*[=:]?\s*(0\.\d{3})/);
  if (lambda) spec.lambda=Number(lambda[1]);
 }
 for (const brand of ['hunton','glava','rockwool']) if (name.includes(brand)) spec.brand=brand;
 // Explicit collector / future imported product metadata may complete evidence.
 // Contradictions with known attributes disqualify the product.
 const declared=offer.specification || {};
 for (const key of specFields) if (declared[key]!==undefined) {
  const value=numericFields.includes(key)?declared[key]:text(declared[key]);
  if(numericFields.includes(key)?!positive(value):typeof declared[key]!=='string'||!value.trim()||value.length>100)return {productType:kind,conflict:true};
  if (spec[key]!==undefined && String(spec[key]).toLowerCase()!==String(value).toLowerCase() && !(key==='material'&&spec[key]==='wood'&&['pine','spruce'].includes(value))) return {productType:kind,conflict:true};
  spec[key]=value;
 }
 return {productType:kind,...Object.fromEntries(Object.entries(spec).filter(([,v])=>v!==undefined))};
}
export function validateRequirement(value) {
 if (!value || typeof value!=='object' || Array.isArray(value)) throw Error('Materialspesifikasjon mangler.');
 const productType=aliases[value.productType] || value.productType, unit=referenceUnit(value.unit);
 if (!knownTypes.includes(productType)||!unit) throw Error('Varetype eller materialenhet støttes ikke av markedsreferansen.');
 const input=value.specification || value, specification={};
 for (const key of specFields) if (input[key]!==undefined && input[key]!==null && input[key]!=='') {
  const v=numericFields.includes(key)?input[key]:text(input[key]);
  if (numericFields.includes(key)?!positive(v):typeof input[key]!=='string'||v.length>100) throw Error('Ugyldig materialspesifikasjon: '+key);
  specification[key]=v;
 }
 if (specification.treatment && !treatments.includes(specification.treatment) || specification.material && !materials.includes(specification.material)) throw Error('Ukjent materiale eller behandling.');
 if (specification.grade) specification.grade=specification.grade.toUpperCase().match(/^[CK]\d{2}$/)?specification.grade.toUpperCase():specification.grade;
 return {productType,unit,specification};
}
export function requirementIssues(value) {
 let r;try {r=validateRequirement(value);} catch(e) {return [e.message];}
 const required=r.productType==='insulation'?['thicknessMm','material','application']:['thicknessMm','widthMm','material','treatment'];
 if (r.productType==='timber') required.push('grade');
 if (r.productType==='cladding') required.push('profile');
 return required.filter(k=>r.specification[k]===undefined).map(k=>'Mangler '+({thicknessMm:'tykkelse',widthMm:'bredde',material:'materialtype',treatment:'behandling',grade:'styrkeklasse',profile:'profil',application:'bruksområde'}[k]));
}
export function requirementKey(requirement) {
 const r=validateRequirement(requirement);
 return r.productType+':'+r.unit+':'+JSON.stringify(Object.fromEntries(Object.entries(r.specification).sort(([a],[b])=>a.localeCompare(b))));
}
export function requirementForRow(row) {
 if(row.materialOnly)return null;
 if (row.materialRequirement) {try{return validateRequirement(row.materialRequirement);}catch{return null;}}
 const name=text(row.name), key=row.priceKey||'', ai=row.aiSpecification||{};
 let productType=null;
 if(/terrace\.new\.deck|terrassebord/.test(key+' '+name))productType='decking';
 else if(/sloyfer|lekter|utlekting|sløyf|\blekt\b|\brekke\b/.test(key+' '+name))productType='battens';
 else if(/isolasjon|\.insulate$|\.insulation$/.test(key)||/isolasjon/.test(name))productType='insulation';
 else if(/kledning/.test(name)||/kledning|\.cladding$/.test(key))productType='cladding';
 else if(/terrace\.new\.joists/.test(key)||/konstruksjonsvirke/.test(name))productType='timber';
 if (!productType) return null;
 const evidence=[row.name,ai.dimension,ai.insulationThickness?ai.insulationThickness+' mm':'',ai.insulationMaterial==='trefiber'?'trefiberisolasjon':ai.insulationMaterial,ai.insulationBrand,ai.profile,ai.treatment].filter(Boolean).join(' ');
 const {productType:ignored,...specification}=productSpecification({kind:productType,name:evidence});
 try{return validateRequirement({productType,unit:row.materialUnit||row.unit,specification});}catch{return null;}
}
export function comparableProduct(requirement,offer) {
 let r;try{r=validateRequirement(requirement);}catch{return false;}
 if (requirementIssues(r).length) return false;
 const p=productSpecification(offer);
 if (p.conflict||p.productType!==r.productType) return false;
 // Unrequested inferior / premium grades and special surfaces form another group.
 if (!r.specification.grade && p.grade) return false;
 if (!r.specification.profile && p.profile) return false;
 if (r.productType==='insulation'&&p.application==='other') return false;
 return Object.entries(r.specification).every(([key,v])=>key==='material'&&v==='wood'?['wood','pine','spruce'].includes(p[key]):String(p[key]).toLowerCase()===String(v).toLowerCase());
}
export function normalizeReferenceOffer(offer,unit,now=Date.now()) {
 const age=Number(now)-Date.parse(offer.checked_at), quantity=offer.package_quantity;
 // Only public, unconditional observations qualify. Local SKUs stay selectable
 // in the existing product picker, without biasing a national reference.
 if (!Number.isFinite(age)||age<0||age>REFERENCE_MAX_AGE_MS||offer.last_error||offer.price_kind!=='public'||offer.store_id||offer.currency&&offer.currency!=='NOK'||!String(offer.availability).endsWith('/InStock')||offer.valid_until&&(!/^\d{4}-\d{2}-\d{2}$/.test(offer.valid_until)||!Number.isFinite(Date.parse(offer.valid_until+'T23:59:59Z'))||Date.parse(offer.valid_until+'T23:59:59Z')<now)) return null;
 if (!['inkl','ekskl'].includes(offer.vat)||!['unit','package'].includes(offer.quantity_basis)||referenceUnit(offer.unit)!==referenceUnit(unit)||!referenceUnit(unit)||!positive(quantity)||!Number.isSafeInteger(offer.original_ore)||offer.original_ore<=0||!Number.isSafeInteger(offer.package_price_ex_vat_ore)||offer.package_price_ex_vat_ore<=0) return null;
 if (offer.quantity_basis==='package'&&!String(offer.evidence||'').trim()) return null;
 const net=Math.round(offer.original_ore/(offer.vat==='inkl'?1.25:1));
 if (Math.abs(net-offer.package_price_ex_vat_ore)>1) return null;
 const price=offer.package_price_ex_vat_ore/100/quantity;
 if (!positive(price)||!Number.isSafeInteger(offer.normalized_ore)||Math.abs(Math.round(price*100)-offer.normalized_ore)>1) return null;
 let url;try{url=new URL(offer.url);if(url.protocol!=='https:'||url.username||url.password) return null;}catch{return null;}
 if (!offer.chain&&!offer.supplier||!offer.source_id&&!offer.id) return null;
 return {supplier:String(offer.chain||offer.supplier),productId:String(offer.source_id||offer.id),productName:String(offer.name),normalizedPrice:price,url:url.href,checkedAt:offer.checked_at,packageQuantity:quantity,quantityBasis:offer.quantity_basis,originalUnit:offer.original_unit||offer.unit,evidence:offer.evidence||''};
}
const median=values=>values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2;
export function buildMarketReference({requirement,offers=[],now=Date.now()}) {
 let r;try{r=validateRequirement(requirement);}catch(e){return {usable:false,referencePrice:null,reason:e.message,sources:[],productCount:0,supplierCount:0,confidence:'low'};}
 const issues=requirementIssues(r), key=requirementKey(r);
 const empty={version:REFERENCE_VERSION,key,productType:r.productType,specification:r.specification,unit:r.unit,referencePrice:null,usable:false,productCount:0,supplierCount:0,confidence:'low',sources:[],reason:issues.join(' · ')||'Ingen ferske, entydig sammenlignbare offentlige priser.'};
 if (issues.length) return empty;
 // A repeated SKU, including several store observations, is never several products.
 const latest=new Map();
 for (const offer of offers) {const id=String(offer.chain||offer.supplier)+':'+String(offer.source_id||offer.id);if(!latest.has(id)||Date.parse(offer.checked_at)>=Date.parse(latest.get(id).checked_at))latest.set(id,offer);}
 const sources=[...latest.values()].filter(o=>comparableProduct(r,o)).map(o=>normalizeReferenceOffer(o,r.unit,now)).filter(Boolean).sort((a,b)=>a.normalizedPrice-b.normalizedPrice||a.supplier.localeCompare(b.supplier)||a.productId.localeCompare(b.productId));
 if (!sources.length) return empty;
 const prices=sources.map(s=>s.normalizedPrice), productCount=sources.length,supplierCount=new Set(sources.map(s=>s.supplier)).size;
 const medianPrice=median(prices),meanPrice=prices.reduce((sum,p)=>sum+p,0)/prices.length;
 const confidence=productCount>=5&&supplierCount>=2?'high':productCount>=2?'medium':'low';
 const observedAt=sources.reduce((old,s)=>Date.parse(s.checkedAt)<Date.parse(old)?s.checkedAt:old,sources[0].checkedAt);
 return {...empty,referencePrice:medianPrice,medianPrice,meanPrice,minPrice:prices[0],maxPrice:prices.at(-1),productCount,supplierCount,confidence,sources,observedAt,method:'median',usable:productCount>=2,reason:productCount===1?'Kun ett sammenlignbart produkt. Velg konkret produkt eller registrer egen pris.':confidence==='high'?'Minst fem entydige produkter, flere leverandører, kontrollert siste 24 timer.':'Minst to entydige produkter, kontrollert siste 24 timer. Begrenset antall eller leverandørspredning.'};
}
export function createReferenceSnapshot(reference) {
 if (!reference.usable||!positive(reference.referencePrice)) throw Error('Markedsreferansen har for svakt grunnlag.');
 return structuredClone({version:REFERENCE_VERSION,price:reference.referencePrice,unit:reference.unit,observedAt:reference.observedAt,referenceId:reference.key,confidence:reference.confidence,method:reference.method,minPrice:reference.minPrice,maxPrice:reference.maxPrice,meanPrice:reference.meanPrice,productCount:reference.productCount,supplierCount:reference.supplierCount,sources:reference.sources});
}
export function validReferenceSnapshot(snapshot,requirement) {
 if (!snapshot||snapshot.version!==REFERENCE_VERSION||!positive(snapshot.price)||snapshot.unit!==referenceUnit(requirement?.unit)||snapshot.referenceId!==requirementKey(requirement)||!Number.isFinite(Date.parse(snapshot.observedAt))||!['medium','high'].includes(snapshot.confidence)||snapshot.method!=='median'||!Array.isArray(snapshot.sources)||snapshot.sources.length<2||snapshot.sources.length>20000) return false;
 const prices=snapshot.sources.map(s=>s.normalizedPrice).sort((a,b)=>a-b);
 const suppliers=new Set(snapshot.sources.map(s=>s.supplier)).size;
 const expectedConfidence=prices.length>=5&&suppliers>=2?'high':'medium';
 return prices.every(positive)&&snapshot.productCount===prices.length&&snapshot.supplierCount===suppliers&&snapshot.confidence===expectedConfidence&&snapshot.price===median(prices)&&snapshot.minPrice===prices[0]&&snapshot.maxPrice===prices.at(-1)&&snapshot.meanPrice===prices.reduce((sum,p)=>sum+p,0)/prices.length&&Date.parse(snapshot.observedAt)===Math.min(...snapshot.sources.map(s=>Date.parse(s.checkedAt)))&&new Set(snapshot.sources.map(s=>s.supplier+':'+s.productId)).size===prices.length&&snapshot.sources.every(s=>typeof s.supplier==='string'&&typeof s.productId==='string'&&typeof s.productName==='string'&&Number.isFinite(Date.parse(s.checkedAt))&&/^https:\/\//.test(s.url));
}
export function referenceIsNewer(snapshot,reference) {
 if(!reference.usable||reference.key!==snapshot?.referenceId||!Array.isArray(snapshot.sources))return false;
 const previous=new Map(snapshot.sources.map(s=>[s.supplier+':'+s.productId,s.checkedAt]));
 return reference.sources.some(s=>Date.parse(s.checkedAt)>Date.parse(previous.get(s.supplier+':'+s.productId)||snapshot.observedAt));
}
// Public group choices provide a specification, never a guessed row quantity.
export function requirementsForOffers(offers,productType,now=Date.now()) {
 const groups=new Map();
 for (const offer of offers) {
  const {productType:type,conflict,...specification}=productSpecification(offer),unit=referenceUnit(offer.unit);
  if (conflict||type!==productType||!unit||!normalizeReferenceOffer(offer,unit,now)) continue;
  try {const r=validateRequirement({productType:type,unit,specification});if(!requirementIssues(r).length)groups.set(requirementKey(r),r);}catch{}
 }
 return [...groups.values()];
}
export function requirementLabel(requirement) {
 const r=validateRequirement(requirement),s=r.specification;
 const type={decking:'Terrassebord',battens:'Sløyfer / lekter',timber:'Konstruksjonsvirke',cladding:'Kledning',insulation:'Isolasjon'}[r.productType];
 const material={wood:'tre',pine:'furu',spruce:'gran',wood_fibre:'trefiber',glass_wool:'glassull',stone_wool:'steinull',mineral_wool:'mineralull',composite:'kompositt'}[s.material]||'';
 const treatment={pressure_treated:'trykkimpregnert',royal:'royalimpregnert',thermal:'varmebehandlet',untreated:'ubehandlet',primed:'grunnet',painted:'malt'}[s.treatment]||'';
 return [type,s.widthMm?s.thicknessMm+'×'+s.widthMm:s.thicknessMm?s.thicknessMm+' mm':'',material,treatment,s.grade,s.profile,s.brand].filter(Boolean).join(' · ');
}
