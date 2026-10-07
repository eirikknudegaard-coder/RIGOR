import assert from 'node:assert/strict';
import {test} from 'node:test';
import {followupFields} from '../kalkyle-questions.js';
import {appendClarificationAnswers} from '../kalkyle-assistant.js';

test('AI-omformuleringer får valg for taktype, tekking og kledningsretning',()=>{
 const labels=['Er bygget et saltak, pulttak eller valmtak?','Hvilken taktekking skal brukes?','Skal kledningen monteres vertikalt eller horisontalt?','Hvilket materiale ønsker du i kledningen?','Er taksteinen av betong eller tegl?'];
 const fields=followupFields(labels,'Jeg skal bytte tak og kledning.');
 assert(fields.every(q=>q.type==='select'));assert.equal(fields[0].prefix,'Taktype');assert(fields[2].options.includes('Stående (vertikal)'));assert.deepEqual(fields[4].options,['Betongtakstein','Tegltakstein']);
 const brief=appendClarificationAnswers('Arbeidet skal avklares.',fields,{'ai-0':'Saltak','ai-2':'Stående (vertikal)'});
 assert(brief.includes('Taktype: Saltak'));assert(brief.includes('Kledningsretning: Stående (vertikal)'));
 assert.equal(followupFields(['Hvilken type takstein ønsker du?'],'')[0].prefix,'Taksteintype');
 assert.equal(followupFields(['Hvilken taktekking: takstein, takplater eller papp?'],'')[0].prefix,'Taktekking');
 assert.equal(followupFields(['Hva er takets helning?'],'')[0].unit,'grader');
});
test('Mål bruker tall med enhet; profil/dimensjon og åpne spørsmål beholder tekst',()=>{
 const fields=followupFields(['Hva er mønelengden?','Hva er takvinkelen i grader?','Hvor stor er netto veggflate?','Hvor mange nedløp skal monteres?','Hvilken profil og dimensjon ønsker du på kledningen?','Beskriv eventuelle skader i eksisterende tak.'],'');
 assert.deepEqual(fields.map(q=>q.type),['number','number','number','number','text','text']);assert.equal(fields[0].unit,'m');assert.equal(fields[2].unit,'m²');assert.equal(fields[3].step,'1');
 const brief=appendClarificationAnswers('Vi skal bytte tak.',fields,{'ai-0':'6','ai-1':'30','ai-4':'Dobbelfals 19 × 148 mm'});
 assert(brief.includes('Mønelengde: 6 m'));assert(brief.includes('Takvinkel: 30 grader'));assert(brief.includes('Dobbelfals 19 × 148 mm'));
 assert.throws(()=>appendClarificationAnswers('Arbeidet skal avklares.',fields,{'ai-1':'100'}),/Kontroller/);
});
test('Arealgrunnlag forveksles ikke med kledningsretning, sammensatte mål forblir tekst',()=>{
 const fields=followupFields(['Er takarealet horisontalt projisert eller målt takflate?','Oppgi mønelengde og samlet valmlengde.','Skal takrennene byttes eller beholdes?','Skal eksisterende undertak beholdes?'],'');
 assert.equal(fields[0].prefix,'Arealgrunnlag');assert.equal(fields[1].type,'text');assert.deepEqual(fields[2].options,['Byttes','Beholdes']);assert.deepEqual(fields[3].options,['Ja','Nei']);
 assert.equal(followupFields(['Oppgi takvinkel og takareal.'],'')[0].type,'text');
 assert.throws(()=>appendClarificationAnswers('Arbeidet skal avklares.',fields,{'ai-0':'Et oppdiktet valg'}),/Velg/);
 assert.equal(appendClarificationAnswers('Arbeidet skal avklares.',fields,{}),'Arbeidet skal avklares.');
});
