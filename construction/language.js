import {emptyContext,setFact,validateValue} from './context.js';
const n=s=>Number(s.replace(',','.'));
const numeric='(\\d+(?:[.,]\\d+)?)';
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
 detect(/(?:taksperre|sperrene|sperrer)/g,'memberRole','rafters');
 // Mentioning both rafters and joists does not assign a nominal size to either.
 detect(/bjelkelag|etasjeskiller/g,'memberRole','joists');
 for(const m of s.matchAll(/\b2\s*[x×]\s*([68])\b/g))put('nominalSection','2x'+m[1],m[0]);
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
 for(const m of s.matchAll(/(?:drager|bjelke)(?:n)?\s+(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm\b/g)){put('widthMm',Number(m[1]),m[0]);put('heightMm',Number(m[2]),m[0]);}
 for(const m of s.matchAll(/\b(c24|gl30c|s355)\b/g))put('material',({c24:'C24',gl30c:'GL30c',s355:'S355'})[m[1]],m[0]);
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
 return c;
}
