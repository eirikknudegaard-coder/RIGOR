import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveBeam} from '../construction/beam-solver.js';
import {rectangle} from '../construction/sections.js';
import {materials} from '../construction/materials.js';
const close=(actual,expected,tolerance=1e-9)=>assert(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const stiffness={ePa:11e9,iM4:rectangle(48,198).iM4},EI=stiffness.ePa*stiffness.iM4;
test('Rectangle converts mm to SI and preserves the bending axis',()=>{
 const s=rectangle(48,198);close(s.areaM2,.048*.198);close(s.iM4,.048*.198**3/12);close(s.wM3,.048*.198**2/6);
 close(rectangle(48,396).iM4/s.iM4,8);assert.throws(()=>rectangle(0,198));assert.throws(()=>rectangle(NaN,198));
 assert.equal(materials.C24.ePa,11e9);assert.equal(materials.GL30c.ePa,13e9);assert.equal(materials.S355.ePa,210e9);
});
test('Simply supported UDL agrees with closed-form reactions, moment, shear and deflection',()=>{
 const L=4,q=2000,b=solveBeam({system:'simple',spanM:L,qNPerM:q,stiffness});
 close(b.reactions.leftN,q*L/2);close(b.reactions.rightN,q*L/2);close(b.maxMoment.absoluteNm,q*L*L/8);close(b.maxMoment.xM,L/2);close(b.maxShearN,q*L/2);close(b.maxDeflection.downM,5*q*L**4/(384*EI));close(b.maxDeflection.xM,L/2);
 close(b.samples[0].deflectionM,0);close(b.samples.at(-1).deflectionM,0);assert.equal(b.equilibrium.verticalResidualN,0);assert.equal(b.equilibrium.momentResidualNm,0);
});
test('Midspan and off-centre point loads match independent closed forms and exact extrema',()=>{
 const P=12000,L=4;
 const b=solveBeam({system:'simple',spanM:L,points:[{xM:L/2,forceN:P}],stiffness});close(b.reactions.leftN,P/2);close(b.maxMoment.absoluteNm,P*L/4);close(b.maxDeflection.downM,P*L**3/(48*EI));
 const a=1,c=solveBeam({system:'simple',spanM:L,points:[{xM:a,forceN:P}],stiffness});
 close(c.reactions.leftN,P*(L-a)/L);close(c.reactions.rightN,P*a/L);close(c.maxMoment.absoluteNm,P*a*(L-a)/L);close(c.maxMoment.xM,a);
 close(c.maxDeflection.xM,L-Math.sqrt((L*L-a*a)/3));close(c.maxDeflection.downM,P*a*(L*L-a*a)**1.5/(9*Math.sqrt(3)*L*EI));
 const jump=c.samples.filter(s=>s.xM===a);assert.equal(jump.length,2);close(jump[0].shearN-jump[1].shearN,P);close(jump[0].momentNm,jump[1].momentNm);
});
test('Cantilever UDL, tip load and internal point load agree with closed forms',()=>{
 const L=2,q=3500,P=5000,a=.8;
 const b=solveBeam({system:'cantilever',spanM:L,qNPerM:q,points:[{xM:L,forceN:P}],stiffness});
 close(b.reactions.leftN,q*L+P);close(b.reactions.rightN,0);close(b.reactions.fixedMomentNm,q*L*L/2+P*L);close(b.maxMoment.signedNm,-b.reactions.fixedMomentNm);close(b.maxDeflection.downM,q*L**4/(8*EI)+P*L**3/(3*EI));close(b.maxDeflection.xM,L);close(b.samples[0].deflectionM,0);
 const c=solveBeam({system:'cantilever',spanM:L,points:[{xM:a,forceN:P}],stiffness});close(c.maxDeflection.downM,P*a*a*(3*L-a)/(6*EI));close(c.maxMoment.absoluteNm,P*a);
});
test('End point loads go directly to their support, without invented internal shear or bending',()=>{
 const b=solveBeam({system:'simple',spanM:4,points:[{xM:0,forceN:7000},{xM:4,forceN:13000}],stiffness});close(b.reactions.leftN,7000);close(b.reactions.rightN,13000);close(b.maxMoment.absoluteNm,0);close(b.maxShearN,0);close(b.maxDeflection.downM,0);assert(b.samples.every(s=>Math.abs(s.shearN)<1e-9));
});
test('Combined loads satisfy superposition and equilibrium across varied spans',()=>{
 for(let i=1;i<=40;i++){
  const L=.5+i*.13,q=900+i*37,points=[{xM:L*.27,forceN:2300+i*31},{xM:L*.76,forceN:700+i*9}];
  const b=solveBeam({system:'simple',spanM:L,qNPerM:q,points,stiffness}),u=solveBeam({system:'simple',spanM:L,qNPerM:q,stiffness}),p=solveBeam({system:'simple',spanM:L,points,stiffness});
  close(b.reactions.leftN,u.reactions.leftN+p.reactions.leftN);close(b.reactions.rightN,u.reactions.rightN+p.reactions.rightN);close(b.equilibrium.verticalResidualN,0,1e-8);close(b.equilibrium.momentResidualNm,0,1e-8);
  for(const s of b.samples){assert(Number.isFinite(s.momentNm));assert(Number.isFinite(s.deflectionM));assert(Math.abs(s.momentNm)<=b.maxMoment.absoluteNm+1e-8);assert(s.deflectionM<=b.maxDeflection.downM+1e-9);}
 }
});
test('Forces do not require stiffness; invalid loads and unsupported systems are rejected',()=>{
 const b=solveBeam({system:'simple',spanM:3,qNPerM:1000});assert.equal(b.maxDeflection,null);assert(b.samples.every(s=>s.deflectionM===null));
 for(const change of [{system:'continuous'},{system:'frame'},{qNPerM:-1},{spanM:0},{qNPerM:Infinity},{qNPerM:0},{stiffness:{ePa:0,iM4:1}},{points:[{xM:4,forceN:1000}]}])assert.throws(()=>solveBeam({system:'simple',spanM:3,qNPerM:1000,...change}));
});
