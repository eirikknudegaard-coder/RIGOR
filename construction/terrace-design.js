import {analyzeMember} from './member-engine.js';
import {memberMaterial,timberFactors} from './member-materials.js';
import {bounded,validateBasis,validateActions,loadCombinations} from './design-basis.js';

// First-generation EN inputs. This is deliberately not a certified Norwegian NA.
export const terraceEnProfile={expression:'6.10ab',gammaG:1.35,gammaQ:1.5,xi:.85,gammaM:1.3,gammaM1:1,gammaC:1.5,gammaS:1.15,alphaCC:.85,kcr:.67,confirmed:false,source:''};
export const terraceSources={loads:'https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-1-actions-structures',timber:'https://www.swedishwood.com/siteassets/5-publikationer/pdfer/sw-design-of-timber-structures-vol2-2022.pdf',guide:'https://www.bergeneholm.no/inspirasjon/byggeguider/bygge-terrasse-bjelkelagstabellen/',national:'https://standard.no/fagomrader/bygg-anlegg-og-eiendom/eurokoder1/'};
const eps=1e-8;
const evenly=(length,count)=>Array.from({length:count+1},(_,i)=>i*length/count);
const weight=(width,height,material)=>width*height/1e6*material.densityKgM3*9.81/1000;
const peak=result=>Math.max(...result.checks.map(c=>c.utilization));
const envelope=results=>results.reduce((a,b)=>!a||peak(b)>peak(a)?b:a,null);
function action(id,name,kind,source,values={},psi={psi0:.7,psi1:.5,psi2:.3}){return {id,name,kind,source,duration:kind==='G'?'permanent':'medium',...psi,...values};}
function axes(values,length,name){
 if(!Array.isArray(values)||values.length<2||values.length>50||values[0]!==0||Math.abs(values.at(-1)-length)>eps)throw Error(name+' må starte ved 0 og slutte ved terrassens kant.');
 values.forEach((v,i)=>{bounded(v,name,0,length);if(i&&v-values[i-1]<.1-eps)throw Error(name+' må ha minst 0,1 m mellom punktene.');});return [...values];
}
export function terraceLoadBasis(p){
 for(const [id,min,max]of [['lengthM',.5,30],['depthM',.5,20],['heightM',0,10],['spacingMm',100,1200],['deckThicknessMm',15,100],['deckWidthMm',50,300],['deckGapMm',0,15],['deckDensityKgM3',300,1200],['additionalDeadKnM2',0,15],['liveKnM2',.1,15],['pointKn',0,20],['limitRatio',100,1000],['bearingMm',10,500]])bounded(p[id],id,min,max);
 if(!['documented','free_standing'].includes(p.wallSupport))throw Error('Velg bæring ved huset.');
 if(!['unknown','documented','not_applicable'].includes(p.snowStatus))throw Error('Avklar snølast.');
 if(p.snowStatus==='documented'){bounded(p.snowKnM2,'karakteristisk snølast på terrasse',0,20);if(!p.snowSource?.trim())throw Error('Oppgi kilde for snølast på terrassen.');for(const k of ['psi0','psi1','psi2'])bounded(p.snowPsi?.[k],k,0,1);}
 if(typeof p.loadSource!=='string'||p.loadSource.trim().length<5)throw Error('Oppgi kilde for nyttelast og punktlast.');
 for(const k of ['psi0','psi1','psi2'])bounded(p.livePsi?.[k],k,0,1);
 bounded(p.beamCount,'antall dragerplanker',1,3);if(!Number.isInteger(p.beamCount)||typeof p.equalSharing!=='boolean')throw Error('Kontroller drageroppbyggingen.');
 for(const id of ['joistWidthMm','joistHeightMm','beamWidthMm','beamHeightMm'])bounded(p[id],id,30,600);
 const joistMaterial=memberMaterial({family:'timber',grade:p.joistGrade}),beamMaterial=memberMaterial({family:'timber',grade:p.beamGrade});
 const profile=validateBasis(p.profile),deckCoverage=p.deckWidthMm/(p.deckWidthMm+p.deckGapMm);
 const deckKnM2=p.deckThicknessMm/1000*deckCoverage*p.deckDensityKgM3*9.81/1000+p.additionalDeadKnM2;
 const joistWeightKnM=weight(p.joistWidthMm,p.joistHeightMm,joistMaterial),beamWeightKnM=weight(p.beamWidthMm,p.beamHeightMm,beamMaterial);
 const count=Math.ceil(p.lengthM/(p.spacingMm/1000)),joistXs=evenly(p.lengthM,count),actualSpacingM=p.lengthM/count;
 if(joistXs.length>250)throw Error('Del terrassen i mindre deler før det beregnes mer enn 250 bjelker.');
 return {profile,joistMaterial,beamMaterial,deckKnM2,joistWeightKnM,beamWeightKnM,joistXs,actualSpacingM,deckCoverage};
}
function inputFor(p,b,role,lengthM,actions){
 const joist=role==='joist';
 return {member:'beam',system:'simple',lengthM,widthMm:p[role+'WidthMm'],heightMm:p[role+'HeightMm'],material:{family:'timber',grade:p[role+'Grade']},profile:{...b.profile,gammaM:p[role+'Grade']==='GL30c'?p.glulamGammaM??1.25:b.profile.gammaM},serviceClass:p.serviceClass,limitRatio:p.limitRatio,bearingMm:joist?Math.min(p.bearingMm,p.beamCount*p.beamWidthMm):p.bearingMm,restrained:p.restrained,supportsVerified:p.supportsVerified,addSelfWeight:false,actions};
}
function snow(p,values){return p.snowStatus==='documented'&&p.snowKnM2>0?[action('snow','Snølast på terrasse','Q',p.snowSource,values,p.snowPsi)]:[];}
export function analyzeTerraceJoist(p,b,lengthM){
 const g=b.deckKnM2*b.actualSpacingM+b.joistWeightKnM;
 const permanent=action('dead','Terrassebord og bjelkens egenvekt','G','Beregnet volum × oppgitt densitet; egenvekt lagt til én gang',{qKnM:g});
 const common=snow(p,{qKnM:p.snowKnM2*b.actualSpacingM});
 const distributed=analyzeMember(inputFor(p,b,'joist',lengthM,[permanent,action('occupancy','Nyttelast, fordelt','Q',p.loadSource,{qKnM:p.liveKnM2*b.actualSpacingM},p.livePsi),...common]));
 const concentrated=p.pointKn>0?analyzeMember(inputFor(p,b,'joist',lengthM,[permanent,action('occupancy-point','Nyttelast, konsentrert alternativ','Q',p.loadSource,{pKn:p.pointKn,xM:lengthM/2},p.livePsi),...common])):null;
 return envelope([distributed,...(concentrated?[concentrated]:[])]);
}
export function maximumJoistSpan(p,b=terraceLoadBasis(p)){
 let lower=.1,upper=12;
 if(peak(analyzeTerraceJoist(p,b,lower))>1)throw Error('Bjelkedimensjonen tåler ikke minste beregningsspenn.');
 if(peak(analyzeTerraceJoist(p,b,upper))<=1)return {limitM:upper,capped:true,calculation:analyzeTerraceJoist(p,b,upper)};
 for(let i=0;i<32;i++){const mid=(lower+upper)/2;if(peak(analyzeTerraceJoist(p,b,mid))<=1)lower=mid;else upper=mid;}
 const limitM=Math.floor(lower*1000)/1000;
 return {limitM,capped:false,calculation:analyzeTerraceJoist(p,b,limitM)};
}
function tributary(axis,i){return ((i?axis[i]-axis[i-1]:0)+(i<axis.length-1?axis[i+1]-axis[i]:0))/2;}
// Individual joists deliver discrete reactions. All points for one action share
// a combination factor; they are not separate, independent imposed loads.
function bayLoads(p,b,row,x0,x1){
 const share=p.equalSharing?1/p.beamCount:1;
 const points=(kind)=>b.joistXs.flatMap((x,j)=>{
  if(x<x0-eps||x>x1+eps)return [];
  const endSplit=(Math.abs(x-x0)<eps&&x0>eps||Math.abs(x-x1)<eps&&x1<p.lengthM-eps)?.5:1;
  const width=tributary(b.joistXs,j),intensity=kind==='G'?b.deckKnM2:kind==='snow'?p.snowKnM2:p.liveKnM2;
  const force=(intensity*width+(kind==='G'?b.joistWeightKnM:0))*row.tributaryM;
  return [{xM:Math.min(x1-x0,Math.max(0,x-x0)),pKn:force*share*endSplit}];
 });
 const own=b.beamWeightKnM*(p.equalSharing?1:p.beamCount);
 const g=action('dead','Reaksjoner fra bjelkelag og dragerens egenvekt','G','Eksakte bjelkereaksjoner; egenvekt én gang',{qKnM:own,points:points('G')});
 const distributed=[g,action('occupancy','Nyttelast gjennom bjelkelaget','Q',p.loadSource,{points:points('Q')},p.livePsi),...snow(p,{points:points('snow')})];
 const concentrated=[g,action('occupancy-point','Konsentrert nyttelast, ugunstig plassering','Q',p.loadSource,{pKn:p.pointKn*share,xM:(x1-x0)/2},p.livePsi),...snow(p,{points:points('snow')})];
 return {distributed,concentrated,share};
}
function evaluatePlan(p,b,ys,xs,{collect=true}={}){
 const rows=ys.map((yM,i)=>({yM,type:i===0&&p.wallSupport==='documented'?'wall':'beam',tributaryM:tributary(ys,i)}));
 const checks=[],supports=[],wallReactions=[];
 for(const row of rows){
  if(row.type==='wall'){wallReactions.push({yM:0,gkKn:b.deckKnM2*p.lengthM*row.tributaryM+b.joistWeightKnM*b.joistXs.length*row.tributaryM,qkKn:p.liveKnM2*p.lengthM*row.tributaryM,snowKn:p.snowStatus==='documented'?p.snowKnM2*p.lengthM*row.tributaryM:0});continue;}
  const reaction=xs.map(xM=>({xM,yM:row.yM,gkKn:0,qkKn:0,snowKn:0}));
  for(let bay=0;bay<xs.length-1;bay++){
   const x0=xs[bay],x1=xs[bay+1],loads=bayLoads(p,b,row,x0,x1);
   const distributed=analyzeMember(inputFor(p,b,'beam',x1-x0,loads.distributed));
   const concentrated=p.pointKn>0?analyzeMember(inputFor(p,b,'beam',x1-x0,loads.concentrated)):null;
   const result=envelope([distributed,...(concentrated?[concentrated]:[])]);
   if(!collect&&peak(result)>1)return {passed:false};
   checks.push({role:'beam',yM:row.yM,x0M:x0,x1M:x1,spanM:x1-x0,result});
   // Physical reactions from the characteristic distributed case, not from
   // the conservative all-load-on-one-plank resistance assumption.
   for(const a of loads.distributed){
    const physicalScale=1/loads.share,key=a.kind==='G'?'gkKn':a.id==='snow'?'snowKn':'qkKn';
    const totalPoint=(a.points||[]).reduce((s,point)=>s+point.pKn,0),moment=(a.points||[]).reduce((s,point)=>s+point.pKn*point.xM,0);
    const right=(moment/(x1-x0)+(a.qKnM||0)*(x1-x0)/2)*physicalScale;
    const total=(totalPoint+(a.qKnM||0)*(x1-x0))*physicalScale;
    reaction[bay][key]+=total-right;reaction[bay+1][key]+=right;
   }
  }
  supports.push(...reaction);
 }
 // Both adjoining spans bear on the same physical column head. Their
 // reactions must be added, not each allowed the full contact resistance.
 const share=p.equalSharing?1/p.beamCount:1,gammaM=p.beamGrade==='GL30c'?p.glulamGammaM??1.25:b.profile.gammaM;
 for(const support of supports){
  const g=action('dead','Permanent reaksjon ved stolpen','G','Sum fra begge tilstøtende dragerfelt',{nKn:support.gkKn*share});
  const q=action('occupancy','Fordelt nyttelast ved stolpen','Q',p.loadSource,{nKn:support.qkKn*share},p.livePsi);
  const point=action('occupancy-point','Punktlast direkte over opplegget','Q',p.loadSource,{nKn:p.pointKn*share},p.livePsi);
  const s=snow(p,{nKn:support.snowKn*share}),contactChecks=[];
  for(const actions of [[g,q,...s],...(p.pointKn>0?[[g,point,...s]]:[])])for(const c of loadCombinations(validateActions(actions,'column',Math.max(.1,p.heightM)),b.profile).filter(c=>c.limit==='ULS')){
   const resistance=b.beamMaterial.fc90MPa*timberFactors(p.serviceClass,c.duration).kmod/gammaM*p.beamWidthMm*p.bearingMm/1000;
   const demand=c.values.nKn,utilization=demand/resistance;
   contactChecks.push({id:'support-bearing',name:'Samlet oppleggstrykk fra tilstøtende felt',demand,resistance,unit:'kN',utilization,status:utilization<=1?'within':'exceeded',combinationId:c.id,reference:'EN 1995-1-1, 6.1.5; fysisk kontaktflate, kc,90 = 1; reaksjoner fra begge sider summeres'});
  }
  const governing=contactChecks.reduce((a,c)=>!a||c.utilization>a.utilization?c:a,null),result={checks:contactChecks,governing,notPerformed:[]};
  if(!collect&&peak(result)>1)return {passed:false};
  checks.push({role:'contact',yM:support.yM,xM:support.xM,spanM:0,result});
 }
 for(let i=0;i<ys.length-1;i++){const spanM=ys[i+1]-ys[i],result=analyzeTerraceJoist(p,b,spanM);if(!collect&&peak(result)>1)return {passed:false};checks.push({role:'joist',y0M:ys[i],y1M:ys[i+1],spanM,result});}
 return {passed:checks.every(c=>peak(c.result)<=1),rows,supports,wallReactions,checks};
}
export function designTerrace(input){
 const p=structuredClone(input),b=terraceLoadBasis(p),joistLimit=maximumJoistSpan(p,b);
 const ys=p.rowYs?axes(p.rowYs,p.depthM,'Dragerlinjer'):evenly(p.depthM,Math.ceil(p.depthM/joistLimit.limitM));
 if(ys.length>30)throw Error('Del terrassen i mindre beregningsfelt.');
 let xs=p.supportXs?axes(p.supportXs,p.lengthM,'Stolperekker'):null;
 if(!xs){for(let n=1;n<=Math.min(49,Math.floor(p.lengthM/.1));n++){const candidate=evenly(p.lengthM,n);if(evaluatePlan(p,b,ys,candidate,{collect:false}).passed){xs=candidate;break;}}}
 const automaticPlanFound=Boolean(xs);
 if(!xs)xs=evenly(p.lengthM,Math.max(1,Math.ceil(p.lengthM/joistLimit.limitM)));
 if(xs.length*ys.length>400)throw Error('Planen har mer enn 400 støttepunkter. Del terrassen.');
 const analysis=evaluatePlan(p,b,ys,xs),notPerformed=[...new Set(analysis.checks.flatMap(c=>c.result.notPerformed))];
 if(!automaticPlanFound)notPerformed.push('Fant ingen bestått plan med like støtteavstander. Skissen viser felt som må endres; kontroller oppleggstrykk, kontaktlengde og lastdeling.');
 if(p.snowStatus==='unknown')notPerformed.push('Snølast på terrassen er ikke avklart. Den er ikke satt til null i kontrollomfanget.');
 if(p.snowStatus==='not_applicable'&&!p.snowSource?.trim())notPerformed.push('Dokumenter hvorfor snølast ikke er aktuell.');
 if(p.beamCount>1&&!p.equalSharing)notPerformed.push('Lastdeling i dobbel/flerdelt drager er ikke dokumentert: hver planke er kontrollert for hele lasten.');
 const boardSpacing=({21:400,28:600,34:800})[p.deckThicknessMm];
 if(!boardSpacing||b.actualSpacingM*1000>boardSpacing+eps)notPerformed.push('Bordtykkelse og c/c må kontrolleres mot produktets anvisning. Veiledningen for impregnerte bord angir 21/400, 28/600 og 34/800 mm.');
 const beamChecks=analysis.checks.filter(c=>c.role==='beam'),gTotal=b.deckKnM2*p.lengthM*p.depthM+b.joistWeightKnM*b.joistXs.length*p.depthM+b.beamWeightKnM*p.beamCount*p.lengthM*analysis.rows.filter(r=>r.type==='beam').length;
 const sum=key=>[...analysis.supports,...analysis.wallReactions].reduce((s,r)=>s+r[key],0);
 return {version:1,kind:'terrace_span_design',input:p,status:!analysis.passed?'exceeded':notPerformed.length?'preliminary':'within_member_scope',joistLimit,largestBeamSpanM:analysis.passed?Math.max(...beamChecks.map(c=>c.spanM)):null,rowYs:ys,supportXs:xs,...analysis,loadBasis:{...b,profile:b.profile},notPerformed,beamRowCount:analysis.rows.filter(r=>r.type==='beam').length,supportCount:analysis.supports.length,joistCount:b.joistXs.length,beamBayM:Math.max(...ys.slice(1).map((y,i)=>y-ys[i])),columnBayM:Math.max(...xs.slice(1).map((x,i)=>x-xs[i])),equilibrium:{gExpectedKn:gTotal,gReactionKn:sum('gkKn'),qExpectedKn:p.liveKnM2*p.lengthM*p.depthM,qReactionKn:sum('qkKn'),snowReactionKn:sum('snowKn')},assumptions:['Rektangulær terrasse uten utkraging. Hvert felt er enkelt opplagt; skjøter ligger på opplegg.','Bjelkenes punktreaksjoner føres til dragerne; dragerne fordeler reaksjonene til støttepunktene.','Fordelt nyttelast og konsentrert nyttelast kontrolleres som separate alternativer.','Dragerplanker kontrolleres hver for seg, uten å anta et massivt samvirketverrsnitt.'],required:['Stolpenes knekkelengder, kapasitet og avstivning må kontrolleres med reaksjonene fra planen.','Forbindelser, fundament, rekkverkslast og global stabilitet må dokumenteres separat.'],sources:terraceSources};
}
