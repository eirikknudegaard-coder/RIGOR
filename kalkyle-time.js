import {readCsv} from './kalkyle-prices.js';
import {library} from './kalkyle-library.js?v=20261007-avklaringer';
import {timeFactor} from './kalkyle-engine.js?v=20261007-avklaringer';

// Stable task identifiers also work for snapshots created before taskKey existed.
export function templateTask(row){
 const element=library.find(e=>e.id===(row.elementId||'').split('-ai-')[0]||e.tasks.some(t=>row.taskKey===e.id+'.'+t.id));
 const task=element?.tasks.find(t=>row.taskKey===element.id+'.'+t.id||row.name===t.name);
 return task?{element,task,key:element.id+'.'+task.id}:null;
}
export function restoreAssistantTimes(rows,settings){
 return rows.map(row=>{
  const found=templateTask(row);if(!found)return row;
  const repaired={...row,taskKey:found.key};
  if(row.fromAssistant&&row.requiresTime&&row.hours===0&&!found.task.requiresTime){repaired.hours=found.task.hours;repaired.requiresTime=false;repaired.timeSource='RIGOR-mal (foreløpig)';}
  if(row.fromAssistant&&!row.manualFactor)repaired.factor=timeFactor(found.element,settings);
  return repaired;
 });
}
export function validateTimeCatalog(records){
 if(!Array.isArray(records)||records.length>10000)throw Error('Ugyldig grunntidsregister.');
 const seen=new Set();for(const r of records){if(!r||typeof r.key!=='string'||r.key.length>200||typeof r.name!=='string'||r.name.length>300||!r.key&&!r.name||!['m²','m','stk','rs'].includes(r.unit)||!Number.isFinite(r.hours)||r.hours<0||r.hours>10000||r.factor!==null&&(!Number.isFinite(r.factor)||r.factor<=0||r.factor>100)||typeof r.source!=='string'||!r.source.trim()||r.source.length>300)throw Error('Ugyldig grunntid, faktor, enhet eller kilde.');const id=(r.key||r.name.toLocaleLowerCase('nb'))+'|'+r.unit;if(seen.has(id))throw Error('Duplisert oppgave i grunntidsregisteret.');seen.add(id);}
 return records;
}
export function parseTimeCsv(text){
 const records=readCsv(text),headers=records.shift().map(h=>h.toLocaleLowerCase('nb').trim());
 const index=aliases=>headers.findIndex(h=>aliases.includes(h));
 const key=index(['oppgavenokkel','oppgavenøkkel','taskkey']),name=index(['oppgave','navn']),unit=index(['enhet','unit']),hours=index(['timer_per_enhet','timer/enhet','grunntid (t)','grunntid']),factor=index(['tidsfaktor','timefaktor']),source=index(['kilde']);
 if((key<0&&name<0)||unit<0||hours<0||source<0)throw Error('CSV må ha oppgavenøkkel eller oppgave, enhet, grunntid og kilde. Bruk malen for denne kalkylen.');
 if(records.length>10000||records.some(r=>r.length!==headers.length))throw Error('Ugyldig antall CSV-rader eller kolonner.');
 const seen=new Set();return validateTimeCatalog(records.map((r,i)=>{
  const value=s=>Number(String(s).replace(',','.')),h=value(r[hours]),f=factor<0||r[factor]===''?null:value(r[factor]),u=r[unit].replace('m2','m²'),k=key<0?'':r[key],n=name<0?'':r[name],s=r[source];
  if((!k&&!n)||!['m²','m','stk','rs'].includes(u)||!r[hours].trim()||!Number.isFinite(h)||h<0||h>10000||f!==null&&(!Number.isFinite(f)||f<=0||f>100)||!s.trim()||s.length>300)throw Error('Kontroller grunntid, faktor, enhet og kilde på rad '+(i+2)+'.');
  const id=(k||n)+'|'+u;if(seen.has(id))throw Error('Duplisert oppgave på rad '+(i+2)+'.');seen.add(id);
  return {key:k,name:n,unit:u,hours:h,factor:f,source:s};
 }));
}
export function applyTimeCatalog(rows,records){
 return rows.map(row=>{
  if(row.manualTime)return row;
  const key=row.taskKey||templateTask(row)?.key;
  const record=records.find(r=>r.unit===row.unit&&(r.key?r.key===key:r.name.toLocaleLowerCase('nb')===row.name.toLocaleLowerCase('nb')));
  return record?{...row,taskKey:key,hours:record.hours,requiresTime:false,timeSource:record.source,...(record.factor!==null&&!row.manualFactor?{factor:record.factor,timeFactorSource:record.source}: {})}:row;
 });
}
