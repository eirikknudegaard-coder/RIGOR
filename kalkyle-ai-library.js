// Missing terrace work packages. No prices, norms or structural dimensions are
// invented here. Quantities, company experience data or imported times are required.
import {codeRegister} from './kalkyle-code-register.js?v=20261007-avklaringer';
const task=(id,name,priceKey)=>({id,name,hours:0,requiresTime:true,priceKey,exampleMaterial:0,materialUnit:'m²',materialRatio:1});
export const aiWorkPackages=[
 {id:'terrace.new.deck',name:'Nye terrassebord',unit:'m²',tasks:[task('deck','Montere terrassebord','terrace.new.deck')]},
 {id:'terrace.new.joists',name:'Nytt terrassebjelkelag',unit:'m²',tasks:[task('joists','Montere prosjektert terrassebjelkelag','terrace.new.joists')]},
 {id:'terrace.new.railing',name:'Nytt terrasserekkverk',unit:'m',tasks:[{...task('railing','Montere terrasserekkverk','terrace.new.railing'),materialUnit:'m'}]}
].map(e=>({...e,category:'45 · Terrasser',trade:'Tømrer',type:'Alle',description:e.name+' med spesifikasjon fra brukeren.',quantityNote:'Oppgitt areal eller lengde. Materialforbruk og konstruksjon må kontrolleres.',excludes:'Fundamentutbedring, skjulte skader, dimensjonering, transport og avfall.'}));
// Reserved, permanent identifiers for these added templates. Existing register
// entries, mapping logic and export code remain untouched.
for(const [i,e] of aiWorkPackages.entries()){
 const element='RG-E-0'+(161+i);
 if(codeRegister[e.id])continue;
 if(Object.values(codeRegister).some(entry=>entry.element===element))throw Error('Kodekonflikt for '+e.id);
 codeRegister[e.id]={element,tasks:{[e.tasks[0].id]:'01'}};
}
