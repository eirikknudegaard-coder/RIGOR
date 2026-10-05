import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";

const sb = createClient(
  "https://hyqiqjuycivihsgjongj.supabase.co",
  "sb_publishable_Y5qghQsmaJZEXYhwxgH6Eg_TjPiWOBl",
  {auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}
);

const panels = ["portal-loading","login-panel","password-panel","denied-panel","dashboard-panel"];
const $ = (id) => document.getElementById(id);
const originalFlow = new URLSearchParams(location.hash.slice(1)).get("type");
let choosePassword = originalFlow === "invite" || originalFlow === "recovery";
let currentMember = null;
let stateVersion = 0;
const ui = {
  show(name) {panels.forEach(p => $(p).hidden = p !== name);},
  notice(msg) {const el=$("portal-notice"); el.textContent=msg||""; el.hidden=!msg;},
  busy(form, yes) {const button=form.querySelector("button[type='submit']"); if(button) button.disabled=yes;}
};
$("year").textContent = new Date().getFullYear();

function toMessage(error, fallback) {
  const msg = String(error?.message || "");
  if (/invalid login credentials/i.test(msg)) return "Feil e-postadresse eller passord.";
  if (/email not confirmed/i.test(msg)) return "Bekreft e-postadressen før du logger inn.";
  if (/rate limit/i.test(msg)) return "For mange forsøk. Vent litt og prøv igjen.";
  if (/password/i.test(msg)) return "Kunne ikke lagre passordet. Prøv et sterkere passord.";
  return fallback;
}

function createElement(tag, cls, value) {
  const el = document.createElement(tag);
  if(cls) el.className = cls;
  if(value !== undefined) el.textContent = value;
  return el;
}

async function loadTools(isAdmin) {
  const list = $("tools-list");
  list.replaceChildren();
  const {data: all, error: toolsError} = await sb.from("portal_tools")
    .select("tool_key,title,description,enabled").eq("enabled",true).order("title");
  if (toolsError) {
    list.append(createElement("div","portal-tool-empty","Kunne ikke hente verktøyene."));
    if (!isAdmin) return;
  }
  let allowed = new Set();
  if (!isAdmin) {
    const {data: access,error:accessError}=await sb.from("portal_tool_access").select("tool_key");
    if (accessError) {list.append(createElement("div","portal-tool-empty","Tilgangene kunne ikke leses."));return;}
    allowed = new Set((access||[]).map(x=>x.tool_key));
  }
  const visible=(toolsError ? [] : all||[]).filter(t=>isAdmin||allowed.has(t.tool_key));
  // The public prototype is available to admins before database registration.
  // An explicit disabled record is respected; member permissions stay database-driven.
  if (isAdmin && !visible.some(t=>t.tool_key==="kalkyle")) {
    const {data: registered, error: lookupError}=await sb.from("portal_tools")
      .select("tool_key,enabled").eq("tool_key","kalkyle").maybeSingle();
    if (!lookupError && !registered) {
      visible.push({tool_key:"kalkyle",title:"Kalkyleverksted",description:"Prototype: enkel veiviser og detaljert kalkyle for tak, etterisolering og tilbygg. Bruker eksempelsatser."});
    }
  }
  if (!visible.length) {
    list.append(createElement("div","portal-tool-empty","Ingen verktøy er publisert for kontoen din ennå. Verktøy legges til her når de er klare."));
    return;
  }
  visible.forEach(tool=>{
    const card=createElement("article","portal-tool");
    card.append(createElement("h4","",tool.title),createElement("p","",tool.description));
    if (tool.tool_key === "kalkyle") {
      const link=createElement("a","portal-inline-link","Åpne kalkyleverksted →");
      link.href="kalkyle.html";
      card.append(link);
    } else {
      card.append(createElement("p","portal-muted","Tilgjengelig ved publisering av verktøy."));
    }
    list.append(card);
  });
}

