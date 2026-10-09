import {getPortalClient} from './portal-session.js?v=20261007-innlogging';
import {checkToolAccess,toolLoginUrl} from './portal-access.js?v=20261008-construction';
import {initializeUserStorage} from './portal-user-storage.js?v=20261008-pdf';
const app=document.getElementById('protected-app'),shell=document.getElementById('portal-access-shell'),message=document.getElementById('portal-access-message'),retry=document.getElementById('portal-access-retry'),login=document.getElementById('portal-access-login');
const page=document.documentElement.dataset.portalPage;
let version=0,client,loadedUser=null,loading;
login.href=toolLoginUrl(location.href);
function lock(text='Kontrollerer innlogging og tilgang …'){
 app.hidden=true;app.inert=true;shell.hidden=false;message.textContent=text;retry.hidden=true;
 for(const dialog of app.querySelectorAll('dialog[open]'))dialog.close();
}
function redirect(denied=false){version++;lock('Åpner innlogging i RIGOR-portalen …');location.replace(toolLoginUrl(location.href,denied));}
async function loadApp(){
 if(!loading)loading=page==='kalkyle'?Promise.all([import('./kalkyle.js?v=20261009-festemidler'),import('./kalkyle-help.js?v=20261007-innlogging')]):page==='priser'?import('./priser.js?v=20261009-festemidler'):page==='konstruksjon'?import('./construction/ui.js?v=20261009-rib'):Promise.reject(Error('Ukjent verktøy'));
 return loading;
}
async function verify(){
 const ticket=++version;if(!loadedUser||app.hidden)lock();
 try{
  if(!client){const next=await getPortalClient();if(!client){client=next;client.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT'){redirect();return;}
   if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){version++;if(event==='SIGNED_IN')lock();setTimeout(()=>{void verify();},0);}
  });}}
  if(ticket!==version)return;
  const access=await checkToolAccess(client,page==='konstruksjon'?'konstruksjon':'kalkyle');if(ticket!==version)return;
  if(access.status==='login'){redirect();return;}
  if(access.status==='denied'){redirect(true);return;}
  if(access.status!=='ready')throw Error('Tilgangen kunne ikke kontrolleres. Prøv igjen eller åpne portalen.');
  if(loadedUser&&loadedUser!==access.user.id){redirect();return;}
  if(page==='kalkyle')initializeUserStorage(access);
  loadedUser=access.user.id;try{await loadApp();}catch{throw Error('Verktøyet kunne ikke åpnes. Last siden på nytt.');}if(ticket!==version)return;
  app.inert=false;app.hidden=false;shell.hidden=true;
 }catch(error){if(ticket!==version)return;lock(error.message==='Verktøyet kunne ikke åpnes. Last siden på nytt.'?error.message:'Tilgangen kunne ikke kontrolleres. Prøv igjen eller åpne portalen.');retry.hidden=false;}
}
retry.onclick=()=>{if(!client||message.textContent==='Verktøyet kunne ikke åpnes. Last siden på nytt.'){location.reload();return;}void verify();};
// A restored tab must recheck authorization before exposing saved projects.
addEventListener('pagehide',()=>{version++;lock();});
addEventListener('pageshow',event=>{if(event.persisted)void verify();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void verify();});
setInterval(()=>{if(document.visibilityState==='visible')void verify();},300000);
void verify();
