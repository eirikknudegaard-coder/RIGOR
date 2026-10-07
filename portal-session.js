const url='https://hyqiqjuycivihsgjongj.supabase.co';
const publicKey='sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl';
let client;
export function getPortalClient(){
 if(!client)client=import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm').then(({createClient})=>createClient(url,publicKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true},global:{fetch:(input,init={})=>fetch(input,{...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}})).catch(error=>{client=null;throw error;});
 return client;
}
