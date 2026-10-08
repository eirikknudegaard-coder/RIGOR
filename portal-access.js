// Keep browser navigation consistent with the portal's existing account and
// tool permissions. Supabase APIs enforce their own authorization separately.
export async function checkToolAccess(client,toolKey='kalkyle'){
 if(!['kalkyle','konstruksjon'].includes(toolKey))return {status:'denied',message:'Ukjent verktøy.'};
 const title=toolKey==='konstruksjon'?'Konstruksjonsverktøyet':'Kalkyleverktøyet';
 try{
  const {data,error}=await client.auth.getUser();
  if(error){if(error.status===401||error.status===403||error.name==='AuthSessionMissingError')return {status:'login'};return {status:'unavailable'};}
  const user=data?.user;if(!user?.id)return {status:'login'};
  const active=await client.rpc('portal_has_access');
  if(active.error)return {status:'unavailable'};
  if(active.data!==true)return {status:'denied',message:'Aktiv, godkjent portalkonto kreves.'};
  const admin=await client.rpc('portal_is_admin');
  if(admin.error||typeof admin.data!=='boolean')return {status:'unavailable'};
  const tool=await client.from('portal_tools').select('tool_key,enabled').eq('tool_key',toolKey).maybeSingle();
  if(tool.error)return {status:'unavailable'};
  if(tool.data&&tool.data.enabled!==true)return {status:'denied',message:title+' er deaktivert.'};
  // Retain the existing administrator preview before the tool is registered.
  if(admin.data===true)return {status:'ready',user,isAdmin:true};
  if(!tool.data)return {status:'denied',message:title+' må være tildelt kontoen din.'};
  const access=await client.from('portal_tool_access').select('tool_key').eq('user_id',user.id).eq('tool_key',toolKey);
  if(access.error)return {status:'unavailable'};
  if(!Array.isArray(access.data)||!access.data.some(a=>a.tool_key===toolKey))return {status:'denied',message:title+' må være tildelt kontoen din.'};
  return {status:'ready',user,isAdmin:false};
 }catch{return {status:'unavailable'};}
}

export function safeToolReturn(value,base){
 if(typeof value!=='string'||!value)return null;
 try{
  const current=new URL(base),target=new URL(value,current);
  const paths=['kalkyle.html','priser.html','konstruksjon.html'].map(file=>new URL(file,current).pathname);
  if(target.origin!==current.origin||target.username||target.password||!paths.includes(target.pathname))return null;
  target.hash='';return target.href;
 }catch{return null;}
}
export function toolLoginUrl(current,denied=false){
 const target=safeToolReturn(current,current),login=new URL('portal.html',current);
 if(target){const url=new URL(target);login.searchParams.set('returnTo',url.pathname.split('/').at(-1)+url.search);}
 if(denied)login.searchParams.set('access','denied');
 return login.href;
}
