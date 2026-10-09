// Linear elastic Euler–Bernoulli beam. SI throughout: m, N, Pa, m^4.
// Only downward gravity loads and the two explicitly supported systems.
const positive=(v,name)=>{if(!Number.isFinite(v)||v<=0)throw Error('Ugyldig '+name);return v;};
export function solveBeam({system,spanM,qNPerM=0,points=[],stiffness=null}){
 const L=positive(spanM,'spenn');if(L>30||!['simple','cantilever'].includes(system))throw Error('Dette statiske systemet støttes ikke.');
 if(!Number.isFinite(qNPerM)||qNPerM<0||qNPerM>500000||!Array.isArray(points)||points.length>20)throw Error('Ugyldig last.');
 for(const p of points)if(!p||Object.keys(p).some(k=>!['xM','forceN'].includes(k))||!Number.isFinite(p.forceN)||p.forceN<0||p.forceN>5000000||!Number.isFinite(p.xM)||p.xM<0||p.xM>L)throw Error('Punktlasten må ligge på bjelken.');
 const EI=stiffness?positive(stiffness.ePa,'E-modul')*positive(stiffness.iM4,'arealmoment'):null;
 const q=qNPerM,P=points.reduce((s,p)=>s+p.forceN,0),total=q*L+P;
 if(total<=0)throw Error('Oppgi minst én positiv last.');
 const RA=system==='simple'?q*L/2+points.reduce((s,p)=>s+p.forceN*(L-p.xM)/L,0):total;
 const RB=system==='simple'?total-RA:0;
 const fixedMoment=system==='cantilever'?q*L*L/2+points.reduce((s,p)=>s+p.forceN*p.xM,0):0;
 const C=RA*L*L/6-q*L**3/24-points.reduce((s,p)=>s+p.forceN*(L-p.xM)**3/6,0)/L;
 const moment=x=>system==='simple'?RA*x-q*x*x/2-points.reduce((s,p)=>s+p.forceN*Math.max(x-p.xM,0),0):-q*(L-x)**2/2-points.reduce((s,p)=>s+p.forceN*Math.max(p.xM-x,0),0);
 const shear=(x,side='right')=>system==='simple'?RA-q*x-points.reduce((s,p)=>s+(p.xM<x||side==='right'&&p.xM===x?p.forceN:0),0):q*(L-x)+points.reduce((s,p)=>s+(p.xM>x||side==='left'&&p.xM===x?p.forceN:0),0);
 function deflection(x){
  if(!EI)return null;
  if(system==='simple')return (-RA*x**3/6+q*x**4/24+points.reduce((s,p)=>s+p.forceN*Math.max(x-p.xM,0)**3/6,0)+C*x)/EI;
  return (q*x*x*(6*L*L-4*L*x+x*x)/24+points.reduce((s,p)=>s+p.forceN*(x<=p.xM?x*x*(3*p.xM-x):p.xM*p.xM*(3*x-p.xM))/6,0))/EI;
 }
 function slope(x){return (-RA*x*x/2+q*x**3/6+points.reduce((s,p)=>s+p.forceN*Math.max(x-p.xM,0)**2/2,0)+C)/(EI||1);}
 const breaks=[...new Set([0,L,...points.map(p=>p.xM)])].sort((a,b)=>a-b);
 const extrema=[...breaks];
 if(system==='simple'&&q>0)for(let i=0;i<breaks.length-1;i++){
  const left=breaks[i],right=breaks[i+1],x=(RA-points.filter(p=>p.xM<=left).reduce((s,p)=>s+p.forceN,0))/q;
  if(x>left&&x<right)extrema.push(x);
 }
 const maxMoment=extrema.reduce((best,x)=>Math.abs(moment(x))>Math.abs(best.value)?{xM:x,value:moment(x)}:best,{xM:0,value:moment(0)});
 // At an end, a coincident point load can transfer directly to the support;
 // do not count the outside face as internal beam shear.
 const maxShear=breaks.flatMap(x=>[...(x>0?[shear(x,'left')]:[]),...(x<L?[shear(x,'right')]:[])]).reduce((best,v)=>Math.max(best,Math.abs(v)),0);
 let wx=system==='cantilever'?L:0;
 if(EI&&system==='simple'){
  let a=0,b=L;for(let i=0;i<70;i++){const mid=(a+b)/2;if(slope(mid)>0)a=mid;else b=mid;}wx=(a+b)/2;
 }
 const xs=[...new Set([...Array.from({length:101},(_,i)=>L*i/100),...extrema,wx])].sort((a,b)=>a-b);
 const samples=xs.flatMap(x=>points.some(p=>p.xM===x)?[...(x>0?[{xM:x,momentNm:moment(x),shearN:shear(x,'left'),deflectionM:deflection(x)}]:[]),...(x<L?[{xM:x,momentNm:moment(x),shearN:shear(x,'right'),deflectionM:deflection(x)}]:[])]:[{xM:x,momentNm:moment(x),shearN:shear(x),deflectionM:deflection(x)}]);
 const equilibrium={verticalResidualN:RA+RB-total,momentResidualNm:system==='simple'?RB*L-q*L*L/2-points.reduce((s,p)=>s+p.forceN*p.xM,0):fixedMoment-q*L*L/2-points.reduce((s,p)=>s+p.forceN*p.xM,0)};
 return {method:'analytical_euler_bernoulli',system,spanM:L,loads:{qNPerM:q,points:structuredClone(points)},totalN:total,reactions:{leftN:RA,rightN:RB,fixedMomentNm:fixedMoment},maxMoment:{xM:maxMoment.xM,signedNm:maxMoment.value,absoluteNm:Math.abs(maxMoment.value)},maxShearN:maxShear,maxDeflection:EI?{xM:wx,downM:Math.max(0,deflection(wx))}:null,stiffness:stiffness?{...stiffness}:null,equilibrium,samples};
}
