import {materialList} from './kalkyle-materials.js?v=20261009-materialliste';
const number=value=>Number.isFinite(value)?new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(value):'—';
const money=value=>Number.isFinite(value)?new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK'}).format(value):'—';
const el=(tag,value)=>{const node=document.createElement(tag);if(value)node.textContent=value;return node;};
export function renderMaterialList(target,rows,options){
 target.replaceChildren();const materials=materialList(rows,options);
 if(!materials.length){target.append(el('p','Ingen materialposter valgt. Arbeidsoppgaver, rigg og avfall vises i arbeidslisten.'));return;}
 const table=el('table'),head=el('thead'),titles=el('tr');
 for(const label of ['Materiale / produkt','Beregnet behov','Kjøpsmengde','Innkjøpspris ekskl. MVA']){const th=el('th',label);th.scope='col';titles.append(th);}head.append(titles);table.append(head);
 const body=el('tbody');
 for(const material of materials){
  const tr=el('tr');tr.dataset.materialRow=material.rowId;
  const name=el('td');name.append(el('strong',material.name),el('small','Til: '+material.task));
  if(material.supplierSku)name.append(el('small','Varenummer: '+material.supplierSku));
  if(material.needsProduct)name.append(el('small','Materialtype – konkret produkt er ikke valgt'));
  tr.append(name,el('td',number(material.quantity)+' '+material.unit));
  const purchase=el('td',number(material.purchaseQuantity)+' '+material.unit);
  if(material.packages!==null)purchase.append(el('small',number(material.packages)+' '+material.packageUnit));tr.append(purchase);
  const price=el('td',material.price===null?'Pris må avklares':money(material.price)+'/'+material.unit);
  if(material.cost!==null)price.append(el('small','Innkjøp: '+money(material.cost)));
  tr.append(price);body.append(tr);
 }table.append(body);target.append(table);
}
