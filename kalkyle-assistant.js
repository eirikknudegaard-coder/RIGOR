import {instantiate} from './kalkyle-library.js';
export {extractMeasurements,validateProposal,clarificationQuestions,appendClarificationAnswers} from './supabase/functions/rigor-ai-estimate/proposal.js';
export function proposalRows(element,quantity,instance){
 if(!Number.isFinite(quantity)||quantity<0||quantity>1000000)throw Error('Ugyldig mengde');
 return instantiate(element,quantity,1,element.tasks.map(t=>t.id),instance).map(r=>({...r,hours:0,requiresTime:true,requiresQuantity:quantity===0,fromAssistant:true}));
}
