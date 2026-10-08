import {buildMarketReference,requirementForRow,requirementsForOffers,requirementLabel,requirementKey,referenceIsNewer,referenceUnit,validateRequirement,validReferenceSnapshot} from './market-reference.js?v=20261009-reference';
const el=(tag,label,cls)=>{const n=document.createElement(tag);if(label)n.textContent=label;if(cls)n.className=cls;return n;};
const number=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(n);
const price=n=>new Intl.NumberFormat('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const displayUnit=u=>u==='m2'?'m²':u;
const confidence={high:'Høy',medium:'Moderat',low:'Lav'};
const date=stamp=>new Date(stamp).toLocaleDateString('nb-NO',{timeZone:'Europe/Oslo',day:'2-digit',month:'2-digit',year:'numeric'});
const supplier=value=>({obs:'Obs BYGG',byggmax:'Byggmax'}[value]||value);
const labels={thicknessMm:'Tykkelse (mm)',widthMm:'Bredde (mm)',material:'Materiale',treatment:'Behandling',grade:'Kvalitet / styrkeklasse',profile:'Profil',application:'Bruksområde',lambda:'Lambda (W/mK)',brand:'Merke (valgfritt)'};
const options={
 material:[['wood','Tre'],['pine','Furu'],['spruce','Gran'],['wood_fibre','Trefiber'],['mineral_wool','Mineralull'],['glass_wool','Glassull'],['stone_wool','Steinull'],['composite','Kompositt']],
 treatment:[['pressure_treated','Trykkimpregnert'],['untreated','Ubehandlet'],['royal','Royalimpregnert'],['thermal','Varmebehandlet'],['primed','Grunnet'],['painted','Malt']],
 application:[['thermal_building','Varmeisolasjon i bygg'],['other','Annet bruksområde']]
};
let dialog,active,config;
export function setupMarketReferenceUi(callbacks) {
 config=callbacks;
 const style=el('link');style.rel='stylesheet';style.href='./kalkyle-market-reference.css?v=20261009-reference';document.head.append(style);
 dialog=el('dialog',null,'reference-dialog');dialog.id='reference-dialog';dialog.setAttribute('aria-labelledby','reference-title');
 document.body.append(dialog);
 const panel=document.getElementById('market-panel'),oldNote=panel.querySelector('p'),help=el('p','Detaljert: materialspesifikasjon matches mot offentlige priser. En god markedsreferanse brukes uten butikkvalg. Se prisgrunnlag på posten for kilder eller bytte av pris. Lagrede prisøyeblikk oppdateres bare når du velger det.','muted');help.hidden=true;panel.prepend(help);
 const storeLabel=document.getElementById('byggmax-store').closest('label'),originalLabel=storeLabel.firstChild.textContent;
 return {render:renderPriceReference,open:openReference,setDetailed:detailed=>{help.hidden=!detailed;oldNote.hidden=detailed;storeLabel.firstChild.textContent=detailed?'Byggmax-butikk (valgfritt, kun konkrete lokale varer)':originalLabel;}};
}
function button(label,fn){const b=el('button',label,'secondary reference-button');b.type='button';b.onclick=fn;return b;}
function summary(target,basis) {
 target.append(el('p','Markedsreferanse · '+price(basis.price??basis.referencePrice)+' kr/'+displayUnit(basis.unit)+' ekskl. MVA','reference-value'));
 target.append(el('p',basis.productCount+' produkter / '+basis.supplierCount+' leverandører · Sikkerhet: '+confidence[basis.confidence]));
 target.append(el('p','Prisområde: '+price(basis.minPrice)+'–'+price(basis.maxPrice)+' kr/'+displayUnit(basis.unit)));
 target.append(el('p','Sist kontrollert: '+date(basis.observedAt)));
}
function renderPriceReference(target,row,{detailed,offers,now=Date.now()}) {
 if (!detailed&&!row.priceSnapshot) return;
 const requirement=requirementForRow(row);
 if (row.priceBasis==='market_reference'&&row.priceSnapshot) {
  target.replaceChildren();summary(target,row.priceSnapshot);
  const newer=buildMarketReference({requirement,offers,now});
  if (referenceIsNewer(row.priceSnapshot,newer)) target.append(el('small','Nyere markedspriser er tilgjengelige.','reference-newer'));
 } else if (row.priceBasis==='manual_project') target.prepend(el('small','Manuell prosjektpris · '));
 else if (row.priceBasis==='imported_agreement') target.prepend(el('small','Importert avtalepris · '));
 if (!requirement&&!row.priceSnapshot) return;
 target.append(button('Se prisgrunnlag',()=>openReference(row.id)));
}
function openReference(id) {
 const state=config.getState(),row=state.rows.find(r=>r.id===id);if(!row)return;
 active={id,projectId:state.projectId};
 renderDialog(row,state);
 dialog.showModal();
}
function renderDialog(row,state) {
 dialog.replaceChildren();const title=el('h2','Prisgrunnlag: '+row.name);title.id='reference-title';dialog.append(title);
 dialog.append(el('p','Automatisk prisvalg prioriterer manuell prosjektpris og gyldig importert avtalepris. Du kan bytte prisgrunnlag for denne posten med knappene under. Markedsreferansen bruker sammenlignbare offentlige priser uten butikkvalg.','muted'));
 const basisLabel={manual_project:'Manuell prosjektpris',imported_agreement:'Importert avtalepris',product:'Konkret produktpris',market_reference:'Markedsreferanse',example:'Eksempelpris'};
 if(!row.priceIssue)dialog.append(el('p','Gjeldende pris: '+price(row.material)+' kr/'+displayUnit(referenceUnit(row.materialUnit||row.unit))+' · '+(basisLabel[row.priceBasis]||row.priceSource)));
 const saved=requirementForRow(row),type=saved?.productType;
 let validSaved=false;try{validSaved=Boolean(saved&&validReferenceSnapshot(row.priceSnapshot,saved));}catch{}
 if(!type){dialog.append(el('p','Denne varetypen har ikke sikre matcheregler ennå. Velg konkret produkt, importer priser eller registrer egen pris.'));dialog.append(button('Lukk',()=>dialog.close()));return;}
 const groups=requirementsForOffers(state.offers,type),choices=new Map(groups.map(r=>[requirementKey(r),r]));
 if(saved)choices.set(requirementKey(saved),saved);
 const choiceLabel=el('label','Materialspesifikasjon'),select=el('select');select.id='reference-specification';
 for(const [key,r] of choices){const option=el('option',requirementLabel(r)+' · '+r.unit);option.value=key;select.append(option);}select.value=requirementKey(saved);choiceLabel.append(select);dialog.append(choiceLabel);
 const custom=el('details',null,'reference-spec-editor');custom.append(el('summary','Angi eller juster spesifikasjon'));
 const fields=el('div',null,'reference-fields');const unitLabel=el('label','Materialenhet'),unitSelect=el('select');unitSelect.id='reference-unit';
 for(const unit of ['m','m2','stk']){const option=el('option',unit==='m2'?'m²':unit);option.value=unit;unitSelect.append(option);}unitLabel.append(unitSelect);fields.append(unitLabel);
 const controls={};for(const key of Object.keys(labels)){
  const label=el('label',labels[key]),input=el(options[key]?'select':'input');input.id='reference-'+key;
  if(options[key]){const blank=el('option','Ikke avklart');blank.value='';input.append(blank);for(const [v,t] of options[key]){const option=el('option',t);option.value=v;input.append(option);}}
  else if(['thicknessMm','widthMm','lambda'].includes(key)){input.type='number';input.min='0.001';input.max='10000';input.step='any';}
  else{input.type='text';input.maxLength=100;}
  controls[key]=input;label.append(input);fields.append(label);
  if(type==='insulation'?['widthMm','treatment','grade','profile'].includes(key):['application','lambda'].includes(key))label.hidden=true;
 }
 custom.append(fields);dialog.append(custom);
 const quantityLabel=el('label','Materialmengde'),quantity=el('input');quantity.id='reference-quantity';quantity.type='number';quantity.min='0';quantity.max='10000000';quantity.step='any';quantity.required=true;quantityLabel.append(quantity);dialog.append(quantityLabel);
 const quantityNote=el('p',null,'muted');dialog.append(quantityNote);
 const report=el('div',null,'reference-report');report.id='reference-report';dialog.append(report);
 const status=el('p');status.id='reference-status';status.setAttribute('role','status');dialog.append(status);
 const actions=el('div',null,'reference-actions');dialog.append(actions);
 let requirement,current;
 const use=button('Bruk markedsreferanse',()=>commit(false)),refresh=button('Oppdater prisgrunnlag',()=>commit(true));
 const register=button('Registrer manuell pris',()=>{dialog.close();config.onManual(row.id);});
 const concrete=button('Velg konkret produkt',()=>{dialog.close();config.onProduct(row.id);});
 const imported=button('Bruk importert leverandørpris',()=>{try{config.onImport(row.id);dialog.close();}catch(e){status.textContent=e.message;}});
 actions.append(use,refresh,concrete,register,imported,button('Lukk',()=>dialog.close()));
 function sources(target,values) {
  const details=el('details',null,'reference-sources');details.append(el('summary','Se produkter og priser ('+values.length+')'));
  const list=el('ul');for(const s of values){const li=el('li'),link=el('a',s.productName);link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';li.append(link,el('span',supplier(s.supplier)+' · '+number(s.normalizedPrice)+' kr/'+requirement.unit+' · '+date(s.checkedAt)));if(s.quantityBasis==='package')li.append(el('small',number(s.packageQuantity)+' '+requirement.unit+' per '+s.originalUnit+' · '+s.evidence));list.append(li);}details.append(list);target.append(details);
 }
 function draw() {
  try{requirement=validateRequirement({productType:type,unit:unitSelect.value,specification:Object.fromEntries(Object.entries(controls).filter(([,c])=>c.value!=='').map(([key,c])=>[key,c.type==='number'?Number(c.value):c.value]))});current=buildMarketReference({requirement,offers:state.offers});}
  catch(e){current={usable:false,reason:e.message};}
  report.replaceChildren();status.textContent='';
  if(validSaved){const old=el('section');old.append(el('h3','Lagret prisøyeblikk'));summary(old,row.priceSnapshot);sources(old,row.priceSnapshot.sources);report.append(old);}
  else if(row.priceSnapshot)report.append(el('p','Det lagrede prisøyeblikket må kontrolleres. Velg et nytt gyldig grunnlag.','price-warning'));
  if(current.referencePrice!==null&&current.referencePrice!==undefined){const latest=el('section');latest.append(el('h3','Dagens prisgrunnlag'));summary(latest,current);latest.append(el('p',current.reason,'muted'));sources(latest,current.sources);report.append(latest);}
  else report.append(el('p','Markedsreferanse mangler. '+current.reason,'price-warning'));
  report.append(el('p','Median av normaliserte priser ekskl. MVA. Referansen gjelder forbruk; pakningsavrunding og frakt er ikke inkludert. Velg konkret produkt for å beregne kjøp av hele pakninger.','muted'));
  const unitChanged=referenceUnit(row.materialUnit||row.unit)!==unitSelect.value;
  quantityNote.textContent='Arbeidsmengde: '+number(row.quantity)+' '+row.unit+'. Materialmengde oppgis i '+unitSelect.value+'.'+(unitChanged?' Ny materialenhet: registrer faktisk forbruk, ikke arbeidsarealet.':'');
  quantityLabel.firstChild.textContent='Materialmengde ('+unitSelect.value+')';
  use.disabled=!current.usable;refresh.disabled=!current.usable;
  const same=requirement&&row.priceSnapshot&&requirementKey(requirement)===row.priceSnapshot.referenceId;
  refresh.hidden=!same;use.hidden=Boolean(same&&row.priceBasis==='market_reference');
 }
 function load(r) {
  unitSelect.value=r.unit;for(const [key,c] of Object.entries(controls))c.value=r.specification[key]??'';
  quantity.value=referenceUnit(row.materialUnit||row.unit)===r.unit?row.materialQuantity:'';draw();
 }
 function commit(updating) {
  draw();if(!current.usable)return;if(!quantity.reportValidity()||quantity.value===''){status.textContent='Oppgi faktisk materialmengde.';return;}
  try{const live=config.getState();if(live.projectId!==active.projectId)throw Error('Prosjektet er byttet. Åpne prisgrunnlaget på nytt.');
   config.onReference(row.id,requirement,current,Number(quantity.value),updating);dialog.close();
  }catch(e){status.textContent=e.message;}
 }
 select.onchange=()=>load(choices.get(select.value));
 fields.onchange=()=>{if(referenceUnit(row.materialUnit||row.unit)!==unitSelect.value)quantity.value='';draw();};
 load(saved);
}
