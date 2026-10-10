import {emptyContext,setFact,validateValue} from './context.js';
import {readSectionNotations,readProfileNotations,readMaterialDesignations,metricDimensions} from './section-notation.js';
const n=s=>Number(s.replace(',','.'));
const numeric='(\\d+(?:[.,]\\d+)?)';
const memberNames={
 rafters:'(?:taksperr|sperr)(?:e|en|er|ene)',
 joists:'bjelkelag(?:et)?|etasjeskiller(?:en)?|(?:gulv|terrasse)bjelk(?:e|en|er|ene)',
 column:'(?:(?:tre|limtre|betong|stål)\\s*)?(?:(?:vertikale?|stående)\\s*)?(?:søyl(?:e|en|er|ene)|stolp(?:e|en|er|ene)|stend(?:er|eren|ere|erne))',
 beam:'(?:(?:limtre|betong|stål)\\s*)?(?:drager(?:en|e|ne)?|bjelk(?:e|en|er|ene))'
};
// Bind a nominal size only to an adjacent, explicitly named member. Merely
// asking whether a new beam is needed does not assign the wall studs to it.
export function sectionMentions(brief){
 const s=brief.toLowerCase(),mentions=[],link='(?:\\s+(?:av|i|på|med|er|dimensjon(?:en)?))*\\s*';
 for(const m of [...readSectionNotations(brief),...readProfileNotations(brief)].sort((a,b)=>a.index-b.index)){
  const before=s.slice(0,m.index).match(/[^.!?;,\n]*$/)[0].slice(-60),after=s.slice(m.end).match(/^[^.!?;,\n]*/)[0].slice(0,60),roles=[];
  for(const [role,name]of Object.entries(memberNames)){
   const left=before.match(new RegExp('\\b(?:'+name+')'+link+'$')),right=after.match(new RegExp('^'+link+'(?:'+name+')\\b'));
   if(left||right)roles.push({value:role,evidence:(left?.[0]||'')+m.evidence+(right?.[0]||'')});
  }
  // Room/deck plan dimensions are not automatically timber sections.
  if(!roles.length&&/\b(?:terrasse|rom|hus|flate|areal)(?:n|et|ns)?\s*(?:på|er|med)?\s*$/i.test(before))continue;
  mentions.push({...m,roles});
 }
 return mentions;
}
export function nominalSectionMentions(brief){return sectionMentions(brief).filter(m=>m.kind==='nominal');}
export function applySectionDimensions(c){
 c=structuredClone(c);
 for(const id of ['widthMm','heightMm'])if(c.facts[id]?.source.startsWith('Oppgitt tverrsnitt:'))delete c.facts[id];
 const value=c.facts.sectionNotation?.value,role=c.facts.memberRole?.value;
 if(!value||['profile','multiple_members'].includes(c.facts.sectionConstruction?.value)||!['beam','column'].includes(role)||role==='column'&&c.facts.goal?.value!=='check_column')return c;
 const section=readSectionNotations(value)[0],u=section?.unit||c.facts.sectionUnit?.value,dims=section&&metricDimensions(section,u);
 if(!dims)return c;
 // Only fill missing actual dimensions; explicit conflicting measurements
 // remain for the normal conflict/confirmation flow.
 for(const [id,value]of Object.entries(dims))if(!c.facts[id]&&!c.conflicts[id])try{c=setFact(c,id,value,'Oppgitt tverrsnitt: '+section.value+'; enhet '+u);}catch{}
 return c;
}
export function applySectionAnswer(c,id,value){
 c=setFact(c,id,value);
 if(id==='sectionNotation'){
  const m=readSectionNotations(value)[0];
  if(m?.unit)c=setFact(c,'sectionUnit',m.unit);
  else{delete c.facts.sectionUnit;c.unknowns=c.unknowns.filter(k=>k!=='sectionUnit');}
 }
 if(id==='sectionUnit'&&c.facts.sectionNotation&&value!=='unknown'){
  const m=readSectionNotations(c.facts.sectionNotation.value)[0];
  if(value==='inch'&&m.sides.length===2){c=setFact(c,'nominalSection',m.sides.join('x'));delete c.facts.sectionNotation;delete c.facts.sectionUnit;}
  else c=setFact(c,'sectionNotation',m.sides.join('x')+' '+value);
 }
 if(id==='materialDesignation'){
  if(['C24','GL30c','S355'].includes(value))c=setFact(c,'material',value,'Bekreftet materialbetegnelse: '+value);
  else delete c.facts.material;
 }
 return applySectionDimensions(c);
}
// Deliberately narrow rules: a measurement must name its member and its unit.
// Broader AI interpretations remain proposals until the user confirms them.
export function interpretDescription(brief){
 let c=emptyContext(brief);const s=brief.toLowerCase();
 function put(id,value,evidence){
  try{validateValue(id,value);}catch{return;}
  if(c.conflicts[id]){if(!c.conflicts[id].includes(value))c.conflicts[id].push(value);return;}
  if(c.facts[id]&&c.facts[id].value!==value){c.conflicts[id]=[c.facts[id].value,value];delete c.facts[id];return;}
  c=setFact(c,id,value,'Beskrivelsen: «'+evidence+'»');
 }
 const detect=(re,id,value)=>{for(const m of s.matchAll(re))put(id,value,m[0]);};
 for(const m of s.matchAll(/(?:fjerne|fjern|rive|riv|ta bort|åpne)[^\n]{0,70}vegg|(?:åpning|fjerning)[^\n]{0,45}vegg/g))if(!/\bikke\b/.test(s.slice(Math.max(0,m.index-12),m.index+m[0].length)))put('goal','remove_wall',m[0]);
 detect(/(?:holder|kontrollere|undersøke|sjekke)[^.\n]{0,45}(?:bjelk|drager)/g,'goal','check_beam');
 if(/terrasse/.test(s)&&/hvor|antall|hvor mange|plass|trenger|dragere|stolp|søyler|støtter/.test(s))put('goal','plan_terrace','Terrasse med spørsmål om bæring og plassering');
 else detect(/(?:beregne|kontrollere|undersøke|sjekke)[^.\n]{0,45}(?:søyl|stolp)/g,'goal','check_column');
 for(const [id,phrase]of [['terraceLengthM','terrassens lengde'],['terraceDepthM','terrassens dybde'],['terraceHeightM','høyde over terreng']])for(const m of s.matchAll(new RegExp('(?:'+phrase+')(?: er| på)?\\s*'+numeric+'\\s*(?:meter|m)\\b','g')))put(id,n(m[1]),m[0]);
 detect(/saltak/g,'roofType','gable');detect(/pulttak/g,'roofType','mono');detect(/valmtak/g,'roofType','hip');detect(/flatt tak/g,'roofType','flat');
 const sections=sectionMentions(brief),roles=sections.flatMap(m=>m.roles);
 if(roles.length)for(const role of roles)put('memberRole',role.value,role.evidence);
 else{
  // Without an explicit size/member association, competing roles stay unclear.
  detect(/(?:taksperre|sperrene|sperrer)/g,'memberRole','rafters');
  detect(/bjelkelag|etasjeskiller/g,'memberRole','joists');
  detect(new RegExp('\\b(?:'+memberNames.column+')\\b','g'),'memberRole','column');
 }
 for(const m of sections){
  if(m.kind==='nominal')put('nominalSection',m.value,m.evidence);
  else if(m.kind==='profile'){put('profileDesignation',m.value,m.evidence);put('sectionConstruction','profile',m.evidence);}
  else{put('sectionNotation',m.value,m.evidence);if(m.unit)put('sectionUnit',m.unit,m.evidence);}
  if(m.roles.some(r=>r.value==='beam')&&(/\b(?:dobbel|dobbelte|to|tre)\s*$/i.test(s.slice(0,m.index))||m.kind==='compound'&&m.sides[0]>=2&&m.sides[0]<=20&&Number.isInteger(m.sides[0])))put('sectionConstruction','multiple_members',m.evidence);
 }
 for(const m of s.matchAll(/(?:c\s*\/\s*c|cc|c\/c)\s*(\d{2,4})(?:\s*(mm|cm))?\b/g))put('spacingMm',Number(m[1])*(m[2]==='cm'||!m[2]&&Number(m[1])<100?10:1),m[0]);
 for(const m of s.matchAll(new RegExp('(?:takvinkel(?:en)?(?: er| på)?|med)\\s*'+numeric+'\\s*(?:grader|°)','g')))put('roofAngleDeg',n(m[1]),m[0]);
 for(const m of s.matchAll(new RegExp('(?:åpning(?:en)?(?: på| er| skal være)?|fjerne(?:r)?(?: ca\\.?| omtrent)?|fjerne\\s+(?:ca\\.?\\s*)?)\\s*'+numeric+'\\s*(?:meter|m)\\b','g')))put('openingM',n(m[1]),m[0]);
 for(const [id,re] of [
  ['spanM',new RegExp('(?:drager|bjelke)(?:n)?[^.\\n]{0,18}spenn(?:er)?(?: på| er)?\\s*'+numeric+'\\s*(?:meter|m)\\b','g')],
  ['rafterSpanM',new RegExp('(?:sperre(?:ne|r)?|sperrespenn)[^.\\n]{0,18}(?:spenn(?:er)?(?: på| er)?\\s*)?'+numeric+'\\s*(?:meter|m)\\b','g')],
  ['lineLoadKnM',new RegExp('(?:jevn(?:t fordelt)? last|linjelast|last langs (?:drager|bjelke)(?:n)?)(?: på| er)?\\s*'+numeric+'\\s*kn\\s*\\/\\s*m(?![²2])\\b','g')],
  ['pointLoadKn',new RegExp('punktlast(?: på| er)?\\s*'+numeric+'\\s*kn\\b','g')],
  ['pointPositionM',new RegExp('punktlast[^.\\n]{0,35}'+numeric+'\\s*m(?:eter)?\\s*fra (?:venstre|innspent) (?:ende|opplegg)','g')]
 ])for(const m of s.matchAll(re))put(id,n(m[1]),m[0]);
 const grades=readMaterialDesignations(brief),differentGrades=new Set(grades.map(m=>m.value));
 for(const m of grades){
  if(differentGrades.size===1&&['C24','GL30c','S355'].includes(m.value))put('material',m.value,m.evidence);
  else put('materialDesignation',m.value,m.evidence);
 }
 detect(/\b(?:ipe|hea|heb|hem|rhs|shs)\s*\d+\b|hulprofil|i-profil|h-profil/g,'sectionConstruction','profile');
 detect(/dobbel(?:t)?\s*(?:bjelke|drager)|to sammen(?:satte|skrudde) bjelker/g,'sectionConstruction','multiple_members');
 detect(/sperr[^.\n]{0,35}(?:går|ligger)[^.\n]{0,15}(?:på )?tvers[^.\n]{0,20}vegg/g,'direction','across');
 detect(/sperr[^.\n]{0,35}(?:går|ligger)[^.\n]{0,15}(?:parallelt|langs)[^.\n]{0,20}vegg/g,'direction','parallel');
 detect(/(?:tre|fire|[3-9]) (?:stolper|opplegg|støtter)/g,'system','continuous');
 detect(/utkrager|utkraget|fast innspent i (?:en|én|venstre) ende/g,'system','cantilever');
 detect(/fritt opplagt|opplegg i begge ender/g,'system','simple');
 if(/\bramme\b|portalramme/.test(s))put('system','frame','ramme');
 if((s.match(/punktlast/g)||[]).length>1)put('unsupportedReason','Flere punktlaster må spesifiseres i en utvidet modell.','Flere punktlaster');
 if(/vindlast|horisontallast|oppoverrettet|jordtrykk|torsjon/.test(s))put('unsupportedReason','Første versjon dekker vertikale laster nedover. Vind, horisontallast, jordtrykk, løft og torsjon krever en utvidet modell.','Andre lastretninger');
 if(c.facts.lineLoadKnM&&!c.facts.loadChoice)c=setFact(c,'loadChoice',c.facts.pointLoadKn?'mixed':'line','Uttrykkelig oppgitte lasttyper');
 else if(c.facts.pointLoadKn&&!c.facts.loadChoice)c=setFact(c,'loadChoice','point','Uttrykkelig oppgitt punktlast');
 return applySectionDimensions(c);
}
