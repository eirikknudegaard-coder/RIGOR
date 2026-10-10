import {test} from 'node:test';import assert from 'node:assert/strict';
import {emptyContext,setFact,markUnknown,validateContext,fact} from '../construction/context.js';
import {interpretDescription} from '../construction/language.js';
import {nextQuestion,questionFor} from '../construction/conversation.js';
import {buildStructuralModel} from '../construction/load-engine.js';
import {analyzeStructure,explainResult} from '../construction/analysis.js';
import {validateInterpretation,reviewInterpretation,validateFocus} from '../construction/ai-contract.js';
import {buildLoadPath} from '../construction/load-path.js';
const fill=(values,c=emptyContext('Kontrollert testbeskrivelse'))=>Object.entries(values).reduce((ctx,[k,v])=>setFact(ctx,k,v),c);
const close=(a,b)=>assert(Math.abs(a-b)<1e-9);
const beam={goal:'check_beam',system:'simple',spanM:4,loadChoice:'line',lineLoadKnM:2,loadBasis:'documented',loadSource:'Testtegning K-01'};
const roof={goal:'remove_wall',openingM:3.2,direction:'across',roofBearsOnWall:'yes',floorAbove:'no',loadChoice:'roof',roofSupport:'ridge_beam',roofSides:'one',rafterSpanM:4.4,spanBasis:'horizontal',roofDeadKnM2:.8,roofSnowKnM2:2,deadBasis:'horizontal',loadBasis:'preliminary',loadSource:'Brukerens eksempel, ikke stedsspesifikk last'};
test('Terrace arrangement is a separate planning task and asks dimensions rather than forcing a single beam',()=>{
 let c=interpretDescription('Hvor mange søyler trenger jeg på min terrasse? Jeg legger dobbel langsgående bjelke, og enkle cc60 bjelker på tvers. Hvor bør de plasseres?');
 assert.equal(fact(c,'goal'),'plan_terrace');assert.equal(fact(c,'spacingMm'),600);assert.equal(fact(c,'widthMm'),undefined);assert.equal(nextQuestion(c).id,'terraceLengthM');assert.equal(analyzeStructure(c).beam,null);assert.match(buildLoadPath(c).findings[0].text,/c\/c/);
 c=fill({terraceLengthM:8,terraceDepthM:4,terraceHeightM:1,terraceWallSupport:'free_standing'},c);assert.equal(nextQuestion(c),null);assert.equal(buildStructuralModel(c).ready,false);
 const col=interpretDescription('Jeg vil kontrollere en søyle i tre.');assert.equal(fact(col,'goal'),'check_column');assert.equal(nextQuestion(col),null);assert.equal(analyzeStructure(col).beam,null);
});
test('Informal wall example retains nominal size and asks one relevant question without converting it',()=>{
 let c=interpretDescription('Trenger jeg en drager her? Bindingsverk c/c 600, 2x8 og saltak med 25 graders vinkel. Jeg vil fjerne ca. 3 meter av veggen.');
 assert.equal(fact(c,'goal'),'remove_wall');assert.equal(fact(c,'nominalSection'),'2x8');assert.equal(fact(c,'widthMm'),undefined);assert.equal(fact(c,'heightMm'),undefined);assert.equal(fact(c,'openingM'),3);assert.equal(fact(c,'roofAngleDeg'),25);assert.equal(fact(c,'spacingMm'),600);assert.equal(nextQuestion(c).id,'memberRole');
 c=setFact(c,'memberRole','rafters');assert.equal(nextQuestion(c).id,'direction');c=setFact(c,'direction','across');assert.equal(nextQuestion(c).id,'roofBearsOnWall');assert.equal(analyzeStructure(c).beam,null);assert.match(explainResult(analyzeStructure(c)).paragraphs.join(' '),/Retningen alene bekrefter ikke/);
});
const studBrief='trenger jeg en drager her? Bindingsverk cc 600, 2x6" vertikalesøyler, med dobbel hver 1.2m. Saltak med 25 graders vinkel. Jeg vil fjerne 2 meter av veggen';
test('The reported 2x6 wall studs are retained separately from a possible new beam',()=>{
 const c=interpretDescription(studBrief);
 assert.equal(fact(c,'goal'),'remove_wall');assert.equal(fact(c,'nominalSection'),'2x6');assert.equal(fact(c,'memberRole'),'column');
 assert.equal(fact(c,'openingM'),2);assert.equal(fact(c,'spacingMm'),600);assert.equal(fact(c,'roofAngleDeg'),25);
 assert.equal(nextQuestion(c).id,'direction');assert.equal(fact(c,'widthMm'),undefined);assert.equal(fact(c,'heightMm'),undefined);assert.equal(fact(c,'sectionConstruction'),undefined);assert.equal(analyzeStructure(c).beam,null);
 assert.match(c.facts.memberRole.source,/2x6.*vertikalesøyler/);
 const withRoof=interpretDescription(studBrief+'. Sperrene går på tvers av veggen.');
 assert.equal(fact(withRoof,'memberRole'),'column');assert.equal(nextQuestion(withRoof).id,'roofBearsOnWall');
});
test('Nominal questions use the stated dimension, offer studs and use a neutral label without a size',()=>{
 for(const [size,notation]of [['2x6','2x6"'],['2x6','2" × 6"'],['2x8','2 x 8 tommer']]){
  const c=interpretDescription('Jeg vil fjerne 2 meter av veggen. Bindingsverk cc600, '+notation+'.');
  const q=nextQuestion(c);assert.equal(q.id,'memberRole');assert.match(q.label,new RegExp(size));assert(!q.label.includes(size==='2x6'?'2x8':'2x6'));assert(q.options.some(([v])=>v==='column'));
  assert(!questionFor('widthMm',c).help.includes('2x8'));
 }
 assert(!questionFor('memberRole').label.includes('2x8'));
});
test('Nominal member roles follow adjacent words rather than other parts elsewhere in the brief',()=>{
 for(const [description,role]of [['2x6 stående stendere','column'],['2x6 vertikale søyler','column'],['stendere i 2x6','column'],['taksperrer på 2x8','rafters'],['bjelkelaget er 2x8','joists'],['drager 2x6','beam']]){
  const c=interpretDescription('Jeg vil fjerne 2 meter av veggen. '+description+'.');
  assert.equal(fact(c,'memberRole'),role,description);assert.notEqual(nextQuestion(c).id,'memberRole',description);
 }
 const c=interpretDescription('Jeg vil undersøke en drager. Sperrer 2x6 og bjelkelag 2x8.');
 assert.deepEqual(c.conflicts.nominalSection,['2x6','2x8']);assert.deepEqual(c.conflicts.memberRole,['rafters','joists']);assert.equal(buildStructuralModel(c).ready,false);
 assert.equal(nextQuestion(setFact(c,'memberRole','joists')).id,'nominalSection');
});
test('AI cannot change the quoted nominal size or move stud dimensions to the replacement beam',()=>{
 const good={field:'openingM',value:2,evidence:'fjerne 2 meter'};
 const bad=[{field:'nominalSection',value:'2x8',evidence:'2x6"'},{field:'memberRole',value:'beam',evidence:'trenger jeg en drager her?'},{field:'sectionConstruction',value:'multiple_members',evidence:'dobbel hver 1.2m'}];
 for(const f of bad)assert.throws(()=>validateInterpretation({facts:[f]},studBrief));
 const reviewed=reviewInterpretation({facts:[good,...bad]},studBrief);
 assert.deepEqual(reviewed.facts.map(f=>f.field),['openingM']);assert.deepEqual(reviewed.rejectedFields,['nominalSection','memberRole','sectionConstruction']);assert.equal(reviewed.partial,true);
 const correct=validateInterpretation({facts:[{field:'nominalSection',value:'2x6',evidence:'2x6"'},{field:'memberRole',value:'column',evidence:'2x6" vertikalesøyler'}]},studBrief);
 assert.equal(correct.facts.length,2);
});
test('Known facts are not asked again; unknown answers stay REQUIRED and never become a default load',()=>{
 let c=fill(beam);assert.equal(buildStructuralModel(c).ready,true);assert.equal(nextQuestion(c),null);
 c=markUnknown(c,'lineLoadKnM');assert.equal(nextQuestion(c),null);const a=analyzeStructure(c);assert.equal(a.level,'qualitative');assert.equal(a.beam,null);assert(a.model.required.includes('lineLoadKnM'));assert.equal(fact(c,'lineLoadKnM'),undefined);
});
test('Conflicting metric measurements cannot silently overwrite one another',()=>{
 const c=interpretDescription('Jeg vil undersøke en drager med spenn på 3 meter. Drageren har spenn på 4 meter. Jevn last på 2 kN/m.');
 assert.equal(fact(c,'spanM'),undefined);assert.deepEqual(c.conflicts.spanM,[3,4]);assert.equal(nextQuestion(c).id,'spanM');assert.equal(analyzeStructure(c).beam,null);
});
test('Roof transfer uses half horizontal spans, explicit snow on roof, and traceable assumptions',()=>{
 const c=fill(roof),a=analyzeStructure(c);assert.equal(a.level,'orienting');close(a.beam.loads.qNPerM,2.8*2.2*1000);close(a.beam.reactions.leftN,2.8*2.2*1000*3.2/2);assert.equal(a.model.derived[0].status,'DERIVED');assert(a.model.assumptions.some(f=>f.id==='spanM'));assert(a.model.assumptions.some(f=>f.id==='loads'));
 const sloped=analyzeStructure(fill({...roof,spanBasis:'slope',deadBasis:'slope',roofAngleDeg:30,roofSides:'two',oppositeRafterSpanM:3}));const cos=Math.cos(Math.PI/6);close(sloped.beam.loads.qNPerM,(.8/cos+2)*(4.4+3)*cos/2*1000);
});
test('Trusses, ridge board, extra floor loads, nonbearing wall and complex systems are not replaced by a simple roof beam',()=>{
 for(const change of [{roofSupport:'trusses'},{roofSupport:'ridge_board'},{floorAbove:'yes'},{roofBearsOnWall:'no'},{roofType:'hip'},{system:'continuous'},{system:'frame'}]){const a=analyzeStructure(fill({...roof,...change}));assert.equal(a.beam,null);assert(a.model.limitations.length);}
 const multiple=interpretDescription('Undersøke en drager med tre stolper under. Punktlast på 2 kN og punktlast på 3 kN.');assert.equal(analyzeStructure(multiple).beam,null);assert.equal(nextQuestion(multiple),null);
 assert.equal(analyzeStructure(fill(beam,interpretDescription('Jeg vil undersøke en drager med horisontallast.'))).beam,null);
});
test('Section, material and self-weight are confirmed independently; no strength approval is returned',()=>{
 const c=fill({...beam,sectionRequested:true,sectionConstruction:'solid_single',widthMm:115,heightMm:315,material:'GL30c',selfWeightInLoad:false,supportBelow:'unsupported'}),a=analyzeStructure(c);
 close(a.beam.loads.qNPerM,2000+.115*.315*430*9.81);assert(a.beam.maxDeflection);assert.equal(a.checks.deflection.criterionStatus,'ASSUMED');assert.equal(a.checks.deflection.ratio,300);assert(a.checks.notPerformed.some(s=>s.includes('Eurocode')));assert.match(explainResult(a).paragraphs[0],/støtte mangler/);assert(!a.checks.capacity);assert(!a.checks.approved);
 assert.equal(analyzeStructure(fill({...beam,sectionRequested:true,sectionConstruction:'solid_single',widthMm:48,heightMm:198,material:'unknown',selfWeightInLoad:true})).beam,null);
});
test('Point locations outside the beam, zero loads and malformed context cannot yield a result',()=>{
 assert.equal(analyzeStructure(fill({...beam,loadChoice:'point',pointLoadKn:5,pointPositionM:5})).beam,null);assert.equal(analyzeStructure(fill({...beam,lineLoadKnM:0})).beam,null);
 const c=fill(beam);assert.throws(()=>validateContext({...c,moment:99}));assert.throws(()=>validateContext({...c,facts:{...c.facts,spanM:{value:4,status:'DERIVED',source:'AI'}}}));assert.throws(()=>fill({...beam,spanM:NaN}));const original=JSON.stringify(c);analyzeStructure(c);assert.equal(JSON.stringify(c),original);
});
test('AI facts require real quotes, valid fields and human confirmation; AI numbers are not results',()=>{
 const brief='Sperrene går på tvers av veggen. Åpning på 3,2 meter.';
 const v=validateInterpretation({facts:[{field:'openingM',value:3.2,evidence:'Åpning på 3,2 meter'}]},brief);assert.equal(v.facts[0].status,'PROPOSED');
 for(const f of [{field:'openingM',value:9,evidence:'Åpning på 3,2 meter'},{field:'roofBearsOnWall',value:'yes',evidence:'Sperrene går på tvers av veggen'},{field:'momentNm',value:999,evidence:'Åpning på 3,2 meter'},{field:'openingM',value:3.2,evidence:'oppdiktet sitat'}])assert.throws(()=>validateInterpretation({facts:[f]},brief));
 assert.throws(()=>validateFocus({focusId:'safe',approval:true},['load_result']));
 assert.throws(()=>validateInterpretation({facts:[{field:'roofSnowKnM2',value:4,evidence:'Snølast på bakken er 4 kN/m2'}]},'Snølast på bakken er 4 kN/m2'));
 const c=fill(beam),a=analyzeStructure(c);assert.equal(explainResult(a,'load_result').paragraphs[0],a.findings.find(f=>f.id==='load_result').text);
});
test('Profiles and combined members cannot borrow rectangular stiffness, but an explicit load-only analysis is available',()=>{
 for(const shape of ['profile','multiple_members']){
  const c=fill({...beam,sectionRequested:true,sectionConstruction:shape,widthMm:100,heightMm:200,material:'S355',selfWeightInLoad:true});
  const a=analyzeStructure(c);assert.equal(a.beam,null);assert.equal(a.model.section,null);assert.equal(nextQuestion(c),null);
  assert(analyzeStructure(setFact(c,'sectionRequested',false)).beam);
 }
 assert.equal(fact(interpretDescription('Undersøke en drager IPE200 i S355'),'sectionConstruction'),'profile');
});
test('Confirmed roof bearing does not mark the unknown foundation path as confirmed',()=>{
 const p=buildLoadPath(fill(roof));assert.equal(p.edges[1].status,'KNOWN');assert(p.edges.slice(2).every(e=>e.status==='REQUIRED'));
 const c=fill({...roof,roofBearsOnWall:'no'});assert.match(buildLoadPath(c).findings[0].text,/ikke har opplegg/);
});
