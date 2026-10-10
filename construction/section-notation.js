// Section notation is input data. Recognising a designation does not establish
// its standard status, actual dressed dimensions, strength or composite action.
const fractionValues={'¼':.25,'½':.5,'¾':.75,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
const numberPattern='(?:\\d{1,3}\\s+\\d{1,2}\\s*/\\s*\\d{1,2}|\\d{1,2}\\s*/\\s*\\d{1,2}|\\d{0,3}[¼½¾⅛⅜⅝⅞]|\\d{1,6}(?:[.,]\\d{1,6})?)';
const inchPattern='(?:["″“”]|\'\'|tommer|tommers|inch(?:es)?)';
const unitPattern='(?:'+inchPattern+'|mm|millimeter|cm|centimeter|m|meter)';
const separator='(?:[x×✕*]|ganger)';
function number(s){
 s=s.trim().replace(',','.');
 const vulgar=s.match(/^([0-9]*)([¼½¾⅛⅜⅝⅞])$/);if(vulgar)return Number(vulgar[1]||0)+fractionValues[vulgar[2]];
 const fraction=s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);if(fraction)return Number(fraction[1]||0)+Number(fraction[2])/Number(fraction[3]);
 return Number(s);
}
function unit(s){return !s?null:/^(?:mm|millimeter)$/i.test(s)?'mm':/^(?:cm|centimeter)$/i.test(s)?'cm':/^(?:m|meter)$/i.test(s)?'m':'inch';}
const fmt=n=>String(Math.round(n*1e6)/1e6);
export function readProfileNotations(text){
 const out=[],pattern=/\b(IPE(?:\s*[AO](?=\s*\d))?|IPN|HEA|HEB|HEM|UPN|UPE|UNP|RHS|SHS|CHS|HUP|UB|UC|SIGMA|Z|C|L|T)\s*(\d{1,4}(?:[.,]\d+)?(?:\s*[x×✕*]\s*\d{1,4}(?:[.,]\d+)?){0,2})(?:\s*mm\b)?/gi;
 for(const m of text.matchAll(pattern)){
  if(/^[\w]|^[.,]\d/.test(text.slice(m.index+m[0].length)))continue;
  if(readMaterialDesignations(m[0]).some(g=>g.evidence.length===m[0].length)&&!/(?:profil|rør)\s*$/i.test(text.slice(0,m.index)))continue;
  out.push({kind:'profile',value:m[1].toUpperCase().replace(/\s+/g,'')+' '+m[2].replace(/\s+/g,'').replace(/[×✕*]/g,'x').replace(/,/g,'.'),evidence:m[0],index:m.index,end:m.index+m[0].length});
 }
 for(const m of text.matchAll(/\bHE\s*(\d{1,4})\s*([ABM])\b/gi))out.push({kind:'profile',value:'HE'+m[2].toUpperCase()+' '+m[1],evidence:m[0],index:m.index,end:m.index+m[0].length});
 // Keep unfamiliar catalogue designations when the user explicitly says
 // "profil". They remain profiles needing documentation, not solid sections.
 for(const m of text.matchAll(/\bprofil\s+([a-z]{1,12})\s*(\d{1,4}(?:[.,]\d+)?(?:\s*[x×✕*]\s*\d{1,4}(?:[.,]\d+)?){0,2})\b/gi)){
  if(out.some(p=>p.index>=m.index&&p.index<m.index+m[0].length))continue;
  out.push({kind:'profile',value:m[1].toUpperCase()+' '+m[2].replace(/\s+/g,'').replace(/[×✕*]/g,'x').replace(/,/g,'.'),evidence:m[0],index:m.index,end:m.index+m[0].length});
 }
 return out.sort((a,b)=>a.index-b.index);
}
export function readSectionNotations(text){
 const profiles=readProfileNotations(text),out=[];
 const pattern=new RegExp('(?<![\\w/.,-])('+numberPattern+')\\s*('+unitPattern+')?\\s*'+separator+'\\s*('+numberPattern+')\\s*('+unitPattern+')?(?:\\s*'+separator+'\\s*('+numberPattern+')\\s*('+unitPattern+')?)?(?![\\w/]|[.,]\\d)','gi');
 for(const m of text.matchAll(pattern)){
  if(profiles.some(p=>m.index>=p.index&&m.index<p.end))continue;
  // A dimension chain must never be shortened to a two-part solid section.
  const before=text.slice(0,m.index),after=text.slice(m.index+m[0].length);
  if(new RegExp(separator+'\\s*$','i').test(before)||new RegExp('^\\s*'+separator+'\\s*'+numberPattern,'i').test(after))continue;
  let sides=[number(m[1]),number(m[3]),...(m[5]?[number(m[5])]:[])];
  const sideUnits=[unit(m[2]),unit(m[4]),unit(m[6])],units=sideUnits.filter(Boolean);
  if(sides.some(n=>!Number.isFinite(n)||n<=0||n>999999))continue;
  let explicitUnit=units[0]||null;
  if(new Set(units).size>1){
   if(sides.length!==2||units.includes('inch'))continue;
   const scale={mm:1,cm:10,m:1000};sides=sides.map((n,i)=>n*scale[sideUnits[i]||explicitUnit]);explicitUnit='mm';
  }
  const nominal=sides.length===2&&(explicitUnit==='inch'||!explicitUnit&&sides.every(n=>n<=24));
  out.push({kind:sides.length===3?'compound':nominal?'nominal':explicitUnit?'metric':'unspecified',value:sides.map(fmt).join('x')+(explicitUnit&&(!nominal||explicitUnit!=='inch')?' '+explicitUnit:''),sides,unit:explicitUnit,evidence:m[0].trimEnd(),index:m.index,end:m.index+m[0].trimEnd().length});
 }
 return out;
}
export function metricDimensions(section,confirmedUnit=section.unit){
 const scale=({mm:1,cm:10,m:1000})[confirmedUnit];return scale&&section.sides.length===2?{widthMm:section.sides[0]*scale,heightMm:section.sides[1]*scale}:null;
}
export function canonicalNominal(text){const m=readSectionNotations(text);return m.length===1&&m[0].sides.length===2&&(!m[0].unit||m[0].unit==='inch')&&m[0].evidence.length===text.trim().length?m[0].value:null;}
export function canonicalSection(text){const m=readSectionNotations(text);return m.length===1&&m[0].kind!=='nominal'&&m[0].evidence.length===text.trim().length?m[0].value:null;}
export function canonicalProfile(text){let m=readProfileNotations(text);if(!m.length)m=readProfileNotations('profil '+text);return m.length===1&&(m[0].evidence.length===text.trim().length||m[0].evidence==='profil '+text.trim())?m[0].value:null;}
export function readMaterialDesignations(text){
 return [...text.matchAll(/\b(?:GL\d{2}[ch]|C\d{2}(?:\/\d{2})?|D\d{2}|S\d{3}(?:JR|J0|J2|K2|NL|N)?|B\d{3}(?:NC|NA|NB|[A-C])?)\b/gi)].map(m=>({value:/^gl/i.test(m[0])?m[0].toUpperCase().replace(/[CH]$/,c=>c.toLowerCase()):m[0].toUpperCase(),evidence:m[0]}));
}
export function canonicalMaterial(text){const m=readMaterialDesignations(text);return m.length===1&&m[0].evidence.length===text.trim().length?m[0].value:null;}
