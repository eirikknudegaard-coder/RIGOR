import {fact,validateContext} from './context.js';
import {rectangle} from './sections.js';
import {materialFor} from './materials.js';
export function buildStructuralModel(input){
 const c=validateContext(input),get=id=>fact(c,id),required=[],derived=[],assumptions=[],limitations=[];
 const need=id=>{if(get(id)===undefined||get(id)==='unknown'||c.conflicts[id])required.push(id);};
 const goal=get('goal');need('goal');
 const system=get('system')||(goal==='remove_wall'?'simple':null);
 if(!system)required.push('system');
 if(goal==='remove_wall'&&!get('system'))assumptions.push({id:'system',value:'simple',status:'ASSUMED',text:'En mulig ny drager er foreløpig modellert med opplegg i begge ender.'});
 let span=get('spanM');
 if(!span&&goal==='remove_wall'&&get('openingM')){span=get('openingM');assumptions.push({id:'spanM',value:span,status:'ASSUMED',text:'Beregningsspennet er foreløpig satt lik ønsket åpning. Faktisk avstand mellom oppleggsreaksjonene må bekreftes.'});}
 if(!span)required.push(goal==='remove_wall'?'openingM':'spanM');
 if(c.conflicts.memberRole||get('nominalSection')&&!get('memberRole'))required.push('memberRole');
 if(c.conflicts.system)required.push('system');
 need('loadChoice');let q=0;const points=[];
 if(['line','mixed'].includes(get('loadChoice'))){need('lineLoadKnM');q=(get('lineLoadKnM')||0)*1000;}
 if(['point','mixed'].includes(get('loadChoice'))){need('pointLoadKn');need('pointPositionM');if(get('pointLoadKn')!==undefined&&get('pointPositionM')!==undefined)points.push({xM:get('pointPositionM'),forceN:get('pointLoadKn')*1000});}
 let roofBlocked=false;
 if(get('loadChoice')==='roof'){
  for(const id of ['roofBearsOnWall','floorAbove','roofSupport','roofSides','rafterSpanM','spanBasis','roofDeadKnM2','roofSnowKnM2','deadBasis'])need(id);
  if(get('roofSides')==='two')need('oppositeRafterSpanM');
  if(get('spanBasis')==='slope'||get('deadBasis')==='slope')need('roofAngleDeg');
  if(get('roofBearsOnWall')==='no')limitations.push('Du oppgir at sperrene ikke har opplegg på veggen. Taklast kan ikke overføres til veggen med denne modellen.');
  if(get('floorAbove')==='yes')limitations.push('Takmodellen dekker ikke etasjeskiller eller annen bæring. Bruk dokumentert samlet last langs drageren eller en utvidet modell.');
  if(get('roofSupport')&&get('roofSupport')!=='ridge_beam')limitations.push('Sperremodellen krever bekreftet bæring ved mønet. Takstoler og sperrer med mønebord kan ha andre reaksjoner og horisontalkrefter.');
  if(get('roofType')&& !['gable','mono'].includes(get('roofType')))limitations.push('Takformen krever et dokumentert lastgrunnlag direkte på drageren. Enkel sperreoverføring er ikke valgt for denne takformen.');
  roofBlocked=limitations.length>0;
  if(!required.length&&!roofBlocked){
   const cos=Math.cos((get('roofAngleDeg')||0)*Math.PI/180),L1=get('rafterSpanM')*(get('spanBasis')==='slope'?cos:1),L2=get('roofSides')==='two'?get('oppositeRafterSpanM')*(get('spanBasis')==='slope'?cos:1):0;
   const width=(L1+L2)/2,g=get('roofDeadKnM2')/(get('deadBasis')==='slope'?cos:1),s=get('roofSnowKnM2');q=(g+s)*width*1000;
   derived.push({id:'tributaryWidthM',value:width,status:'DERIVED',text:'Halvparten av vannrett sperrespenn fra hver bekreftet side av veggen.'},{id:'roofLineLoadKnM',value:q/1000,status:'DERIVED',text:'(Egenvekt per vannrett m² + oppgitt snølast på taket) × lastbredde.'});
   assumptions.push({id:'roofGravity',status:'ASSUMED',text:'Hver sperre er modellert som enkelt opplagt mellom bekreftede bæringer. Sperrenes enkelte oppleggslaster er jevnet ut til en vertikal linjelast. Senteravstanden brukes ikke til å plassere enkeltlaster i denne orienterende modellen. Ingen horisontalkrefter eller takstolreaksjoner beregnes.'});
  }
 }
 if(get('loadChoice')&&get('loadChoice')!=='unknown'){need('loadBasis');need('loadSource');}
 if(get('loadBasis')==='preliminary')assumptions.push({id:'loads',status:'ASSUMED',text:'Lastene er brukerens foreløpige forutsetninger, ikke en verifisert stedsspesifikk lastberegning.'});
 let section=null,material=null,sectionBlocked=false;
 if(get('sectionRequested')===true){
  for(const id of ['sectionConstruction','widthMm','heightMm','material','selfWeightInLoad'])need(id);
  if(get('sectionConstruction')&&get('sectionConstruction')!=='solid_single'){sectionBlocked=true;limitations.push('Sammensatte bjelker og stålprofiler kan ikke regnes som ett massivt rektangel. Vis lastanalyse uten nedbøyning, eller bruk en utvidet tverrsnittsmodell.');}
  if(get('sectionConstruction')==='solid_single'&&get('widthMm')!==undefined&&get('heightMm')!==undefined)section=rectangle(get('widthMm'),get('heightMm'));
  material=materialFor(get('material'));
  if(section&&material&&get('selfWeightInLoad')===false){const own=section.areaM2*material.densityKgM3*9.81;q+=own;derived.push({id:'selfWeightKnM',value:own/1000,status:'DERIVED',text:'Bekreftet tverrsnittsareal × middeltetthet × 9,81 m/s².'});}
  if(section&&material&&get('selfWeightInLoad')===undefined)limitations.push('Avklar om dragerens egenvekt er med, slik at den verken utelates eller telles to ganger.');
 }else limitations.push('Dragerens tverrsnitt, stivhet og egenvekt er ikke kontrollert i denne lastanalysen.');
 if(get('unsupportedReason'))limitations.push(get('unsupportedReason'));
 if(['continuous','frame'].includes(system))limitations.push('Tre eller flere opplegg og rammer krever en utvidet analysemodell. De erstattes ikke med en fritt opplagt bjelke.');
 if(system==='unknown')required.push('system');
 if(points.some(p=>p.xM>span))limitations.push('Punktlasten ligger utenfor oppgitt spenn.');
 const loadOutOfRange=q>500000;
 if(loadOutOfRange)limitations.push('Den utledede linjelasten er over støttet nivå på 500 kN/m. Kontroller enheter og lastgrunnlag, eller bruk en utvidet modell.');
 const blocked=get('unsupportedReason')||!['simple','cantilever'].includes(system)||points.some(p=>p.xM>span)||roofBlocked||sectionBlocked||loadOutOfRange;
 const ready=required.length===0&&!blocked&&(q>0||points.some(p=>p.forceN>0));
 if(required.length===0&&!blocked&&q===0&&!points.some(p=>p.forceN>0))limitations.push('Det er ikke oppgitt noen positiv last. Null last gir ikke et grunnlag for å vurdere drageren.');
 return {ready,required:[...new Set(required)],system,spanM:span||null,qNPerM:q,points,section,material,derived,assumptions,limitations,loadSource:get('loadSource')||null,loadBasis:get('loadBasis')||null,stiffness:section&&material?{ePa:material.ePa,iM4:section.iM4}:null};
}
