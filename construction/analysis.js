import {validateContext,fact} from './context.js';
import {buildLoadPath} from './load-path.js';
import {buildStructuralModel} from './load-engine.js';
import {solveBeam} from './beam-solver.js';
import {structuralChecks} from './checks.js';
const fmt=(n,d=2)=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:d}).format(n);
export function analyzeStructure(input){
 const context=validateContext(input),loadPath=buildLoadPath(context),model=buildStructuralModel(context);
 if(!model.ready)return {version:1,level:'qualitative',context,loadPath,model,beam:null,checks:null,findings:loadPath.findings};
 const beam=solveBeam(model),checks=structuralChecks(context,model,beam),findings=[];
 findings.push(...loadPath.findings.filter(f=>f.id!=='support_path'));
 findings.push({id:'load_result',text:'Med de oppgitte lastene bærer den modellerte drageren '+fmt(beam.totalN/1000)+' kN over '+fmt(beam.spanM)+' meter.'});
 const support=fact(context,'supportBelow');
 findings.push({id:'support_result',text:beam.system==='simple'?'Venstre ende får '+fmt(beam.reactions.leftN/1000)+' kN og høyre ende '+fmt(beam.reactions.rightN/1000)+' kN. '+(support==='unsupported'?'Du oppgir at støtte mangler. Lastveien under enden må løses.':'Disse punktlastene må føres videre til stendere, underliggende konstruksjon og fundament. Kapasiteten der er ikke kontrollert.'):'Innspenningen må ta '+fmt(beam.reactions.leftN/1000)+' kN vertikallast og '+fmt(beam.reactions.fixedMomentNm/1000)+' kNm moment. En vanlig opplagt ende gir ikke denne innspenningen.'});
 if(checks.deflection)findings.push({id:'deflection_result',text:'Øyeblikkelig nedbøyning er '+fmt(checks.deflection.actualMm)+' mm. Det er '+(checks.deflection.overLimit?'over':'under')+' den '+(checks.deflection.criterionStatus==='ASSUMED'?'foreløpige ':'oppgitte ')+'sammenligningsgrensen L/'+fmt(checks.deflection.ratio,0)+' ('+fmt(checks.deflection.limitMm)+' mm). Dette er ikke en kontroll av bæreevnen.'});
 else findings.push({id:'deflection_missing',text:'Moment og reaksjoner er beregnet. Nedbøyning venter på bekreftet dragerdimensjon og materialklasse.'});
 if(model.section&&beam.spanM/(model.section.heightMm/1000)<10)findings.push({id:'deep_beam',text:'Bjelken er kort i forhold til høyden. Skjærdeformasjon kan ha betydning; den enkle nedbøyningsmodellen omfatter ikke dette.'});
 findings.push({id:'scope',text:'Dette er en orienterende, lineær elastisk beregning for de oppgitte lastene. Ingen Eurocodekapasitet, opplegg eller fundament er godkjent.'});
 return {version:1,level:'orienting',context,loadPath,model,beam,checks,findings};
}
// AI can choose the emphasis among verified findings, but cannot supply new
// numbers, capacities or an approval. Every sentence below is engine-owned.
export function explainResult(analysis,focusId=null){
 const defaultId=fact(analysis.context,'supportBelow')==='unsupported'?(analysis.beam?'support_result':'support_path'):analysis.checks?.deflection?.overLimit?'deflection_result':analysis.beam?'support_result':'wall_path';
 const preferred=analysis.findings.find(f=>f.id===(focusId||defaultId))||analysis.findings[0];
 return {heading:analysis.level==='qualitative'?'Foreløpig vurdering':'Orienterende beregning',focusId:preferred?.id,paragraphs:preferred?[preferred.text,...analysis.findings.filter(f=>f.id!==preferred.id).map(f=>f.text)]:[]};
}