async function loadUsers() {
  const list=$("users-list");
  list.replaceChildren();
  const {data,error}=await sb.from("portal_users")
    .select("user_id,email,display_name,role,active").order("created_at",{ascending:false});
  if(error){ui.notice("Kunne ikke lese brukerkontoene.");return;}
  (data||[]).forEach(user=>{
    const row=document.createElement("tr");
    row.append(createElement("td","",user.display_name ? user.display_name+" · "+user.email : user.email));
    row.append(createElement("td","",user.role==="admin"?"Administrator":"Bruker"));
    row.append(createElement("td","",user.active?"Aktiv":"Deaktivert"));
    const actions=document.createElement("td");
    if(user.role!=="admin"){
      const button=createElement("button","",user.active?"Deaktiver":"Aktiver");
      button.type="button";
      button.addEventListener("click",async()=>{
        button.disabled=true;
        const {error:changeError}=await sb.from("portal_users")
          .update({active:!user.active,updated_at:new Date().toISOString()})
          .eq("user_id",user.user_id).eq("role","member");
        if(changeError)ui.notice("Kunne ikke endre kontoen.");
        else{ui.notice("Brukerstatus oppdatert.");await loadUsers();}
        button.disabled=false;
      });
      actions.append(button);
    } else actions.textContent="—";
    row.append(actions);list.append(row);
  });
}

async function render() {
  const version=++stateVersion;
  ui.show("portal-loading");
  const {data:{user},error}=await sb.auth.getUser();
  if(version!==stateVersion) return;
  if(error||!user) {
    currentMember=null;
    $("logout").hidden=true;
    ui.show("login-panel");
    return;
  }
  $("logout").hidden=false;
  if(choosePassword){ui.show("password-panel");return;}
  const {data:hasAccess,error:accessError}=await sb.rpc("portal_has_access");
  if(version!==stateVersion)return;
  if(accessError || !hasAccess){ui.show("denied-panel");return;}
  const {data:admin} = await sb.rpc("portal_is_admin");
  if(version!==stateVersion)return;
  currentMember=user;
  $("signed-in-user").textContent=user.email||"";
  $("admin-badge").hidden=!admin;
  $("admin-section").hidden=!admin;
  ui.show("dashboard-panel");
  await loadTools(Boolean(admin));
  if(admin) await loadUsers();
}

$("login-form").addEventListener("submit",async(event)=>{
  event.preventDefault();const form=event.currentTarget;ui.busy(form,true);ui.notice("");
  const email=$("login-email").value.trim().toLowerCase();
  const password=$("login-password").value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  ui.busy(form,false);
  if(error){ui.notice(toMessage(error,"Innloggingen mislyktes."));return;}
  await render();
});
$("forgot-button").addEventListener("click",async()=>{
  const email=$("login-email").value.trim().toLowerCase();
  if(!email){ui.notice("Skriv e-postadressen din i feltet først.");return;}
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:"https://rigor.no/portal.html"});
  ui.notice(error?toMessage(error,"Kunne ikke sende e-post."):
    "Hvis adressen er registrert, får du en e-post med lenke for å velge nytt passord.");
});
$("password-form").addEventListener("submit",async(event)=>{
  event.preventDefault();const form=event.currentTarget;
  const a=$("new-password").value, b=$("confirm-password").value;
  if(a!==b){ui.notice("Passordene er ikke like.");return;}
  if(a.length<12){ui.notice("Passordet må ha minst 12 tegn.");return;}
  ui.busy(form,true);
  const {error}=await sb.auth.updateUser({password:a});
  ui.busy(form,false);
  if(error){ui.notice(toMessage(error,"Kunne ikke opprette passordet."));return;}
  choosePassword=false;
  history.replaceState({},document.title,"portal.html");
  ui.notice("Passordet er lagret.");
  await render();
});
$("invite-form").addEventListener("submit",async(event)=>{
  event.preventDefault(); const form=event.currentTarget;ui.busy(form,true);ui.notice("");
  const email=$("invite-email").value.trim().toLowerCase();
  const name=$("invite-name").value.trim();
  const {data,error}=await sb.functions.invoke("rigor-invite-user",{body:{email,name}});
  ui.busy(form,false);
  if(error || !data?.ok){
    ui.notice(data?.error || "Kunne ikke sende invitasjonen. Kontroller at e-postinnstillingene er klare.");
    return;
  }
  form.reset();
  ui.notice("Invitasjonen ble sendt til "+email+".");
  await loadUsers();
});
$("logout").addEventListener("click",async()=>{
  const {error}=await sb.auth.signOut();
  if(error)ui.notice("Kunne ikke logge ut.");
  else {choosePassword=false;ui.notice("");await render();}
});

// Supabase handles authentication tokens from emailed invitations/reset links.
sb.auth.onAuthStateChange((event)=>{
  if(event==="PASSWORD_RECOVERY") choosePassword=true;
  if(event==="SIGNED_OUT") choosePassword=false;
  // Keep the auth callback synchronous to avoid deadlocks in the SDK.
  setTimeout(()=>{void render();},0);
});
void render();