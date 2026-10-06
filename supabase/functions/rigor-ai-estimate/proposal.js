export function extractMeasurements(brief){
 const text=brief.toLocaleLowerCase('nb');const areaMatches=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:m²(?![a-zæøå0-9])|m2\b|kvadratmeter\b)/g)].map(m=>Number(m[1].replace(',','.')));
 const angles=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:grader\b|°)/g)].map(m=>Number(m[1].replace(',','.')));
 const shapes={flat:/\bflatt\s+tak\b/,shed:/\bpulttak\b/,gable:/\bsaltak\b/,hip:/\bvalmtak\b/,mansard:/\bmansardtak\b/};const matched=Object.entries(shapes).filter(([,re])=>re.test(text));
 return {area:areaMatches.length===1&&areaMatches[0]>0&&areaMatches[0]<=100000?areaMatches[0]:null,angle:angles.length===1&&angles[0]>=0&&angles[0]<=75?angles[0]:null,roofType:matched.length===1?matched[0][0]:null,basis:/\b(horisontalt|projisert|grunnflate)\b/.test(text)?'footprint':/\b(takflate|overflate|målt)\b/.test(text)?'surface':null};
}
export function shortlist(brief,catalog){
 const text=brief.toLocaleLowerCase('nb');
 if(/\b(tak|saltak|pulttak|valmtak|mansardtak|takstein|sutak|undertak|sløyfer|sløfyer|takrenner|vannrenner)\b/.test(text))return catalog.filter(e=>e.id.startsWith('roof.')||e.id.startsWith('rig.')||/vindsk|renne|nedløp/i.test(e.name));
 if(/\b(etterisolere|etterisolering|isolasjon|yttervegg|kledning)\b/.test(text))return catalog.filter(e=>/^(insulation|wall|cladding|opening|rig)\./.test(e.id));
 const words=text.match(/[a-zæøå]{4,}/g)||[];return catalog.map(e=>({e,score:words.filter(w=>(e.name+' '+e.category+' '+e.description).toLocaleLowerCase('nb').includes(w)).length})).sort((a,b)=>b.score-a.score).slice(0,80).map(v=>v.e);
}
export function validateProposal(value,allowed){
 if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='items,questions,summary'||typeof value.summary!=='string'||value.summary.length>1500||!Array.isArray(value.items)||value.items.length>30||!Array.isArray(value.questions)||value.questions.length>20||value.questions.some(q=>typeof q!=='string'||q.length>500))throw Error('Ugyldig AI-forslag');
 const seen=new Set();for(const item of value.items){if(!item||Object.keys(item).sort().join(',')!=='elementId,reason,scope,taskIds'||!['requested','related','optional'].includes(item.scope)||typeof item.reason!=='string'||item.reason.length>500||!Array.isArray(item.taskIds)||!item.taskIds.length||new Set(item.taskIds).size!==item.taskIds.length||seen.has(item.elementId))throw Error('Ugyldige oppgaver i AI-forslaget');const e=allowed.find(e=>e.id===item.elementId);if(!e||item.taskIds.some(id=>!e.tasks.some(t=>t.id===id)))throw Error('AI foreslo en oppgave utenfor biblioteket');seen.add(item.elementId);}
 return value;
}
