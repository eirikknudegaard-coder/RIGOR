export function extractMeasurements(brief){
 const text=brief.toLocaleLowerCase('nb');const areaMatches=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:m²(?![a-zæøå0-9])|m2\b|kvadratmeter\b)/g)].map(m=>Number(m[1].replace(',','.')));
 const angles=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:grader\b|°)/g)].map(m=>Number(m[1].replace(',','.')));
 const labelledArea=[...text.matchAll(/(?:^|\n)takareal:\s*(\d+(?:[.,]\d+)?)\s*m[²2]/g)].at(-1);
 const terraceArea=!/\b(tak|saltak|pulttak|valmtak|mansardtak|yttervegg|kledning)\b/.test(text)?[...text.matchAll(/(?:^|\n)terrasseareal:\s*(\d+(?:[.,]\d+)?)\s*m[²2]/g)].at(-1):null;
 const labelledAngle=[...text.matchAll(/(?:^|\n)takvinkel:\s*(\d+(?:[.,]\d+)?)\s*grader/g)].at(-1);
 const shapeLabel=[...text.matchAll(/(?:^|\n)taktype:\s*([^\n]+)/g)].at(-1);
 const basisLabel=[...text.matchAll(/(?:^|\n)arealgrunnlag:\s*([^\n]+)/g)].at(-1);
 const shapes={flat:/\bflatt\s+tak\b/,shed:/\bpulttak\b/,gable:/\bsaltak\b/,hip:/\bvalmtak\b/,mansard:/\bmansardtak\b/};const matched=Object.entries(shapes).filter(([,re])=>re.test(shapeLabel?.[1]||text));
 const areaLabel=terraceArea||labelledArea;const areas=areaLabel?[Number(areaLabel[1].replace(',','.'))]:areaMatches,angleValues=labelledAngle?[Number(labelledAngle[1].replace(',','.'))]:angles;
 const basisText=basisLabel?.[1]||text;
 return {area:areas.length===1&&areas[0]>0&&areas[0]<=100000?areas[0]:null,angle:angleValues.length===1&&angleValues[0]>=0&&angleValues[0]<=75?angleValues[0]:null,roofType:matched.length===1?matched[0][0]:null,basis:/\b(horisontalt|projisert|grunnflate)\b/.test(basisText)?'footprint':/\b(takflate|overflate|målt)\b/.test(basisText)?'surface':null};
}

