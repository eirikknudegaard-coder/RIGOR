import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createUserStorage,userStorage,userStorageKey} from '../portal-user-storage.js';
function memory(){
 const data=new Map();let fail=false;
 return {getItem:key=>data.get(key)??null,setItem(key,value){if(fail)throw Error('quota');data.set(key,String(value));},removeItem:key=>data.delete(key),fail:()=>{fail=true;},data};
}
const access=(id,isAdmin=false)=>({status:'ready',user:{id},isAdmin});
const project=(id,name)=>({id,name,updated:'2026-10-07T08:00:00Z',snapshot:{version:2,rows:[]}});
test('Document sender and logo are private to their verified account and preserve projects',()=>{
 const raw=memory(),a=createUserStorage(raw,access('account-a')),b=createUserStorage(raw,access('account-b'));
 a.setItem('rigor-projects-v1',JSON.stringify([project('p','Prosjekt')]));
 a.setItem('rigor-document-profile-v1',JSON.stringify({version:1,company:'Bygg A',logo:{data:'test-only'}}));
 assert.equal(b.getItem('rigor-document-profile-v1'),null);
 assert.equal(JSON.parse(a.getItem('rigor-projects-v1'))[0].id,'p');
 b.setItem('rigor-document-profile-v1',JSON.stringify({version:1,company:'Bygg B'}));
 assert.equal(JSON.parse(a.getItem('rigor-document-profile-v1')).company,'Bygg A');
});
test('No anonymous fallback; all local app values are separate for two verified account IDs',()=>{
 const raw=memory();assert.throws(()=>userStorage.getItem('rigor-projects-v1'));
 assert.throws(()=>createUserStorage(raw,{status:'login',user:{id:'A'}}));
 assert.throws(()=>createUserStorage(raw,access('')));
 const a=createUserStorage(raw,access('A')),b=createUserStorage(raw,access('B'));
 for(const key of ['rigor-projects-v1','rigor-calculation-v1','rigor-library-v1','rigor-job-brief-v1','rigor-rate-defaults-v1']){
  raw.setItem(key,'legacy');assert.equal(a.getItem(key),null);assert.equal(b.getItem(key),null);
  a.setItem(key,'private A');assert.equal(b.getItem(key),null);b.setItem(key,'private B');assert.equal(a.getItem(key),'private A');
 }
 a.removeItem('rigor-job-brief-v1');assert.equal(a.getItem('rigor-job-brief-v1'),null);assert.equal(b.getItem('rigor-job-brief-v1'),'private B');
 assert.throws(()=>a.setItem('supabase-auth','bad'));
 assert.notEqual(userStorageKey('A:B'),userStorageKey('A%3AB'));
});
test('A member cannot view or claim unowned legacy projects; administrator import is explicit and idempotent',()=>{
 const raw=memory(),older=JSON.stringify([project('old','Eldre prosjekt')]);raw.setItem('rigor-projects-v1',older);
 const member=createUserStorage(raw,access('member'));assert.equal(member.hasLegacyData(),false);assert.throws(()=>member.importLegacy());assert.equal(member.getItem('rigor-projects-v1'),null);
 const admin=createUserStorage(raw,access('admin',true));assert.equal(admin.getItem('rigor-projects-v1'),null);assert.equal(admin.hasLegacyData(),true);
 assert.equal(admin.importLegacy(),true);assert.deepEqual(JSON.parse(admin.getItem('rigor-projects-v1')),[project('old','Eldre prosjekt')]);assert.equal(raw.getItem('rigor-projects-v1'),older);
 assert.equal(admin.hasLegacyData(),false);assert.equal(admin.importLegacy(),false);
});
test('Legacy migration merges IDs and preserves current account calculation, rates and draft',()=>{
 const raw=memory(),admin=createUserStorage(raw,access('admin',true));
 admin.setItem('rigor-projects-v1',JSON.stringify([project('same','Oppdatert'),project('new','Nytt')]));
 raw.setItem('rigor-projects-v1',JSON.stringify([project('same','Gammelt'),project('old','Eldre')]));
 admin.setItem('rigor-library-v1',JSON.stringify([{id:'mine',name:'Ny mal',category:'10',tasks:[]}]));
 raw.setItem('rigor-library-v1',JSON.stringify([{id:'old',name:'Gammel mal',category:'20',tasks:[]}]));
 for(const key of ['rigor-calculation-v1','rigor-rate-defaults-v1','rigor-job-brief-v1']){admin.setItem(key,'existing');raw.setItem(key,'ignored');}
 admin.importLegacy();assert.deepEqual(JSON.parse(admin.getItem('rigor-projects-v1')).map(p=>p.name),['Oppdatert','Nytt','Eldre']);
 assert.equal(JSON.parse(admin.getItem('rigor-library-v1')).length,2);
 for(const key of ['rigor-calculation-v1','rigor-rate-defaults-v1','rigor-job-brief-v1'])assert.equal(admin.getItem(key),'existing');
});
test('Older calculation, rates and brief are copied only into missing account values',()=>{
 const raw=memory(),admin=createUserStorage(raw,access('admin',true));
 for(const [key,value] of [['rigor-calculation-v1',JSON.stringify({version:2,settings:{},rows:[],rates:{}})],['rigor-rate-defaults-v1',JSON.stringify({version:1,rates:{}})],['rigor-job-brief-v1','Beskrivelse']]){
  raw.setItem(key,value);
 }
 admin.importLegacy();for(const key of ['rigor-calculation-v1','rigor-rate-defaults-v1','rigor-job-brief-v1'])assert.equal(admin.getItem(key),raw.getItem(key));
});
test('Quota, malformed records and project limits preserve account and legacy data without marking import complete',()=>{
 const raw=memory(),admin=createUserStorage(raw,access('admin',true));admin.setItem('rigor-projects-v1',JSON.stringify([project('new','Nytt')]));raw.setItem('rigor-projects-v1',JSON.stringify([project('old','Eldre')]));
 const before=new Map(raw.data);raw.fail();assert.throws(()=>admin.importLegacy(),/kunne ikke lagres/);assert.deepEqual(raw.data,before);assert.equal(admin.hasLegacyData(),true);
 const malformed=memory();malformed.setItem('rigor-projects-v1','{');const storage=createUserStorage(malformed,access('admin',true));assert.throws(()=>storage.importLegacy());assert.equal(malformed.getItem(userStorageKey('admin')),null);
 malformed.setItem(userStorageKey('admin'),'invalid');assert.throws(()=>storage.setItem('rigor-job-brief-v1','test'));assert.equal(malformed.getItem(userStorageKey('admin')),'invalid');
 const full=memory(),limited=createUserStorage(full,access('admin',true));limited.setItem('rigor-projects-v1',JSON.stringify(Array.from({length:100},(_,i)=>project(String(i),'Projekt'))));full.setItem('rigor-projects-v1',JSON.stringify([project('older','Eldre')]));const original=full.getItem(userStorageKey('admin'));assert.throws(()=>limited.importLegacy(),/100/);assert.equal(full.getItem(userStorageKey('admin')),original);
});
