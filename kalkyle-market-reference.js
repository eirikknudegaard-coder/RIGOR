import {applyPrices,priceStatus} from './kalkyle-prices.js?v=20261009-qa';
import {buildMarketReference,requirementForRow,referenceUnit,requirementKey,createReferenceSnapshot,validReferenceSnapshot} from './market-reference.js?v=20261009-festemidler';

// Uses the existing price application and calculation engine; only price choice
// and source metadata are added. Simple calculations retain their existing path.
export function applyDetailedMaterialPrices(rows,{mode,importedPrices=[],marketPrices=[],offers=[],bindings={},detailed=false,now=Date.now()}={}) {
 const today=new Date(now).toISOString().slice(0,10);
 const base=applyPrices(rows,mode,mode==='import'?importedPrices:marketPrices,today);
 const imports=new Map(importedPrices.map(p=>[p.prisnokkel,p]));
 return base.map((priced,i)=>{
  const original=rows[i],requirement=requirementForRow(original),snapshot=original.priceSnapshot;
  if (!detailed&&!snapshot) return priced;
  if (original.manualPrice) return {...priced,priceBasis:'manual_project'};
  if (mode==='example'||!original.priceKey) return {...priced,priceBasis:mode==='example'?'example':null};
  // An explicit SKU remains an explicit SKU, with existing package rounding.
  if (original.materialPriceChoice==='product'||bindings[original.priceKey]&&!original.materialPriceChoice&&!snapshot) return {...applyPrices([original],'market',marketPrices,today)[0],priceBasis:'product'};
  const imported=imports.get(original.priceKey),unit=referenceUnit(original.materialUnit||original.unit);
  if (original.materialPriceChoice!=='reference'&&imported&&priceStatus(imported,today)==='gyldig'&&imported.enhet===unit) return {...applyPrices([original],'import',[imported],today)[0],priceBasis:'imported_agreement'};
  const canUse=()=>{try{return requirement&&validReferenceSnapshot(snapshot,requirement);}catch{return false;}};
  if (canUse()) return snapshotPrice(priced,snapshot);
  if (snapshot) return {...priced,material:0,priceIssue:'Markedsreferansens lagrede spesifikasjon må kontrolleres.',priceBasis:'missing'};
  if (!detailed) return {...priced,material:0,priceIssue:'Markedsreferansens lagrede spesifikasjon må kontrolleres.'};
  const reference=buildMarketReference({requirement,offers,now});
  if (!reference.usable) return {...priced,material:0,priceBasis:'missing',priceIssue:'Markedsreferanse mangler',priceSource:reference.reason,priceDate:'',marketMaterialCost:undefined,marketPackages:undefined,marketPurchasedQuantity:undefined};
  const next=createReferenceSnapshot(reference);
  return {...snapshotPrice(priced,next),materialRequirement:requirement,priceSnapshot:next};
 });
}
function snapshotPrice(row,snapshot) {
 return {...row,material:snapshot.price,priceBasis:'market_reference',priceSource:'Markedsreferanse · median · '+snapshot.productCount+' produkter / '+snapshot.supplierCount+' leverandører · frakt og pakningsavrunding ikke inkludert',priceDate:snapshot.observedAt.slice(0,10),priceIssue:null,marketMaterialCost:undefined,marketPackages:undefined,marketPurchasedQuantity:undefined};
}
export function useReference(row,requirement,reference,{materialQuantity=row.materialQuantity}={}) {
 if (reference.key!==requirementKey(requirement)||reference.unit!==referenceUnit(requirement.unit)) throw Error('Markedsreferansen samsvarer ikke med materialvalget.');
 if (!Number.isFinite(materialQuantity)||materialQuantity<0||materialQuantity>1e7) throw Error('Oppgi gyldig materialmengde.');
 return {...row,materialRequirement:structuredClone(requirement),materialPriceChoice:'reference',manualPrice:false,manualPriceDate:'',manualPriceSource:'',priceSnapshot:createReferenceSnapshot(reference),materialUnit:reference.unit==='m2'?'m²':reference.unit,materialQuantity,materialRatio:row.quantity>0?materialQuantity/row.quantity:1};
}
