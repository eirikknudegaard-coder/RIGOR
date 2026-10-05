import {jobs,propose,calculate} from './kalkyle-engine.js';
import {parseCsv,validatePrices,applyPrices} from './kalkyle-prices.js';
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',maximumFractionDigits:2}).format(n),num=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(n);
const rateKeys=['wage','direct','indirect','billing','laborMarkup','materialMarkup'];
let job='roof',rows=[],edited=false,lastSettings=null,result=null;
let priceMode='market',importedPrices=[],marketPrices=[],marketMessage='Ingen markedspriskilde er tilkoblet. Importer en prisliste eller velg demonstrasjon.',priceRequest=0;
function settings(){return {job,area:Number($('area').value),angle:Number($('angle').value),basis:$('basis').value,material:$('material').value,difficulty:Number($('difficulty').value),options:[...document.querySelectorAll('#options input:checked')].map(e=>e.value)};}
function rates(){return Object.fromEntries(rateKeys.map(k=>[k,Number($(k).value)]));}
function valid(){return [...document.querySelectorAll('#questions input[type=number],.rates input')].every(e=>e.disabled||e.checkValidity()) && rows.every(r=>['quantity','material','hours','factor'].every(k=>Number.isFinite(r[k])&&r[k]>=0));}
function setupJob(){
 $('jobs').replaceChildren();for(const [key,j] of Object.entries(jobs)){const b=document.createElement('button');b.textContent=j.name;b.setAttribute('aria-pressed',String(key===job));b.onclick=()=>{if(edited&&!confirm('Nye veiviservalg erstatter dine redigerte poster. Fortsette?'))return;job=key;edited=false;setupJob();generate();};$('jobs').append(b);}
 $('options').replaceChildren();for(const [id,title,checked] of jobs[job].options){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=checked;label.append(input,document.createTextNode(title));$('options').append(label);}
 for(const id of ['angle','basis','material']){$(id).disabled=job!=='roof';$(id+'-label').hidden=job!=='roof';}
 $('area-help').textContent=job==='roof'?'Horisontalt areal omregnes for et enkelt tak med lik vinkel på takflatene. Ta med takutstikk. Bratte tak øker arbeidstiden: +10 % over 25°, +25 % over 40°.':job==='insulation'?'Oppgi netto ytterveggflate som skal etterisoleres.':'Oppgi gulvareal for et tilbygg med én etasje.';
 $('scope-note').textContent='Arbeidstider er eksempler. Rigg og avfall er foreløpig arealbaserte avsetninger; små jobber kan kreve minimumspriser.';
 $('uncertainty').textContent=jobs[job].uncertainty;
}
function generate(){lastSettings=settings();rows=propose(lastSettings);edited=false;renderRows();update();}
function renderRows(){
 $('rows').replaceChildren();rows.forEach((r,i)=>{const tr=document.createElement('tr');const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=r.enabled;enabled.setAttribute('aria-label','Inkluder '+r.name);enabled.onchange=()=>{r.enabled=enabled.checked;edited=true;update();};let td=document.createElement('td');td.append(enabled);tr.append(td);td=document.createElement('td');td.textContent=r.name;tr.append(td);
 for(const key of ['quantity','unit','material','hours']){td=document.createElement('td');if(key==='unit')td.textContent=r.unit;else{const input=document.createElement('input');input.type='number';input.min='0';input.max=key==='quantity'?'1000000':'10000000';input.step='any';input.value=r[key];input.required=true;input.setAttribute('aria-label',r.name+' '+({quantity:'mengde',material:'materialpris',hours:'timer per enhet'}[key]));input.oninput=()=>{r[key]=input.value===''?NaN:Number(input.value);if(key==='material'){r.manualPrice=true;r.priceSource='Manuelt satt';r.priceDate='';r.priceIssue=null;}edited=true;update();};td.append(input);}tr.append(td);}
 td=document.createElement('td');td.textContent=num(r.factor);tr.append(td);
 td=document.createElement('td');td.id='row-source-'+i;td.className='price-meta';tr.append(td);
 td=document.createElement('td');td.id='row-total-'+i;tr.append(td);$('rows').append(tr);});
}
function update(){
 rows=applyPrices(rows,priceMode,priceMode==='import'?importedPrices:marketPrices);
 const missing=rows.filter(r=>r.enabled&&r.priceIssue);
 $('import-panel').hidden=priceMode!=='import';$('market-panel').hidden=priceMode!=='market';
 $('price-status').textContent=priceMode==='market'?marketMessage:priceMode==='import'?`Prislisten inneholder ${importedPrices.length} priser. Priser eldre enn 30 dager må oppdateres.`:'Demonstrasjon: prisene er eksempler, ikke markedspriser.';
 $('price-coverage').replaceChildren();
 rows.forEach((r,i)=>{const source=$('row-source-'+i);source.textContent=r.priceIssue?`${r.priceKey}: ${r.priceIssue}`:`${r.priceSource}${r.priceDate?' · '+r.priceDate:''}`;source.classList.toggle('price-warning',Boolean(r.priceIssue));const input=$('rows').children[i].querySelectorAll('input[type=number]')[1];if(document.activeElement!==input)input.value=r.priceIssue?'':r.material;input.required=!r.priceIssue;});
 for(const r of rows.filter(r=>r.enabled)){const li=document.createElement('li');li.textContent=r.priceIssue?`${r.name}: ${r.priceIssue} (${r.priceKey}).`:`${r.name}: ${r.priceSource}${r.priceDate?' · '+r.priceDate:''}${r.manualPrice?' – overstyrer valgt prisgrunnlag':''}.`;$('price-coverage').append(li);}
 const ok=valid()&&[...document.querySelectorAll('#rows input[type=number]')].every(e=>e.checkValidity());for(const id of ['save','export'])$(id).disabled=!ok||(id==='export'&&missing.length>0);
 if(!ok){result=null;$('status').textContent='Fyll inn gyldige tall i alle feltene før kalkylen beregnes.';for(const id of ['total','per-area','hours','cost','profit','vat','gross','hourly','calc-area'])$(id).textContent='—';rows.forEach((r,i)=>$('row-total-'+i).textContent='—');return;}
 const area=lastSettings.job==='roof'&&lastSettings.basis==='footprint'?lastSettings.area/Math.cos(lastSettings.angle*Math.PI/180):lastSettings.area;
 result=calculate(rows,rates(),area);$('total').textContent=money(result.price);$('per-area').textContent=money(result.perArea)+'/m²';$('calc-area').textContent=num(area)+' m²';$('hours').textContent=num(result.hours)+' t';for(const id of ['cost','profit','vat','gross'])$(id).textContent=money(result[id]);$('hourly').textContent='Timekostnad: '+money(result.hourly)+' · Kundepris: '+money(result.hourly*(1+rates().laborMarkup/100))+' ekskl. MVA';
 result.items.forEach((r,i)=>$('row-total-'+i).textContent=money(r.price));$('included').replaceChildren();for(const r of rows.filter(r=>r.enabled)){const li=document.createElement('li');li.textContent=r.name;$('included').append(li);}
 if(missing.length){result=null;for(const id of ['total','per-area','cost','profit','vat','gross'])$(id).textContent='—';rows.forEach((r,i)=>$('row-total-'+i).textContent=r.enabled?'Prisgrunnlag ufullstendig':'Ikke inkludert');$('status').textContent=`${missing.length} valgte poster mangler gyldige priser. Importer priser eller legg inn materialkostnad manuelt. Timer vises, men totalpris og CSV-eksport venter på komplett prisgrunnlag.`;return;}
 $('status').textContent=edited?'Egne postendringer er med i anslaget.':'Forslag fra veiviseren. Kontroller omfang og satser.';
}
function view(detail){$('wizard').hidden=detail;$('details').hidden=!detail;$('simple').setAttribute('aria-pressed',String(!detail));$('detailed').setAttribute('aria-pressed',String(detail));}
$('simple').onclick=()=>view(false);$('detailed').onclick=()=>view(true);
$('questions').onsubmit=e=>e.preventDefault();$('questions').onchange=()=>{if(edited&&!confirm('Endringen lager et nytt forslag og erstatter redigerte poster. Fortsette?')){const s=lastSettings;for(const k of ['area','angle','basis','material','difficulty'])$(k).value=s[k];for(const el of document.querySelectorAll('#options input'))el.checked=s.options.includes(el.value);return;}generate();};
for(const key of rateKeys)$(key).oninput=update;
$('reset').onclick=()=>{if(!edited||confirm('Gjenopprette postene fra veiviseren?'))generate();};
$('save').onclick=()=>{try{localStorage.setItem('rigor-calculation-v1',JSON.stringify({version:2,settings:lastSettings,rows,rates:rates(),edited,priceMode,importedPrices,marketPrices}));$('status').textContent='Kalkylen er lagret i denne nettleseren.';}catch{$('status').textContent='Nettleseren tillater ikke lokal lagring. Bruk CSV-eksport.';}};
$('restore').onclick=()=>{try{const raw=localStorage.getItem('rigor-calculation-v1');if(!raw){$('status').textContent='Ingen lokal kalkyle er lagret.';return;}const s=JSON.parse(raw);if(![1,2].includes(s.version)||!jobs[s.settings?.job]||!Array.isArray(s.rows)||s.rows.length>100||s.rows.some(r=>typeof r.name!=='string'||typeof r.enabled!=='boolean'||r.unit!=='m²'||['quantity','material','hours','factor'].some(k=>!Number.isFinite(r[k])||r[k]<0))||!rateKeys.every(k=>Number.isFinite(s.rates?.[k]))||!['surface','footprint'].includes(s.settings.basis)||!['metal','tile'].includes(s.settings.material)||!Array.isArray(s.settings.options)||!['area','angle','difficulty'].every(k=>Number.isFinite(s.settings[k])))throw Error();if(edited&&!confirm('Erstatte den åpne kalkylen med den lagrede?'))return;
 if(s.version===2){if(!['market','import','example'].includes(s.priceMode)||!Array.isArray(s.importedPrices))throw Error();if(s.importedPrices.length)validatePrices(s.importedPrices);if(s.marketPrices?.length)validatePrices(s.marketPrices);priceMode=s.priceMode;importedPrices=s.importedPrices;marketPrices=s.marketPrices||[];if(priceMode==='market'&&marketPrices.length)marketMessage='Lagret prisgrunnlag. Kilde og dato kontrolleres; hent nye priser ved behov.';}else{priceMode='example';importedPrices=[];}
 $('price-mode').value=priceMode;
 job=s.settings.job;setupJob();for(const k of ['area','angle','basis','material','difficulty'])$(k).value=s.settings[k];for(const el of document.querySelectorAll('#options input'))el.checked=s.settings.options.includes(el.value);for(const k of rateKeys)$(k).value=s.rates[k];lastSettings=s.settings;rows=s.rows.map(r=>({...r,priceKey:r.priceKey===undefined&&r.material>0?`${job}.${r.id}${job==='roof'&&r.id==='cover'?'.'+s.settings.material:''}`:r.priceKey,manualPrice:Boolean(r.manualPrice)}));edited=Boolean(s.edited);renderRows();update();if(result)$('status').textContent='Lokal kalkyle åpnet med lagrede priser. Markedspriser hentes først når du ber om oppdatering.';
 }catch{$('status').textContent='Kunne ikke åpne lokal kalkyle. Lagrede data er ugyldige eller utilgjengelige.';}};
