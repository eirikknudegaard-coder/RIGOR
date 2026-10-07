"""Mock verified Supabase responses for local browser tests; no production bypass."""
import json

def authorize_portal(page, mode='admin', delay=0, wait=True):
    module = '''
const defaults=DEFAULTS;
const callbacks=[];
const state=()=>JSON.parse(localStorage.getItem('rigor-test-auth')||'null')||defaults;
window.testPortalCalls=[];
window.testAuthEmit=(event,mode)=>{if(mode)localStorage.setItem('rigor-test-auth',JSON.stringify({...state(),mode}));callbacks.forEach(fn=>fn(event));};
const result=table=>{
 const mode=state().mode;
 if(mode==='tools-error'&&table==='portal_tools')return {data:null,error:{message:'offline'}};
 if(table==='portal_tools')return {data:mode==='admin'?null:{tool_key:'kalkyle',title:'Kalkyle',enabled:mode!=='disabled'},error:null};
 if(table==='portal_tool_access')return {data:mode==='member'?[{tool_key:'kalkyle'}]:[],error:null};
 return {data:[],error:null};
};
const client={auth:{
 async getUser(){window.testPortalCalls.push('getUser');if(state().delay)await new Promise(resolve=>setTimeout(resolve,state().delay));const mode=state().mode;if(mode==='offline')return {data:{user:null},error:{status:503}};if(mode==='expired')return {data:{user:null},error:{status:401}};return {data:{user:mode==='anonymous'?null:{id:'verified-test-user',email:'admin@example.test'}},error:null};},
 async getSession(){return {data:{session:{access_token:'test-only'}}};},
 onAuthStateChange(callback){callbacks.push(callback);return {data:{subscription:{unsubscribe(){}}}};},
 async signInWithPassword(){window.testAuthEmit('SIGNED_IN',state().signInMode||'admin');return {error:null};},
 async signOut(){window.testAuthEmit('SIGNED_OUT','anonymous');return {error:null};}
},async rpc(name){window.testPortalCalls.push(name);return {data:name==='portal_has_access'?state().mode!=='inactive':name==='portal_is_admin'?['admin','disabled','tools-error'].includes(state().mode):false,error:null};},from(table){
 const filters={};return {select(){return this;},eq(k,v){filters[k]=v;return this;},order(){return this;},maybeSingle(){window.testPortalCalls.push({table,filters});return Promise.resolve(result(table));},then(resolve,reject){window.testPortalCalls.push({table,filters});const response=result(table);return Promise.resolve({...response,data:table==='portal_tools'?response.data?[response.data]:[]:response.data}).then(resolve,reject);}};
}};
export async function getPortalClient(){return client;}
'''.replace('DEFAULTS', json.dumps({'mode':mode,'delay':delay}))
    page.route('**/portal-session.js*',lambda route:route.fulfill(content_type='application/javascript',body=module))
    if wait:
        original_goto, original_reload = page.goto, page.reload
        def ready(response):
            if page.url.split('?')[0].endswith(('/kalkyle.html','/priser.html')):
                page.locator('#protected-app').wait_for(state='visible')
            return response
        page.goto=lambda *args,**kwargs:ready(original_goto(*args,**kwargs))
        page.reload=lambda *args,**kwargs:ready(original_reload(*args,**kwargs))
