import {fields,validateValue,labels} from './context.js';
export const interpretationFields=Object.keys(fields).filter(id=>!['unsupportedReason','sectionRequested','deflectionRatio','selfWeightInLoad','loadSource','loadBasis'].includes(id));
export function interpretationSchema(){
 return {type:'object',additionalProperties:false,required:['facts'],properties:{facts:{type:'array',maxItems:20,items:{anyOf:interpretationFields.map(id=>{
  const d=fields[id],value=d.type==='number'?{type:'number'}:d.type==='enum'?{type:'string',enum:d.values}:{type:'boolean'};
  return {type:'object',additionalProperties:false,required:['field','value','evidence'],properties:{field:{type:'string',enum:[id]},value,evidence:{type:'string'}}};
 })}}}};
}
export function validateInterpretation(input,brief){
 if(!input||Object.keys(input).some(k=>k!=='facts')||!Array.isArray(input.facts)||input.facts.length>20)throw Error('Ugyldig AI-tolkning.');
 const seen=new Set();const facts=input.facts.map(f=>{
  if(!f||Object.keys(f).some(k=>!['field','value','evidence'].includes(k))||!interpretationFields.includes(f.field)||seen.has(f.field)||typeof f.evidence!=='string'||f.evidence.trim().length<2||f.evidence.length>600||!brief.toLowerCase().includes(f.evidence.toLowerCase()))throw Error('AI-tolkningen mangler et entydig sitat.');
  seen.add(f.field);validateValue(f.field,f.value);
  if(typeof f.value==='number'){
   const values=[...f.evidence.matchAll(/\d+(?:[.,]\d+)?/g)].map(m=>Number(m[0].replace(',','.')));
   const unitScale=f.field==='spacingMm'&&(/\bcm\b/i.test(f.evidence)||! /\bmm\b/i.test(f.evidence)&&/c\s*\/?\s*c\s*60/i.test(f.evidence))?10:f.field.endsWith('M')&&/\bmm\b/i.test(f.evidence)?.001:f.field.endsWith('M')&&/\bcm\b/i.test(f.evidence)?.01:1;
   if(!values.some(v=>Math.abs(v*unitScale-f.value)<1e-8))throw Error('AI foreslo et tall som ikke finnes i den oppgitte informasjonen.');
  }
  if(f.field==='roofBearsOnWall'&&f.value==='yes'&&!/hviler|bærer|opplegg|støtt|ligger på/i.test(f.evidence))throw Error('Retning alene bekrefter ikke bæring.');
  if(f.field==='roofSnowKnM2'&&/bakken|marksnølast|snølast på mark/i.test(f.evidence))throw Error('Snølast på bakken er ikke snølast på taket.');
  return {...f,label:labels[f.field],status:'PROPOSED'};
 });return {facts};
}
// Keep independently evidenced facts when a different item is unsupported.
// An invalid root / oversized response still fails. No bad value is coerced.
export function reviewInterpretation(input,brief){
 if(!input||Object.keys(input).some(k=>k!=='facts')||!Array.isArray(input.facts)||input.facts.length>20)throw Error('Ugyldig AI-tolkning.');
 const facts=[],rejected=[],seen=new Set();
 for(const proposal of input.facts){
  try{
   const valid=validateInterpretation({facts:[proposal]},brief).facts[0];
   if(seen.has(valid.field))throw Error('Duplikat');
   if(valid.field==='goal'&&valid.value==='plan_terrace'&&!/terrass/i.test(valid.evidence))throw Error('Feil tema');
   if(valid.field==='goal'&&valid.value==='check_column'&&!/søyl|stolp/i.test(valid.evidence))throw Error('Feil tema');
   seen.add(valid.field);facts.push(valid);
  }catch{rejected.push(interpretationFields.includes(proposal?.field)?proposal.field:'unsupported');}
 }
 return {facts,rejectedFields:[...new Set(rejected)],partial:rejected.length>0};
}
export function focusSchema(ids){
 if(!ids.length)throw Error('Ingen beregnede funn å forklare.');
 return {type:'object',additionalProperties:false,required:['focusId'],properties:{focusId:{type:'string',enum:ids}}};
}
export function validateFocus(input,ids){if(!input||Object.keys(input).some(k=>k!=='focusId')||!ids.includes(input.focusId))throw Error('AI valgte et ukjent resultat.');return input.focusId;}
