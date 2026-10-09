// Input contract shared by the conversation and the server. Derived values are
// produced by the load engine, never accepted as claims from a language model.
const number=(min,max)=>({type:'number',min,max});
const choice=(...values)=>({type:'enum',values});
export const fields=Object.freeze({
 goal:choice('remove_wall','check_beam','check_column','plan_terrace','unknown'),
 memberRole:choice('rafters','joists','beam','column','unknown'),
 terraceLengthM:number(.5,50),terraceDepthM:number(.5,30),terraceHeightM:number(0,10),
 terraceWallSupport:choice('documented','free_standing','unknown'),
 nominalSection:choice('2x6','2x8'),
 widthMm:number(10,2000),heightMm:number(10,3000),spacingMm:number(100,2000),
 roofType:choice('gable','mono','hip','flat','unknown'),roofAngleDeg:number(0,75),
 openingM:number(.1,30),spanM:number(.1,30),rafterSpanM:number(.1,30),oppositeRafterSpanM:number(.1,30),
 spanBasis:choice('horizontal','slope','unknown'),direction:choice('across','parallel','unknown'),
 roofBearsOnWall:choice('yes','no','unknown'),floorAbove:choice('yes','no','unknown'),
 roofSupport:choice('ridge_beam','trusses','ridge_board','unknown'),roofSides:choice('one','two','unknown'),
 supportBelow:choice('documented','unknown','unsupported'),
 system:choice('simple','cantilever','continuous','frame','unknown'),
 loadChoice:choice('roof','line','point','mixed','unknown'),
 lineLoadKnM:number(0,500),pointLoadKn:number(0,5000),pointPositionM:number(0,30),
 roofDeadKnM2:number(0,20),roofSnowKnM2:number(0,30),deadBasis:choice('horizontal','slope','unknown'),
 loadBasis:choice('documented','preliminary'),loadSource:{type:'text',max:400},
 material:choice('C24','GL30c','S355','unknown'),sectionRequested:{type:'boolean'},sectionConstruction:choice('solid_single','multiple_members','profile','unknown'),deflectionRatio:number(100,1000),
 selfWeightInLoad:{type:'boolean'},unsupportedReason:{type:'text',max:500}
});
export const labels={sectionConstruction:'Dragerens oppbygging',tributaryWidthM:'Lastbredde (m)',roofLineLoadKnM:'Utledet taklast langs drageren (kN/m)',selfWeightKnM:'Utledet egenvekt for drageren (kN/m)',goal:'Hva du vil undersøke',memberRole:'Del av konstruksjonen',nominalSection:'Nominell dimensjon',widthMm:'Bredde (mm)',heightMm:'Høyde (mm)',spacingMm:'Senteravstand (mm)',roofType:'Takform',roofAngleDeg:'Takvinkel (grader)',openingM:'Ønsket åpning (m)',spanM:'Dragerspenn (m)',rafterSpanM:'Sperrespenn (m)',oppositeRafterSpanM:'Sperrespenn på andre siden (m)',spanBasis:'Hvordan spennet er målt',direction:'Sperrer i forhold til veggen',roofBearsOnWall:'Sperrer med opplegg på veggen',floorAbove:'Etasjeskiller over veggen',roofSupport:'Bæring ved mønet',roofSides:'Taklast fra én eller to sider',supportBelow:'Støtte under endene',system:'Opplegg for drageren',loadChoice:'Lastgrunnlag',lineLoadKnM:'Last langs drageren (kN/m)',pointLoadKn:'Punktlast (kN)',pointPositionM:'Punktlast fra venstre ende (m)',roofDeadKnM2:'Takets egenvekt (kN/m²)',roofSnowKnM2:'Snølast på taket (kN/m²)',deadBasis:'Areal for takets egenvekt',loadBasis:'Dokumentasjon av laster',loadSource:'Kilde for lastene',material:'Materialklasse',deflectionRatio:'Foreløpig nedbøyningsgrense L/',selfWeightInLoad:'Dragerens egenvekt er med i oppgitt last',unsupportedReason:'Avgrensning'};
export const valueLabels={solid_single:'Ett massivt rektangel',multiple_members:'Sammensatt bjelke',profile:'Profil med flenser / hulrom',remove_wall:'Fjerne vegg',check_beam:'Undersøke bjelke',unknown:'Vet ikke',rafters:'Taksperrer',joists:'Bjelkelag',beam:'Drager / bjelke',gable:'Saltak',mono:'Pulttak',hip:'Valmtak',flat:'Flatt tak',horizontal:'Vannrett',slope:'Langs takflaten',across:'På tvers av veggen',parallel:'Langs veggen',yes:'Ja',no:'Nei',ridge_beam:'Bærende drager ved mønet',trusses:'Takstoler',ridge_board:'Mønebord uten bærende drager',one:'Én side',two:'Begge sider',documented:'Dokumentert',unsupported:'Mangler støtte',simple:'Opplegg i begge ender',cantilever:'Fast innspent i én ende',continuous:'Tre eller flere opplegg',frame:'Ramme',roof:'Oppgitte taklaster',line:'Oppgitt last langs drageren',point:'Oppgitt punktlast',mixed:'Last langs drageren og punktlast',preliminary:'Foreløpige, brukeroppgitte laster'};
Object.assign(labels,{terraceLengthM:'Terrassens lengde langs huset (m)',terraceDepthM:'Terrassens dybde fra huset (m)',terraceHeightM:'Høyde over terreng (m)',terraceWallSupport:'Bæring ved huset'});
Object.assign(valueLabels,{check_column:'Undersøke søyle / stolpe',plan_terrace:'Plassere dragere og stolper i terrasse',column:'Søyle / stolpe',free_standing:'Frittstående terrasse'});
export function validateValue(id,value){
 const d=fields[id];if(!d)throw Error('Ukjent konstruksjonsopplysning.');
 if(d.type==='number'&&(!Number.isFinite(value)||value<d.min||value>d.max))throw Error('Kontroller '+labels[id]+'.');
 if(d.type==='enum'&&!d.values.includes(value))throw Error('Velg et gyldig svar for '+labels[id]+'.');
 if(d.type==='boolean'&&typeof value!=='boolean')throw Error('Ugyldig ja/nei-svar.');
 if(d.type==='text'&&(typeof value!=='string'||!value.trim()||value.length>d.max))throw Error('Oppgi '+labels[id]+'.');
 return value;
}
export function emptyContext(brief=''){
 if(typeof brief!=='string'||brief.length>8000)throw Error('Beskrivelsen kan ha høyst 8000 tegn.');
 return {version:1,brief,facts:{},unknowns:[],conflicts:{}};
}
export function fact(context,id){return context.facts[id]?.value;}
export function setFact(context,id,value,source='Svar fra brukeren',status='KNOWN'){
 validateValue(id,value);if(!['KNOWN','ASSUMED'].includes(status))throw Error('Bare oppgitt eller synlig antatt grunnlag kan registreres.');
 const next=structuredClone(context);next.facts[id]={value,status,source:String(source).slice(0,600)};
 next.unknowns=next.unknowns.filter(k=>k!==id);delete next.conflicts[id];return next;
}
export function markUnknown(context,id){
 if(!fields[id])throw Error('Ukjent opplysning.');const next=structuredClone(context);delete next.facts[id];delete next.conflicts[id];
 if(!next.unknowns.includes(id))next.unknowns.push(id);return next;
}
export function validateContext(input){
 if(!input||input.version!==1||Object.keys(input).some(k=>!['version','brief','facts','unknowns','conflicts'].includes(k)))throw Error('Ugyldig konstruksjonsmodell.');
 const clean=emptyContext(input.brief);
 if(!input.facts||Array.isArray(input.facts)||typeof input.facts!=='object'||!Array.isArray(input.unknowns)||input.unknowns.length>Object.keys(fields).length)throw Error('Ugyldige konstruksjonsopplysninger.');
 for(const [id,f] of Object.entries(input.facts)){
  if(!f||Object.keys(f).some(k=>!['value','source','status'].includes(k))||!['KNOWN','ASSUMED'].includes(f.status)||typeof f.source!=='string'||!f.source.trim()||f.source.length>600)throw Error('Opplysningene mangler sporbar kilde.');
  validateValue(id,f.value);clean.facts[id]={...f};
 }
 for(const id of input.unknowns){if(!fields[id]||clean.facts[id]||clean.unknowns.includes(id))throw Error('Ugyldig avklaring.');clean.unknowns.push(id);}
 if(!input.conflicts||Array.isArray(input.conflicts)||typeof input.conflicts!=='object')throw Error('Ugyldige motstridende opplysninger.');
 for(const [id,values] of Object.entries(input.conflicts)){
  if(!fields[id]||clean.facts[id]||!Array.isArray(values)||values.length<2||values.length>10)throw Error('Ugyldig motstrid.');
  values.forEach(v=>validateValue(id,v));clean.conflicts[id]=[...values];
 }
 return clean;
}
