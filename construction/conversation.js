import {fact,fields} from './context.js';
const choices={
 goal:[['remove_wall','Jeg vil fjerne en vegg'],['check_beam','Jeg vil undersøke en bjelke eller drager'],['check_column','Jeg vil undersøke en søyle eller stolpe'],['plan_terrace','Jeg vil plassere dragere og stolper i en terrasse']],
 terraceWallSupport:[['documented','Dokumentert bæring mot huset'],['free_standing','Frittstående – egne dragere og stolper på begge sider']],
 memberRole:[['rafters','Taksperrene'],['joists','Bjelkelaget'],['beam','Drageren jeg vil undersøke']],
 direction:[['across','På tvers av veggen'],['parallel','Langs veggen']],
 roofBearsOnWall:[['yes','Ja, de har opplegg på veggen'],['no','Nei, de bæres et annet sted']],
 floorAbove:[['no','Nei, bare tak over'],['yes','Ja, også etasjeskiller eller annen bæring']],
 roofSupport:[['ridge_beam','Sperrer med bærende drager / vegg ved mønet'],['trusses','Ferdige takstoler'],['ridge_board','Sperrer med mønebord uten bærende mønedrager']],
 roofSides:[['one','Én side'],['two','Begge sider']],
 spanBasis:[['horizontal','Vannrett mellom oppleggene'],['slope','Langs sperren / takflaten']],
 system:[['simple','Støttet i begge ender'],['cantilever','Fast innspent i én ende, fri i den andre'],['continuous','Støttet på tre eller flere steder'],['frame','Del av en ramme']],
 loadChoice:[['roof','Jeg har oppgitt egenvekt og snølast på taket'],['line','Jeg har en oppgitt last langs drageren'],['point','Jeg har en oppgitt punktlast'],['mixed','Jeg har begge lasttypene']],
 deadBasis:[['horizontal','Per m² vannrett takareal'],['slope','Per m² av skrå takflate']],
 loadBasis:[['documented','Fra en tegning eller lastberegning'],['preliminary','Egne foreløpige lastforutsetninger']],
 material:[['C24','Konstruksjonsvirke C24'],['GL30c','Limtre GL30c'],['S355','Stål S355 – massivt rektangel']],
 sectionConstruction:[['solid_single','Én drager med massivt rektangulært tverrsnitt'],['multiple_members','Flere bjelker satt sammen'],['profile','Profil med flenser eller hulrom']],
 supportBelow:[['documented','Dokumentert støtte helt ned til fundament'],['unsupported','Det mangler støtte under enden']],
 selfWeightInLoad:[[true,'Ja, den er med i de oppgitte lastene'],[false,'Nei, legg til dragerens egenvekt']]
};
const wording={
 terraceLengthM:['Hvor lang er terrassen langs huset?','Oppgi lengden i meter. Antall stolper kan ikke finnes fra c/c-avstand alene.'],
 terraceDepthM:['Hvor langt går terrassen ut fra huset?','Oppgi dybden i meter. Dette er normalt retningen de tverrgående bjelkene spenner.'],
 terraceHeightM:['Hvor høyt er terrassegulvet over terrenget?','Oppgi meter. Høyde og avstivning påvirker stolper, rekkverk og fundament.'],
 terraceWallSupport:['Skal terrassen bæres av huset eller være frittstående?','Innfesting mot huset må være dokumentert. Et kledningsbord er ikke et dokumentert opplegg.'],
 goal:['Hva vil du undersøke først?','Vi starter med hva konstruksjonen skal gjøre.'],
 memberRole:['Når du sier 2x8 eller bjelker, hvilken del av konstruksjonen mener du?','Samme dimensjon kan brukes i ulike deler. Den skal ikke flyttes automatisk til en ny drager.'],
 direction:['Går taksperrene på tvers av veggen du ønsker å fjerne?','Retningen kan gi en indikasjon, men bekrefter ikke bæring alene.'],
 roofBearsOnWall:['Hviler taksperrene faktisk på denne veggen?','Se etter et opplegg eller dokumentasjon. Er du usikker, kan vi fortsatt vurdere lastveien.'],
 floorAbove:['Bærer veggen også etasjeskiller eller andre konstruksjoner over?','Taklast alene dekker ikke last fra en etasje eller andre dragere.'],
 openingM:['Hvor bred åpning ønsker du i veggen?','Oppgi i meter. Åpningen brukes som et foreløpig dragerspenn; faktisk avstand mellom oppleggene kan være større.'],
 rafterSpanM:['Hvor langt spenner sperrene fra veggen til neste bæring?','Oppgi i meter. Bæring kan for eksempel være en dokumentert mønedrager.'],
 oppositeRafterSpanM:['Hvor langt spenner sperrene på den andre siden av veggen?','Oppgi i meter. Lasten fra hver side må tas med.'],
 spanBasis:['Er sperrespennet målt vannrett eller langs sperren?','Dette bestemmer hvilket takareal som belaster veggen.'],
 roofSupport:['Hvordan er taket båret ved mønet?','Takstoler og tak uten bærende mønedrager kan ha en annen lastvei. Vi bruker ikke en enkel sperremodell for disse.'],
 roofSides:['Får veggen taklast fra én side eller fra begge sider?','Vi trenger bare den delen av taket som har opplegg på denne veggen.'],
 roofAngleDeg:['Hvilken takvinkel har taket?','Oppgi i grader. Vinkelen trengs når et mål eller egenvekten er oppgitt langs takflaten.'],
 spanM:['Hvor langt er det mellom dragerens opplegg?','Oppgi i meter. For en utkrager er dette lengden fra innspenning til fri ende.'],
 system:['Hvordan er drageren støttet?','Beskriv oppleggene. RIGOR velger beregningsmetoden.'],
 loadChoice:['Har du et lastgrunnlag fra tegning eller tidligere beregning?','Velg det du har. Vet du ikke lastene, får du en vurdering av lastveien uten oppdiktede tall.'],
 lineLoadKnM:['Hvilken last skal drageren bære langs hele lengden?','Bruk oppgitt vertikallast i kN per meter. Tall kan hentes fra en tegning eller lastberegning.'],
 pointLoadKn:['Hvor stor last kommer ned på det ene punktet?','Bruk oppgitt vertikallast i kN. Én punktlast støttes i denne visningen.'],
 pointPositionM:['Hvor på drageren kommer punktlasten ned?','Oppgi meter fra venstre ende, eller fra innspenningen for en utkrager.'],
 roofDeadKnM2:['Hvilken egenvekt er oppgitt for hele takoppbyggingen?','Oppgi kN per m². Tekking alene er ikke hele takets egenvekt.'],
 roofSnowKnM2:['Hvilken snølast er oppgitt på selve taket?','Oppgi kN per m² vannrett takareal. Snølast på bakken skal ikke settes inn her uten omregning. Sted, høyde og takform påvirker dette.'],
 deadBasis:['Hvilket areal gjelder takets oppgitte egenvekt for?','Vi omregner bare når arealgrunnlag og takvinkel er kjent.'],
 loadBasis:['Hvordan er disse lastene fastsatt?','Dette følger med resultatet. Ingen Eurocodekombinasjoner eller sikkerhetsfaktorer legges til automatisk.'],
 loadSource:['Hvor kommer lastene fra?','Oppgi for eksempel dokumentnavn, tegning eller beskrivelse av din foreløpige forutsetning.'],
 widthMm:['Hva er den faktiske bredden på drageren du vil undersøke?','Oppgi i millimeter. 2x8 kan tilsvare 48x198 mm, men må bekreftes på den aktuelle drageren. Ingen samvirkning for doble bjelker forutsettes.'],
 sectionConstruction:['Hvordan er drageren bygget opp?','Første versjon beregner nedbøyning for ett massivt rektangel. Stålprofiler og sammensatte bjelker trenger et annet tverrsnittsgrunnlag.'],
 heightMm:['Hva er den faktiske høyden på drageren?','Oppgi vertikal høyde i millimeter. Høyden påvirker stivheten kraftig.'],
 material:['Hvilken dokumentert materialklasse har drageren?','Materialverdiene hentes fra et kontrollert register. Dimensjonen alene angir ikke styrkeklassen. Stålprofiler med flenser eller hulrom støttes ikke som rektangel.'],
 selfWeightInLoad:['Er dragerens egenvekt allerede med i lastgrunnlaget?','Hvis ikke, legges den til fra bekreftet tverrsnitt og materialets middeltetthet.'],
 deflectionRatio:['Hvilken L/–grense vil du sammenligne nedbøyningen med?','Oppgi nevneren, for eksempel 300 for L/300. Dette er en oppgitt sammenligningsgrense, ikke automatisk et forskriftskrav.'],
 supportBelow:['Hva støtter dragerens ender videre nedover?','Store punktlaster krever en sammenhengende lastvei til fundamentet. Oppleggskapasitet beregnes ikke her.']
};
export function questionFor(id){
 const d=fields[id],w=wording[id];if(!d||!w)throw Error('Spørsmålet støttes ikke.');
 return {id,label:w[0],help:w[1],type:choices[id]?'select':d.type==='number'?'number':'text',options:choices[id]||[],min:d.min,max:d.max};
}
export function requiredFields(c){
 const get=id=>fact(c,id),ids=[];
 if(!get('goal')||get('goal')==='unknown')return ['goal'];
 if(get('goal')==='plan_terrace')return ['terraceLengthM','terraceDepthM','terraceHeightM','terraceWallSupport'];
 if(get('goal')==='check_column')return [];
 if(c.conflicts.memberRole||get('nominalSection')&&!get('memberRole'))ids.push('memberRole');
 if(get('goal')==='remove_wall'){
  ids.push('direction','roofBearsOnWall','floorAbove','openingM');
  if(!get('loadChoice'))ids.push('rafterSpanM');
 }else ids.push('spanM','system');
 ids.push('loadChoice');
 if(get('loadChoice')==='roof'){
  ids.push('roofBearsOnWall','floorAbove','roofSupport','roofSides','rafterSpanM','spanBasis');
  if(get('roofSides')==='two')ids.push('oppositeRafterSpanM');
  if(get('spanBasis')==='slope'||get('deadBasis')==='slope')ids.push('roofAngleDeg');
  ids.push('roofDeadKnM2','roofSnowKnM2','deadBasis');
 }else if(['line','mixed'].includes(get('loadChoice')))ids.push('lineLoadKnM');
 if(['point','mixed'].includes(get('loadChoice')))ids.push('pointLoadKn','pointPositionM');
 if(get('loadChoice')&&get('loadChoice')!=='unknown')ids.push('loadBasis','loadSource');
 if(get('sectionRequested')===true)ids.push('sectionConstruction','widthMm','heightMm','material','selfWeightInLoad');
 if(get('goal')==='remove_wall'||get('sectionRequested')===true)ids.push('supportBelow');
 return [...new Set(ids)];
}
export function nextQuestion(c){
 if(fact(c,'unsupportedReason')||['continuous','frame'].includes(fact(c,'system')))return null;
 if(fact(c,'sectionRequested')===true&&['multiple_members','profile'].includes(fact(c,'sectionConstruction')))return null;
 if(fact(c,'loadChoice')==='roof'&&(['trusses','ridge_board'].includes(fact(c,'roofSupport'))||fact(c,'floorAbove')==='yes'||fact(c,'roofBearsOnWall')==='no'))return null;
 const conflicts=Object.keys(c.conflicts).find(id=>wording[id]);if(conflicts)return {...questionFor(conflicts),help:'Opplysningene motsier hverandre. Bekreft riktig verdi. '+questionFor(conflicts).help};
 const id=requiredFields(c).find(id=>!c.facts[id]&&!c.unknowns.includes(id));return id?questionFor(id):null;
}
