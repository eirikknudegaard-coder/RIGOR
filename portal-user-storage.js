// Account separation for local app data. The caller supplies server-verified
// portal access before importing the calculation app. This is not encryption
// or cloud storage: browser administrators can still inspect localStorage.
const legacyKeys=['rigor-projects-v1','rigor-calculation-v1','rigor-library-v1','rigor-job-brief-v1','rigor-rate-defaults-v1'];
const keys=[...legacyKeys,'rigor-document-profile-v1'];
const imported='legacy-imported-v1';
export function userStorageKey(userId){
 if(typeof userId!=='string'||!userId.trim()||userId.length>256)throw Error('Verifisert bruker mangler.');
 return 'rigor-user:'+encodeURIComponent(userId)+':storage-v1';
}
export function createUserStorage(storage,access){
 if(access?.status!=='ready')throw Error('Verifisert tilgang kreves før lokal lagring åpnes.');
 const key=userStorageKey(access.user?.id),admin=access.isAdmin===true;
 const read=()=>{
  const raw=storage.getItem(key);if(raw===null)return {version:1,entries:{}};
  let record;try{record=JSON.parse(raw);}catch{throw Error('Kontolagringen kunne ikke leses. Data er beholdt.');}
  if(record?.version!==1||!record.entries||Array.isArray(record.entries)||typeof record.entries!=='object'||Object.entries(record.entries).some(([k,v])=>![...keys,imported].includes(k)||typeof v!=='string'))throw Error('Kontolagringen kunne ikke leses. Data er beholdt.');
  return record;
 };
 const check=k=>{if(!keys.includes(k))throw Error('Ukjent lagringsnøkkel.');};
 const pendingLegacy=()=>admin&&!read().entries[imported]&&legacyKeys.some(k=>{const raw=storage.getItem(k);return raw!==null&&raw!==''&&raw!=='[]';});
 return {
  getItem(k){check(k);return read().entries[k]??null;},
  setItem(k,value){check(k);const record=read();record.entries[k]=String(value);storage.setItem(key,JSON.stringify(record));},
  removeItem(k){check(k);const record=read();delete record.entries[k];storage.setItem(key,JSON.stringify(record));},
  hasLegacyData:pendingLegacy,
  importLegacy(){
   if(!admin)throw Error('Kun administrator kan overføre eldre data uten kontotilknytning.');
   const record=read();if(record.entries[imported])return false;
   const parse=raw=>{try{return JSON.parse(raw);}catch{throw Error('Eldre data kunne ikke leses. Kontodata og originalene er beholdt.');}};
   let changed=false;
   for(const k of legacyKeys){
    const raw=storage.getItem(k);if(raw===null||raw===''||raw==='[]')continue;
    if(k==='rigor-projects-v1'||k==='rigor-library-v1'){
     const older=parse(raw),current=parse(record.entries[k]||'[]');
     const valid=list=>Array.isArray(list)&&list.length<=100&&list.every(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&(k==='rigor-projects-v1'?item.snapshot&&typeof item.updated==='string'&&Number.isFinite(Date.parse(item.updated)):typeof item.category==='string'&&Array.isArray(item.tasks)));
     if(!valid(older)||!valid(current))throw Error('Eldre prosjekt- eller biblioteksdata må kontrolleres før overføring.');
     const ids=new Set(current.map(item=>item.id));const merged=[...current,...older.filter(item=>!ids.has(item.id)&&(ids.add(item.id),true))];
     if(merged.length>100)throw Error('Overføringen vil overskride grensen på 100 prosjekter eller bibliotekmaler.');
     record.entries[k]=JSON.stringify(merged);
    }else if(!(k in record.entries)){
     if(k!=='rigor-job-brief-v1'){
      const value=parse(raw);
      if(!value||!value.rates||!(k==='rigor-calculation-v1'?[1,2].includes(value.version)&&value.settings&&Array.isArray(value.rows):value.version===1))throw Error('Eldre kalkyle- eller satsdata må kontrolleres før overføring.');
     }
     record.entries[k]=raw;
    }
    changed=true;
   }
   if(!changed)return false;
   record.entries[imported]='done';
   // One atomic localStorage write: quota errors preserve both current account
   // data and all original legacy values. Never overwrite or remove originals.
   try{storage.setItem(key,JSON.stringify(record));}catch{throw Error('Overføringen kunne ikke lagres. Kontodata og originalene er beholdt. Nettleserens lagringsplass kan være full.');}return true;
  }
 };
}
let scoped,userId;
export function initializeUserStorage(access){
 if(userId&&userId!==access.user?.id)throw Error('Last siden på nytt ved bytte av konto.');
 scoped=createUserStorage(localStorage,access);userId=access.user.id;
}
function current(){if(!scoped)throw Error('Kontolagring er ikke åpnet.');return scoped;}
export const userStorage={
 getItem:key=>current().getItem(key),setItem:(key,value)=>current().setItem(key,value),removeItem:key=>current().removeItem(key),
 hasLegacyData:()=>current().hasLegacyData(),importLegacy:()=>current().importLegacy()
};
