import {weatherReference,terrainParameters} from './weather-register.js';
import {municipalityLabel} from './municipalities.js';
const finite=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
export function siteLoadBasis(p){
 const required=[],notes=[],snow={},wind={},need=(valid,id)=>{if(!valid)required.push(id);return valid;};
 const location=need(/^\d{4}$/.test(p.municipality||'')&&municipalityLabel(p.municipality)!==p.municipality,'municipality');
 need(finite(p.altitudeM,0,2500),'altitudeM');
 const ref=location?weatherReference(p.municipality,p.area):null;
 if(location&&!ref)required.push('area');
 const snowRequested=['snow','both'].includes(p.actions),windRequested=['wind','both'].includes(p.actions);
 need(['snow','wind','both'].includes(p.actions),'actions');
 const confirmed=p.confirmed===true&&typeof p.standardSource==='string'&&p.standardSource.trim().length>=10;
 if(!confirmed)required.push('standardSource');
 if(snowRequested){
  let sk=ref?.snow&&finite(p.altitudeM,0,ref.snow.altitudeLimitM)?ref.snow.sk0:null;
  let groundSource=sk!==null?ref.snow.source:null;
  if(p.groundSnowKnM2!==undefined){sk=finite(p.groundSnowKnM2,0,30)&&typeof p.groundSnowSource==='string'&&p.groundSnowSource.trim().length>=10?p.groundSnowKnM2:null;groundSource=sk!==null?p.groundSnowSource:null;}
  if(sk===null){required.push('groundSnowKnM2');notes.push(ref?.snow?'Byggestedet ligger over tabellens høydegrense. Utsnittet inneholder ikke regelen for høydeøkning; oppgi dokumentert marksnølast for denne høyden.':'Marksnølast mangler for området i det tilgjengelige registeret. Oppgi dokumentert verdi for byggestedets høyde.');}
  snow.groundKnM2=sk;snow.groundSource=groundSource;snow.reference=ref?.snow||null;
  need(['flat','mono','gable'].includes(p.roofType),'roofType');need(finite(p.roofAngleDeg,0,75),'roofAngleDeg');
  need(['normal','exposed','sheltered'].includes(p.snowExposure),'snowExposure');
  need(['free','retained'].includes(p.snowSliding),'snowSliding');
  need(p.snowDrift==='none','snowDrift');need(p.thermal==='normal','thermal');
  if(p.snowDrift!=='none'||p.snowSliding==='complex')notes.push('Parapet, sprang, høyere nabobygg eller lokal snødrift krever egne lasttilfeller.');
  if(p.thermal!=='normal')notes.push('Glass-/varmeavgivende tak trenger et dokumentert termisk grunnlag.');
  if(p.roofType==='flat'&&p.roofAngleDeg!==0)required.push('flatRoofAngle');
  if(sk!==null&&['flat','mono','gable'].includes(p.roofType)&&finite(p.roofAngleDeg,0,75)&&['free','retained'].includes(p.snowSliding)&&p.snowDrift==='none'&&p.thermal==='normal'&&['normal','exposed','sheltered'].includes(p.snowExposure)&&(p.roofType!=='flat'||p.roofAngleDeg===0)){
   const a=p.roofAngleDeg,mu=p.snowSliding==='retained'?.8:a<=30?.8:a<60?.8*(60-a)/30:0,ce=({normal:1,exposed:.8,sheltered:1.2})[p.snowExposure];
   snow.mu=mu;snow.ce=ce;snow.ct=1;snow.roofKnM2=mu*ce*sk;
   snow.cases=p.roofType==='gable'?[{id:'balanced',left:snow.roofKnM2,right:snow.roofKnM2},{id:'left_reduced',left:.5*snow.roofKnM2,right:snow.roofKnM2},{id:'right_reduced',left:snow.roofKnM2,right:.5*snow.roofKnM2}]:[{id:'uniform',load:snow.roofKnM2}];
   notes.push('Formfaktor: EN 1991-1-3 tabell 5.2 / 5.3.2–5.3.3; Ce fra tabell 5.1; Ct=1. Prosjektets NA-valg må kontrolleres. Saltak forutsetter lik vinkel på begge sider.');
  }
  snow.ready=required.length===0&&Number.isFinite(snow.roofKnM2);
 }
 if(windRequested){
  const manualWind=finite(p.referenceWindMS,10,60)&&typeof p.referenceWindSource==='string'&&p.referenceWindSource.trim().length>=10;
  const vb0=p.referenceWindMS!==undefined?(manualWind?p.referenceWindMS:null):ref?.wind?.vb0??null;wind.reference=ref?.wind||null;wind.referenceSource=manualWind?p.referenceWindSource:ref?.wind?.source||null;wind.vb0=vb0;
  need(vb0!==null,'referenceWindMS');need(finite(p.heightM,.5,200),'heightM');need(Boolean(terrainParameters[p.terrain]),'terrain');
  need(p.topography==='flat','topography');need(p.terrainTransition==='no','terrainTransition');
  // The supplied excerpts do not contain altitude adjustment or NA turbulence
  // rules. They must remain explicit documented inputs, never AI-generated.
  need(finite(p.altitudeFactor,1,3)&&typeof p.altitudeFactorSource==='string'&&p.altitudeFactorSource.trim().length>=10,'altitudeFactor');
  need(finite(p.turbulenceIntensity,0,1)&&typeof p.turbulenceSource==='string'&&p.turbulenceSource.trim().length>=10,'turbulenceIntensity');
  need(finite(p.airDensity,.8,1.5),'airDensity');
  if(p.topography!=='flat')notes.push('Ås, skrent eller traktvirkning trenger en egen topografikontroll; c0 blir ikke gjettet til 1.');
  if(p.terrainTransition!=='no')notes.push('NA krever kontroll av terrengoverganger innen 10 km; ett ruhetstall er ikke tilstrekkelig her.');
  const t=terrainParameters[p.terrain];
  if(vb0!==null&&t&&finite(p.heightM,.5,200)&&p.topography==='flat'&&p.terrainTransition==='no'&&finite(p.altitudeFactor,1,3)&&typeof p.altitudeFactorSource==='string'&&p.altitudeFactorSource.trim().length>=10){
   wind.z=Math.max(p.heightM,t.zmin);wind.cr=t.kr*Math.log(wind.z/t.z0);wind.vb=vb0*p.altitudeFactor;wind.vm=wind.cr*wind.vb;
   if(finite(p.airDensity,.8,1.5)){wind.qbKnM2=.5*p.airDensity*wind.vb**2/1000;if(finite(p.turbulenceIntensity,0,1)&&typeof p.turbulenceSource==='string'&&p.turbulenceSource.trim().length>=10)wind.qpKnM2=(1+7*p.turbulenceIntensity)*.5*p.airDensity*wind.vm**2/1000;}
  }
  notes.push('Alle vindretninger og hele året: cdir=cseason=1, uten reduksjoner. q_p er vindkasttrykk; tak-/veggsoner, cpe/cpi, sug, innfesting og global stabilitet er egne kontroller. Vindtrykk legges ikke inn som positiv tyngdelast.');
 }
 return {version:1,level:'load_basis',ready:!required.length,required:[...new Set(required)],location:location?municipalityLabel(p.municipality):null,input:structuredClone(p),snow,wind,notes,source:p.standardSource||null};
}
