import {analyzeMember} from './member-engine.js';
import {planTerrace} from './terrace-plan.js';
import {renderDiagrams,renderTerracePlan} from './diagram-renderer.js';
const fmt=(n,d=2)=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:d}).format(n);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function initManual(root){
 if(!root)return;
 let result=null,rowId=0;
 const form=el('form',undefined,'rib-form'),error=el('p',undefined,'rib-error'),report=el('section',undefined,'rib-report');error.setAttribute('role','alert');report.setAttribute('aria-live','polite');
 const controls={},rows=[],groups={};
 function group(title,help){const fieldset=el('fieldset'),legend=el('legend',title);fieldset.append(legend,el('p',help,'muted'));const grid=el('div',undefined,'rib-fields');fieldset.append(grid);form.append(fieldset);return grid;}
 function field(parent,id,title,{options=null,value='',help='',required=true}={}){
  const label=el('label'),input=el(options?'select':'input');input.id='rib-'+id;input.name=id;input.required=required;
  if(options){for(const [v,t]of options){const o=el('option',t);o.value=v;input.append(o);}}else {input.type='text';input.inputMode='decimal';input.maxLength=600;}
  input.value=options&&!options.some(([v])=>String(v)===String(value))?String(options[0][0]):String(value);label.append(el('span',title),input);if(help)label.append(el('small',help));parent.append(label);controls[id]=input;return input;
 }
 function tick(parent,id,title,help){const label=el('label',undefined,'rib-tick'),input=el('input');input.type='checkbox';input.id='rib-'+id;label.append(input,el('span',title));if(help)label.append(el('small',help));parent.append(label);controls[id]=input;return input;}
 const choice=group('1. Hva skal beregnes?','Registrer grunnlaget direkte. Skjemaet sender ingen opplysninger til AI.');
 field(choice,'member','Konstruksjonsdel',{options:[['beam','Bjelke / drager'],['column','Søyle / vertikal stolpe'],['terrace','Terrasse – plan for dragere og stolper']]});
 field(choice,'family','Materiale',{options:[['timber','Tre · Eurocode 5'],['steel','Stål · Eurocode 3'],['concrete','Armert betong · Eurocode 2']]});
 const dims=group('2. Dimensjon og opplegg','Bruk faktisk rektangulært tverrsnitt. Stålprofiler og sammensatte dragere skal ikke settes inn som massive rektangler.');groups.dims=dims.parentElement;
 field(dims,'widthMm','Bredde (mm)');field(dims,'heightMm','Høyde / dybde (mm)');field(dims,'lengthM','Spenn eller søylehøyde (m)');
 field(dims,'system','Bjelkens opplegg',{options:[['simple','Støttet i begge ender'],['cantilever','Dokumentert innspent – fri ende']]});
 field(dims,'effectiveYM','Knekkelengde, sterk akse (m)',{help:'Oppgi effektiv lengde fra dokumentert avstivning og opplegg. Den er ikke alltid lik stolpehøyden.'});field(dims,'effectiveZM','Knekkelengde, svak akse (m)');
 field(dims,'limitRatio','Valgt nedbøyningsgrense L/',{value:300,help:'Prosjektets sammenligningsgrense. L/300 er et eksempel, ikke et universelt krav.'});
 field(dims,'bearingMm','Kontaktlengde ved opplegg (mm)',{required:false,help:'Tre: fysisk kontaktflate brukes uten økning av effektiv flate.'});
 field(dims,'thetaDenominator','Global skjevstilling 1/',{value:200,help:'Eksempel 1/200. Kontroller verdi og anvendelse mot prosjektets standard. Lokale imperfeksjoner inngår i knekkurvene.'});
 tick(dims,'globalSway','Legg global skjevstillingskraft på denne søylen','Himp = θ·NEd. I dette skjemaet brukes konservativt H·h som moment i kritisk tverrsnitt. Den globale rammen analyseres ikke.');
 tick(dims,'restrained','Avstivning og torsjonsstøtte er dokumentert','Bjelke: trykksiden er fastholdt mot vipping. Søyle: sideveis avstivning og valgt knekkelengde er dokumentert.');
 tick(dims,'supportsVerified','Opplegg og lastvei er dokumentert','For innspenning kreves en forbindelse som faktisk kan ta moment.');
 tick(dims,'addSelfWeight','Legg til medlemsegenvekt automatisk','La valget stå av dersom medlemsegenvekten allerede inngår i Gk.');
 const mat=group('3. Materialgrunnlag','Styrkeklasse, varighet og klima påvirker kapasiteten. Materialdata og formler følger resultatet.');groups.mat=mat.parentElement;
 field(mat,'grade','Treklasse',{options:[['C24','Konstruksjonsvirke C24'],['GL30c','Limtre GL30c']]});
 field(mat,'serviceClass','Klimaklasse',{options:[['','Velg dokumentert klimaklasse'],['1','1 – tørt innemiljø'],['2','2 – beskyttet, høyere fukt'],['3','3 – utendørs / fuktig']]});
 field(mat,'fyMPa','Dokumentert flytegrense fy (MPa)',{help:'S355 betyr ikke automatisk 355 MPa for alle tykkelser.'});
 field(mat,'strengthSource','Kilde for stålets flytegrense',{help:'Produktdokumentasjon, tykkelse og standard.'});controls.strengthSource.inputMode='text';
 field(mat,'bucklingCurve','Dokumentert knekkurve',{options:[['','Velg etter profiltype og akse'],['a0','a0 · α 0,13'],['a','a · α 0,21'],['b','b · α 0,34'],['c','c · α 0,49'],['d','d · α 0,76']]});
 field(mat,'fckMPa','Betongens fck (MPa)',{help:'Sylinderfasthet, 12–50 MPa.'});field(mat,'fykMPa','Armeringens fyk (MPa)');
 field(mat,'reinforcementMm2','Armeringsareal As (mm²)',{help:'Bjelke: effektiv strekkarmering. Søyle: samlet armering.'});
 field(mat,'coverToSteelMm','Avstand fra ytterkant til strekkstålets tyngdepunkt (mm)');
 const scope=el('p',undefined,'rib-scope');mat.parentElement.append(scope);
 const loads=group('4. Karakteristiske laster','Gk = permanent last. Qk = variabel last. Oppgi kilder og kombinasjonsfaktorer; snølast på bakken er ikke taklast. Bare positive nedoverrettede/trykk-laster støttes.');groups.loads=loads.parentElement;
 const actionRoot=el('div',undefined,'rib-action-list');loads.replaceChildren(actionRoot);
 const add=el('button','+ Legg til last','secondary');add.type='button';loads.parentElement.append(add);
 function addRow(kind='Q'){
  if(rows.length>=12)return;const id='load-'+(++rowId),box=el('fieldset',undefined,'rib-action');box.append(el('legend','Last '+rowId));const grid=el('div',undefined,'rib-fields'),row={id,box,fields:{}};box.append(grid);actionRoot.append(box);
  function rf(key,title,options,value='',help=''){const input=field(grid,id+'-'+key,title,{options,value,help,required:false});row.fields[key]=input;return input;}
  rf('name','Navn',null,kind==='G'?'Permanent last':'Variabel last');rf('kind','Lasttype',[['G','Permanent · Gk'],['Q','Variabel · Qk']],kind);
  rf('qKnM','Linjelast (kN/m)');rf('pKn','Punktlast (kN)');rf('xM','Punktlast fra venstre / innspenning (m)');
  rf('nKn','Trykkraft N (kN)');rf('myKnM','Moment om sterk akse My (kNm)');rf('mzKnM','Moment om svak akse Mz (kNm)');rf('hKn','Horisontalkraft ved toppen H (kN)',null,'','H·h legges til My. Bare bruk dette når kraften gir moment på det undersøkte medlemmet.');
  rf('duration','Lastvarighet',[['permanent','Permanent'],['long','Lang'],['medium','Middels'],['short','Kort'],['instant','Øyeblikkelig']],kind==='G'?'permanent':'medium');
  for(const key of ['psi0','psi1','psi2'])rf(key,key.replace('psi','ψ'),null,'','Oppgi fra prosjektets standard / NA.');
  rf('source','Lastkilde',null,'','Tegning, lastberegning eller beskrevet forutsetning.').inputMode='text';
  const remove=el('button','Fjern last','secondary');remove.type='button';remove.onclick=()=>{rows.splice(rows.indexOf(row),1);box.remove();invalidate();};box.append(remove);rows.push(row);row.fields.kind.onchange=sync;sync();
 }
 add.onclick=()=>{addRow();invalidate();};
 const basis=group('5. Standard og nasjonalt tillegg','Formlene følger første generasjon Eurokoder. Verdiene nedenfor er redigerbare EN-eksempler og er ikke et verifisert norsk NA-oppsett. Andre generasjon er ikke implementert.');groups.basis=basis.parentElement;
 field(basis,'expression','ULS-kombinasjonsregel',{options:[['6.10ab','Maksimum av 6.10a og 6.10b'],['6.10','6.10']]});
 for(const [id,title,value]of [['gammaG','γG – ugunstig permanent last',1.35],['gammaQ','γQ – variabel last',1.5],['xi','ξ – reduksjon i 6.10b',.85],['gammaM','γM / γM0 – materiale',1.3],['gammaM1','γM1 – stålknekking',1],['gammaC','γC – betong',1.5],['gammaS','γS – armering',1.15],['alphaCC','αcc – betong',.85],['kcr','kcr – effektiv trebredde for skjær',.67]])field(basis,id,title,{value});
 field(basis,'standardSource','Standardutgave og dokumentert NA-grunnlag',{required:false,help:'Angi NS-EN-utgaver, norske NA-utgaver og kilde for faktorene.'});controls.standardSource.inputMode='text';
 tick(basis,'confirmed','Jeg har kontrollert standardutgavene og prosjektets NA-verdier','Ubekreftede verdier gir bare en foreløpig beregning. En avkrysning er brukerens bekreftelse, ikke ekstern sertifisering.');
 const terrace=group('Terrasse: geometri og lastvei','Legg inn maksimale spenn fra kontrollerte medlemsberegninger. c/c for bjelkelaget bestemmer ikke alene antall stolper.');groups.terrace=terrace.parentElement;
 for(const [id,title]of [['terraceLengthM','Lengde langs huset (m)'],['terraceDepthM','Dybde ut fra huset (m)'],['terraceHeightM','Høyde over terreng (m)'],['joistSpanM','Kontrollert største bjelkespenn (m)'],['beamSpanM','Kontrollert største dragerspenn (m)'],['spacingMm','Bjelkelag c/c (mm)'],['deadKnM2','Karakteristisk permanent flatebelastning (kN/m²)'],['liveKnM2','Karakteristisk variabel flatebelastning (kN/m²)']])field(terrace,id,title);
 field(terrace,'wallSupport','Bæring ved huset',{options:[['','Velg'],['documented','Dokumentert innfesting / bæring ved huset'],['free_standing','Frittstående – egne stolper på begge sider']]});
 field(terrace,'spanSource','Kilde for kontrollerte spenn og laster',{help:'Beregningsreferanse / dokumentasjon. Dobbel drager krever kontroll av lastdeling og forbindelser.'});controls.spanSource.inputMode='text';
 const submit=el('button','Beregn medlem','rib-submit');submit.type='submit';form.append(error,submit);root.append(form,report);
 function visible(id,show){const c=controls[id];c.parentElement.hidden=!show;c.disabled=!show;}
 function sync(){
  const member=controls.member.value,family=controls.family.value,beam=member==='beam',column=member==='column',deck=member==='terrace';
  for(const key of ['dims','mat','loads','basis'])groups[key].hidden=deck;groups.terrace.hidden=!deck;controls.family.disabled=deck;controls.family.parentElement.hidden=deck;
  for(const key of ['system','limitRatio'])visible(key,beam);visible('bearingMm',beam&&family==='timber');
  for(const key of ['effectiveYM','effectiveZM','thetaDenominator','globalSway'])visible(key,column);
  for(const key of ['grade','serviceClass','kcr'])visible(key,family==='timber');
  for(const key of ['fyMPa','strengthSource'])visible(key,family==='steel');visible('bucklingCurve',family==='steel'&&column);visible('gammaM1',family==='steel');
  for(const key of ['fckMPa','fykMPa','reinforcementMm2','gammaC','gammaS','alphaCC'])visible(key,family==='concrete');visible('coverToSteelMm',family==='concrete'&&beam);
  for(const [key,c]of Object.entries(controls))if(key.startsWith('terrace')||['joistSpanM','beamSpanM','spacingMm','deadKnM2','liveKnM2','wallSupport','spanSource'].includes(key))c.disabled=!deck;
  for(const group of [groups.dims,groups.mat,groups.loads,groups.basis])for(const c of group.querySelectorAll('input,select'))if(deck)c.disabled=true;
  if(!deck){for(const key of ['widthMm','heightMm','lengthM','restrained','supportsVerified','addSelfWeight','expression','gammaG','gammaQ','xi','gammaM','standardSource','confirmed'])controls[key].disabled=false;}
  for(const r of rows){const variable=r.fields.kind.value==='Q';for(const key of ['qKnM','pKn','xM']){r.fields[key].parentElement.hidden=!beam;r.fields[key].disabled=!beam||deck;}for(const key of ['nKn','myKnM','mzKnM','hKn']){r.fields[key].parentElement.hidden=!column;r.fields[key].disabled=!column||deck;}for(const key of ['psi0','psi1','psi2','duration']){r.fields[key].parentElement.hidden=!variable;r.fields[key].disabled=!variable||deck;}r.fields.source.disabled=deck;r.fields.name.disabled=deck;r.fields.kind.disabled=deck;}
  scope.textContent=family==='concrete'?'Betong: enkel strekkarmert bjelke får ULS-bøyning og skjærreferanse. Riss, bøyledetaljer, kryp og armert søyle med andreordensvirkning er ikke ferdig kontrollert; resultatet blir ufullstendig.':family==='steel'?'Stål: massivt rektangel. Elastisk bjelkekontroll og ren trykk-/bøyeknekking. Stålprofiler og søyler med moment krever flere kontroller.':'Tre: rektangulært C24/GL30c, bøyning, skjær, knekking, toakset trykk/bøyning, oppleggstrykk og nedbøyning med kryp. Vipping krever dokumentert fastholding.';
  submit.textContent=deck?'Lag plan fra kontrollerte spenn':'Beregn medlem';
 }
 function numeric(c,blankZero=false){const s=c.value.trim();if(!s&&blankZero)return 0;if(!/^\d+(?:[.,]\d+)?$/.test(s))throw Error('Oppgi et positivt tall i «'+(c.parentElement.querySelector('span')?.textContent||c.name)+'».');return Number(s.replace(',','.'));}
 const num=id=>numeric(controls[id]);
 function input(){
  const member=controls.member.value,family=controls.family.value;
  const profile={expression:controls.expression.value,source:controls.standardSource.value.trim(),confirmed:controls.confirmed.checked};
  for(const key of ['gammaG','gammaQ','xi','gammaM','gammaM1','gammaC','gammaS','alphaCC','kcr'])profile[key]=num(key);
  const material={family,grade:controls.grade.value};if(family==='steel')Object.assign(material,{fyMPa:num('fyMPa'),strengthSource:controls.strengthSource.value.trim()});if(family==='concrete')Object.assign(material,{fckMPa:num('fckMPa'),fykMPa:num('fykMPa')});
  const relevant=member==='beam'?['qKnM','pKn']:['nKn','myKnM','mzKnM','hKn'];
  const actions=rows.filter(r=>relevant.some(k=>r.fields[k].value.trim())).map(r=>{const a={id:r.id,name:r.fields.name.value.trim(),kind:r.fields.kind.value,source:r.fields.source.value.trim(),duration:r.fields.duration.value};for(const key of ['qKnM','pKn','xM','nKn','myKnM','mzKnM','hKn'])a[key]=r.fields[key].disabled?0:numeric(r.fields[key],true);for(const key of ['psi0','psi1','psi2'])a[key]=a.kind==='G'?1:numeric(r.fields[key]);return a;});
  const i={member,material,profile,actions,widthMm:num('widthMm'),heightMm:num('heightMm'),lengthM:num('lengthM'),restrained:controls.restrained.checked,supportsVerified:controls.supportsVerified.checked,addSelfWeight:controls.addSelfWeight.checked};
  if(member==='beam'){i.system=controls.system.value;i.limitRatio=num('limitRatio');if(family==='timber'&&controls.bearingMm.value.trim())i.bearingMm=num('bearingMm');}
  else Object.assign(i,{effectiveYM:num('effectiveYM'),effectiveZM:num('effectiveZM'),thetaDenominator:num('thetaDenominator'),globalSway:controls.globalSway.checked,bucklingCurve:controls.bucklingCurve.value});
  if(family==='timber')i.serviceClass=num('serviceClass');if(family==='concrete'){i.reinforcementMm2=num('reinforcementMm2');if(member==='beam')i.coverToSteelMm=num('coverToSteelMm');}
  return i;
 }
 function list(parent,title,items){if(!items.length)return;parent.append(el('h3',title));const ul=el('ul');for(const item of items)ul.append(el('li',item));parent.append(ul);}
 function render(result){
  report.replaceChildren();report.hidden=false;
  if(result.kind==='terrace_geometry_plan'){
   report.append(el('h2','Geometriplan – kapasitet må dokumenteres'),el('p',result.beamRowCount+' dragerlinjer og '+result.supportCount+' støttepunkter, med '+fmt(result.beamBayM)+' m mellom dragerlinjene og '+fmt(result.columnBayM)+' m mellom stolpene. '+result.joistCount+' tverrbjelker ved angitt maksimal c/c.'));
   const drawing=el('div');renderTerracePlan(drawing,result);report.append(drawing);
   list(report,'Forutsetninger',result.assumptions);list(report,'Kontroller før planen kan brukes',result.required);
   const table=el('table');table.append(el('caption','Støttepunkter målt fra venstre hjørne ved huset'));const head=el('tr');['x (m)','y (m)','Gk (kN)','Qk (kN)'].forEach(t=>head.append(el('th',t)));table.append(head);
   result.supports.forEach(s=>{const tr=el('tr');[s.xM,s.yM,s.gkKn,s.qkKn].forEach(v=>tr.append(el('td',fmt(v))));table.append(tr);});const scroll=el('div',undefined,'basis-scroll');scroll.append(table);report.append(scroll);
  }else{
   const title={exceeded:'En eller flere kontroller er overskredet',incomplete:'Medlemskontrollen er ufullstendig',within_member_scope:'Innenfor det beregnede medlemsomfanget'}[result.status];
   report.append(el('p',result.profile.confirmed?'Brukerbekreftet standardgrunnlag':'Foreløpig · NA-grunnlag ikke bekreftet','eyebrow'),el('h2',title),el('p',result.material.name+' · '+fmt(result.input.widthMm,0)+' × '+fmt(result.input.heightMm,0)+' mm · '+fmt(result.input.lengthM)+' m'),el('p',result.governing?'Styrende: '+result.governing.name+' · '+fmt(result.governing.utilization*100)+' % · '+result.governing.combinationId:'Ingen full kapasitet beregnet'));
   list(report,'Gjenstår for medlemmet',result.notPerformed);list(report,'Utenfor denne medlemsberegningen',result.outsideScope);
   const table=el('table');table.append(el('caption','Styrende resultat for hver utført kontroll'));const head=el('tr');['Kontroll','Utnyttelse','Kombinasjon','Grunnlag'].forEach(t=>head.append(el('th',t)));table.append(head);
   const worst=new Map();for(const c of result.checks)if(!worst.has(c.id)||worst.get(c.id).utilization<c.utilization)worst.set(c.id,c);
   for(const c of worst.values()){const tr=el('tr');[c.name,fmt(c.utilization*100)+' %'+(c.status==='exceeded'?' · Overskredet':''),c.combinationId,c.reference].forEach(t=>tr.append(el('td',t)));table.append(tr);}const scroll=el('div',undefined,'basis-scroll');scroll.append(table);report.append(scroll);
   if(result.input.member==='column'){
    const max=result.results.filter(r=>r.combination.limit==='ULS').sort((a,b)=>b.forces.nKn-a.forces.nKn)[0];report.append(el('p','Største NEd '+fmt(max.forces.nKn)+' kN · My,Ed '+fmt(max.forces.myKnM)+' kNm · Mz,Ed '+fmt(max.forces.mzKnM)+' kNm. Global ekvivalent skjevstillingskraft '+fmt(max.imperfection.hKn)+' kN'+(result.input.globalSway?' er lagt til.':' er vist for avstivningen, men ikke lagt til medlemmet.')));
   }
   const details=el('details');details.append(el('summary','Alle lastkombinasjoner og beregningsgrunnlag'));
   for(const r of result.results){details.append(el('h3',r.combination.id+' · '+r.combination.reference),el('p',r.combination.terms.filter(t=>t.factor).map(t=>fmt(t.factor)+' × '+t.name).join(' + ')));if(r.deflection)details.append(el('p','Øyeblikkelig deformasjon / brutto betongreferanse: '+fmt(r.deflection.mm)+' mm'+(r.finalDeflection?' · Sluttnedbøyning '+fmt(r.finalDeflection.mm)+' mm':'')));}
   details.append(el('pre',JSON.stringify({profile:result.profile,section:result.section,material:result.material,results:result.results.map(r=>({combination:r.combination,details:r.details,imperfection:r.imperfection}))},null,2)));report.append(details);
   if(result.input.member==='beam'){const charts=el('details');charts.append(el('summary','Diagrammer for den styrende kombinasjonen'));const target=el('div');charts.append(target);const r=result.results.find(r=>r.combination.id===result.governing?.combinationId)||result.results[0];renderDiagrams(target,r.forces);report.append(charts);}
  }
  const download=el('button','Last ned beregningsgrunnlag (JSON)','secondary');download.type='button';download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({product:'RIGOR Konstruksjon',generatedAt:new Date().toISOString(),...result},null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download='rigor-medlemsberegning.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};report.append(download);
 }
 function invalidate(){result=null;report.replaceChildren();report.hidden=true;error.textContent='';}
 controls.member.onchange=()=>{sync();invalidate();};controls.family.onchange=()=>{if(controls.family.value==='steel')controls.gammaM.value='1';else if(controls.family.value==='timber')controls.gammaM.value=controls.grade.value==='C24'?'1.3':'1.25';controls.confirmed.checked=false;sync();invalidate();};controls.grade.onchange=()=>{controls.gammaM.value=controls.grade.value==='C24'?'1.3':'1.25';controls.confirmed.checked=false;invalidate();};
 form.addEventListener('input',event=>{if(event.target!==controls.confirmed)controls.confirmed.checked=false;invalidate();});form.addEventListener('change',event=>{if(event.target!==controls.confirmed)controls.confirmed.checked=false;invalidate();});
 form.onsubmit=event=>{event.preventDefault();invalidate();try{result=controls.member.value==='terrace'?planTerrace({lengthM:num('terraceLengthM'),depthM:num('terraceDepthM'),heightM:num('terraceHeightM'),joistSpanM:num('joistSpanM'),beamSpanM:num('beamSpanM'),spacingMm:num('spacingMm'),deadKnM2:num('deadKnM2'),liveKnM2:num('liveKnM2'),wallSupport:controls.wallSupport.value,spanSource:controls.spanSource.value.trim()}):analyzeMember(input());render(result);report.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){error.textContent=e.message;}};
 addRow('G');addRow('Q');sync();report.hidden=true;
 return {open(member='beam',context=null){controls.member.value=member;sync();if(context){const facts=context.facts||{},complex=['profile','multiple_members'].includes(facts.sectionConstruction?.value);for(const [key,id]of [['spanM','lengthM'],['widthMm','widthMm'],['heightMm','heightMm'],['terraceLengthM','terraceLengthM'],['terraceDepthM','terraceDepthM'],['terraceHeightM','terraceHeightM'],['spacingMm','spacingMm'],['terraceWallSupport','wallSupport']])if(facts[key]&&!(complex&&['widthMm','heightMm'].includes(key)))controls[id].value=String(facts[key].value);}controls.confirmed.checked=false;invalidate();}};
}
