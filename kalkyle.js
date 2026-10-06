import {jobs,propose,calculate,roofGeometry,roofConsumption} from './kalkyle-engine.js?v=20261005-sortiment';
import {library,roofTypes,instantiate,searchLibrary} from './kalkyle-library.js?v=20261005-kategorier';
import {parseCsv,validatePrices,applyPrices} from './kalkyle-prices.js?v=20261005-sortiment';
import {fields,prepareImport,sampleImport,checkMapping,mapImport} from './kalkyle-import.js?v=20261005-kategorier';
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',maximumFractionDigits:2}).format(n),num=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(n);
const rateKeys=['wage','direct','indirect','billing','laborMarkup','materialMarkup'];
let job='roof',rows=[],edited=false,lastSettings=null,result=null;
let priceMode='market',importedPrices=[],marketPrices=[],marketMessage='Ingen markedspriskilde er tilkoblet. Importer en prisliste eller velg demonstrasjon.',priceRequest=0;
const roofKeys=['roofType','lowerAngle','upperShare','ridgeLength','hipLength','breakLength','edgeLength','drainCount','battenSpacing','lathSpacing','roofWaste'];
let renderedGroups=[];let calculationMode='simple';
function settings(){return {...Object.fromEntries(roofKeys.map(k=>[k,k==='roofType'?$(k).value:Number($(k).value)])),job,area:Number($('area').value),angle:Number($('angle').value),basis:$('basis').value,material:$('material').value,difficulty:Number($('difficulty').value),options:[...document.querySelectorAll('#options input:checked')].map(e=>e.value)};}
function rates(){return Object.fromEntries(rateKeys.map(k=>[k,Number($(k).value)]));}
function valid(){return [...document.querySelectorAll('#questions input[type=number],.rates input')].every(e=>e.disabled||e.checkValidity()) && rows.every(r=>['quantity','material','hours','factor','materialQuantity'].every(k=>Number.isFinite(r[k])&&r[k]>=0));}
function setupJob(){
 $('jobs').replaceChildren();for(const [key,j] of Object.entries(jobs)){const b=document.createElement('button');b.textContent=j.name;b.setAttribute('aria-pressed',String(key===job));b.onclick=()=>{if(edited&&!confirm('Nye veiviservalg erstatter dine redigerte poster. Fortsette?'))return;job=key;edited=false;setupJob();generate();};$('jobs').append(b);}
 $('options').replaceChildren();for(const [id,title,checked] of [...jobs[job].options,...(job==='roof'?[['details','Ta med møne, beslag og taktypeavhengige detaljer',false]]:[])]){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=checked;label.append(input,document.createTextNode(title));$('options').append(label);}
 for(const id of ['angle','basis','material','roofType']){$(id).disabled=job!=='roof';$(id+'-label').hidden=job!=='roof';}
 $('area-help').textContent=job==='roof'?'Horisontalt areal omregnes for et enkelt tak med lik vinkel på takflatene. Ta med takutstikk. Bratte tak øker arbeidstiden: +10 % over 25°, +25 % over 40°.':job==='insulation'?'Oppgi netto ytterveggflate som skal etterisoleres.':'Oppgi gulvareal for et tilbygg med én etasje.';
 $('scope-note').textContent='Arbeidstider er eksempler. Rigg og avfall er foreløpig arealbaserte avsetninger; små jobber kan kreve minimumspriser.';
 $('uncertainty').textContent=jobs[job].uncertainty;configureRoof();
}
function configureRoof(){
 $('roof-consumption').hidden=job!=='roof';for(const id of ['battenSpacing','lathSpacing','roofWaste'])$(id).disabled=job!=='roof';
 const roof=job==='roof',type=$('roofType').value,shape=roofTypes[type];
 $('roof-type-note').textContent=roof?shape.note:'';
 $('angle').max=type==='flat'?'5':'75';if(roof&&type==='flat'&&Number($('angle').value)>5)$('angle').value='3';
 for(const o of $('material').options)o.disabled=roof&&type==='flat'&&o.value!=='membrane';if(roof&&type==='flat')$('material').value='membrane';
 $('mansard-fields').hidden=!roof||type!=='mansard';$('lowerAngle').disabled=!roof||type!=='mansard';$('upperShare').disabled=!roof||type!=='mansard'||$('basis').value!=='footprint';
 const details=roof&&Boolean(document.querySelector('#options input[value=details]:checked'));$('roof-details').hidden=!details;
 for(const [id,active] of [['ridgeLength',['gable','hip','mansard'].includes(type)],['hipLength',type==='hip'],['breakLength',type==='mansard'],['edgeLength',true],['drainCount',type==='flat']]){$(id).disabled=!details||!active;$(id+'-label').hidden=!active;}
 if(roof)$('area-help').textContent=type==='mansard'?'Øvre takvinkel oppgis i feltet Takvinkel. Ved projisert areal brukes øvre og nedre vinkel med oppgitt arealandel. Ved målt takflate brukes høyeste vinkel som tidsforutsetning.':'Målt takflate brukes direkte. Projisert areal omregnes med takvinkelen; flatt tak har lavt fall. Arealet inkluderer takutstikk. Tidsfaktorer er foreløpige antakelser.';
}
function generate(){configureRoof();if([...document.querySelectorAll('#questions input[type=number]')].some(e=>!e.disabled&&!e.checkValidity())){update();return;}lastSettings=settings();rows=propose(lastSettings);edited=false;renderRows();update();}
function renderRows(){
 $('rows').replaceChildren();renderedGroups=[];
 const groups=new Map();rows.forEach((r,i)=>{const key=r.elementId||r.id||String(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
 for(const [key,indices] of groups){
  renderedGroups.push(indices);const first=rows[indices[0]],group=document.createElement('tr');group.className='element-row';group.dataset.elementIndex=indices[0];
  let td=document.createElement('td');td.colSpan=2;td.className='element-title';td.textContent=(first.category?first.category+' / ':'')+(first.elementName||first.name);group.append(td);
  td=document.createElement('td');const qty=document.createElement('input');qty.type='number';qty.min='0';qty.max='1000000';qty.step='any';qty.value=first.quantity;qty.setAttribute('aria-label','Elementmengde '+(first.elementName||first.name));qty.oninput=()=>{const value=qty.value===''?NaN:Number(qty.value);for(const i of indices){const r=rows[i];r.quantity=value;r.materialQuantity=value*(r.materialRatio??1);}edited=true;renderRows();update();const input=document.querySelector(`[data-element-index='${indices[0]}'] input`);input?.focus();};td.append(qty);group.append(td);
  td=document.createElement('td');td.textContent=first.unit;group.append(td);td=document.createElement('td');td.colSpan=6;td.textContent=indices.length+' oppgaver · endre elementmengden for å oppdatere alle oppgavene';group.append(td);
  td=document.createElement('td');td.id='group-total-'+indices[0];group.append(td);td=document.createElement('td');const remove=document.createElement('button');remove.className='element-delete';remove.textContent='Fjern';remove.setAttribute('aria-label','Fjern element '+(first.elementName||first.name));remove.onclick=()=>{rows=rows.filter((r,i)=>!indices.includes(i));edited=true;renderRows();update();};td.append(remove);group.append(td);$('rows').append(group);
  for(const i of indices){const r=rows[i],tr=document.createElement('tr');tr.dataset.rowIndex=i;const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=r.enabled;enabled.setAttribute('aria-label','Inkluder '+r.name);enabled.onchange=()=>{r.enabled=enabled.checked;edited=true;update();};td=document.createElement('td');td.append(enabled);tr.append(td);td=document.createElement('td');td.textContent=r.name;tr.append(td);
   for(const k of ['quantity','unit','materialQuantity','materialUnit','material','hours']){td=document.createElement('td');if(k==='unit'||k==='materialUnit')td.textContent=r[k]||r.unit;else{const input=document.createElement('input');input.type='number';input.min='0';input.max='10000000';input.step='any';input.value=k==='hours'&&r.requiresTime?'':r[k];input.required=!(k==='hours'&&r.requiresTime);if(k==='hours'&&r.requiresTime)input.placeholder='Angi grunntid';input.dataset.field=k;input.setAttribute('aria-label',r.name+' '+({quantity:'mengde',materialQuantity:'materiellmengde',material:'materialpris',hours:'timer per enhet'}[k]));input.oninput=()=>{r[k]=input.value===''?NaN:Number(input.value);if(k==='quantity'){r.materialQuantity=r.quantity*(r.materialRatio??1);tr.querySelector('[data-field=materialQuantity]').value=r.materialQuantity;}if(k==='materialQuantity')r.materialRatio=r.quantity>0?r.materialQuantity/r.quantity:1;if(k==='hours')r.requiresTime=false;if(k==='material'){r.manualPrice=true;r.priceIssue=null;}edited=true;update();};td.append(input);}tr.append(td);}
   td=document.createElement('td');td.textContent=num(r.factor);tr.append(td);td=document.createElement('td');td.id='row-source-'+i;td.className='price-meta';tr.append(td);td=document.createElement('td');td.id='row-total-'+i;tr.append(td);td=document.createElement('td');tr.append(td);$('rows').append(tr);
  }
 }
}
function update(){
 $('task-count').textContent=rows.filter(r=>r.enabled).length+' valgte oppgaver';
 const pricedRows=applyPrices(rows,priceMode,priceMode==='import'?importedPrices:marketPrices);
 rows.forEach((row,i)=>Object.assign(row,pricedRows[i]));
 const missing=rows.filter(r=>r.enabled&&r.priceIssue);
 const missingTimes=rows.filter(r=>r.enabled&&r.requiresTime);
 const missingQuantities=rows.filter(r=>r.enabled&&r.requiresQuantity&&r.quantity===0);
 $('import-panel').hidden=priceMode!=='import';$('market-panel').hidden=priceMode!=='market';
 $('price-status').textContent=priceMode==='market'?marketMessage:priceMode==='import'?`Prislisten inneholder ${importedPrices.length} priser. Priser eldre enn 30 dager må oppdateres.`:'Demonstrasjon: prisene er eksempler, ikke markedspriser.';
 $('price-coverage').replaceChildren();
 rows.forEach((r,i)=>{const source=$('row-source-'+i);source.textContent=r.priceIssue?`${r.priceKey}: ${r.priceIssue}`:`${r.priceSource}${r.priceDate?' · '+r.priceDate:''}`;source.classList.toggle('price-warning',Boolean(r.priceIssue));const input=document.querySelector(`[data-row-index='${i}'] [data-field=material]`);if(document.activeElement!==input)input.value=r.priceIssue?'':r.material;input.required=!r.priceIssue;});
 for(const r of rows.filter(r=>r.enabled)){const li=document.createElement('li');li.textContent=r.priceIssue?`${r.name}: ${r.priceIssue} (${r.priceKey}).`:`${r.name}: ${r.priceSource}${r.priceDate?' · '+r.priceDate:''}${r.manualPrice?' – overstyrer valgt prisgrunnlag':''}.`;$('price-coverage').append(li);}
 const ok=valid()&&[...document.querySelectorAll('#rows input[type=number]')].every(e=>e.checkValidity());for(const id of ['save','export'])$(id).disabled=!ok||(id==='export'&&(missing.length>0||missingQuantities.length>0||missingTimes.length>0));
 if(!ok){for(const indices of renderedGroups)$('group-total-'+indices[0]).textContent='—';result=null;$('status').textContent='Fyll inn gyldige tall i alle feltene før kalkylen beregnes.';for(const id of ['total','per-area','hours','cost','profit','vat','gross','hourly','calc-area'])$(id).textContent='—';rows.forEach((r,i)=>$('row-total-'+i).textContent='—');return;}
 const area=lastSettings.job==='roof'?roofGeometry(lastSettings).area:lastSettings.area;
 result=calculate(rows,rates(),area);$('total').textContent=money(result.price);$('per-area').textContent=money(result.perArea)+'/m²';$('calc-area').textContent=num(area)+' m²';$('hours').textContent=num(result.hours)+' t';for(const id of ['cost','profit','vat','gross'])$(id).textContent=money(result[id]);$('hourly').textContent='Timekostnad: '+money(result.hourly)+' · Kundepris: '+money(result.hourly*(1+rates().laborMarkup/100))+' ekskl. MVA';
 for(const indices of renderedGroups)$('group-total-'+indices[0]).textContent=indices.some(i=>rows[i].enabled&&rows[i].priceIssue)?'Pris mangler':indices.some(i=>rows[i].enabled&&rows[i].requiresTime)?'Grunntid mangler':money(indices.reduce((sum,i)=>sum+result.items[i].price,0));
 result.items.forEach((r,i)=>$('row-total-'+i).textContent=money(r.price));$('included').replaceChildren();for(const r of rows.filter(r=>r.enabled)){const li=document.createElement('li');li.textContent=r.name;$('included').append(li);}
 if(missing.length||missingQuantities.length||missingTimes.length){for(const indices of renderedGroups)if(indices.some(i=>rows[i].enabled&&rows[i].requiresQuantity&&rows[i].quantity===0))$('group-total-'+indices[0]).textContent='Mengde mangler';result=null;for(const id of ['total','per-area','cost','profit','vat','gross'])$(id).textContent='—';rows.forEach((r,i)=>$('row-total-'+i).textContent=r.enabled?'Prisgrunnlag ufullstendig':'Ikke inkludert');$('status').textContent=`${missing.length} valgte oppgaver mangler gyldige priser; ${missingQuantities.length} mangler mengde; ${missingTimes.length} mangler grunntid. Importer priser eller legg inn materialkostnad manuelt. Timer vises, men totalpris og CSV-eksport venter på komplett prisgrunnlag.`;return;}
 if(!rows.length){result=null;for(const id of ['total','per-area','cost','profit','vat','gross'])$(id).textContent='—';$('export').disabled=true;$('status').textContent='Kalkylen er tom. Legg til bygningselementer og velg oppgavene som skal inngå.';return;}
 $('status').textContent=edited?'Egne postendringer er med i anslaget.':'Forslag fra veiviseren. Kontroller omfang og satser.';
}
function view(detail){calculationMode=detail?'detailed':'simple';workspacePane(calculationMode);}
function workspacePane(pane){for(const [button,panel] of [['simple','wizard'],['detailed','details'],['pricing-tab','pricing-pane'],['rates-tab','rates-pane']]){const selected=button===pane;$(panel).hidden=!selected;$(button).setAttribute('aria-pressed',String(selected));}const text={simple:'Velg arbeidet og avklar omfanget. Veiviseren foreslår poster til kontroll.',detailed:'Bygg kalkylen fra biblioteket. Juster oppgaver, mengder og materialforbruk.', 'pricing-tab':'Velg dokumenterte materialpriser og kontroller kilde, dato og enhet.', 'rates-tab':'Sett prosjektets timekostnad og påslag. Endringene påvirker denne kalkylen.'};$('workspace-view-help').textContent=text[pane];}
$('pricing-tab').onclick=()=>workspacePane('pricing-tab');$('rates-tab').onclick=()=>workspacePane('rates-tab');
$('simple').onclick=()=>view(false);$('detailed').onclick=()=>view(true);
$('questions').onsubmit=e=>e.preventDefault();$('questions').onchange=()=>{if(edited&&!confirm('Endringen lager et nytt forslag og erstatter redigerte poster. Fortsette?')){const s=lastSettings;for(const k of ['area','angle','basis','material','difficulty',...roofKeys])if(s[k]!==undefined)$(k).value=s[k];for(const el of document.querySelectorAll('#options input'))el.checked=s.options.includes(el.value);configureRoof();return;}generate();};
for(const key of rateKeys)$(key).oninput=update;
$('reset').onclick=()=>{if(!edited||confirm('Gjenopprette postene fra veiviseren?'))generate();};
$('save').onclick=()=>{try{localStorage.setItem('rigor-calculation-v1',JSON.stringify({version:2,settings:lastSettings,rows,rates:rates(),edited,priceMode,importedPrices,marketPrices}));$('status').textContent='Kalkylen er lagret i denne nettleseren.';}catch{$('status').textContent='Nettleseren tillater ikke lokal lagring. Bruk CSV-eksport.';}};
function restoreCalculation(snapshot=null){try{const raw=snapshot?JSON.stringify(snapshot):localStorage.getItem('rigor-calculation-v1');if(!raw){$('status').textContent='Ingen lokal kalkyle er lagret.';return;}const s=JSON.parse(raw);if(![1,2].includes(s.version)||!jobs[s.settings?.job]||!Array.isArray(s.rows)||s.rows.length>500||s.rows.some(r=>typeof r.name!=='string'||typeof r.enabled!=='boolean'||!['m²','m','stk','rs'].includes(r.unit)||['quantity','material','hours','factor'].some(k=>!Number.isFinite(r[k])||r[k]<0))||!rateKeys.every(k=>Number.isFinite(s.rates?.[k]))||!['surface','footprint'].includes(s.settings.basis)||!['metal','tile','membrane'].includes(s.settings.material)||!Array.isArray(s.settings.options)||!['area','angle','difficulty'].every(k=>Number.isFinite(s.settings[k])))throw Error();if(edited&&!confirm('Erstatte den åpne kalkylen med den lagrede?'))return;
 if(s.version===2){if(!['market','import','example'].includes(s.priceMode)||!Array.isArray(s.importedPrices))throw Error();if(s.importedPrices.length)validatePrices(s.importedPrices);if(s.marketPrices?.length)validatePrices(s.marketPrices);priceMode=s.priceMode;importedPrices=s.importedPrices;marketPrices=s.marketPrices||[];if(priceMode==='market'&&marketPrices.length)marketMessage='Lagret prisgrunnlag. Kilde og dato kontrolleres; hent nye priser ved behov.';}else{priceMode='example';importedPrices=[];}
 $('price-mode').value=priceMode;
 const restored={roofType:'gable',lowerAngle:60,upperShare:50,ridgeLength:0,hipLength:0,breakLength:0,edgeLength:0,drainCount:0,battenSpacing:600,lathSpacing:500,roofWaste:0,...s.settings};
 job=s.settings.job;setupJob();for(const k of ['area','angle','basis','material','difficulty',...roofKeys])if(restored[k]!==undefined)$(k).value=restored[k];for(const el of document.querySelectorAll('#options input'))el.checked=s.settings.options.includes(el.value);configureRoof();for(const k of rateKeys)$(k).value=s.rates[k];lastSettings=restored;rows=s.rows.map(r=>({...r,materialQuantity:r.materialQuantity??r.quantity,materialUnit:r.materialUnit||r.unit,materialRatio:r.materialRatio??1,priceKey:r.priceKey===undefined&&r.material>0?`${job}.${r.id}${job==='roof'&&r.id==='cover'?'.'+s.settings.material:''}`:r.priceKey,manualPrice:Boolean(r.manualPrice)}));edited=Boolean(s.edited);renderRows();update();if(result)$('status').textContent='Lokal kalkyle åpnet med lagrede priser. Markedspriser hentes først når du ber om oppdatering.';
 return true;}catch{$('status').textContent='Kunne ikke åpne lokal kalkyle. Lagrede data er ugyldige eller utilgjengelige.';return false;}}
$('restore').onclick=()=>restoreCalculation();
$('export').onclick=()=>{if(!result)return;const cell=v=>'"'+String(v).replaceAll('"','""')+'"';const data=[['RIGOR prisanslag – prisgrunnlag: '+priceMode+', ekskl. MVA; arbeidstider er eksempler'],['Oppgave','Mengde','Enhet','Materiellmengde','Materialenhet','Materiell kr/enhet','Timer/enhet','Tidsfaktor','Arbeidstimer','Kostnad','Pris ekskl. MVA','Priskilde','Prisdato'],...result.items.filter(r=>r.enabled).map(r=>[r.name,r.quantity,r.unit,r.materialQuantity,r.materialUnit,r.material,r.hours,r.factor,r.workHours,r.cost,r.price,r.priceSource,r.priceDate]),['Totalt', '', '', '', '', '', '', '',result.hours,result.cost,result.price],['Taktype',lastSettings.job==='roof'?roofTypes[lastSettings.roofType||'gable'].name:''],['Forutsetninger',jobs[job].uncertainty]];const url=URL.createObjectURL(new Blob(['\uFEFF'+data.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rigor-prisanslag.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function applyCatalog(){rows=rows.map(r=>({...r,manualPrice:false}));edited=true;renderRows();update();}
$('price-mode').onchange=()=>{
 const next=$('price-mode').value;
 if(rows.some(r=>r.manualPrice)&&!confirm('Bytte prisgrunnlag erstatter manuelt satte materialpriser. Fortsette?')){$('price-mode').value=priceMode;return;}
 priceMode=next;applyCatalog();
};
$('price-file').onchange=async()=>{
 const file=$('price-file').files[0];if(!file)return;
 try{if(file.size>2_000_000)throw Error('Prislisten er for stor (maks 2 MB).');const prices=parseCsv(await file.text());
 if(rows.some(r=>r.manualPrice)&&!confirm('Import erstatter manuelt satte materialpriser. Fortsette?'))return;
 importedPrices=prices;priceMode='import';$('price-mode').value=priceMode;applyCatalog();
 }catch(error){$('price-status').textContent='Import avvist: '+error.message+' Gjeldende priser er beholdt.';}
 $('price-file').value='';
};
$('template').onclick=()=>{
 const unique=[...new Map(rows.filter(r=>r.priceKey).map(r=>[r.priceKey,r])).values()];const data=['prisnokkel;enhet;pris;kilde;dato;valuta;mva',...unique.map(r=>`${r.priceKey};${(r.materialUnit||r.unit).replace('m²','m2')};;;;NOK;ekskl`)];
 const url=URL.createObjectURL(new Blob(['\uFEFF'+data.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rigor-prisliste-mal.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('refresh-prices').onclick=async()=>{
 if(rows.some(r=>r.manualPrice)&&!confirm('Hente nye priser erstatter manuelt satte materialpriser. Fortsette?'))return;
 const request=++priceRequest;$('refresh-prices').disabled=true;marketMessage='Henter dokumenterte markedspriser …';update();
 try{const {priceApi}=await import('./market-price-client.js');const data=await priceApi('catalog');if(!data.prices.length)throw Error('Ingen verifiserte priser i serverregisteret.');const prices=validatePrices(data.prices);if(request!==priceRequest)return;marketPrices=prices;marketMessage='Serverens prisregister hentet. Markedspriser eldre enn 24 timer brukes ikke. Hele pakninger prises; frakt er ikke inkludert.';
 if(priceMode==='market')applyCatalog();else update();
 }catch(e){marketMessage=e.message+' Importer en prisliste ved behov. Tidligere hentede priser beholdes med datokontroll.';update();}
 finally{$('refresh-prices').disabled=false;}
};
setupJob();generate();

let importFile=null,importGeneration=0,importClient=null;
const fieldNames={prisnokkel:'Prisnøkkel (RIGOR-post)',enhet:'Enhet',pris:'Innkjøpspris',kilde:'Leverandør / kilde',dato:'Prisdato',valuta:'Valuta',mva:'MVA-grunnlag'};
function currentMapping(){return Object.fromEntries(fields.map(k=>[k,$('map-'+k).value===''?null:Number($('map-'+k).value)]));}
function importDefaults(){return {kilde:$('default-source').value.trim(),dato:$('default-date').value,valuta:'NOK',enhet:'m2',mva:'ekskl'};}
function previewMapping(){
 $('mapping-confirm').checked=false;$('confirm-import').disabled=true;
 const mapping=currentMapping(),defaults=importDefaults();$('mapping-preview').replaceChildren();
 for(const row of importFile.records.slice(0,5)){const tr=document.createElement('tr');for(const k of fields){const td=document.createElement('td');td.textContent=mapping[k]===null?defaults[k]||'Mangler':row[mapping[k]];tr.append(td);}$('mapping-preview').append(tr);}
}
function renderMapping(mapping){
 checkMapping(mapping,importFile.headers.length);$('mapping-fields').replaceChildren();
 for(const k of fields){const label=document.createElement('label');label.textContent=fieldNames[k];const select=document.createElement('select');select.id='map-'+k;const empty=document.createElement('option');empty.value='';empty.textContent='Ingen kolonne – fyll inn / avklar';select.append(empty);
 importFile.headers.forEach((title,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${i+1}: ${title}`;select.append(option);});select.value=mapping[k]===null?'':mapping[k];select.onchange=previewMapping;label.append(select);$('mapping-fields').append(label);}
 $('mapping-head').replaceChildren();const tr=document.createElement('tr');for(const k of fields){const th=document.createElement('th');th.textContent=fieldNames[k];tr.append(th);}$('mapping-head').append(tr);previewMapping();
}
$('assist-file').onchange=async()=>{
 const generation=++importGeneration;importFile=null;$('mapping-panel').hidden=true;const file=$('assist-file').files[0];if(!file)return;
 try{if(file.size>2_000_000)throw Error('Filen er for stor (maks 2 MB).');const prepared=prepareImport(await file.text());if(generation!==importGeneration)return;importFile=prepared;$('mapping-panel').hidden=false;$('ai-import-status').textContent='Kolonner er foreslått med faste regler. Kontroller koblingen eller be AI om hjelp.';$('sample-info').textContent=`${prepared.records.length} rader og ${prepared.headers.length} kolonner. Originalfilen beholdes i nettleseren frem til import.`;renderMapping(prepared.mapping);}
 catch(error){$('price-status').textContent='Analyse avvist: '+error.message;}
};
for(const id of ['default-source','default-date'])$(id).oninput=()=>{if(importFile)previewMapping();};
$('mapping-confirm').onchange=()=>{$('confirm-import').disabled=!$('mapping-confirm').checked;};
$('confirm-import').onclick=()=>{
 if(!importFile||!$('mapping-confirm').checked)return;
 try{const prices=mapImport(importFile,currentMapping(),importDefaults());if(rows.some(r=>r.manualPrice)&&!confirm('Import erstatter manuelt satte materialpriser. Fortsette?'))return;
 importedPrices=prices;priceMode='import';$('price-mode').value=priceMode;applyCatalog();$('ai-import-status').textContent=`${prices.length} priser importert etter din bekreftelse. Kilde og dato følger prisene.`;$('mapping-confirm').checked=false;$('confirm-import').disabled=true;
 }catch(error){$('ai-import-status').textContent='Import avvist: '+error.message+' Gjeldende priser er beholdt.';}
};
$('ai-map').onclick=async()=>{
 if(!importFile)return;
 let sample;try{sample=sampleImport(importFile);}catch(error){$('ai-import-status').textContent=error.message;return;}
 const generation=importGeneration;
 if(!confirm('Sende kolonneoverskrifter og opptil åtte rader til OpenAI for kolonneforslag? Se forhåndsvisningen før du fortsetter.'))return;
 $('ai-map').disabled=true;$('ai-import-status').textContent='Analyserer kolonner …';
 try{
  if(!importClient){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm');importClient=createClient('https://hyqiqjuycivihsgjongj.supabase.co','sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl',{auth:{detectSessionInUrl:false}});}
  const {data,error}=await importClient.auth.getSession();if(error||!data.session)throw Error('Logg inn som administrator i portalen først. Manuell kolonneimport fungerer uten AI.');
  const response=await fetch('https://hyqiqjuycivihsgjongj.supabase.co/functions/v1/rigor-import-map',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token,apikey:'sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl'},body:JSON.stringify(sample),signal:AbortSignal.timeout(30000)});
  const answer=await response.json();if(!response.ok)throw Error(answer.error||'AI-import er ikke aktivert i Supabase ennå.');if(generation!==importGeneration)return;
  renderMapping(checkMapping(answer.mapping,importFile.headers.length));$('ai-import-status').textContent=`AI-forslag klart. Kontroller alle felt før import. Forbruk: ${answer.usage?.input_tokens||0} input-tokens og ${answer.usage?.output_tokens||0} output-tokens.`;
 }catch(error){if(generation===importGeneration)$('ai-import-status').textContent=error.message+' Ingen priser er endret.';}
 finally{$('ai-map').disabled=false;}
};

let localLibrary=[];
try{
 const raw=localStorage.getItem('rigor-library-v1');if(raw&&raw.length<1_000_000){const data=JSON.parse(raw);
 if(Array.isArray(data)&&data.length<=100&&data.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&typeof e.category==='string'&&['m²','m','stk','rs'].includes(e.unit)&&Array.isArray(e.tasks)&&e.tasks.length<=100&&e.tasks.every(t=>typeof t.id==='string'&&typeof t.name==='string'&&Number.isFinite(t.hours)&&t.hours>=0&&Number.isFinite(t.materialRatio)&&t.materialRatio>=0&&['m²','m','stk','rs'].includes(t.materialUnit)&&(!t.priceKey||typeof t.priceKey==='string'))))localLibrary=data;
 }}catch{$('library-status').textContent='Lokalt bibliotek kunne ikke leses. RIGOR-malene er fortsatt tilgjengelige.';}
function renderLibrary(){
 const elements=$('library-source').value==='local'?localLibrary:library;
 const old=$('library-category').value;$('library-category').replaceChildren();for(const category of ['Alle',...[...new Set(elements.map(e=>e.category))].sort((a,b)=>a.localeCompare(b,'nb',{numeric:true}))]){const o=document.createElement('option');o.textContent=category;$('library-category').append(o);}if([...$('library-category').options].some(o=>o.value===old))$('library-category').value=old;
 const matches=searchLibrary(elements,{search:$('library-search').value,trade:$('library-trade').value,type:$('library-type').value,category:$('library-category').value});matches.sort((a,b)=>a.category.localeCompare(b.category,'nb',{numeric:true}));$('library-list').replaceChildren();
 let category='',group;for(const element of matches){if(element.category!==category){group=document.createElement('details');group.className='library-category-group';group.open=Boolean($('library-search').value.trim()||$('library-category').value!=='Alle');const heading=document.createElement('summary');heading.textContent=element.category+' ('+matches.filter(e=>e.category===element.category).length+' elementer)';group.append(heading);$('library-list').append(group);category=element.category;}
 const card=document.createElement('details');card.className='library-card';const summary=document.createElement('summary');summary.textContent=`${element.name} (${element.tasks.length} oppgaver)`;card.append(summary);const note=document.createElement('p');note.className='muted';note.textContent=`${element.trade} · ${element.type} · arbeidsenhet ${element.unit}. ${element.tasks.some(t=>t.requiresTime)?'Grunntid må registreres etter at oppgavene er lagt inn.':'Grunntider og forbruk er foreløpige.'} Kontroller faktisk oppbygging og materialvalg.`;card.append(note);
 const scope=document.createElement('dl');scope.className='library-scope';for(const [title,value] of [['Inkluderer',element.description||element.tasks.map(t=>t.name).join(', ')],['Mengdegrunnlag',element.quantityNote||'Oppgi mengde i '+element.unit+'.'],['Ikke inkludert',element.excludes||'Kontroller avgrensningene før kalkylen brukes.']]){const dt=document.createElement('dt');dt.textContent=title;const dd=document.createElement('dd');dd.textContent=value;scope.append(dt,dd);}card.append(scope);
 for(const t of element.tasks){const label=document.createElement('label');label.className='check';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.value=t.id;label.append(checkbox,document.createTextNode(`${t.name} · ${t.requiresTime?'grunntid må registreres':num(t.hours)+' t/'+element.unit}${t.priceKey?' · '+t.materialUnit+' materiell · '+t.priceKey:''}`));card.append(label);}
 const controls=document.createElement('div');controls.className='library-controls';const label=document.createElement('label');label.textContent='Elementmengde ('+element.unit+')';const input=document.createElement('input');input.type='number';input.min='.1';input.max='100000';input.step='any';input.value=element.unit==='m²'?String(job==='roof'?roofGeometry(lastSettings).area:lastSettings.area):'1';input.required=true;input.setAttribute('aria-label','Bibliotekmengde '+element.name);label.append(input);controls.append(label);const add=document.createElement('button');add.textContent='Legg til valgte oppgaver';add.onclick=()=>{
 const selected=[...card.querySelectorAll('input[type=checkbox]:checked')].map(e=>e.value);if(!selected.length||!input.checkValidity()){$('library-status').textContent='Velg minst én oppgave og en positiv mengde.';return;}
 if(rows.length+selected.length>500){$('library-status').textContent='Maks 500 oppgaver i én kalkyle.';return;}
 const factor=element.id.startsWith('roof.')&&element.unit==='m²'?lastSettings.difficulty*roofGeometry(lastSettings).slope:lastSettings.difficulty;
 rows.push(...instantiate(element,Number(input.value),factor,selected,'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)).map(r=>roofConsumption(r,lastSettings)));edited=true;renderRows();update();$('library-status').textContent=selected.length+' oppgaver lagt til fra '+element.name+'.';
 };controls.append(add);card.append(controls);group.append(card);}
 if(!matches.length){const p=document.createElement('p');p.className='muted';p.textContent=elements.length?'Ingen elementer samsvarer med filtrene.':'Biblioteket er tomt. Lagre kalkylen som egne elementmaler.';$('library-list').append(p);}
}
for(const id of ['library-source','library-trade','library-type','library-category'])$(id).onchange=renderLibrary;
$('library-search').oninput=renderLibrary;
$('library-browser').ontoggle=()=>{if($('library-browser').open)renderLibrary();};
$('save-library').onclick=()=>{
 if(!valid()||!rows.some(r=>r.enabled)){$('library-status').textContent='Velg oppgaver og fyll inn gyldige mengder og timer før lagring.';return;}
 const name=prompt('Navn på ditt bibliotek / malsett:',jobs[job].name);if(!name?.trim())return;
 const added=renderedGroups.filter(indices=>indices.some(i=>rows[i].enabled)).map((indices,n)=>{const first=rows[indices[0]];return {id:'local.'+Date.now()+'.'+n,name:name.trim().slice(0,80)+' / '+(first.elementName||first.name),category:first.category||'Egne elementer',trade:'Alle',type:'Alle',unit:first.unit,description:first.elementDescription||'',quantityNote:first.quantityNote||'',excludes:first.excludes||'',tasks:indices.filter(i=>rows[i].enabled).map((i,j)=>{const r=rows[i];return {id:String(j),name:r.name,hours:r.hours,requiresTime:Boolean(r.requiresTime),priceKey:r.priceKey||null,exampleMaterial:0,materialRatio:r.materialRatio??1,materialUnit:r.materialUnit||r.unit};})};});
 if(localLibrary.length+added.length>100){$('library-status').textContent='Maks 100 egne elementmaler.';return;}
 try{const next=[...localLibrary,...added];localStorage.setItem('rigor-library-v1',JSON.stringify(next));localLibrary=next;$('library-status').textContent=added.length+' elementmaler lagret lokalt. Prisene hentes fra prisgrunnlaget ved bruk; manuelle priser er ikke lagret i malene.';$('library-source').value='local';$('library-trade').value='Alle';$('library-type').value='Alle';$('library-search').value='';renderLibrary();}
 catch{$('library-status').textContent='Nettleseren tillater ikke lagring av biblioteket.';}
};
renderLibrary();

// Project management is local; calculation snapshots keep each project's prices and rates separate.
const newProjectDefaults=projectSnapshot();
const projectKey='rigor-projects-v1';let projects=[],activeProject=null,pendingMode='simple',editingProject=false,briefProjectId=null;
try{const stored=JSON.parse(localStorage.getItem(projectKey)||'[]');if(Array.isArray(stored)&&stored.length<=100)projects=stored.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.snapshot);else throw Error();}catch{$('project-message').textContent='Prosjektlisten kunne ikke leses. Lagrede data er ikke overskrevet.';}
function projectSnapshot(){return {version:2,settings:structuredClone(lastSettings),rows:structuredClone(rows),rates:rates(),edited,priceMode,importedPrices:structuredClone(importedPrices),marketPrices:structuredClone(marketPrices)};}
function persistProjects(){localStorage.setItem(projectKey,JSON.stringify(projects));}
function projectHeader(){const p=projects.find(p=>p.id===activeProject);if(!p)return;$('project-title').textContent=p.name;$('project-meta').textContent=[p.customer,p.address,p.number?'Nr. '+p.number:'',p.state].filter(Boolean).join(' · ');}
function saveProject(){if(!activeProject)return true;const index=projects.findIndex(p=>p.id===activeProject);const previous=projects[index];projects[index]={...previous,snapshot:projectSnapshot(),brief:$('job-brief').value,mode:calculationMode,updated:new Date().toISOString(),total:result?.price??null};try{persistProjects();return true;}catch{projects[index]=previous;$('status').textContent='Prosjektet kunne ikke lagres. Nettleserens lagringsplass kan være full.';return false;}}
function renderProjects(){const list=$('project-list');list.replaceChildren();const needle=$('project-search').value.toLocaleLowerCase('nb');const matches=projects.filter(p=>[p.name,p.customer,p.address,p.number].join(' ').toLocaleLowerCase('nb').includes(needle)).sort((a,b)=>b.updated.localeCompare(a.updated));for(const p of matches){const card=document.createElement('article');card.className='project-card';const title=document.createElement('h3');title.textContent=p.name;const meta=document.createElement('p');meta.textContent=[p.customer,p.address,p.state].filter(Boolean).join(' · ');const detail=document.createElement('p');detail.className='muted';detail.textContent=(p.mode==='detailed'?'Detaljert':'Forenklet')+' · Oppdatert '+new Date(p.updated).toLocaleDateString('nb-NO')+' · '+(p.total===null?'Prisgrunnlag ufullstendig':money(p.total)+' ekskl. MVA');const open=document.createElement('button');open.textContent='Åpne prosjekt';open.onclick=()=>{edited=false;if(!restoreCalculation(p.snapshot)){$('project-message').textContent='Prosjektet kunne ikke åpnes. Kalkyledata må kontrolleres.';return;}activeProject=p.id;view(p.mode==='detailed');showWorkspace();};card.append(title,meta,detail,open);list.append(card);}if(!matches.length){const empty=document.createElement('p');empty.className='muted';empty.textContent=projects.length?'Ingen prosjekter samsvarer med søket.':'Ingen prosjekter ennå. Velg Forenklet eller Detaljert for å komme i gang.';list.append(empty);}}
function showWorkspace(){$('project-home').hidden=true;$('project-workspace').hidden=false;projectHeader();$('workspace-brief-anchor').append($('job-composer'));if(briefProjectId!==activeProject){const brief=projects.find(p=>p.id===activeProject)?.brief;$('job-brief').value=typeof brief==='string'?brief.slice(0,8000):'';briefProjectId=activeProject;}$('brief-status').textContent='Beskrivelsen lagres med prosjektet. AI-forslag er ikke aktivert ennå.';window.scrollTo(0,0);}
function projectDialog(mode,edit=false){pendingMode=mode;editingProject=edit;const p=edit?projects.find(p=>p.id===activeProject):null;$('project-name').value=p?.name||'';$('project-customer').value=p?.customer||'';$('project-address').value=p?.address||'';$('project-number').value=p?.number||String(projects.length+1);$('project-state').value=p?.state||'Utkast';$('project-dialog-title').textContent=edit?'Prosjektdetaljer':'Opprett '+(mode==='simple'?'forenklet':'detaljert')+' prosjekt';$('project-submit').textContent=edit?'Lagre detaljer':'Opprett prosjekt';$('project-form-error').textContent='';$('project-dialog').showModal();$('project-name').focus();}
$('start-simple').onclick=()=>projectDialog('simple');$('start-detailed').onclick=()=>projectDialog('detailed');$('project-edit').onclick=()=>projectDialog(calculationMode,true);$('project-cancel').onclick=()=>$('project-dialog').close();$('project-search').oninput=renderProjects;
$('project-form').onsubmit=e=>{e.preventDefault();const name=$('project-name').value.trim();if(!name){$('project-form-error').textContent='Skriv inn et prosjektnavn.';return;}if(!editingProject&&projects.length>=100){$('project-form-error').textContent='Maks 100 lokale prosjekter.';return;}const previous=projects.slice();const previousActive=activeProject;const metadata={name,customer:$('project-customer').value.trim(),address:$('project-address').value.trim(),number:$('project-number').value.trim(),state:$('project-state').value,...(!editingProject?{brief:$('job-brief').value}:{})};if(editingProject){projects=projects.map(p=>p.id===activeProject?{...p,...metadata,updated:new Date().toISOString()}:p);}else{edited=false;restoreCalculation(newProjectDefaults);generate();if(pendingMode==='detailed'){rows=[];edited=true;renderRows();update();}view(pendingMode==='detailed');activeProject=crypto.randomUUID();projects.push({...metadata,id:activeProject,mode:pendingMode,updated:new Date().toISOString(),snapshot:projectSnapshot(),total:result?.price??null});}try{persistProjects();}catch{projects=previous;activeProject=previousActive;$('project-form-error').textContent='Kunne ikke lagre prosjektet i nettleseren.';return;}$('project-dialog').close();showWorkspace();if(pendingMode==='detailed'&&!editingProject){$('library-browser').open=true;renderLibrary();}};
const legacySave=$('save').onclick;$('save').textContent='Lagre prosjekt';$('save').onclick=()=>{if(saveProject()){legacySave();$('status').textContent='Prosjektet er lagret i denne nettleseren.';}};
$('project-back').onclick=()=>{if(!saveProject())return;$('project-workspace').hidden=true;$('project-home').hidden=false;activeProject=null;briefProjectId=null;$('home-brief-anchor').append($('job-composer'));restoreBriefDraft();renderProjects();window.scrollTo(0,0);};
renderProjects();

const briefDraftKey='rigor-job-brief-v1';
const briefExamples={roof:'Jeg skal bygge et saltak med 30 graders takvinkel og 100 m² målt takflate. Tilbudet skal inkludere takstein, sløyfer, sutak, vindskier, beslag og takrenner.',insulation:'Jeg skal etterisolere ytterveggene. Ta med riving av eksisterende kledning, utlekting, isolasjon, vindsperre og ny kledning. Mengder og tykkelse må avklares.',terrace:'Jeg skal bygge en terrasse. Ta med fundamenter, bjelkelag, terrassebord, festemidler og rekkverk. Areal, høyde og dimensjoner må avklares.'};
function restoreBriefDraft(){try{$('job-brief').value=localStorage.getItem(briefDraftKey)||'';}catch{$('job-brief').value='';}$('brief-status').textContent='Beskrivelsen lagres lokalt. Ingen AI-kall eller automatisk kalkyle lages ennå.';}
for(const button of document.querySelectorAll('[data-brief-example]'))button.onclick=()=>{if($('job-brief').value.trim()&&!confirm('Erstatte beskrivelsen med dette eksemplet?'))return;$('job-brief').value=briefExamples[button.dataset.briefExample];$('job-brief').focus();$('brief-status').textContent='Eksempel lagt inn. Tilpass beskrivelsen og lagre den.';};
$('job-brief').oninput=()=>{$('brief-status').textContent='Beskrivelsen er endret. Velg Lagre beskrivelse for å beholde endringen.';};
$('brief-save').onclick=()=>{try{if(activeProject){if(!saveProject())throw Error('Prosjektet kunne ikke lagres.');}else localStorage.setItem(briefDraftKey,$('job-brief').value);$('brief-status').textContent=activeProject?'Beskrivelsen er lagret med prosjektet. Ingen AI-forslag er laget.':'Beskrivelsen er lagret lokalt og følger med når du oppretter prosjektet.';}catch(e){$('brief-status').textContent=e.message||'Nettleseren tillater ikke lokal lagring.';}};
$('nav-projects').onclick=()=>{if(activeProject)$('project-back').click();else window.scrollTo({top:0,behavior:'smooth'});};
restoreBriefDraft();