// Ask ordinary specification questions before spending tokens on a work list.
// Shared with the server so an omitted question cannot disappear from a proposal.
export function clarificationQuestions(brief){
 const text=brief.toLocaleLowerCase('nb'),m=extractMeasurements(brief),questions=[];
 const roof=/\b(tak|saltak|pulttak|valmtak|mansardtak|takstein|sutak|undertak)\b/.test(text);
 const cladding=/\b(kledning|trekledning|ytterkledning|fasadeplater|dobbelfals|enkelfals)\b/.test(text);
 const choice=(id,label,prefix,options)=>questions.push({id,label,prefix,type:'select',options});
 const number=(id,label,prefix,unit,min,max)=>questions.push({id,label,prefix,unit,type:'number',min,max});
 if(roof){
  if(!m.roofType)choice('roof-type','Hvilken taktype har bygget?','Taktype',['Saltak','Pulttak','Flatt tak','Valmtak','Mansardtak']);
  if(m.roofType==='mansard'){
   for(const [key,label] of [['lower','Nedre'],['upper','Øvre']])if(!new RegExp(label.toLowerCase()+' takvinkel:\\s*\\d+(?:[.,]\\d+)?\\s*grader').test(text))number('roof-angle-'+key,'Hva er '+label.toLowerCase()+' takvinkel? (grader)',label+' takvinkel','grader',0,75);
  }else if(m.angle===null)number('roof-angle','Hva er takvinkelen? (grader)','Takvinkel','grader',0,75);
  if(m.area===null)number('roof-area','Hvor stort er taket? (m²)','Takareal','m²',0.01,100000);
  if(!m.basis)choice('roof-basis','Gjelder arealet selve takflaten eller horisontal grunnflate?','Arealgrunnlag',['Målt takflate','Horisontal grunnflate']);
  if(!/\b(takstein|betongstein|teglstein|takplater|takplate|takpapp|takshingel|shingel|takmembran|membrantekking|torvtak)\b/.test(text))choice('roof-covering','Hvilken taktekking ønsker du?','Taktekking',['Takstein','Takplater','Takpapp / membran','Takshingel','Torvtak']);
 }
 if(cladding){
  if(!/\b(trekledning|trevirke|gran|furu|sedertre|kompositt(?:kledning)?|fasadeplater|fibersement|metallkledning)\b/.test(text))choice('cladding-material','Hvilken type kledning ønsker du?','Kledningsmateriale',['Trekledning','Komposittkledning','Fasadeplater']);
  if(!/\b(liggende|horisontal(?:t)?|stående|vertikal(?:t)?)\b/.test(text))choice('cladding-direction','Skal kledningen være liggende eller stående?','Kledningsretning',['Liggende (horisontal)','Stående (vertikal)']);
  if(!/\b(dobbelfals|enkelfals|tømmermann|rektangulær|låvepanel|faspanel|falsprofil)\b/.test(text)&&!/kledningsprofil:\s*\S/.test(text))questions.push({id:'cladding-profile',label:'Hvilken profil og dimensjon ønsker du? For eksempel dobbelfals 19 × 148 mm.','prefix':'Kledningsprofil',type:'text'});
  const wallArea=[...text.matchAll(/(?:^|\n)kledningsareal:\s*(\d+(?:[.,]\d+)?)\s*m[²2]/g)].at(-1);
  if(!wallArea&&(roof||m.area===null))number('cladding-area','Hvor stor netto veggflate skal kles? (m², etter fradrag for åpninger)','Kledningsareal','m²',0.01,100000);
  if(!/etterisoler|uten (?:ny )?isolasjon|beholde.*isolasjon|etterisolering:\s*nei/.test(text))choice('cladding-insulation','Skal veggen etterisoleres samtidig?','Etterisolering',['Ja, tykkelse må avklares','Nei, eksisterende isolasjon beholdes']);
 }
 return questions;
}

export function appendClarificationAnswers(brief,questions,answers){
 const lines=[];
 for(const q of questions){const raw=String(answers[q.id]??'').trim();if(!raw)continue;
  let value=raw;if(raw.length>500)throw Error('Et svar kan ha høyst 500 tegn.');
  if(q.type==='select'&&!q.options.includes(raw))throw Error('Velg et av alternativene.');
  if(q.type==='number'){const n=Number(raw.replace(',','.'));if(!Number.isFinite(n)||n<q.min||n>q.max)throw Error('Kontroller '+q.label.toLowerCase());value=n+' '+q.unit;}
  lines.push((q.prefix||q.label)+': '+value);
 }
 if(!lines.length)return brief;
 const updated=brief+'\n\nAvklaringer:\n'+lines.join('\n');
 if(updated.length>8000)throw Error('Beskrivelsen med svar er for lang. Kort ned teksten til 8000 tegn.');
 return updated;
}

export function proposalSchema(allowed){
 const common={reason:{type:'string'},scope:{type:'string',enum:['requested','related','optional']}};
 return {type:'object',additionalProperties:false,required:['summary','items','questions'],properties:{summary:{type:'string'},questions:{type:'array',items:{type:'string'}},items:{type:'array',items:{anyOf:allowed.map(e=>({type:'object',additionalProperties:false,required:['elementId','taskIds','reason','scope'],properties:{...common,elementId:{type:'string',enum:[e.id]},taskIds:{type:'array',items:{type:'string',enum:e.tasks.map(t=>t.id)}}}}))}}}};
}

export function mergeProposalItems(value){
 if(!value||!Array.isArray(value.items))return value;
 const byId=new Map();for(const item of value.items){if(!item||Object.keys(item).sort().join(',')!=='elementId,reason,scope,taskIds'||!['requested','related','optional'].includes(item.scope)||typeof item.reason!=='string'||item.reason.length>500||!Array.isArray(item.taskIds))return value;const old=byId.get(item.elementId);if(old){old.taskIds=[...new Set([...old.taskIds,...item.taskIds])];if(item.scope==='requested')old.scope='requested';}else byId.set(item.elementId,{...item,taskIds:[...new Set(item.taskIds)]});}
 return {...value,items:[...byId.values()],questions:Array.isArray(value.questions)?[...new Set(value.questions)]:value.questions};
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
