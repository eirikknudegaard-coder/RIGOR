import {clarificationQuestions} from './kalkyle-assistant.js?v=20261007-avklaringer';

// The model supplies question text; this small catalogue determines the input
// controls. Unknown or compound specifications keep an open text answer.
export function followupFields(labels,brief){
 const known=clarificationQuestions(brief);
 return labels.map((label,i)=>{
  const exact=known.find(q=>q.label===label);
  const base={id:'ai-'+i,label,type:'text'};
  if(exact)return {...exact,id:base.id};
  const text=label.toLocaleLowerCase('nb');
  if(/takvinkel|takhelning|takets (?:vinkel|helning)/.test(text)&&/areal|lengde|bredde/.test(text))return base;
  const select=(prefix,options)=>({...base,type:'select',prefix,options});
  const number=(prefix,unit,min=0,max=10000,step='any')=>({...base,type:'number',prefix,unit,min,max,step});
  if(/arealgrunnlag|(?:takflate|takareal)[\s\S]*(?:grunnflate|horisontal|projisert)|(?:grunnflate|horisontal|projisert)[\s\S]*(?:takflate|takareal)/.test(text))return select('Arealgrunnlag',['Målt takflate','Horisontal grunnflate']);
  if(/takvinkel|takhelning|takets (?:vinkel|helning)|hvor bratt[^?]*tak|vinkel[^?]*(?:tak|grader)/.test(text)&&!/areal|lengde|bredde/.test(text))return number(/nedre/.test(text)?'Nedre takvinkel':/øvre/.test(text)?'Øvre takvinkel':'Takvinkel','grader',0,/nedre/.test(text)?85:75);
  if(/taktype|type(?:n)?[^?]*tak|saltak|pulttak|valmtak|mansardtak|flatt tak/.test(text)&&!/takstein|takplater|tekking/.test(text))return select('Taktype',['Saltak','Pulttak','Flatt tak','Valmtak','Mansardtak']);
  if(/(?:liggende|stående|horisontal|vertikal)[\s\S]*(?:kledning|monter|utførelse)|kledning[\s\S]*(?:liggende|stående|horisontal|vertikal)|kledningsretning/.test(text))return select('Kledningsretning',['Liggende (horisontal)','Stående (vertikal)']);
  if(/kledning|kledningsmateriale|fasade/.test(text)&&/materiale|type|tre|kompositt|fibersement/.test(text)&&!/profil|dimensjon|tykkelse|bredde/.test(text))return select('Kledningsmateriale',['Trekledning','Komposittkledning','Fasadeplater']);
  if(/profil/.test(text)&&/kledning|dobbelfals|enkelfals|panel/.test(text)&&!/dimensjon|mål|bredde|tykkelse/.test(text))return select('Kledningsprofil',['Dobbelfals','Enkelfals','Tømmermannskledning','Rektangulær kledning']);
  if(/takstein/.test(text)&&/betong|tegl|type|hvilken/.test(text)&&!/takplater|metall|papp|shingel|torv/.test(text))return select('Taksteintype',['Betongtakstein','Tegltakstein']);
  if(/taktekking|tekkemateriale|(?:type|hvilken)[^?]*(?:tekking|takstein|takplater|takpapp)/.test(text))return select('Taktekking',['Takstein','Takplater','Takpapp / membran','Takshingel','Torvtak']);
  if(/etterisoler|etterisolasjon/.test(text)&&/skal|ønsker|vil|samtidig/.test(text)&&!/tykk|mm|hvor mye/.test(text))return select('Etterisolering',['Ja, tykkelse må avklares','Nei, eksisterende isolasjon beholdes']);
  if(/areal|flate|kvadratmeter|m²|\bm2\b/.test(text)&&/hvor stor|hvor mange|areal(?:et)?\b|netto|målt/.test(text)&&!/andel|fordeling|dimensjon/.test(text))return number(/vegg|fasade|kledning/.test(text)?'Kledningsareal':'Takareal','m²',.01,100000);
  const lengths=[['møne','Mønelengde'],['takfot','Takfotlengde'],['valm','Valmlengde'],['takrenne','Takrennelengde'],['vindsk','Vindskilengde'],['nedløp','Nedløpslengde'],['knekk','Knekkbeslaglengde']].filter(([word])=>text.includes(word));
  if(lengths.length===1&&/lengde|lang|meter|\(m\)/.test(text))return number(lengths[0][1],'m');
  if(/arbeidshøyde|gesimshøyde|bygghøyde|hvor høyt|hvor høy[^?]*(?:tak|bygg|vegg)/.test(text))return number('Arbeidshøyde','m',0,200);
  if(/avstand|c\/c|sperreavstand|lekteavstand/.test(text)&&/mm|millimeter/.test(text))return number(/sperre|sløyfe/.test(text)?'Sløyfeavstand':'Lekteavstand','mm',1,10000);
  if(/isolasjon|etterisolering/.test(text)&&/tykk|mm|millimeter/.test(text))return number('Isolasjonstykkelse','mm',1,1000);
  if(/hvor mange|antall/.test(text)&&!/type|dimensjon|mål|meter|vinkel/.test(text))return number(label,'stk',0,10000,'1');
  if(/eller/.test(text)&&/bytt|skift|utskift/.test(text)&&/behold/.test(text))return select(label,['Byttes','Beholdes']);
  if(/^(?:skal|ønsker|vil|må|er)\b/.test(text)&&/bytte|skifte|beholde|inkludere|ta med|montere|rives|riving|utskift|still(?:as)|fallsikring|avfall|isolert/.test(text)&&!/hvilken|hvilke|type|dimensjon|hvordan|eller/.test(text))return select(label,['Ja','Nei']);
  return base;
 });
}
