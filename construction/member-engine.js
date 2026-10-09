import {bounded,validateBasis,validateActions,loadCombinations,basisSources} from './design-basis.js';
import {memberMaterial,timberFactors} from './member-materials.js';
import {rectangle} from './sections.js';
import {solveBeam} from './beam-solver.js';
const check=(id,name,demand,resistance,unit,reference)=>({id,name,demand,resistance,unit,utilization:resistance>0?demand/resistance:Infinity,reference,status:demand<=resistance?'within':'exceeded'});
function sectionFor(input){
 const s=rectangle(input.widthMm,input.heightMm);s.izM4=(input.heightMm/1000)*(input.widthMm/1000)**3/12;s.wzM3=(input.heightMm/1000)*(input.widthMm/1000)**2/6;
 return s;
}
export function timberBuckling(material,section,lengthYM,lengthZM){
 const axis=(I,L)=>{
  const slenderness=L/Math.sqrt(I/section.areaM2),relative=slenderness/Math.PI*Math.sqrt(material.fcMPa*1e6/material.e05Pa);
  const k=.5*(1+material.betaC*(relative-.3)+relative**2),kc=relative<=.3?1:1/(k+Math.sqrt(Math.max(0,k*k-relative**2)));
  return {slenderness,relative,kc,ncrN:Math.PI**2*material.e05Pa*I/L**2};
 };
 return {y:axis(section.iM4,lengthYM),z:axis(section.izM4,lengthZM),reference:'EN 1995-1-1, 6.3.2 (6.21–6.29). Lokal skjevhet inngår i βc; den legges ikke til en gang til.'};
}
export function steelBuckling(material,section,lengthYM,lengthZM,curve){
 const alpha=({a0:.13,a:.21,b:.34,c:.49,d:.76})[curve];if(!alpha)throw Error('Velg dokumentert knekkurve.');
 const axis=(I,L)=>{const ncrN=Math.PI**2*material.ePa*I/L**2,relative=Math.sqrt(section.areaM2*material.fyMPa*1e6/ncrN),phi=.5*(1+alpha*(relative-.2)+relative**2),chi=Math.min(1,1/(phi+Math.sqrt(Math.max(0,phi*phi-relative**2))));return {ncrN,relative,chi,alpha};};
 return {y:axis(section.iM4,lengthYM),z:axis(section.izM4,lengthZM),reference:'EN 1993-1-1, 6.3.1.2, 6.49–6.51. Valgt knekkurve må passe tverrsnitt og akse.'};
}
// Braced isolated column: global initial inclination / equivalent top force.
// Local bow imperfections are included in EC5/EC3 buckling curves separately.
export function columnImperfection(lengthM,nKn,thetaDenominator){
 bounded(thetaDenominator,'global skjevstilling 1/',100,1000);
 const theta=1/thetaDenominator,hKn=nKn*theta;
 return {theta,hKn,baseMomentKnM:hKn*lengthM,reference:'Oppgitt global skjevstilling: Himp = θ·NEd. Fundament og avstivningssystem må ta denne kraften. Lokal stavskjevhet behandles separat.'};
}
function beamDeflection(beam,section,material){
 const bendingMm=beam.maxDeflection?.downM*1000||0;
 if(!material.gPa)return {mm:bendingMm,bendingMm,shearBoundMm:null,method:'Euler–Bernoulli; bare bøyningsdeformasjon'};
 const q=beam.loads.qNPerM,L=beam.spanM,GA=(5/6)*material.gPa*section.areaM2;
 // Sum of maxima is a conservative bound for combined loads at different x.
 const shearBoundM=beam.system==='simple'?q*L*L/(8*GA)+beam.loads.points.reduce((s,p)=>s+p.forceN*p.xM*(L-p.xM)/(GA*L),0):q*L*L/(2*GA)+beam.loads.points.reduce((s,p)=>s+p.forceN*p.xM/GA,0);
 return {mm:bendingMm+shearBoundM*1000,bendingMm,shearBoundMm:shearBoundM*1000,method:'Bøyningsmaksimum + øvre grense for skjærdeformasjon (κ = 5/6)'};
}
function timberChecks(model,combination,forces){
 const {material:m,section:s,input:i,profile:p}=model,{kmod,kdef}=timberFactors(i.serviceClass,combination.duration),fm=m.fmMPa*1e6*kmod/p.gammaM,fc=m.fcMPa*1e6*kmod/p.gammaM,fv=m.fvMPa*1e6*kmod/p.gammaM;
 const checks=[],details={kmod,kdef,fmPa:fm,fcPa:fc,fvPa:fv};
 if(i.member==='beam'){
  checks.push(check('bending','Bøyning',forces.maxMoment.absoluteNm,fm*s.wM3,'Nm','EN 1995-1-1, 6.1.6; kh = 1 uten styrkeøkning'));
  checks.push(check('shear','Skjær',forces.maxShearN,(2/3)*p.kcr*s.areaM2*fv,'N','EN 1995-1-1, 6.1.7; bef = kcr·b'));
  if(i.bearingMm){const resistance=m.fc90MPa*1e6*kmod/p.gammaM*(i.widthMm/1000)*(i.bearingMm/1000);checks.push(check('bearing','Trykk på dokumentert oppleggsflate',Math.max(forces.reactions.leftN,forces.reactions.rightN),resistance,'N','EN 1995-1-1, 6.1.5; kc,90 = 1, ingen økning av effektiv flate'));}
 }else{
  const buckling=timberBuckling(m,s,i.effectiveYM,i.effectiveZM);details.buckling=buckling;
  const n=forces.nKn*1000,my=forces.myKnM*1000,mz=forces.mzKnM*1000,ry=my/(fm*s.wM3),rz=mz/(fm*s.wzM3),axial=n/(fc*s.areaM2);
  checks.push(check('compression','Trykk parallelt med fiber',n,fc*s.areaM2,'N','EN 1995-1-1, 6.1.4'));
  checks.push(check('buckling-y','Knekking om sterk akse',n,buckling.y.kc*fc*s.areaM2,'N',buckling.reference),check('buckling-z','Knekking om svak akse',n,buckling.z.kc*fc*s.areaM2,'N',buckling.reference));
  // Both section interaction (6.19/6.20) and member interaction (6.23/6.24).
  checks.push(check('section-interaction','Trykk + toakset bøyning i tverrsnitt',Math.max(axial*axial+ry+.7*rz,axial*axial+.7*ry+rz),1,'forhold','EN 1995-1-1, 6.2.4; km = 0,7'));
  checks.push(check('member-interaction','Knekking + toakset bøyning',Math.max(axial/buckling.y.kc+ry+.7*rz,axial/buckling.z.kc+.7*ry+rz),1,'forhold','EN 1995-1-1, 6.3.2; ingen ekstra lokal skjevhetslast utover knekkurven'));
  checks.push(check('column-shear','Skjær fra oppgitt horisontalkraft',forces.hKn*1000,(2/3)*p.kcr*s.areaM2*fv,'N','EN 1995-1-1, 6.1.7'));
 }
 return {checks,details};
}
function steelChecks(model,combination,forces){
 const {material:m,section:s,input:i,profile:p}=model,fy=m.fyMPa*1e6,checks=[],details={};
 if(i.member==='beam'){
  checks.push(check('bending','Elastisk bøyning',forces.maxMoment.absoluteNm,fy*s.wM3/p.gammaM,'Nm','EN 1993-1-1, 6.2.5; elastisk tverrsnitt uten hull'));
  const sigma=forces.maxMoment.absoluteNm/s.wM3,tau=1.5*forces.maxShearN/s.areaM2;
  checks.push(check('shear','Elastisk skjær',tau,fy/(Math.sqrt(3)*p.gammaM),'Pa','EN 1993-1-1, 6.2.1 (6.1)'));
  checks.push(check('combined','Konservativ elastisk M–V-kontroll',Math.sqrt(sigma*sigma+3*tau*tau),fy/p.gammaM,'Pa','EN 1993-1-1, 6.2.1 (6.1); største spenninger kombineres konservativt'));
 }else{
  const b=steelBuckling(m,s,i.effectiveYM,i.effectiveZM,i.bucklingCurve);details.buckling=b;
  checks.push(check('compression','Elastisk trykkapasitet',forces.nKn*1000,fy*s.areaM2/p.gammaM,'N','EN 1993-1-1, 6.2.4'));
  for(const axis of ['y','z'])checks.push(check('buckling-'+axis,'Bøyeknekking om '+axis+'-akse',forces.nKn*1000,b[axis].chi*fy*s.areaM2/p.gammaM1,'N',b.reference));
  const stress=forces.nKn*1000/s.areaM2+forces.myKnM*1000/s.wM3+forces.mzKnM*1000/s.wzM3;
  checks.push(check('section-interaction','Elastisk N–My–Mz i tverrsnitt',stress,fy/p.gammaM,'Pa','EN 1993-1-1, 6.2.1'));
  details.combinedMemberRequired=forces.myKnM>0||forces.mzKnM>0||forces.hKn>0;
 }
 return {checks,details};
}
function concreteChecks(model,combination,forces){
 const {input:i,material:m,section:s,profile:p}=model,checks=[],fcd=p.alphaCC*m.fckMPa*1e6/p.gammaC,fyd=m.fykMPa*1e6/p.gammaS;
 if(i.member==='beam'){
  // Rectangular stress block, singly reinforced, fck <= 50 MPa.
  const d=(i.heightMm-i.coverToSteelMm)/1000,As=i.reinforcementMm2/1e6,b=i.widthMm/1000,x=As*fyd/(.8*b*fcd),z=d-.4*x;
  if(d<=0||x/d>.45||z<=0)throw Error('Betongbjelken er utenfor den enkle, strekkarmerte modellen (x/d ≤ 0,45).');
  checks.push(check('bending','Bøyning, enkel strekkarmering',forces.maxMoment.absoluteNm,As*fyd*z,'Nm','EN 1992-1-1, 3.1.7 og 6.1; λ = 0,8, η = 1'));
  const rho=Math.min(.02,As/(b*d)),k=Math.min(2,1+Math.sqrt(200/(d*1000))),vrdC=Math.max(.18/p.gammaC*k*(100*rho*m.fckMPa)**(1/3),.035*k**1.5*Math.sqrt(m.fckMPa))*1e6*b*d;
  checks.push(check('shear','Skjær uten beregnet bøylebidrag',forces.maxShearN,vrdC,'N','EN 1992-1-1, 6.2.2 (6.2a/b); ingen skjærreduksjon ved opplegg'));
  const fctm=.3*m.fckMPa**(2/3),minAs=Math.max(.26*fctm/m.fykMPa,.0013)*b*d;
  checks.push(check('minimum-reinforcement','Minimum strekkarmering',minAs,As,'m²','EN 1992-1-1, 9.2.1.1'));
  return {checks,details:{fcdPa:fcd,fydPa:fyd,xM:x,zM:z,required:['Bøyler, forankring, rissvidde, kryp og nedbøyning i risset tverrsnitt må kontrolleres.']}};
 }
 // Report an upper bound only: never present concentric capacity as a column design.
 const As=i.reinforcementMm2/1e6,upper=(s.areaM2-As)*fcd+As*fyd;
 checks.push(check('axial-upper-bound','Øvre grense for rent sentrisk trykk',forces.nKn*1000,upper,'N','Tverrsnittsgrense uten eksentrisitet; dette er ikke søylens dimensjonerende kapasitet'));
 const minEccM=Math.max(.02,i.heightMm/30000),localEccM=i.effectiveYM/(2*200),ncrN=Math.PI**2*m.ePa*s.iM4/i.effectiveYM**2;
 return {checks,details:{fcdPa:fcd,fydPa:fyd,minEccM,localEccM,ncrGrossN:ncrN,minimumMomentKnM:forces.nKn*Math.max(minEccM,localEccM),required:['Armert betongsøyle krever N–M-interaksjon, effektiv stivhet med kryp og andreordensanalyse (EN 1992-1-1, 5.8). Brutto Eulerlast er bare en referanse og brukes ikke som dimensjonerende kapasitet.']}};
}
export function analyzeMember(input){
 if(!input||!['beam','column'].includes(input.member))throw Error('Velg bjelke eller søyle.');
 if(Object.keys(input).some(k=>!['member','sectionType','system','lengthM','widthMm','heightMm','material','profile','serviceClass','limitRatio','bearingMm','effectiveYM','effectiveZM','thetaDenominator','globalSway','bucklingCurve','reinforcementMm2','coverToSteelMm','restrained','supportsVerified','addSelfWeight','actions'].includes(k)))throw Error('Ukjent medlemsopplysning.');
 if(input.sectionType&&input.sectionType!=='rectangle')throw Error('Bare ett massivt rektangel støttes. Profil og sammensatte medlemmer krever en annen modell.');
 const i=structuredClone(input),profile=validateBasis(i.profile),section=sectionFor(i),material=memberMaterial(i.material);
 bounded(i.lengthM,'lengde/spenn',.1,30);
 if(typeof i.restrained!=='boolean'||typeof i.supportsVerified!=='boolean'||typeof i.addSelfWeight!=='boolean')throw Error('Bekreft avstivning, opplegg og egenvekt.');
 const notPerformed=[],outsideScope=['Forbindelser, fundament og samlet bygningstabilitet','Brann, seismikk, ulykkeslast og utførelseskontroll'];
 if(!profile.confirmed)notPerformed.push('Prosjektets standardutgave og norske NA-parametere er ikke bekreftet.');
 if(!i.restrained)notPerformed.push('Vipping/torsjon og avstivning er ikke dokumentert.');
 if(!i.supportsVerified)notPerformed.push('Opplegg, knekkelengder og lastvei er ikke dokumentert.');
 if(material.family==='timber'){timberFactors(i.serviceClass,'permanent');if(i.heightMm>600)notPerformed.push('Størrelses-/volumvirkning for trefelt over 600 mm må avklares.');}
 if(material.family==='steel'&&Math.max(i.widthMm/i.heightMm,i.heightMm/i.widthMm)>10)notPerformed.push('Torsjons-/torsjonsbøyeknekking for svært flatt stålrektangel er ikke kontrollert.');
 if(i.member==='beam'){
  if(!['simple','cantilever'].includes(i.system))throw Error('Velg to opplegg eller dokumentert innspenning.');
  bounded(i.limitRatio,'nedbøyningsgrense L/',100,1000);
  if(material.family==='timber'&&i.bearingMm!=null)bounded(i.bearingMm,'oppleggslengde',10,1000);
  if(material.family==='timber'&&!i.bearingMm)notPerformed.push('Trykk på oppleggsflate mangler kontaktlengde.');
  if(material.family==='steel')notPerformed.push('Lokal lastinnføring og opplegg i stål er ikke kontrollert.');
 }else{
  bounded(i.effectiveYM,'knekkelengde y',.1,100);bounded(i.effectiveZM,'knekkelengde z',.1,100);
  bounded(i.thetaDenominator,'skjevstilling 1/',100,1000);
  if(typeof i.globalSway!=='boolean')throw Error('Angi om global skjevstilling skal gi last på denne søylen.');
 }
 if(material.family==='concrete'){
  bounded(i.reinforcementMm2,'armeringsareal',10,30000);if(i.reinforcementMm2/1e6>=section.areaM2*.08)throw Error('Kontroller armeringsarealet.');
  if(i.member==='beam')bounded(i.coverToSteelMm,'avstand til armeringens tyngdepunkt',10,i.heightMm*.45);
 }
 const actions=validateActions(i.actions,i.member,i.lengthM);if(actions.some(a=>a.id==='self-weight'))throw Error('Last-ID self-weight er reservert for beregnet egenvekt.');
 if(i.addSelfWeight){const weight=section.areaM2*material.densityKgM3*9.81/1000;actions.push({id:'self-weight',name:'Automatisk medlemsegenvekt',kind:'G',source:material.reference,duration:'permanent',psi0:1,psi1:1,psi2:1,qKnM:i.member==='beam'?weight:0,nKn:i.member==='column'?weight*i.lengthM:0,pKn:0,myKnM:0,mzKnM:0,hKn:0,xM:0});}
 const model={input:i,profile,material,section},combinations=loadCombinations(actions,profile),results=[];
 for(const c of combinations){
  let forces,deflection=null,imperfection=null;
  if(i.member==='beam'){
   forces=solveBeam({system:i.system,spanM:i.lengthM,qNPerM:c.values.qKnM*1000,points:c.points,stiffness:{ePa:material.ePa,iM4:section.iM4}});
   if(c.limit.startsWith('SLS'))deflection=beamDeflection(forces,section,material);
  }else{
   imperfection=columnImperfection(i.lengthM,c.values.nKn,i.thetaDenominator);
   const H=c.values.hKn+(i.globalSway?imperfection.hKn:0);
   // Worst-sign top load moment; pinned braced supports must instead receive an explicit M.
   forces={nKn:c.values.nKn,myKnM:c.values.myKnM+H*i.lengthM,mzKnM:c.values.mzKnM,hKn:H};
  }
  const checker=material.family==='timber'?timberChecks:material.family==='steel'?steelChecks:concreteChecks;
  const controlled=c.limit==='ULS'?checker(model,c,forces):{checks:[],details:{}};
  if(controlled.details.combinedMemberRequired)notPerformed.push('Stålsøyle med moment: stavinteraksjon etter EN 1993-1-1, 6.3.3 er ikke utført.');
  if(controlled.details.required)notPerformed.push(...controlled.details.required);
  results.push({combination:c,forces,deflection,imperfection,...controlled});
 }
 const characteristic=results.filter(r=>r.combination.limit==='SLS-characteristic'),qp=results.find(r=>r.combination.limit==='SLS-quasi-permanent');
 if(i.member==='beam'&&material.family==='timber'){
  const kdef=timberFactors(i.serviceClass,'permanent').kdef;
  for(const r of characteristic){
   if(!qp){r.finalDeflection={...r.deflection};continue;}
   const q=r.forces.loads.qNPerM+kdef*qp.forces.loads.qNPerM,merged=new Map();for(const point of [...r.forces.loads.points,...qp.forces.loads.points.map(p=>({...p,forceN:p.forceN*kdef}))])merged.set(point.xM,(merged.get(point.xM)||0)+point.forceN);const points=[...merged].map(([xM,forceN])=>({xM,forceN}));
   const final=solveBeam({system:i.system,spanM:i.lengthM,qNPerM:q,points,stiffness:{ePa:material.ePa,iM4:section.iM4}});
   r.finalDeflection=beamDeflection(final,section,material);
  }
 }
 const checks=results.flatMap(r=>r.checks.map(c=>({...c,combinationId:r.combination.id})));
 if(i.member==='beam'){
  if(material.family==='concrete')notPerformed.push('Elastisk bruttonedbøyning er referanse; SLS i risset betong med kryp er ikke kontrollert.');
  else for(const r of characteristic){checks.push({...check('instant-deflection','Øyeblikkelig nedbøyning',r.deflection.mm,i.lengthM*1000/i.limitRatio,'mm','Prosjektets valgte sammenligningsgrense'),combinationId:r.combination.id});if(r.finalDeflection)checks.push({...check('final-deflection','Sluttnedbøyning inkl. kryp',r.finalDeflection.mm,i.lengthM*1000/i.limitRatio,'mm','EN 1995-1-1, 2.2.3 og 7.2; winst + kdef·wqp'),combinationId:r.combination.id});}
 }
 const governing=checks.reduce((worst,c)=>!worst||c.utilization>worst.utilization?c:worst,null),exceeded=checks.some(c=>c.status==='exceeded');
 return {version:1,kind:'member_design',input:i,material,section,actions,profile,results,checks,governing,notPerformed:[...new Set(notPerformed)],outsideScope,status:exceeded?'exceeded':notPerformed.length?'incomplete':'within_member_scope',sources:basisSources,scope:'Kontroll av ett massivt rektangulært medlem uten hull eller utsparinger, ikke godkjenning av samlet byggverk. Bare positive gravitasjons-/trykk-laster, avstivet medlem og eksplisitte lastforutsetninger.'};
}
