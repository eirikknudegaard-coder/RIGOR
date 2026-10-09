import {requirementForRow} from './market-reference.js?v=20261009-reference';

const text=value=>typeof value==='string'?value.trim():'';
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const labels={decking:'Terrassebord',battens:'Lekter / utlekting',cladding:'Kledning',insulation:'Isolasjon',timber:'Konstruksjonsvirke'};
const materials={wood_fibre:'trefiber',glass_wool:'glassull',stone_wool:'steinull',mineral_wool:'mineralull',pine:'furu',spruce:'gran',composite:'kompositt'};
const treatments={pressure_treated:'trykkimpregnert',primed:'grunnet',painted:'malt',untreated:'ubehandlet',thermal:'varmebehandlet',royal:'royalimpregnert'};
const names={'roof.underlay.undertak':'Undertak','roof.underlay.sloyfer':'Sløyfer','roof.underlay.lekter':'Lekter','roof.cover.tile':'Takstein','roof.cover.metal':'Metalltekking','roof.cover.membrane':'Takmembran','insulation.vindsperre':'Vindsperre','foundation.slab.base':'Bærelagsmasser','foundation.slab.insulation':'Grunnisolasjon','foundation.slab.reinforcement':'Armering','foundation.slab.concrete':'Betong'};
export function materialName(row){
 const requirement=requirementForRow(row),spec=requirement?.specification||{};
 const name=names[row.priceKey]||labels[requirement?.productType]||text(row.name).replace(/^(?:montere|legge|sette inn|installere|bygge|feste)\s+/i,'').replace(/\s*\([^)]*\)/g,'').trim()||'Materiale';
 const dimension=spec.thicknessMm?(spec.widthMm?spec.thicknessMm+'x'+spec.widthMm:spec.thicknessMm)+' mm':'';
 return [name,spec.brand,dimension,materials[spec.material],spec.profile,treatments[spec.treatment]].filter(Boolean).join(' · ');
}
export function selectedProductSnapshot(offer){
 return {id:offer.id,name:offer.name,url:offer.url,unit:offer.unit,packageQuantity:offer.package_quantity,checkedAt:offer.checked_at,supplier:offer.chain,supplierSku:offer.source_id,packageUnit:offer.original_unit};
}
// A market reference is a specification, never the product previously selected
// for the same task. Material identity follows the active price choice.
export function materialForRow(row,{offers=[],bindings={},priceMode='market'}={}){
 if(!row.enabled||!row.priceKey&&!row.manualProduct||row.materialUnit==='rs'||/^(?:rig\.|(?:roof|insulation)\.(?:rig|waste)(?:\.|$)|extension\.(?:rig|technical|foundation)(?:\.|$))/.test(row.priceKey||''))return null;
 const productChoice=!row.manualPrice&&!['market_reference','imported_agreement','manual_project','example'].includes(row.priceBasis)&&
  (row.priceBasis==='product'||priceMode==='market'&&(row.materialPriceChoice==='product'||bindings[row.priceKey]&&!row.materialPriceChoice&&!row.priceSnapshot));
 const id=productChoice?(bindings[row.priceKey]||row.selectedProduct?.id):null;
 const offer=id?offers.find(o=>o.id===id):null;
 const saved=id&&row.selectedProduct?.id===id?row.selectedProduct:null;
 const chosen=offer?selectedProductSnapshot(offer):saved;
 const name=productChoice&&chosen?text(chosen.name):row.manualPrice?text(row.manualProduct)||materialName(row):materialName(row);
 const quantity=finite(row.materialQuantity)?row.materialQuantity:null;
 const purchaseQuantity=productChoice&&finite(row.marketPurchasedQuantity)?row.marketPurchasedQuantity:quantity;
 return {rowId:row.id,name,task:text(row.name),unit:text(row.materialUnit||row.unit),quantity,purchaseQuantity,
  packages:productChoice&&finite(row.marketPackages)?row.marketPackages:null,packageUnit:text(chosen?.packageUnit)||'pakke',
  productId:id||'',supplier:productChoice?text(chosen?.supplier):row.manualPrice?text(row.manualPriceSource):'',
  supplierSku:productChoice?text(chosen?.supplierSku):row.manualPrice?text(row.supplierSku):'',
  needsProduct:!chosen&&!(row.manualPrice&&text(row.manualProduct)),priceIssue:text(row.priceIssue),
  price:!row.priceIssue&&finite(row.material)?row.material:null,
  cost:!row.priceIssue&&quantity!==null&&finite(row.material)?productChoice&&finite(row.marketMaterialCost)?row.marketMaterialCost:quantity*row.material:null,
  priceSource:text(row.priceSource),priceDate:text(row.priceDate)};
}
export function materialList(rows,options){return rows.map(row=>materialForRow(row,options)).filter(Boolean);}
