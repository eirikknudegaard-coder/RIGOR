import {codeRegister} from './kalkyle-code-register.js?v=20261007-avklaringer';
import {calculate} from './kalkyle-engine.js?v=20261007-avklaringer';

// Identifiers belong to the template, so adding copies, sorting and AI selection
// cannot renumber them. Company mappings are optional and belong to the project.
export function codesFor(elementId,taskId){
 const entry=codeRegister[elementId];
 const element=entry?.element||'RG-E-L-'+encodeURIComponent(elementId);
 const suffix=entry?.tasks[taskId]||'X-'+encodeURIComponent(taskId);
 const key=element.replace('RG-E-','')+'-'+suffix;
 return {element,work:'RG-A-'+key,purchase:'RG-M-'+key,sale:'RG-S-'+key,salary:''};
}
export function rowCodes(row){
 const key=row.taskKey||row.id||'',split=key.lastIndexOf('.');
 const base=codesFor(key.slice(0,split),key.slice(split+1));
 const mappings=row.codeMappings||{};
 for(const k of ['work','purchase','sale','salary'])if(typeof mappings[k]==='string'&&mappings[k].trim()&&mappings[k].length<=100)base[k]=mappings[k].trim();
 return base;
}
export function exportBasis({rows,rates,project={},offers=[],bindings={},priceMode='market'},kind){
 const selected=rows.filter(r=>r.enabled);
 if(!selected.length)throw Error('Velg oppgaver først.');
 if(!['wage','direct','indirect','billing','laborMarkup','materialMarkup'].every(k=>Number.isFinite(rates[k])&&rates[k]>=0)||rates.billing<=0||rates.billing>100)throw Error('Kontroller timesatser og påslag.');
 if(selected.some(r=>['quantity','materialQuantity','material','hours','factor'].some(k=>!Number.isFinite(r[k])||r[k]<0)||r.requiresQuantity&&r.quantity===0))throw Error('Avklar gyldige mengder først.');
 if(kind==='work'&&selected.some(r=>r.requiresTime))throw Error('Avklar grunntid før arbeidsplanen eksporteres.');
 if(kind==='purchase'&&selected.some(r=>r.priceKey&&r.priceIssue))throw Error('Avklar materialpriser før innkjøpsgrunnlaget eksporteres.');
 if(kind==='sale'&&selected.some(r=>r.priceIssue||r.requiresTime))throw Error('Salgsgrunnlaget krever komplett pris- og tidsgrunnlag.');
 const calc=calculate(selected,rates,1),prefix=r=>[project.number||'',project.name||'',rowCodes(r).element];
 if(kind==='work')return [
  ['Prosjektnummer','Prosjekt','Elementkode','Arbeidskode','Lønnsart (må kobles)','Oppgave','Planlagt mengde','Arbeidsenhet','Grunntid t/enhet','Tidsfaktor','Planlagte timer','Grunntidskilde','Status'],
  ...calc.items.filter(r=>r.workHours>0).map(r=>[...prefix(r),rowCodes(r).work,rowCodes(r).salary,r.name,r.quantity,r.unit,r.hours,r.factor,r.workHours,r.timeSource||'Registrert','Planlagt arbeid – faktisk timeregistrering kreves for lønn'])
 ];
 if(kind==='purchase')return [
  ['Prosjektnummer','Prosjekt','Elementkode','Innkjøpskode','Oppgave','Produkt','Leverandørens varenummer','Leverandør','Butikk','Behovsmengde','Materialenhet','Kjøpsmengde','Pakninger','Pakningsenhet','Innkjøpspris kr/enhet ekskl. MVA','Innkjøpskostnad ekskl. MVA','Priskilde','Prisdato','Status'],
  ...calc.items.filter(r=>r.priceKey||r.manualPrice).map(r=>{
   const offer=priceMode==='market'&&!r.manualPrice&&!r.priceIssue?offers.find(o=>o.id===bindings[r.priceKey]):null;
   return [...prefix(r),rowCodes(r).purchase,r.name,offer?.name||r.manualProduct||'',offer?.source_id||r.supplierSku||'',offer?.chain||'',offer?.store_name||'',r.materialQuantity,r.materialUnit,r.marketPurchasedQuantity??r.materialQuantity,r.marketPackages??'',offer?.original_unit||'',r.material,r.marketMaterialCost??r.materialQuantity*r.material,r.priceSource,r.priceDate,'Planlagt innkjøp – frakt ikke inkludert'];
  })
 ];
 if(kind==='sale')return [
  ['Prosjektnummer','Prosjekt','Elementkode','Salgskode','Type','Oppgave','Mengde','Enhet','Pris kr/enhet ekskl. MVA','Sum ekskl. MVA','MVA %','Priskilde','Prisdato'],
  ...calc.items.flatMap(r=>{
   const base=[...prefix(r),rowCodes(r).sale];const lines=[];
   if(r.workHours>0)lines.push([...base,'Arbeid',r.name,r.workHours,'t',calc.hourly*(1+rates.laborMarkup/100),r.laborPrice,25,r.timeSource||'Registrert','']);
   if(r.priceKey||r.manualPrice){const q=r.marketPurchasedQuantity??r.materialQuantity;lines.push([...base,'Materiale / avsetning',r.name,q,r.materialUnit,q?r.materialPrice/q:0,r.materialPrice,25,r.priceSource,r.priceDate]);}
   return lines;
  })
 ];
 throw Error('Ukjent eksporttype.');
}

// Protect imported company fields against spreadsheet formula execution.
export function csvText(lines){
 const cell=value=>{let s=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+lines.map(row=>row.map(cell).join(';')).join('\r\n');
}
