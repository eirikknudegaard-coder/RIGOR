import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkToolAccess,safeToolReturn,toolLoginUrl} from '../portal-access.js';
function fixture({user={id:'verified-user'},authError=null,active=true,admin=true,tool=null,access=[],failed=null}={}){
 const calls=[];
 const client={auth:{getUser:async()=>{calls.push('getUser');return {data:{user},error:authError};},getSession:()=>{throw Error('A local session is not identity verification');}},rpc:async name=>{calls.push(name);return {data:name==='portal_has_access'?active:admin,error:failed===name?Error('offline'):null};},from:name=>{
  const filters={};const result=()=>({data:name==='portal_tools'?tool:access,error:failed===name?Error('offline'):null});
  const query={select(){return this;},eq(k,v){filters[k]=v;return this;},maybeSingle:async()=>{calls.push({name,filters});return result();},then(resolve,reject){calls.push({name,filters});return Promise.resolve(result()).then(resolve,reject);}};return query;
 }};return {client,calls};
}
test('Anonymous, fake/expired sessions and inactive accounts cannot open a tool',async()=>{
 for(const options of [{user:null},{authError:{status:401}},{authError:{name:'AuthSessionMissingError'}},{active:false}]){
  const f=fixture(options),answer=await checkToolAccess(f.client);assert(['login','denied'].includes(answer.status));assert.equal(f.calls[0],'getUser');assert(!f.calls.some(c=>c?.name==='portal_tools'));
 }
});
test('Admin preview remains available before registration, but an explicitly disabled tool is respected',async()=>{
 assert.equal((await checkToolAccess(fixture().client)).status,'ready');
 assert.equal((await checkToolAccess(fixture({tool:{tool_key:'kalkyle',enabled:false}}).client)).status,'denied');
});
test('A member needs the enabled tool and access for the verified user ID',async()=>{
 const f=fixture({admin:false,tool:{tool_key:'kalkyle',enabled:true},access:[{tool_key:'kalkyle'}]});
 assert.equal((await checkToolAccess(f.client)).status,'ready');
 assert.deepEqual(f.calls.at(-1),{name:'portal_tool_access',filters:{user_id:'verified-user',tool_key:'kalkyle'}});
 for(const options of [{admin:false},{admin:false,tool:{tool_key:'kalkyle',enabled:true}},{admin:false,tool:{tool_key:'kalkyle',enabled:true},access:[{tool_key:'other'}]}])assert.equal((await checkToolAccess(fixture(options).client)).status,'denied');
});
test('Failures and malformed authorization replies fail closed',async()=>{
 for(const failed of ['portal_has_access','portal_is_admin','portal_tools','portal_tool_access']){
  const f=fixture({failed,admin:false,tool:{tool_key:'kalkyle',enabled:true}});assert.equal((await checkToolAccess(f.client)).status,'unavailable');
 }
 assert.equal((await checkToolAccess(fixture({admin:'true'}).client)).status,'unavailable');
 assert.equal((await checkToolAccess({auth:{getUser:async()=>{throw Error('offline');}}})).status,'unavailable');
});
test('Login returns only to allowlisted local tools and strips authentication fragments',()=>{
 const base='https://rigor.no/portal.html';
 assert.equal(safeToolReturn('kalkyle.html?project=123#access_token=secret',base),'https://rigor.no/kalkyle.html?project=123');
 assert.equal(safeToolReturn('priser.html',base),'https://rigor.no/priser.html');
 for(const target of ['//evil.test/kalkyle.html','https://rigor.no.evil.test/kalkyle.html','https://user:password@rigor.no/kalkyle.html','javascript:alert(1)','data:text/html,x','portal.html','https://rigor.no/%2fkalkyle.html'])assert.equal(safeToolReturn(target,base),null);
 assert.equal(safeToolReturn('kalkyle.html','https://user.github.io/RIGOR/portal.html'),'https://user.github.io/RIGOR/kalkyle.html');
 const login=new URL(toolLoginUrl('https://rigor.no/priser.html?view=all#tokens',true));
 assert.equal(login.pathname,'/portal.html');assert.equal(login.searchParams.get('returnTo'),'priser.html?view=all');assert.equal(login.searchParams.get('access'),'denied');
});
