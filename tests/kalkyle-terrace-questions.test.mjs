import test from 'node:test';
import assert from 'node:assert/strict';
import {followupFields,cleanFollowupQuestions} from '../kalkyle-questions.js';
import {terraceQuestionFields} from '../supabase/functions/rigor-ai-estimate/terrace-questions.js';
import {appendClarificationAnswers,extractMeasurements} from '../kalkyle-assistant.js';

export const terraceLabels=[
 'Hva er arealet på terrassen (m²)?',
 'Hva er høyden fra terreng til terrassens overflate?',
 'Ønskes spesifikke dimensjoner på bjelkelaget (f.eks. dimensjon og senteravstand)?',
 'Hvilket materiale og profil ønskes på terrassebordene?',
 'Ønskes stående eller liggende terrassebord?',
 'Hva slags rekkverkstilbehør ønskes (høyde, type, materiale)?'
];
const brief='Jeg skal bygge ny terrasse med bjelkelag, terrassebord og rekkverk.';
const fieldsFor=(labels=terraceLabels,text=brief)=>followupFields(cleanFollowupQuestions(labels,text),text);

test('screenshot questions split into professional choice, measurement and specification controls',()=>{
 const fields=fieldsFor(),byPrefix=Object.fromEntries(fields.map(q=>[q.prefix,q]));
 assert.equal(fields.length,10);assert.equal(new Set(fields.map(q=>q.id)).size,10);
 assert(!fields.some(q=>/stående|liggende/.test(q.label)));
 for(const prefix of ['Terrassebordmateriale','Terrassebordprofil','Rekkverkstype'])assert.equal(byPrefix[prefix].type,'select');
 assert.equal(byPrefix.Terrasseareal.unit,'m²');assert.equal(byPrefix.Terrassehøyde.unit,'m');assert.equal(byPrefix.Bjelkeavstand.unit,'mm');
 assert.equal(byPrefix.Bjelkedimensjon.type,'text');assert.equal(byPrefix.Rekkverkshøyde.unit,'m');
 assert(byPrefix.Bjelkeavstand.help.includes('ikke en standard'));
 assert(byPrefix.Terrassebordprofil.options.includes('Ru'));
 assert(fields.filter(q=>q.prefix==='Terrassebordmerknader').length===1);
 assert.equal(fields.at(-1).type,'text');
});
test('answers retain terrace-specific prefixes, units and area after refinement',()=>{
 const fields=fieldsFor(),values={Terrasseareal:'50',Terrassehøyde:'4',Bjelkedimensjon:'må avklares',Bjelkeavstand:'600',Terrassebordmateriale:'Royalimpregnert tre',Terrassebordprofil:'Glatt',Rekkverkstype:'Glassfelt',Rekkverkshøyde:'1',Terrassebordmerknader:'Brun farge',Rekkverksdetaljer:'Håndløper'};
 const answers=Object.fromEntries(fields.map(q=>[q.id,values[q.prefix]]));
 const answered=appendClarificationAnswers(brief,fields,answers);
 for(const value of ['Terrasseareal: 50 m²','Terrassehøyde: 4 m','Bjelkeavstand: 600 mm','Terrassebordmateriale: Royalimpregnert tre','Terrassebordprofil: Glatt','Rekkverkstype: Glassfelt'])assert(answered.includes(value));
 assert.equal(extractMeasurements(answered).area,50);assert(!answered.includes('Takareal:'));
 assert.deepEqual(fieldsFor(terraceLabels,answered).map(q=>q.prefix),['Bjelkedimensjon']);
 const duplicateArea=appendClarificationAnswers('Jeg skal bytte 50 m² terrasse.',fields.filter(q=>q.prefix==='Terrasseareal'),{[fields[0].id]:'50'});
 assert.equal(extractMeasurements(duplicateArea).area,50);
 assert.throws(()=>appendClarificationAnswers(brief,fields,{[fields.find(q=>q.prefix==='Terrassehøyde').id]:'-1'}),/Kontroller/);
 assert.throws(()=>appendClarificationAnswers(brief,fields,{[fields.find(q=>q.prefix==='Terrassebordmateriale').id]:'Oppdiktet valg'}),/Velg/);
});
test('terrace facts do not become roof facts and canonical controls round-trip',()=>{
 const labels=['Hva er lengde og bredde på terrassen?','Hva er bjelkespennet?','Hvilken type grunnforhold er det?','Ønskes skjult eller synlig innfesting på terrassebordene?','Hvilke dimensjoner ønskes på terrassebordene?'];
 const fields=fieldsFor(labels);
 assert.deepEqual(fields.filter(q=>q.type==='number').map(q=>[q.prefix,q.unit]),[['Terrasselengde','m'],['Terrassebredde','m'],['Terrassespenn','m']]);
 assert.equal(fields.find(q=>q.prefix==='Terrassegrunn').type,'select');assert.equal(fields.find(q=>q.prefix==='Terrassebordinnfesting').type,'select');assert.equal(fields.find(q=>q.prefix==='Terrasseborddimensjon').type,'select');
 assert.deepEqual(fieldsFor(fields.map(q=>q.label)).map(q=>[q.prefix,q.type]),fields.map(q=>[q.prefix,q.type]));
 assert.equal(extractMeasurements('Terrasseareal: 50 m²\nTakareal: 100 m²\nSaltak').area,100);
 assert.equal(fieldsFor(['Hva er arealet på terrassen?'],'Bytte terrasse på 50 m²').length,0);
});
test('bad deck/cladding questions are removed, genuine cladding questions still work',()=>{
 assert.deepEqual(terraceQuestionFields('Ønskes stående eller liggende terrassebord?',brief),[]);
 assert.deepEqual(terraceQuestionFields('Skal bordene monteres horisontalt eller vertikalt?',brief),[]);
 assert.deepEqual(fieldsFor(['Skal kledningen være stående eller liggende?']),[]);
 assert.equal(followupFields(['Skal kledningen være stående eller liggende?'],'Bygge terrasse og bytte kledning på huset.')[0].prefix,'Kledningsretning');
 const railing=fieldsFor(['Skal rekkverket ha stående eller liggende spiler?']);
 assert.equal(railing[0].prefix,'Rekkverkstype');assert(!railing[0].options.includes('Liggende spiler'));
 assert.equal(railing.find(q=>q.prefix==='Rekkverksutførelse').type,'text');
 assert.equal(fieldsFor(['Hvilket materiale og profil ønskes på terrassebordene?'],'Jeg skal kun rive terrassen og bjelkelaget.').length,0);
});
