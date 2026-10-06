import {instantiate} from './kalkyle-library.js?v=20261006-enkel-pris';
import {timeFactor} from './kalkyle-engine.js?v=20261006-enkel-pris';
export {extractMeasurements,validateProposal,clarificationQuestions,appendClarificationAnswers} from './supabase/functions/rigor-ai-estimate/proposal.js';
export function proposalRows(element,quantity,instance,settings={}){
 if(!Number.isFinite(quantity)||quantity<0||quantity>1000000)throw Error('Ugyldig mengde');
 return instantiate(element,quantity,timeFactor(element,settings),element.tasks.map(t=>t.id),instance).map(r=>({...r,requiresQuantity:quantity===0,fromAssistant:true}));
}

export function wizardBrief(settings,rows,brief=''){
 const description=brief.split('\n\nKalkylegrunnlag fra veiviseren:')[0].trim();
 const lines=['Kalkylegrunnlag fra veiviseren:','Kontroller arbeidslisten og foreslå manglende tilhørende oppgaver. Behold eksisterende arbeid. Spør om manglende mål og materialspesifikasjoner. Ikke finn på priser eller arbeidstider.'];
 if(settings.job==='roof'){
  lines.push('Taktype: '+({flat:'Flatt tak',shed:'Pulttak',gable:'Saltak',hip:'Valmtak',mansard:'Mansardtak'}[settings.roofType]),'Takareal: '+settings.area+' m²','Takvinkel: '+settings.angle+' grader','Arealgrunnlag: '+(settings.basis==='footprint'?'Horisontal grunnflate':'Målt takflate'),'Taktekking: '+({metal:'Takplater',tile:'Takstein',membrane:'Takpapp / membran'}[settings.material]));
  if(settings.roofType==='mansard')lines.push('Øvre takvinkel: '+settings.angle+' grader','Nedre takvinkel: '+settings.lowerAngle+' grader','Øvre andel av horisontalt areal: '+settings.upperShare+' %');
  lines.push('Sløyfeavstand: '+settings.battenSpacing+' mm','Lekteavstand: '+settings.lathSpacing+' mm','Svinn sløyfer og lekter: '+settings.roofWaste+' %');
 }else lines.push('Arbeid: '+(settings.job==='insulation'?'Etterisolering av yttervegg, 100 mm':'Tilbygg'),'Netto areal: '+settings.area+' m²');
 lines.push('Adkomstfaktor: '+settings.difficulty,'Eksisterende oppgaver som skal beholdes: '+rows.filter(r=>r.enabled).map(r=>r.name).join('; '),'Andre arbeider fra beskrivelsen må avklares før de tas med. Veiviserens merkede takdata gjelder hvis beskrivelsen har eldre mål.');
 const result=(description?description+'\n\n':'')+lines.join('\n');
 if(result.length>8000)throw Error('Beskrivelsen og arbeidslisten er for lang. Kort ned beskrivelsen før AI-kontrollen.');
 return result;
}
