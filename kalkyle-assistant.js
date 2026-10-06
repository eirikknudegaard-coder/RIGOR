import {instantiate} from './kalkyle-library.js?v=20261006-ai-kostnader';
import {timeFactor} from './kalkyle-engine.js?v=20261006-ai-kostnader';
export {extractMeasurements,validateProposal,clarificationQuestions,appendClarificationAnswers} from './supabase/functions/rigor-ai-estimate/proposal.js';
export function proposalRows(element,quantity,instance,settings={}){
 if(!Number.isFinite(quantity)||quantity<0||quantity>1000000)throw Error('Ugyldig mengde');
 return instantiate(element,quantity,timeFactor(element,settings),element.tasks.map(t=>t.id),instance).map(r=>({...r,requiresQuantity:quantity===0,fromAssistant:true}));
}
