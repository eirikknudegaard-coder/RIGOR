const terrace=/\b(terrasse|terrassen|terrassebord(?:ene)?|terrassegulv(?:et)?|platting(?:en)?)\b/;
const direction=/liggende|stående|horisontal|vertikal/;
const cladding=/kledning|fasade|veggpanel/;
const select=(label,prefix,options)=>({label,prefix,type:'select',options});
const number=(label,prefix,unit,min,max)=>({label,prefix,type:'number',unit,min,max});
const text=(label,prefix,placeholder)=>({label,prefix,type:'text',placeholder});
const railingType=()=>({...select('Hvilken type rekkverk ønsker du?','Rekkverkstype',['Trespiler','Glassfelt','Metallspiler','Annet – beskriv i merknader','Ikke avklart']),help:'Utforming må sikre mot fall og klatring. Produktvalg alene avklarer ikke rekkverkets utførelse.'});

// A deliberately small domain catalogue. Reject the cladding question that
// makes no sense for a deck floor; keep genuine railing/cladding questions.
// Compound specifications become separate controls with explicit units.
export function terraceQuestionFields(label,brief){
 const question=label.toLocaleLowerCase('nb'),context=brief.toLocaleLowerCase('nb');
 const deck=/terrassebord|terrassegulv/.test(question);
 const terraceOnly=terrace.test(context)&&!cladding.test(context)&&!/\b(tak|saltak|pulttak|yttervegg)\b/.test(context);
 const demolitionOnly=terraceOnly&&/\b(rive|rives|riving|demontere|demontering)\b/.test(context)&&!/\b(ny|nye|nytt|bygge|bytte|skifte|oppgradere|montere|legge)\b/.test(context);
 if(direction.test(question)&&(deck||terraceOnly&&!/rekkverk|spiler|kledning|fasade/.test(question)))return [];
 if(terraceOnly&&cladding.test(question))return [];
 if(!terrace.test(question)&&!terrace.test(context))return null;
 if(/\b(tak|taket|takvinkel|taktype|taktekking|kledning|fasade|vegg)\b/.test(question))return null;
 if(/^andre ønsker til terrassebordene/.test(question))return [text('Andre ønsker til terrassebordene (valgfritt)','Terrassebordmerknader','Beskriv annet materiale, overflate eller produktønske')];

 if(/rekkverk/.test(question)){
  if(/utførelse/.test(question)&&!/type|material|høyde|høyt|høy\b/.test(question))return [text('Hvilken rekkverksutførelse er oppgitt eller prosjektert?','Rekkverksutførelse','Beskriv løsning, eller «må avklares»')];
  if(direction.test(question)&&/spil/.test(question))return [railingType(),text('Hvilken rekkverksutførelse er oppgitt eller prosjektert?','Rekkverksutførelse','Beskriv løsning, eller «må avklares»')];
  if(/lengde|lang|meter|\(m\)/.test(question)&&!/høyde|høy|type|material|tilbehør/.test(question))return [number('Hva er samlet rekkverkslengde? (m)','Rekkverkslengde','m',0,10000)];
  if(/(?:skal|ønsker|ønskes|vil)[\s\S]*(?:ta med|inkluder|bytte|skifte|behold|monter)|(?:skal|ønskes)[\s\S]*rekkverk\??$/.test(question)&&!/type|material|høyde|høyt|tilbehør/.test(question))return [select('Skal tilbudet inkludere rekkverk?','Rekkverk inkluderes',['Ja','Nei','Ikke avklart'])];
  const fields=[];
  if(/type|slags|material/.test(question)||/hvilk/.test(question)&&!/høyde|høyt|høy\b|lengde|utførelse/.test(question))fields.push(railingType());
  if(/høyde|høyt|høy\b/.test(question))fields.push({...number('Hvilken rekkverkshøyde er oppgitt eller prosjektert? (m)','Rekkverkshøyde','m',0.1,5),help:'Høyde og utførelse må kontrolleres mot TEK17 § 12-15. Ikke gjett en prosjektert høyde.'});
  if(/tilbehør|detaljer|type|material/.test(question))fields.push(text('Tilbehør og andre ønsker til rekkverket (valgfritt)','Rekkverksdetaljer','F.eks. håndløper, avslutninger eller annet rekkverk'));
  return fields.length?fields:null;
 }
 if(/bjelkelag|bjelke(?:ne|r|dimensjon|avstand|spenn)?\b/.test(question)){
  const fields=[];
  if(/dimensjon|mål|størrelse/.test(question))fields.push(text('Hvilken bjelkedimensjon er oppgitt eller prosjektert?','Bjelkedimensjon','Oppgitt dimensjon, eller «må avklares»'));
  if(/senteravstand|bjelkeavstand|c\s*\/?\s*c|avstand/.test(question))fields.push({...number('Hva er senteravstanden mellom bjelkene? (mm)','Bjelkeavstand','mm',1,3000),help:'Avstanden må vurderes mot valgt terrassebord, bjelkedimensjon, spenn og belastning. 600 mm er ikke en standard for alle produkter.'});
  if(/spenn/.test(question))fields.push(number('Hva er fri spennlengde mellom understøttelsene? (m)','Terrassespenn','m',0.01,100));
  return fields.length?fields:null;
 }
 if(/høyde|høyt|høy\b/.test(question)&&/terrasse|terreng|overflate|bakken/.test(question))return [number('Hvor høyt er terrassegulvet over terrenget? (m)','Terrassehøyde','m',0,50)];
 if(/areal|kvadratmeter|m²|\bm2\b/.test(question)&&!/dimensjon|fordeling|andel|lengde|bredde/.test(question))return [number('Hva er arealet på terrassen? (m²)','Terrasseareal','m²',0.01,100000)];
 if(!deck&&/\b(terrasse|terrassen|terrassens|platting|plattingen)\b/.test(question)&&/dimensjon|mål|størrelse|hvor stor/.test(question)&&!/høyde|rekkverk|bjelke|material/.test(question))return [number('Hva er terrassens lengde? (m)','Terrasselengde','m',0.01,1000),number('Hva er terrassens bredde? (m)','Terrassebredde','m',0.01,1000)];
 if(/lengde[\s\S]*bredde|bredde[\s\S]*lengde/.test(question)&&/terrasse|mål/.test(question))return [number('Hva er terrassens lengde? (m)','Terrasselengde','m',0.01,1000),number('Hva er terrassens bredde? (m)','Terrassebredde','m',0.01,1000)];
 if(/terrassens lengde|terrasselengde/.test(question))return [number('Hva er terrassens lengde? (m)','Terrasselengde','m',0.01,1000)];
 if(/terrassens bredde|terrassebredde/.test(question))return [number('Hva er terrassens bredde? (m)','Terrassebredde','m',0.01,1000)];
 if(/spenn|understøttelse|støttepunkter/.test(question)&&!/dimensjon|antall/.test(question))return [number('Hva er fri spennlengde mellom understøttelsene? (m)','Terrassespenn','m',0.01,100)];
 if(/grunnforhold|grunnen|underlaget/.test(question)&&/type|hvilk|hva slags/.test(question))return [select('Hvilke grunnforhold har terrassen?','Terrassegrunn',['Fjell','Eksisterende betongdekke','Løsmasser – type må avklares','Blanding av grunnforhold','Ikke avklart'])];
 if(/innfesting|festemetode/.test(question)&&/terrassebord|skjult|synlig/.test(question))return demolitionOnly?[]:[{...select('Hvilken innfesting ønsker du til terrassebordene?','Terrassebordinnfesting',['Synlige skruer','Skjult innfesting','Ikke avklart']),help:'Innfestingen må være egnet for det valgte produktet og miljøet terrassen står i.'}];
 if(/retning|leggemønster|diagonal|langs|tvers/.test(question)&&deck)return [select('Hvordan skal terrassebordene legges?','Terrassebordmønster',['Rett mønster – retning avklares på stedet','Diagonalt mønster','Annet – beskriv i merknader','Ikke avklart'])];

 const board=deck||terraceOnly&&!/fundament|stolpe|drager|stillas|trapp|innfesting|skruer/.test(question);
 if(board&&/material|trevirke|treslag|profil|overflate|glatt|rillet|dimensjon|tykkelse|bredde/.test(question)){
  if(demolitionOnly)return [];
  const fields=[];
  if(/material|trevirke|treslag/.test(question))fields.push(select('Hvilket materiale ønsker du til terrassebordene?','Terrassebordmateriale',['Trykkimpregnert furu','Royalimpregnert tre','Termofuru','Kebony','Accoya','Kompositt','Annet – beskriv i merknader','Ikke avklart']));
  if(/profil|overflate|glatt|rillet|ru\b/.test(question))fields.push(select('Hvilken overflate ønsker du på terrassebordene?','Terrassebordprofil',['Glatt','Rillet','Ru','Annet – beskriv i merknader','Ikke avklart']));
  if(/dimensjon|tykkelse|bredde/.test(question))fields.push({...select('Hvilken dimensjon skal terrassebordene ha?','Terrasseborddimensjon',['28 × 120 mm','28 × 145 mm','Annen dimensjon – beskriv i merknader','Ikke avklart']),help:'Dette er vanlige treborddimensjoner. Kontroller dimensjon og monteringsanvisning for det valgte produktet.'});
  if(fields.some(field=>field.type==='select'))fields.push(text('Andre ønsker til terrassebordene (valgfritt)','Terrassebordmerknader','Beskriv annet materiale, overflate eller produktønske'));
  return fields;
 }
 return null;
}

export function cleanTerraceQuestions(labels,brief){
 const questions=labels.flatMap(label=>{
  const fields=terraceQuestionFields(label,brief);
  return fields===null?[label]:fields.map(field=>field.label);
 });
 return [...new Set(questions)].filter(label=>{
  const fields=terraceQuestionFields(label,brief);
  const field=fields?.find(field=>field.label===label);if(!field)return true;
  if(field.prefix==='Terrasseareal'&&!/\b(tak|saltak|pulttak|yttervegg|kledning)\b/i.test(brief)){
   const areas=[...brief.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:m²(?![a-zæøå0-9])|m2\b|kvadratmeter\b)/gi)];
   if(areas.length===1&&Number(areas[0][1].replace(',','.'))>0)return false;
  }
  const prefix=field.prefix.toLocaleLowerCase('nb');
  const answer=brief.toLocaleLowerCase('nb').split('\n').filter(line=>line.startsWith(prefix+':')).at(-1)?.slice(prefix.length+1).trim();
  return !answer||/^(?:ikke avklart|må avklares|annet|annen)\b/.test(answer);
 });
}
