// First-generation EN 1990 equations. National choices are explicit inputs.
// This is NOT a pre-validated Norwegian NA profile.
export const basisSources={
 norway:'https://standard.no/fagomrader/bygg-anlegg-og-eiendom/eurokoder1/',
 combinations:'https://www.steelconstruction.info/Design_codes_and_standards',
 timber:'https://www.swedishwood.com/siteassets/5-publikationer/pdfer/sw-design-of-timber-structures-vol2-2022.pdf',
 steel:'https://www.steelconstruction.info/Member_design',
 concrete:'https://www.concretecentre.com/Codes/Eurocode-2/Columns.aspx'
};
export const actionKeys=['qKnM','pKn','nKn','myKnM','mzKnM','hKn'];
export const durationOrder=['permanent','long','medium','short','instant'];
export function bounded(value,name,min,max){if(!Number.isFinite(value)||value<min||value>max)throw Error('Kontroller '+name+'.');return value;}
export function validateBasis(p){
 if(!p||!['6.10','6.10ab'].includes(p.expression))throw Error('Velg kombinasjonsregel.');
 if(Object.keys(p).some(k=>!['expression','gammaG','gammaQ','gammaM','gammaM1','gammaC','gammaS','xi','kcr','alphaCC','confirmed','source'].includes(k)))throw Error('Ukjent standardparameter.');
 for(const id of ['gammaG','gammaQ','gammaM','gammaM1','gammaC','gammaS'])bounded(p[id],id,1,2);
 bounded(p.xi,'ξ',.5,1);bounded(p.kcr,'kcr',.3,1);bounded(p.alphaCC,'αcc',.5,1);
 if(typeof p.confirmed!=='boolean'||typeof p.source!=='string'||p.source.length>600)throw Error('Oppgi standardgrunnlaget.');
 if(p.confirmed&&p.source.trim().length<10)throw Error('Oppgi standardutgave og kilde for de kontrollerte NA-verdiene.');
 return {...p};
}
export function validateActions(actions,member,spanM){
 if(!Array.isArray(actions)||!actions.length||actions.length>12)throw Error('Oppgi 1–12 karakteristiske laster.');
 const ids=new Set();let nonzero=false;
 return actions.map((a,i)=>{
  if(!a||!['G','Q'].includes(a.kind)||typeof a.name!=='string'||!a.name.trim()||a.name.length>100||typeof a.source!=='string'||!a.source.trim()||a.source.length>400)throw Error('Hver last trenger navn, type og kilde.');
  if(typeof a.id!=='string'||!a.id.trim()||ids.has(a.id))throw Error('Lastene må ha ulike ID-er.');ids.add(a.id);
  const clean={id:a.id||'action-'+i,name:a.name,kind:a.kind,source:a.source,duration:a.kind==='G'?'permanent':a.duration};
  if(!durationOrder.includes(clean.duration))throw Error('Velg lastvarighet.');
  for(const key of actionKeys){clean[key]=bounded(a[key]??0,key,0,5000);nonzero ||= clean[key]>0;}
  if(a.points!==undefined){
   if(member!=='beam'||!Array.isArray(a.points)||a.points.length>250)throw Error('Punktlastgruppen krever en bjelke og høyst 250 lastpunkter.');
   clean.points=a.points.map(point=>({xM:bounded(point.xM,'lastpunkt',0,spanM),pKn:bounded(point.pKn,'punktkraft',0,5000)}));
   nonzero ||= clean.points.some(point=>point.pKn>0);
  }
  if(member==='beam'&&(clean.nKn||clean.myKnM||clean.mzKnM||clean.hKn))throw Error('Bjelkeskjemaet støtter nedoverrettet linje- og punktlast. Andre lastretninger krever en utvidet modell.');
  if(member==='column'&&(clean.qKnM||clean.pKn))throw Error('Søyleskjemaet bruker normalkraft, moment og horisontalkraft ved toppen.');
  if(clean.pKn>0)clean.xM=bounded(a.xM,'punktlastens plassering',0,spanM);else clean.xM=0;
  for(const key of ['psi0','psi1','psi2'])clean[key]=a.kind==='G'?1:bounded(a[key],key,0,1);
  if(clean.psi2>clean.psi1||clean.psi1>clean.psi0)throw Error('Kombinasjonsfaktorer må følge ψ2 ≤ ψ1 ≤ ψ0.');
  if(i===actions.length-1&&!nonzero)throw Error('Oppgi minst én positiv karakteristisk last.');
  return clean;
 });
}
function combine(actions,factors,id,limit,reference,leading=null){
 const values=Object.fromEntries(actionKeys.map(k=>[k,0])),points=[];
 let duration='permanent';
 actions.forEach((a,i)=>{const factor=factors[i];for(const k of actionKeys)values[k]+=a[k]*factor;if(a.pKn&&factor)points.push({xM:a.xM,forceN:a.pKn*factor*1000});for(const point of a.points||[])if(point.pKn&&factor){points.push({xM:point.xM,forceN:point.pKn*factor*1000});values.pKn+=point.pKn*factor;}if(factor&&durationOrder.indexOf(a.duration)>durationOrder.indexOf(duration))duration=a.duration;});
 return {id,limit,reference,leading,values,points,duration,terms:actions.map((a,i)=>({actionId:a.id,name:a.name,factor:factors[i],source:a.source}))};
}
export function loadCombinations(actions,profile){
 const p=validateBasis(profile),variable=actions.map((a,i)=>a.kind==='Q'?i:null).filter(i=>i!==null),combinations=[];
 const permanent=actions.map(a=>a.kind==='G'?p.gammaG:0);
 combinations.push(combine(actions,permanent,'ULS-G','ULS','EN 1990: permanent last alene'));
 for(const lead of variable){
  const base=(g,q)=>actions.map((a,i)=>a.kind==='G'?g:q(a,i));
  if(p.expression==='6.10')combinations.push(combine(actions,base(p.gammaG,(a,i)=>p.gammaQ*(i===lead?1:a.psi0)),'ULS-'+lead+'-610','ULS','EN 1990, 6.10',actions[lead].name));
  else{
   combinations.push(combine(actions,base(p.gammaG,a=>p.gammaQ*a.psi0),'ULS-'+lead+'-610a','ULS','EN 1990, 6.10a',actions[lead].name));
   combinations.push(combine(actions,base(p.xi*p.gammaG,(a,i)=>p.gammaQ*(i===lead?1:a.psi0)),'ULS-'+lead+'-610b','ULS','EN 1990, 6.10b',actions[lead].name));
  }
  combinations.push(combine(actions,base(1,(a,i)=>i===lead?1:a.psi0),'SLS-char-'+lead,'SLS-characteristic','EN 1990, 6.14b',actions[lead].name));
  combinations.push(combine(actions,base(1,(a,i)=>i===lead?a.psi1:a.psi2),'SLS-freq-'+lead,'SLS-frequent','EN 1990, 6.15b',actions[lead].name));
 }
 if(!variable.length)combinations.push(combine(actions,actions.map(()=>1),'SLS-G','SLS-characteristic','EN 1990: karakteristisk permanent last'));
 combinations.push(combine(actions,actions.map(a=>a.kind==='G'?1:a.psi2),'SLS-qp','SLS-quasi-permanent','EN 1990, 6.16b'));
 return combinations.filter(c=>Object.values(c.values).some(v=>v>0));
}
