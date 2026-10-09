import {test} from 'node:test';
import assert from 'node:assert/strict';
import {designTerrace,terraceLoadBasis,maximumJoistSpan,analyzeTerraceJoist,terraceEnProfile} from '../construction/terrace-design.js';
import {analyzeMember} from '../construction/member-engine.js';
const close=(a,b,t=1e-8)=>assert(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
export const terraceCase=()=>({lengthM:5,depthM:4,heightM:2,spacingMm:600,deckThicknessMm:28,deckWidthMm:120,deckGapMm:6,deckDensityKgM3:550,additionalDeadKnM2:0,liveKnM2:4,pointKn:3,limitRatio:300,bearingMm:180,wallSupport:'free_standing',snowStatus:'unknown',snowKnM2:0,snowSource:'',loadSource:'EN example for numerical test only; not a verified Norwegian project',livePsi:{psi0:.7,psi1:.5,psi2:.3},snowPsi:{psi0:.5,psi1:.2,psi2:0},beamCount:2,equalSharing:true,joistWidthMm:48,joistHeightMm:198,beamWidthMm:48,beamHeightMm:198,joistGrade:'C24',beamGrade:'C24',serviceClass:3,profile:{...terraceEnProfile},restrained:true,supportsVerified:true});
test('Grouped joist reactions use one imposed-action factor and preserve exact point forces',()=>{
 const p=terraceCase(),base={member:'beam',system:'simple',lengthM:4,widthMm:48,heightMm:198,material:{family:'timber',grade:'C24'},profile:{...p.profile,expression:'6.10'},serviceClass:3,limitRatio:300,bearingMm:180,restrained:true,supportsVerified:true,addSelfWeight:false};
 const a={id:'Q',name:'One occupancy action',kind:'Q',source:'Test values',duration:'medium',psi0:.7,psi1:.5,psi2:.3,points:[{xM:1,pKn:2},{xM:3,pKn:3}]};
 const r=analyzeMember({...base,actions:[a]}),uls=r.results.find(r=>r.combination.id==='ULS-0-610');
 close(uls.forces.reactions.leftN,1.5*(2000*3/4+3000/4));close(uls.forces.reactions.rightN,1.5*(2000/4+3000*3/4));close(uls.forces.totalN,7500);
 assert.throws(()=>analyzeMember({...base,actions:[{...a,points:[{xM:5,pKn:2}]}]}));
});
test('Maximum joist span matches an independent EC5 strength/deflection envelope, including shear deformation and creep',()=>{
 const p={...terraceCase(),pointKn:0},b=terraceLoadBasis(p),span=maximumJoistSpan(p,b),h=.198,width=.048,I=width*h**3/12,E=11e9,G=690e6,A=width*h;
 const g=(.028*(120/126)*550*9.81/1000)*(.5555555555555556)+A*420*9.81/1000,q=4*.5555555555555556;
 const qd=Math.max(1.35*g+1.5*.7*q,.85*1.35*g+1.5*q)*1000,fm=.65*24e6/1.3,W=width*h*h/6;
 const bending=Math.sqrt(8*fm*W/qd),shear=2*((2/3)*.67*A*(.65*4e6/1.3))/qd;
 const qFinal=(g*3+q*1.6)*1000,GA=5/6*G*A;
 let low=.1,high=12;for(let i=0;i<80;i++){const L=(low+high)/2,w=5*qFinal*L**4/(384*E*I)+qFinal*L*L/(8*GA);if(w<=L/300)low=L;else high=L;}
 const expected=Math.min(bending,shear,low);assert(Math.abs(span.limitM-expected)<.0011);assert(analyzeTerraceJoist(p,b,span.limitM+.002).checks.some(c=>c.utilization>1));
 assert.equal(span.calculation.governing.id,'final-deflection');
});
test('Deck, joist and all beam-plank self-weights appear exactly once; physical reactions conserve area loads',()=>{
 for(const equalSharing of [false,true])for(const wallSupport of ['free_standing','documented']){
  const p={...terraceCase(),equalSharing,wallSupport},r=designTerrace(p),A=.048*.198,deck=.028*120/126*550*9.81/1000;
  const expected=deck*20+A*420*9.81/1000*r.joistCount*4+A*420*9.81/1000*2*5*r.beamRowCount;
  close(r.equilibrium.gExpectedKn,expected);close(r.equilibrium.gReactionKn,expected);close(r.equilibrium.qReactionKn,80);
  if(wallSupport==='documented')assert(r.wallReactions[0].qkKn>0);
  assert(r.notPerformed.some(t=>/Snølast/.test(t)));assert.notEqual(r.status,'within_member_scope');
 }
});
test('Double joists are separate full-size planks; unverified sharing is conservative and cannot masquerade as composite action',()=>{
 const shared=designTerrace(terraceCase()),unshared=designTerrace({...terraceCase(),equalSharing:false});
 assert(shared.largestBeamSpanM>=unshared.largestBeamSpanM);assert(unshared.notPerformed.some(t=>/hver planke/.test(t)));
 const r=shared.checks.find(c=>c.role==='beam').result;assert.equal(r.input.widthMm,48);assert.equal(r.section.areaM2,.048*.198);
});
test('The common physical column head must carry reactions from both adjoining bays',()=>{
 const p={...terraceCase(),rowYs:[0,2,4],supportXs:[0,2.5,5],bearingMm:90},r=designTerrace(p);
 const s=r.supports.find(s=>s.xM===2.5&&s.yM===2),c=r.checks.find(c=>c.role==='contact'&&c.xM===2.5&&c.yM===2).result;
 assert.equal(r.status,'exceeded');assert.equal(r.largestBeamSpanM,null);assert(c.governing.utilization>1);
 const q=s.qkKn/2,g=s.gkKn/2;close(c.governing.demand,Math.max(1.35*g+1.5*.7*q,.85*1.35*g+1.5*q));
});
test('Changing the 2D grid recalculates spans, discrete joist reactions and status; malformed axes are rejected',()=>{
 const p=terraceCase(),base=designTerrace(p),edited=designTerrace({...p,rowYs:[0,1.5,4],supportXs:[0,1,2.8,5]});
 assert.notDeepEqual(base.supports,edited.supports);close(edited.equilibrium.qReactionKn,80);close(edited.equilibrium.gReactionKn,edited.equilibrium.gExpectedKn);
 assert(edited.checks.some(c=>c.role==='beam'&&Math.abs(c.spanM-2.2)<1e-8));
 for(const supportXs of [[0,3,2,5],[0,0,5],[.1,2,5],[0,4.95,5]])assert.throws(()=>designTerrace({...p,supportXs}));
});
test('Snow, concentrated occupancy, unsupported board spacing and provisional standard values remain explicit',()=>{
 const p=terraceCase(),base=designTerrace(p),snow=designTerrace({...p,snowStatus:'documented',snowKnM2:6,snowSource:'Test terrace snow, not ground snow'});
 assert(snow.joistLimit.limitM<base.joistLimit.limitM);close(snow.equilibrium.snowReactionKn,120);
 const point=designTerrace({...p,pointKn:5});assert(point.joistLimit.limitM<base.joistLimit.limitM);
 assert.throws(()=>designTerrace({...p,pointKn:12}),/minste beregningsspenn/,'A concentrated load that exceeds contact resistance cannot be repaired by shortening the span.');
 const checked=designTerrace({...p,profile:{...p.profile,confirmed:true,source:'First-generation EN numerical test profile, not actual NA approval'},snowStatus:'not_applicable',snowSource:'Enclosed numerical benchmark; not an actual outdoor terrace'});
 assert.equal(checked.status,'within_member_scope');assert(checked.required.some(t=>/Stolpenes/.test(t)));
 const thin=designTerrace({...p,deckThicknessMm:21});assert(thin.notPerformed.some(t=>/Bordtykkelse/.test(t)));
 assert.throws(()=>designTerrace({...p,livePsi:{psi0:.3,psi1:.5,psi2:.3}}));
});
