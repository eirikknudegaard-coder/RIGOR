import {municipalityMentions} from './municipalities.js';
import {fields,validateValue,labels} from './context.js';
import {sectionMentions} from './language.js';
import {readSectionNotations,readProfileNotations,readMaterialDesignations,metricDimensions} from './section-notation.js';
export const interpretationFields=Object.keys(fields).filter(id=>!['unsupportedReason','sectionRequested','deflectionRatio','selfWeightInLoad','loadSource','loadBasis','siteArea'].includes(id));
export function interpretationSchema(){
 return {type:'object',additionalProperties:false,required:['facts'],properties:{facts:{type:'array',maxItems:20,items:{anyOf:interpretationFields.map(id=>{
  const d=fields[id],value=d.type==='number'?{type:'number'}:d.type==='enum'?{type:'string',enum:d.values}:d.type==='text'?{type:'string'}:{type:'boolean'};
  return {type:'object',additionalProperties:false,required:['field','value','evidence'],properties:{field:{type:'string',enum:[id]},value,evidence:{type:'string'}}};
 })}}}};
}
export function validateInterpretation(input,brief){
 if(!input||Object.keys(input).some(k=>k!=='facts')||!Array.isArray(input.facts)||input.facts.length>20)throw Error('Ugyldig AI-tolkning.');
 const sectionRoles=[...new Set(sectionMentions(brief).flatMap(m=>m.roles.map(r=>r.value)))];
 const seen=new Set();const facts=input.facts.map(f=>{
  if(!f||Object.keys(f).some(k=>!['field','value','evidence'].includes(k))||!interpretationFields.includes(f.field)||seen.has(f.field)||typeof f.evidence!=='string'||f.evidence.trim().length<2||f.evidence.length>600||!brief.toLowerCase().includes(f.evidence.toLowerCase()))throw Error('AI-tolkningen mangler et entydig sitat.');
  seen.add(f.field);validateValue(f.field,f.value);
  if(f.field==='siteMunicipality'&&(new Set(municipalityMentions(f.evidence).map(m=>m.id)).size!==1||!municipalityMentions(f.evidence).some(m=>m.id===f.value)))throw Error('Kommunen finnes ikke entydig i sitatet.');
  if(f.field==='weatherActions'&&!(f.value==='snow'?/snølast/i.test(f.evidence):f.value==='wind'?/vindlast|vindtrykk/i.test(f.evidence):/snø/i.test(f.evidence)&&/vind/i.test(f.evidence)))throw Error('Lasttemaet finnes ikke i sitatet.');
  if(f.field==='siteTerrain'&&!({0:/åpent hav/i,I:/kyst|åpent vann|uten trær/i,II:/landbruk|spredte små/i,III:/skog|småhus|industri/i,IV:/tett by|byområde|15 m/i})[f.value]?.test(f.evidence))throw Error('Terrengkategorien må beskrives uttrykkelig.');
  if(f.field==='siteTopography'&&!({flat:/flat|svakt hellende/i,hill:/ås|fjellrygg/i,escarpment:/skrent|trang dal/i})[f.value]?.test(f.evidence))throw Error('Terrengformen må beskrives uttrykkelig.');
  if(f.field==='siteTerrainTransition'&&!({yes:/terrengovergang|overgang fra/i,no:/ingen terrengovergang|samme terrengtype/i})[f.value]?.test(f.evidence))throw Error('Ruhetsovergangen er ikke dokumentert i sitatet.');
  if(f.field==='siteAltitudeM'&&!/moh|m\.?o\.?h\.?|over havet/i.test(f.evidence))throw Error('Byggehøyde er ikke høyde over havet.');
  if(f.field==='buildingHeightM'&&(!/bygge?høyde|byggets høyde|bygget er[^.]{0,30}høyt/i.test(f.evidence)||/moh|m\.?o\.?h\.?|over havet/i.test(f.evidence)))throw Error('Referansehøyde for bygget er ikke oppgitt.');
  if(f.field==='nominalSection'&&!readSectionNotations(f.evidence).some(m=>m.kind==='nominal'&&m.value===f.value))throw Error('AI foreslo en annen nominell dimensjon enn sitatet oppgir.');
  if(f.field==='sectionNotation'&&!readSectionNotations(f.evidence).some(m=>m.kind!=='nominal'&&m.value===f.value))throw Error('AI endret det oppgitte tverrsnittet.');
  if(f.field==='profileDesignation'&&!readProfileNotations(f.evidence).some(m=>m.value===f.value))throw Error('AI endret den oppgitte profilen.');
  if(f.field==='materialDesignation'&&!readMaterialDesignations(f.evidence).some(m=>m.value===f.value))throw Error('AI endret den oppgitte materialbetegnelsen.');
  if(f.field==='material'&&!readMaterialDesignations(f.evidence).some(m=>m.value===f.value))throw Error('AI endret den oppgitte materialklassen.');
  if(f.field==='sectionUnit'&&!readSectionNotations(f.evidence).some(m=>m.unit===f.value))throw Error('Enheten er ikke oppgitt.');
  if(f.field==='memberRole'&&sectionRoles.length===1&&f.value!==sectionRoles[0])throw Error('AI flyttet dimensjonen til en annen konstruksjonsdel.');
  if(f.field==='sectionConstruction'&&f.value==='multiple_members'&&!/bjelk|drager/i.test(f.evidence))throw Error('Doble stendere er ikke en sammensatt drager.');
  if(typeof f.value==='number'){
   const metric=readSectionNotations(f.evidence).filter(m=>m.kind==='metric');
   if(['widthMm','heightMm'].includes(f.field)&&metric.length){
    if(!metric.some(m=>metricDimensions(m)?.[f.field]===f.value))throw Error('AI endret dimensjonen eller enheten.');
    const wall=sectionMentions(brief).some(m=>m.roles.some(r=>r.value==='column'))&&/fjerne|rive|åpning/i.test(brief);
    if(wall&&!sectionMentions(f.evidence).some(m=>m.roles.some(r=>r.value==='beam')))throw Error('Eksisterende stendere angir ikke målene på en ny drager.');
   }else{
   const values=[...f.evidence.matchAll(/\d+(?:[.,]\d+)?/g)].map(m=>Number(m[0].replace(',','.')));
   const unitScale=f.field==='spacingMm'&&(/\bcm\b/i.test(f.evidence)||! /\bmm\b/i.test(f.evidence)&&/c\s*\/?\s*c\s*60/i.test(f.evidence))?10:f.field.endsWith('M')&&/\bmm\b/i.test(f.evidence)?.001:f.field.endsWith('M')&&/\bcm\b/i.test(f.evidence)?.01:1;
   if(!values.some(v=>Math.abs(v*unitScale-f.value)<1e-8))throw Error('AI foreslo et tall som ikke finnes i den oppgitte informasjonen.');
   }
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
