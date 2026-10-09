import {test} from 'node:test';import assert from 'node:assert/strict';
import {loadCombinations,validateActions} from '../construction/design-basis.js';
import {analyzeMember,timberBuckling,steelBuckling,columnImperfection} from '../construction/member-engine.js';
import {timberGrades,timberFactors} from '../construction/member-materials.js';
import {rectangle} from '../construction/sections.js';
import {planTerrace} from '../construction/terrace-plan.js';
const close=(a,b,tolerance=1e-8)=>assert(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const profile={expression:'6.10',gammaG:1.35,gammaQ:1.5,xi:.85,gammaM:1.3,gammaM1:1,gammaC:1.5,gammaS:1.15,alphaCC:.85,kcr:.67,source:'Testprofil EN, ikke norsk NA-verifikasjon',confirmed:true};
const action=(id,kind,values={})=>({id,name:id,kind,source:'Testreferanse K-01',duration:kind==='G'?'permanent':'medium',psi0:.7,psi1:.5,psi2:.3,qKnM:0,pKn:0,nKn:0,myKnM:0,mzKnM:0,hKn:0,...values});
const base={member:'beam',system:'simple',lengthM:4,widthMm:115,heightMm:315,material:{family:'timber',grade:'GL30c'},serviceClass:2,limitRatio:300,bearingMm:100,profile:{...profile,gammaM:1.25},restrained:true,supportsVerified:true,addSelfWeight:false,actions:[action('G','G',{qKnM:1}),action('Q','Q',{qKnM:2})]};
test('EN 1990 leading actions, 6.10a/b and three SLS combinations are independent and auditable',()=>{
 const a=validateActions([action('G','G',{qKnM:2}),action('live','Q',{qKnM:3}),action('snow','Q',{qKnM:1,psi0:.5,psi1:.2,psi2:0})],'beam',4),c=loadCombinations(a,{...profile,expression:'6.10ab'});
 close(c.find(x=>x.id==='ULS-1-610a').values.qKnM,6.6);close(c.find(x=>x.id==='ULS-1-610b').values.qKnM,7.545);close(c.find(x=>x.id==='ULS-2-610b').values.qKnM,6.945);
 close(c.find(x=>x.id==='SLS-char-1').values.qKnM,5.5);close(c.find(x=>x.id==='SLS-freq-1').values.qKnM,3.5);close(c.find(x=>x.id==='SLS-qp').values.qKnM,2.9);
 assert(c.every(x=>x.terms.every(t=>t.source==='Testreferanse K-01')));assert(!c.some(x=>x.limit==='ULS'&&x.values.qKnM===5));
});
test('Timber bending, shear, bearing and mean-E deflection reproduce independent closed forms',()=>{
 const r=analyzeMember(base),uls=r.results.find(x=>x.combination.id==='ULS-1-610'),q=4350,b=.115,h=.315,L=4,W=b*h*h/6,A=b*h;
 close(uls.forces.maxMoment.absoluteNm,q*L*L/8);close(uls.checks.find(c=>c.id==='bending').resistance,30e6*.8/1.25*W);
 close(uls.checks.find(c=>c.id==='shear').resistance,2/3*.67*A*3.5e6*.8/1.25);
 close(uls.checks.find(c=>c.id==='bearing').resistance,.115*.1*2.5e6*.8/1.25);
 const sls=r.results.find(x=>x.combination.limit==='SLS-characteristic'),I=b*h**3/12;
 close(sls.deflection.bendingMm,5*3000*L**4/(384*13e9*I)*1000);
 close(sls.deflection.shearBoundMm,3000*L*L/(8*(5/6)*650e6*A)*1000);
 const effectiveQ=3000+.8*(1000+.3*2000);close(sls.finalDeflection.bendingMm,5*effectiveQ*L**4/(384*13e9*I)*1000);
 const g=r.results.find(x=>x.combination.id==='ULS-G');close(g.details.kmod,.6);close(uls.details.kmod,.8);
 assert.equal(r.status,'within_member_scope');assert(r.outsideScope.some(x=>x.includes('fundament')));
});
test('Unverified national choices, missing bearing, restraint or supports cannot yield a complete member control',()=>{
 for(const edit of [{profile:{...base.profile,confirmed:false,source:''}},{restrained:false},{supportsVerified:false},{bearingMm:null}]){const r=analyzeMember({...base,...edit});assert.equal(r.status,'incomplete');assert(r.notPerformed.length);}
 const r=analyzeMember({...base,widthMm:48,heightMm:98});assert.equal(r.status,'exceeded');assert(r.checks.some(c=>c.utilization>1));
 assert.throws(()=>analyzeMember({...base,sectionType:'IPE'}));assert.throws(()=>analyzeMember({...base,system:'continuous'}));
});
test('Timber kmod/kdef and two-axis buckling use fifth-percentile E and explicit effective lengths',()=>{
 close(timberFactors(3,'short').kmod,.7);close(timberFactors(3,'permanent').kdef,2);
 const s=rectangle(100,200);s.izM4=.2*.1**3/12;const b=timberBuckling(timberGrades.C24,s,3,3);
 close(b.z.ncrN,Math.PI**2*7.4e9*(.2*.1**3/12)/9);assert(b.z.kc<b.y.kc);
 const r=analyzeMember({...base,member:'column',widthMm:140,heightMm:140,lengthM:3,effectiveYM:3,effectiveZM:3,thetaDenominator:200,globalSway:true,actions:[action('G','G',{nKn:30}),action('Q','Q',{nKn:20})]});
 const u=r.results.find(x=>x.combination.id==='ULS-1-610');close(u.forces.nKn,70.5);close(u.imperfection.hKn,70.5/200);close(u.forces.myKnM,70.5/200*3);assert(u.checks.some(c=>c.id==='member-interaction'));assert(u.checks.some(c=>c.id==='section-interaction'));
 const noSway=analyzeMember({...r.input,globalSway:false});close(noSway.results.find(x=>x.combination.id==='ULS-1-610').forces.myKnM,0);
});
test('Steel pure compression includes Euler critical load and both buckling axes; mixed bending stays incomplete',()=>{
 const m={family:'steel',fyMPa:355,strengthSource:'Test product thickness 10 mm'},p={...profile,gammaM:1};
 const i={...base,member:'column',material:m,profile:p,widthMm:100,heightMm:100,lengthM:3,effectiveYM:3,effectiveZM:3,bucklingCurve:'c',thetaDenominator:200,globalSway:false,actions:[action('G','G',{nKn:10})]};
 const r=analyzeMember(i);assert.equal(r.status,'within_member_scope');const u=r.results[0],ncr=Math.PI**2*210e9*(.1*.1**3/12)/9;close(u.details.buckling.y.ncrN,ncr);
 const lambda=Math.sqrt(.01*355e6/ncr),phi=.5*(1+.49*(lambda-.2)+lambda*lambda),chi=1/(phi+Math.sqrt(phi*phi-lambda*lambda));close(u.checks.find(c=>c.id==='buckling-y').resistance,chi*.01*355e6);
 const mixed=analyzeMember({...i,globalSway:true});assert.equal(mixed.status,'incomplete');assert(mixed.notPerformed.some(x=>x.includes('6.3.3')));
 assert.throws(()=>analyzeMember({...i,material:{...m,strengthSource:''}}));
});
test('Reinforced concrete beam ULS uses actual tensile steel and stress block; columns never claim design capacity',()=>{
 const i={...base,material:{family:'concrete',fckMPa:30,fykMPa:500},widthMm:300,heightMm:500,reinforcementMm2:1200,coverToSteelMm:50,actions:[action('G','G',{qKnM:3})]};
 const r=analyzeMember(i),u=r.results[0],fcd=.85*30e6/1.5,fyd=500e6/1.15,x=.0012*fyd/(.8*.3*fcd),moment=.0012*fyd*(.45-.4*x);close(u.checks.find(c=>c.id==='bending').resistance,moment);assert.equal(r.status,'incomplete');assert(r.notPerformed.some(x=>x.includes('risset')));
 const column=analyzeMember({...i,member:'column',lengthM:3,effectiveYM:3,effectiveZM:3,thetaDenominator:200,globalSway:true,actions:[action('G','G',{nKn:50})]});assert.equal(column.status,'incomplete');assert(column.notPerformed.some(x=>x.includes('andreordens')));assert(column.checks.every(c=>c.id==='axial-upper-bound'));
 assert.throws(()=>analyzeMember({...i,reinforcementMm2:8000}));
});
test('Gravity load data, sources, psi ranges and stale national confirmations cannot be silently repaired',()=>{
 for(const actions of [[action('x','Q',{qKnM:-1})],[action('x','Q',{qKnM:1,psi2:.8})],[action('x','G',{qKnM:1,source:''})],[action('x','G',{qKnM:1}),action('x','Q',{qKnM:1})]])assert.throws(()=>analyzeMember({...base,actions}));
 assert.throws(()=>analyzeMember({...base,profile:{...profile,confirmed:true,source:''}}));
 const original=JSON.stringify(base);analyzeMember(base);assert.equal(JSON.stringify(base),original);
 assert.throws(()=>analyzeMember({...base,approved:true}));assert.throws(()=>analyzeMember({...base,profile:{...profile,ePa:99}}));
});
test('Final timber deformation handles a zero quasi-permanent variable load and many coincident point loads',()=>{
 const q=analyzeMember({...base,actions:[action('Q','Q',{qKnM:1,psi0:0,psi1:0,psi2:0})]}),sls=q.results.find(r=>r.combination.limit==='SLS-characteristic');close(sls.finalDeflection.mm,sls.deflection.mm);
 const many=analyzeMember({...base,actions:Array.from({length:12},(_,j)=>action('load'+j,j===0?'G':'Q',{pKn:.2,xM:2}))});assert(many.results.every(r=>r.forces.loads.points.length<=12));assert(many.results.filter(r=>r.combination.limit==='SLS-characteristic').every(r=>r.finalDeflection.mm>r.deflection.mm));
});
test('Terrace layout partitions spans, locates supports and conserves characteristic area loads',()=>{
 const r=planTerrace({lengthM:8,depthM:4,heightM:1.2,joistSpanM:2.1,beamSpanM:2.9,spacingMm:600,deadKnM2:.5,liveKnM2:2,wallSupport:'free_standing',spanSource:'K-11: kontrollerte medlemsberegninger'});
 assert.equal(r.beamRowCount,3);assert.equal(r.supportCount,12);close(r.columnBayM,8/3);close(r.beamBayM,2);close(r.supports.reduce((s,x)=>s+x.tributaryAreaM2,0),32);close(r.supports.reduce((s,x)=>s+x.gkKn,0),16);close(r.supports.reduce((s,x)=>s+x.qkKn,0),64);
 assert.equal(r.status,'layout_only');assert(r.required.some(x=>x.includes('hver planke')));
 const wall=planTerrace({...r.input,wallSupport:'documented'});assert.equal(wall.supportCount,8);close(wall.supports.reduce((s,x)=>s+x.tributaryAreaM2,0),24);
 assert.throws(()=>planTerrace({...r.input,spanSource:''}));assert.throws(()=>planTerrace({...r.input,joistSpanM:.2,beamSpanM:.2}));
});
