import {applyMaterialConsumption,familyConsumption} from './material-consumption.js?v=20261009-qa';
// User specifications restrict material choices. No product, dimensions or
// consumption is invented and no price is selected here.
export function annotateAiMaterial(row,facts,offers=[]){
 const key=row.priceKey||'',name=row.name.toLocaleLowerCase('nb');let spec={};
 if(/isolasjon|insulate|insulation$/.test(key+' '+name))spec={insulationMaterial:facts.insulationMaterial,insulationBrand:facts.insulationBrand,insulationThickness:facts.insulationThickness};
 else if(/utlekting|frame$/.test(key+' '+name)&&facts.domain==='exterior_wall')spec={dimension:facts.battenDimension};
 else if(row.priceKey&&/cladding|kledning/.test(key+' '+name))spec={profile:facts.claddingProfile,direction:facts.claddingDirection,dimension:facts.claddingDimension,treatment:facts.claddingTreatment};
 else if(/terrace.new.deck/.test(key))spec={dimension:facts.deckDimension,treatment:facts.deckTreatment};
 spec=Object.fromEntries(Object.entries(spec).filter(([,v])=>v!==null&&v!==undefined));
 const tagged=Object.keys(spec).length?{...row,aiSpecification:spec}:row;
 const kind=key==='terrace.new.deck'?'decking':row.priceKey&&/cladding|kledning/.test(key+' '+name)?'cladding':null;
 if(!kind)return tagged;
 const candidates=offers.filter(o=>o.kind===kind&&matchesAiMaterial(tagged,o)&&o.price_kind==='public'&&!o.store_id&&!o.last_error&&String(o.availability).endsWith('/InStock')&&Date.now()-Date.parse(o.checked_at)>=0&&Date.now()-Date.parse(o.checked_at)<=86400000);
 const consumption=familyConsumption(candidates);
 return consumption?applyMaterialConsumption(tagged,consumption):tagged;
}
export function matchesAiMaterial(row,offer){
 const spec=row.aiSpecification;if(!spec)return true;const text=offer.name.toLocaleLowerCase('nb');
 if(spec.insulationMaterial==='trefiber'&&!/trefiber|hunton/.test(text)||spec.insulationMaterial==='mineralull'&&!/mineralull|glassull|steinull|glava|rockwool/.test(text))return false;
 if(spec.insulationBrand&&!text.includes(spec.insulationBrand.toLocaleLowerCase('nb')))return false;
 if(spec.insulationThickness&&!new RegExp('(?:^|\\D)'+spec.insulationThickness+'\\s*mm(?:\\D|$)','i').test(text))return false;
 if(spec.dimension){const [a,b]=spec.dimension.split(/[x×]/).map(s=>s.trim());if(!new RegExp('(?:^|\\D)'+a+'\\s*[x×]\\s*'+b+'(?:\\D|$)','i').test(text))return false;}
 if(spec.profile&&!text.includes(spec.profile.toLocaleLowerCase('nb')))return false;
 if(spec.treatment==='impregnert'&&(!/impregnert/.test(text)||/royal|termo|varmebehandlet/.test(text)))return false;
 if(spec.treatment==='grunnet'&&!/grunnet/.test(text))return false;
 return true;
}
export function aiSpecificationText(row){const spec=row.aiSpecification;if(!spec)return '';return Object.entries(spec).filter(([key])=>key!=='direction').map(([key,v])=>key==='insulationThickness'?v+' mm':v).join(' · ');}
