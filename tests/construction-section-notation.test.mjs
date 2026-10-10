import {test} from 'node:test';import assert from 'node:assert/strict';
import {readSectionNotations,readProfileNotations,canonicalNominal,canonicalProfile} from '../construction/section-notation.js';
import {interpretDescription,applySectionAnswer} from '../construction/language.js';
import {fact,validateValue,setFact} from '../construction/context.js';
import {nextQuestion} from '../construction/conversation.js';
import {validateInterpretation,interpretationSchema} from '../construction/ai-contract.js';
import {buildStructuralModel} from '../construction/load-engine.js';

test('Nominal member sizes are general numeric pairs, rather than a whitelist of two products',()=>{
 for(const size of ['1x2','1x3','1x4','1x6','2x2','2x3','2x4','2x5','2x6','2x8','2x10','2x12','3x3','3x4','3x6','3x8','4x4','4x6','4x8','6x6','8x8','7x9']){
  const c=interpretDescription('Jeg vil fjerne 2 meter av veggen. Stendere '+size+'".');
  assert.equal(fact(c,'nominalSection'),size,size);assert.equal(fact(c,'memberRole'),'column',size);assert.equal(nextQuestion(c).id,'direction');
  assert.equal(fact(c,'widthMm'),undefined);assert.equal(fact(c,'heightMm'),undefined);
 }
 const unknown=interpretDescription('Jeg vil undersøke en drager. Dimensjon 3x4.');
 assert.match(nextQuestion(unknown).label,/3x4/);assert.equal(nextQuestion(unknown).id,'memberRole');
});
test('Inch marks, multiplication signs, decimals and fractions normalise while keeping the original quote',()=>{
 for(const [source,normal]of [['2" × 2"','2x2'],["3'' * 4''",'3x4'],['2 ganger 6 tommer','2x6'],['1½×3½″','1.5x3.5'],['1 1/2 x 3 1/2 tommer','1.5x3.5'],['5/4 x 6 inches','1.25x6'],['3/16x4 tommer','0.1875x4'],['2,5x7 tommer','2.5x7'],['½x4 tommer','0.5x4'],['1x30 tommer','1x30']]){
  const c=interpretDescription('Jeg vil undersøke en drager. Bjelke '+source+'.');
  assert.equal(fact(c,'nominalSection'),normal,source);assert.equal(fact(c,'memberRole'),'beam');assert(c.facts.nominalSection.source.includes(source));
  assert.equal(canonicalNominal(source),normal);assert.equal(validateValue('nominalSection',normal),normal);
 }
 for(const bad of ['0x4','-2x6','2x0','1/0x6','2x6.3.4','javascript:alert(1)'])assert.throws(()=>validateValue('nominalSection',bad),bad);
});
test('Explicit actual dimensions and units are used for the named member; wall studs never size a replacement beam',()=>{
 for(const [source,w,h]of [['48x198 mm',48,198],['48 mm × 198 mm',48,198],['48 mm x 19,8 cm',48,198],['20x40 cm',200,400],['0,2x0,4 m',200,400]]){
  const c=interpretDescription('Jeg vil undersøke en drager. Betongbjelke '+source+'.');
  assert.equal(fact(c,'widthMm'),w,source);assert.equal(fact(c,'heightMm'),h,source);assert.equal(fact(c,'nominalSection'),undefined);
 }
 const wall=interpretDescription('Jeg vil fjerne 2 meter av veggen. Stendere 48x148 mm.');
 assert.equal(fact(wall,'sectionNotation'),'48x148 mm');assert.equal(fact(wall,'memberRole'),'column');assert.equal(fact(wall,'widthMm'),undefined);
 const col=interpretDescription('Jeg vil kontrollere en søyle. Tresøyle 90x90 mm.');assert.equal(fact(col,'widthMm'),90);
 assert.throws(()=>validateInterpretation({facts:[{field:'widthMm',value:48,evidence:'Stendere 48x148 mm'}]},wall.brief));
});
test('A missing unit is asked with a dropdown and edits update dependent dimensions',()=>{
 let c=interpretDescription('Jeg vil undersøke en drager. Bjelke 48x198.');
 assert.equal(nextQuestion(c).id,'sectionUnit');assert.equal(nextQuestion(c).type,'select');assert.equal(fact(c,'widthMm'),undefined);
 const column=interpretDescription('Jeg vil kontrollere en søyle. Tresøyle 90x90.');
 assert.equal(nextQuestion(column).id,'sectionUnit');assert.equal(fact(column,'widthMm'),undefined);
 c=applySectionAnswer(c,'sectionUnit','mm');assert.equal(fact(c,'sectionNotation'),'48x198 mm');assert.equal(fact(c,'widthMm'),48);
 c=applySectionAnswer(c,'sectionNotation','73x223 mm');assert.equal(fact(c,'widthMm'),73);assert.equal(fact(c,'heightMm'),223);
 c=applySectionAnswer(c,'memberRole','column');assert.equal(fact(c,'widthMm'),undefined);
 c=applySectionAnswer(c,'memberRole','beam');assert.equal(fact(c,'widthMm'),73);
 c=applySectionAnswer(c,'sectionNotation','20x40 cm');assert.equal(fact(c,'sectionUnit'),'cm');assert.equal(fact(c,'widthMm'),200);
 c=applySectionAnswer(c,'sectionUnit','mm');assert.equal(fact(c,'sectionNotation'),'20x40 mm');assert.equal(fact(c,'widthMm'),20);
});
test('Profile and compound descriptions are retained without borrowing solid rectangular properties',()=>{
 for(const [source,normal]of [['IPE200','IPE 200'],['HEB 240','HEB 240'],['HE 200 B','HEB 200'],['UPN160','UPN 160'],['RHS 100×50×4 mm','RHS 100x50x4'],['SHS 100x100x5','SHS 100x100x5'],['CHS 114,3x6,3','CHS 114.3x6.3'],['L80x80x8','L 80x80x8'],['Z200x60x2','Z 200x60x2'],['C200x60x2','C 200x60x2'],['profil XYZ180','XYZ 180']]){
  const c=interpretDescription('Jeg vil undersøke en drager. Bjelke '+source+'.');
  assert.equal(fact(c,'profileDesignation'),normal,source);assert.equal(canonicalProfile(source),normal);assert.equal(fact(c,'sectionConstruction'),'profile');assert.equal(fact(c,'widthMm'),undefined);
  assert.equal(buildStructuralModel(setFact(c,'sectionRequested',true)).section,null);
 }
 const compound=interpretDescription('Jeg vil undersøke en drager. Bjelke 2x48x198 mm.');
 assert.equal(fact(compound,'sectionNotation'),'2x48x198 mm');assert.equal(fact(compound,'sectionConstruction'),'multiple_members');assert.equal(fact(compound,'widthMm'),undefined);
 const long=interpretDescription('Jeg vil undersøke en drager. Bjelke 200x400x12000 mm.');assert.equal(fact(long,'sectionNotation'),'200x400x12000 mm');assert.equal(fact(long,'widthMm'),undefined);
});
test('Material designations are preserved; unsupported classes and competing materials are not replaced by C24',()=>{
 for(const grade of ['C18','C30','D40','GL28h','GL32c','S235','S355J2','C30/37','B500NC']){
  const c=interpretDescription('Jeg vil undersøke en drager. Bjelke 48x198 mm i '+grade+'.');
  assert.equal(fact(c,'materialDesignation'),grade,grade);assert.equal(fact(c,'material'),undefined);assert(buildStructuralModel(c).limitations.some(s=>s.includes(grade)));
 }
 let c=interpretDescription('Jeg vil undersøke en drager. Stendere C24, ny limtrebjelke GL28h.');
 assert.deepEqual(c.conflicts.materialDesignation,['C24','GL28h']);assert.equal(fact(c,'material'),undefined);assert.equal(nextQuestion(c).id,'materialDesignation');
 c=applySectionAnswer(c,'materialDesignation','GL28h');assert.equal(fact(c,'material'),undefined);
 assert.throws(()=>validateInterpretation({facts:[{field:'material',value:'C24',evidence:'GL28h'}]},c.brief));
});
test('AI cannot change dimensions, units, profiles or grades; general nominal values are allowed in the schema',()=>{
 for(const [brief,proposal]of [
  ['Bjelke 3x4 tommer',{field:'nominalSection',value:'3x4',evidence:'3x4 tommer'}],
  ['Bjelke 20x40 cm',{field:'widthMm',value:200,evidence:'Bjelke 20x40 cm'}],
  ['Bjelke HEB200',{field:'profileDesignation',value:'HEB 200',evidence:'HEB200'}],
  ['Betong C30/37',{field:'materialDesignation',value:'C30/37',evidence:'C30/37'}]
 ])assert.equal(validateInterpretation({facts:[proposal]},brief).facts.length,1);
 for(const [brief,proposal]of [
  ['Bjelke 3x4 tommer',{field:'nominalSection',value:'2x4',evidence:'3x4 tommer'}],
  ['Bjelke 48x198',{field:'sectionUnit',value:'mm',evidence:'48x198'}],
  ['Bjelke 20x40 cm',{field:'widthMm',value:20,evidence:'20x40 cm'}],
  ['Bjelke HEB200',{field:'profileDesignation',value:'HEA 200',evidence:'HEB200'}]
 ])assert.throws(()=>validateInterpretation({facts:[proposal]},brief));
 const branch=interpretationSchema().properties.facts.items.anyOf.find(d=>d.properties.field.enum[0]==='nominalSection');
 assert.equal(branch.properties.value.type,'string');assert.equal(branch.properties.value.enum,undefined);
});
test('Deck and room geometry is not classified as a timber section',()=>{
 for(const source of ['Terrasse 3x4 m.','Rom på 4x5 meter.','Terrasse på 3x4.']){
  const c=interpretDescription(source);assert.equal(fact(c,'nominalSection'),undefined,source);assert.equal(fact(c,'sectionNotation'),undefined,source);
 }
});
