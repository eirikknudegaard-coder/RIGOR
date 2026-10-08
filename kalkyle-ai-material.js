// User specifications restrict material choices. No product, dimensions or
// consumption is invented and no price is selected here.
export function annotateAiMaterial(row,facts){
 const key=row.priceKey||'',name=row.name.toLocaleLowerCase('nb');let spec={};
 if(/isolasjon|insulate|insulation$/.test(key+' '+name))spec={insulationMaterial:facts.insulationMaterial,insulationBrand:facts.insulationBrand,insulationThickness:facts.insulationThickness};
 else if(/utlekting|frame$/.test(key+' '+name)&&facts.domain==='exterior_wall')spec={dimension:facts.battenDimension};
 else if(/cladding|kledning/.test(key+' '+name))spec={profile:facts.claddingProfile,direction:facts.claddingDirection};
 else if(/terrace.new.deck/.test(key))spec={dimension:facts.deckDimension,treatment:facts.deckTreatment};
 spec=Object.fromEntries(Object.entries(spec).filter(([,v])=>v!==null&&v!==undefined));
 return Object.keys(spec).length?{...row,aiSpecification:spec}:row;
}
export function matchesAiMaterial(row,offer){
 const spec=row.aiSpecification;if(!spec)return true;const text=offer.name.toLocaleLowerCase('nb');
 if(spec.insulationMaterial==='trefiber'&&!/trefiber|hunton/.test(text)||spec.insulationMaterial==='mineralull'&&!/mineralull|glassull|steinull|glava|rockwool/.test(text))return false;
 if(spec.insulationBrand&&!text.includes(spec.insulationBrand.toLocaleLowerCase('nb')))return false;
 if(spec.insulationThickness&&!new RegExp('(?:^|\\D)'+spec.insulationThickness+'\\s*mm(?:\\D|$)','i').test(text))return false;
 if(spec.dimension){const [a,b]=spec.dimension.split(/[x×]/).map(s=>s.trim());if(!new RegExp('(?:^|\\D)'+a+'\\s*[x×]\\s*'+b+'(?:\\D|$)','i').test(text))return false;}
 if(spec.profile&&!text.includes(spec.profile.toLocaleLowerCase('nb')))return false;
 if(spec.treatment==='impregnert'&&!/impregnert/.test(text))return false;
 return true;
}
export function aiSpecificationText(row){const spec=row.aiSpecification;if(!spec)return '';return Object.entries(spec).filter(([key])=>key!=='direction').map(([key,v])=>key==='insulationThickness'?v+' mm':v).join(' · ');}
