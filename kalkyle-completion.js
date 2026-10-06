const money=n=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',maximumFractionDigits:2}).format(n);
const number=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(n);
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};

export function renderCompletion(target,{rows,priceMode,onMarket,onPrice,onQuantity,onTime,onDetails}){
 target.replaceChildren();const selected=rows.filter(r=>r.enabled);
 if(!selected.length){target.append(el('p','Velg arbeid eller legg til oppgaver fra biblioteket.','muted'));return;}
 const missing=selected.filter(r=>r.priceIssue||r.requiresTime||r.requiresQuantity&&r.quantity===0);
 const head=el('div',null,'completion-heading');head.append(el('h3','2. Materialer og prisgrunnlag'),el('span',missing.length?missing.length+' poster må avklares':'Prisgrunnlaget er klart','workspace-label'));target.append(head);
 target.append(el('p','Velg riktig vare og dimensjon, eller registrer leverandørens pris. Arbeid og materialer bruker prosjektets satser og påslag. Rigg og avfall trenger et eget kostnadsgrunnlag.','muted'));
 const groups=new Map();for(const row of selected){const key=row.elementId||row.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 for(const group of groups.values()){
  const section=el('details',null,'completion-group');section.open=group.some(r=>r.priceIssue||r.requiresTime||r.requiresQuantity&&r.quantity===0);
  const problems=group.filter(r=>r.priceIssue||r.requiresTime||r.requiresQuantity&&r.quantity===0).length;
  section.append(el('summary',(group[0].elementName||group[0].name)+' · '+(problems?problems+' avklaringer':'klart')));
  for(const row of group){
   const card=el('article',null,'completion-task');card.dataset.completionId=row.id;
   card.append(el('h4',row.name));
   card.append(el('p',number(row.quantity)+' '+row.unit+' arbeid'+(row.priceKey?' · '+number(row.materialQuantity)+' '+row.materialUnit+' materiell':''),'muted'));
   if(row.requiresQuantity&&row.quantity===0){
    const label=el('label','Arbeidsmengde ('+row.unit+')');const input=el('input');input.type='number';input.min='.01';input.max='1000000';input.step='any';input.setAttribute('aria-label','Avklar mengde '+row.name);input.onchange=()=>{if(input.checkValidity()&&input.value)onQuantity(row,Number(input.value));};label.append(input);card.append(label);
   }
   if(row.requiresTime){
    const label=el('label','Grunntid (t/'+row.unit+')');const input=el('input');input.type='number';input.min='0';input.max='10000';input.step='any';input.setAttribute('aria-label','Avklar grunntid '+row.name);input.onchange=()=>{if(input.checkValidity()&&input.value)onTime(row,Number(input.value));};label.append(input);card.append(label);
   }
   if(row.priceKey){
    card.append(el('p',row.priceIssue?'Materialpris mangler eller må oppdateres':money(row.material)+'/'+row.materialUnit+' ekskl. MVA · '+row.priceSource+(row.priceDate?' · '+row.priceDate:''),row.priceIssue?'price-warning':'completion-price'));
    if(priceMode==='market'){const button=el('button',row.priceIssue?'Velg markedsvare':'Bytt markedsvare','secondary');button.type='button';button.onclick=()=>onMarket(row);card.append(button);}
    const manual=el('details',null,'completion-manual');manual.append(el('summary','Registrer leverandørpris'));
    const form=el('form');const fields=el('div',null,'completion-price-fields');
    const definitions=[['price','Pris kr/'+row.materialUnit+' ekskl. MVA','number',row.manualPrice?row.material:''],['source','Leverandør / kilde','text',row.manualPriceSource||''],['date','Prisdato','date',row.manualPriceDate||new Date().toISOString().slice(0,10)]];
    for(const [key,text,type,value] of definitions){const label=el('label',text),input=el('input');input.name=key;input.type=type;input.required=true;input.value=value;input.setAttribute('aria-label',text+' til '+row.name);if(type==='number'){input.min='0';input.max='10000000';input.step='any';}if(type==='text')input.maxLength=300;if(type==='date')input.max=new Date().toISOString().slice(0,10);label.append(input);fields.append(label);}
    const submit=el('button','Bruk innkjøpspris','secondary');submit.type='submit';form.append(fields,submit);form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);onPrice(row,{price:Number(data.get('price')),source:String(data.get('source')).trim(),date:String(data.get('date'))});};manual.append(form);card.append(manual);
   }else card.append(el('p','Arbeidsoppgave uten materialkostnad.','muted'));
   section.append(card);
  }
  target.append(section);
 }
 const button=el('button','Rediger oppgaver, timer og koder','secondary');button.type='button';button.onclick=onDetails;target.append(button);
}
