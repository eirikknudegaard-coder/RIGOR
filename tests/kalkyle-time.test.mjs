import {test} from 'node:test';
import assert from 'node:assert/strict';
import {library} from '../kalkyle-library.js';
import {proposalRows} from '../kalkyle-assistant.js';
import {calculate} from '../kalkyle-engine.js';
import {parseTimeCsv,applyTimeCatalog,restoreAssistantTimes} from '../kalkyle-time.js';
const settings={job:'roof',area:30,angle:45,basis:'surface',roofType:'gable',difficulty:1.15};
const element=library.find(e=>e.id==='roof.underlay');
test('AI uses library times, roof pitch and access; the configured hourly price contributes to the quote',()=>{
 const rows=proposalRows(element,30,'-ai-test',settings);
 assert.equal(rows[0].hours,.25);assert.equal(rows[0].factor,1.4375);assert.equal(rows[0].requiresTime,false);
 const result=calculate(rows,{wage:500,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20},30);
 assert.equal(result.hourly,1054.6875);assert.equal(result.hours,21.5625);assert.equal(result.price,result.hours*1054.6875*1.2);
});
test('Old AI snapshots regain known times but preserve manually supplied times and factors',()=>{
 const rows=proposalRows(element,30,'-ai-test',settings).map(r=>({...r,taskKey:undefined,hours:0,requiresTime:true,factor:1}));
 rows[1]={...rows[1],hours:.6,requiresTime:false,manualTime:true,factor:1.9,manualFactor:true};
 const restored=restoreAssistantTimes(rows,settings);assert.equal(restored[0].hours,.25);assert.equal(restored[0].factor,1.4375);assert.equal(restored[1].hours,.6);assert.equal(restored[1].factor,1.9);
 const unknown=proposalRows(library.find(e=>e.id==='roof.finish.pvc'),30,'-ai-test',settings);assert(restoreAssistantTimes(unknown,settings).every(r=>r.requiresTime));
});
test('CSV norm import accepts decimal commas and Svenn header names, retaining precision and source',()=>{
 const records=parseTimeCsv('Oppgave;Enhet;Grunntid (t);Tidsfaktor;Kilde\nMontere sløyfer;m2;0,074;1,35;Egen eksport');
 const rows=applyTimeCatalog(proposalRows(element,30,'-ai-test',settings),records);
 assert.equal(rows[1].hours,.074);assert.equal(rows[1].factor,1.35);assert.equal(rows[1].timeSource,'Egen eksport');assert.equal(rows[0].hours,.25);
 assert.equal(applyTimeCatalog([{...rows[1],manualTime:true,hours:.6}],records)[0].hours,.6);
 assert.equal(applyTimeCatalog([{...rows[1],manualFactor:true,factor:2}],records)[0].factor,2);
});
test('Missing sources, wrong units, empty hours and duplicate task rows cannot become norms',()=>{
 const header='oppgavenokkel;enhet;timer_per_enhet;tidsfaktor;kilde\n';
 for(const line of ['roof.underlay.battens;m2;;1;Test','roof.underlay.battens;m2;0.12;0;Test','roof.underlay.battens;m2;0.12;1;','roof.underlay.battens;kg;0.12;1;Test'])assert.throws(()=>parseTimeCsv(header+line));
 const line='roof.underlay.battens;m2;0.12;;Test';assert.throws(()=>parseTimeCsv(header+line+'\n'+line));
 const records=parseTimeCsv(header+'roof.underlay.battens;m;0.99;;Test');assert.equal(applyTimeCatalog(proposalRows(element,30,'-ai-test',settings),records)[1].hours,.12);
});
