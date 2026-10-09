import {proposalForMode} from './kalkyle-ai-modes.js?v=20261009-qa-release';
export function validateModeResult(result,library,context,mode){
 if(result.mode!==undefined&&result.mode!==mode)throw Error('AI-svaret har feil modus. Ingen poster er endret.');
 const raw={summary:result.summary,questions:result.questions,items:result.items.map(item=>({elementId:item.elementId,taskIds:item.taskIds,reason:item.reason,scope:item.scope}))};
 // Never trust provider amounts or quantities; rebuild annotations from facts.
 const reserved=['price','total','hours','gross','materialCost'];
 if(reserved.some(k=>Object.hasOwn(result,k))||result.items.some(item=>reserved.some(k=>Object.hasOwn(item,k))))throw Error('AI-svaret inneholder beregninger som må komme fra RIGOR.');
 const validated=proposalForMode(raw,library,context,mode),suggestions=result.context?.suggestions;
 if(suggestions!==undefined){if(!Array.isArray(suggestions)||suggestions.length>5||suggestions.some(s=>!s||s.priority!=='OPTIONAL'||typeof s.text!=='string'||s.text.length>600))throw Error('Ugyldige tillegg i AI-svaret.');validated.context.suggestions=suggestions.map(s=>({priority:'OPTIONAL',text:s.text}));}
 return validated;
}