$('export').onclick=()=>{if(!result)return;const cell=v=>'"'+String(v).replaceAll('"','""')+'"';const data=[['RIGOR prisanslag – prisgrunnlag: '+priceMode+', ekskl. MVA; arbeidstider er eksempler'],['Oppgave','Mengde','Enhet','Materiell kr/enhet','Timer/enhet','Tidsfaktor','Arbeidstimer','Kostnad','Pris ekskl. MVA','Priskilde','Prisdato'],...result.items.filter(r=>r.enabled).map(r=>[r.name,r.quantity,r.unit,r.material,r.hours,r.factor,r.workHours,r.cost,r.price,r.priceSource,r.priceDate]),['Totalt', '', '', '', '', '',result.hours,result.cost,result.price],['Forutsetninger',jobs[job].uncertainty]];const url=URL.createObjectURL(new Blob(['\uFEFF'+data.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rigor-prisanslag.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
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
 const data=['prisnokkel;enhet;pris;kilde;dato;valuta;mva',...rows.filter(r=>r.priceKey).map(r=>`${r.priceKey};m2;;;;NOK;ekskl`)];
 const url=URL.createObjectURL(new Blob(['\uFEFF'+data.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rigor-prisliste-mal.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('refresh-prices').onclick=async()=>{
 if(rows.some(r=>r.manualPrice)&&!confirm('Hente nye priser erstatter manuelt satte materialpriser. Fortsette?'))return;
 const request=++priceRequest;$('refresh-prices').disabled=true;marketMessage='Henter dokumenterte markedspriser …';update();
 try{const response=await fetch('assets/market-prices.json',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();const prices=validatePrices(data.prices);if(request!==priceRequest)return;marketPrices=prices;marketMessage='Publisert prisregister hentet. Kilde og dato vises per post; priser eldre enn 30 dager brukes ikke.';
 if(priceMode==='market')applyCatalog();else update();
 }catch{marketMessage='Markedspriser er ikke tilgjengelige. Ingen leverandørkilde er koblet til ennå. Importer en prisliste. Eventuelle tidligere hentede priser beholdes med datokontroll.';update();}
 finally{$('refresh-prices').disabled=false;}
};
setupJob();generate();
