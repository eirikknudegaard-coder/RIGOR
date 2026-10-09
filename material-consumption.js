// Consumption is separate from price and packaging. Never infer a joint width.
const unit=value=>String(value||'').replace('m²','m2').replace('lm','m');
export function validConsumption(value){
 return Boolean(value&&Number.isFinite(value.value)&&value.value>0&&value.value<=1e5&&['m','m2','stk'].includes(unit(value.materialUnit))&&['m','m2','stk'].includes(unit(value.workUnit))&&typeof value.source==='string'&&/^https:\/\//.test(value.source)&&['manufacturer_or_retailer_documentation','geometry','user'].includes(value.sourceType)&&Number.isFinite(Date.parse(value.checkedAt)));
}
export function documentedConsumption(text,{source,checkedAt,materialUnit='m'}={}){
 const matches=[...String(text).matchAll(/(?:forbruk\s*(?:på|:)?\s*|beregn(?:\s+forbruk)?\s*(?:på\s*)?(?:ca\.?\s*)?)(\d+(?:[.,]\d+)?)\s*(?:løpemeter|lm\.?|m)\s*(?:per|pr\.?|\/)\s*m[²2]/gi)];
 const values=[...new Set(matches.map(m=>Number(m[1].replace(',','.'))))];
 if(values.length!==1)return null;
 const consumption={value:values[0],materialUnit:unit(materialUnit),workUnit:'m2',source,sourceType:'manufacturer_or_retailer_documentation',checkedAt,evidence:matches[0][0]};
 return validConsumption(consumption)?consumption:null;
}
export function applyMaterialConsumption(row,consumption,{explicit=false}={}){
 if(!validConsumption(consumption)||unit(row.unit)!==unit(consumption.workUnit)||!Number.isFinite(row.quantity)||row.quantity<0||row.manualMaterialQuantity&&!explicit)return row;
 const materialQuantity=Math.round(row.quantity*consumption.value*1e6)/1e6;
 return {...row,materialUnit:unit(consumption.materialUnit)==='m2'?'m²':unit(consumption.materialUnit),materialQuantity,materialRatio:consumption.value,materialConsumption:structuredClone(consumption),requiresMaterialConsumption:false,...(explicit?{manualMaterialQuantity:false}:{})};
}
export function familyConsumption(offers){
 const candidates=offers.map(o=>o.materialConsumption).filter(validConsumption);
 if(!candidates.length||candidates.length!==offers.length||new Set(candidates.map(c=>JSON.stringify([c.value,unit(c.materialUnit),unit(c.workUnit)]))).size!==1)return null;
 return structuredClone(candidates[0]);
}
export function roofTileRule(text,{source,checkedAt}={}){
 const width=String(text).match(/byggebredde\s*:\s*(\d+(?:[.,]\d+)?)\s*mm/i);
 const spacing=String(text).match(/fra\s*(\d+)\s*til\s*(\d+)\s*mm\s*lekte/i);
 if(!width||!spacing||!/forbruk\s*:\s*\d+[.,]\d+\s*[-–]\s*\d+[.,]\d+\s*stk\s*per\s*m[²2]/i.test(text))return null;
 return {type:'roof_tile_spacing',coverWidthMm:Number(width[1].replace(',','.')),minSpacingMm:Number(spacing[1]),maxSpacingMm:Number(spacing[2]),source,checkedAt,evidence:'Byggebredde '+width[1]+' mm; lekteintervall '+spacing[1]+'–'+spacing[2]+' mm'};
}
export function consumptionForProduct(offer,{lathSpacing}={}){
 if(validConsumption(offer.materialConsumption))return offer.materialConsumption;
 const rule=offer.materialConsumptionRule;
 if(rule?.type!=='roof_tile_spacing')return null;
 if(![lathSpacing,rule.minSpacingMm,rule.maxSpacingMm,rule.coverWidthMm].every(Number.isFinite)||rule.minSpacingMm<=0||rule.maxSpacingMm<rule.minSpacingMm||lathSpacing<rule.minSpacingMm||lathSpacing>rule.maxSpacingMm||rule.coverWidthMm<=0||!/^https:\/\//.test(rule.source)||!Number.isFinite(Date.parse(rule.checkedAt)))throw Error('Oppgi dokumentert lekteavstand mellom '+rule.minSpacingMm+' og '+rule.maxSpacingMm+' mm for denne taksteinen.');
 return {value:1e6/(rule.coverWidthMm*lathSpacing),materialUnit:'stk',workUnit:'m2',source:rule.source,sourceType:'geometry',checkedAt:rule.checkedAt,evidence:rule.evidence+'; valgt lekteavstand '+lathSpacing+' mm',lathSpacing};
}
