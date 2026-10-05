import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareImport,sampleImport,checkMapping,mapImport} from '../kalkyle-import.js';
const csv='Post;Unit;Nettopris;Leverandør\nroof.cover.metal;m2;123,45;Testleverandør';
test('Gjenkjenner kjente kolonner og lar usikre felt stå åpne',()=>{
 const file=prepareImport(csv);assert.equal(file.mapping.pris,2);assert.equal(file.mapping.dato,null);
 const prices=mapImport(file,file.mapping,{dato:'2026-10-05',valuta:'NOK',mva:'ekskl'});assert.equal(prices[0].pris,123.45);assert.equal(prices[0].kilde,'Testleverandør');
});
test('Ingen gjetting på prisnøkler, pakningsenhet eller ugyldig kobling',()=>{
 const file=prepareImport(csv);assert.throws(()=>mapImport(file,{...file.mapping,prisnokkel:null},{}));assert.throws(()=>checkMapping({...file.mapping,dato:2},4));assert.throws(()=>checkMapping({...file.mapping,dato:50},4));
 const packages=prepareImport(csv.replace(';m2;',';pakke;'));assert.throws(()=>mapImport(packages,packages.mapping,{dato:'2026-10-05',valuta:'NOK',mva:'ekskl'}));
});
test('Sender kun åtte begrensede eksempelrader til AI',()=>{
 const file=prepareImport('Post;Pris\n'+Array.from({length:100},(_,i)=>'roof.cover.metal;'+i).join('\n'));assert.equal(sampleImport(file).rows.length,8);
});
test('Ulik radbredde avvises før analyse',()=>assert.throws(()=>prepareImport('A;B\nx;y;z')));
