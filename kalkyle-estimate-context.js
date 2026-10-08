import {createEstimateContext,requireMode} from './kalkyle-ai-modes.js?v=20261008-ai-modes';
import {appendClarificationAnswers} from './kalkyle-assistant.js?v=20261007-terrassevalg';
// Text and a future speech-to-text adapter use the same plain input contract.
export function estimateInput({text,source='text'}){if(!['text','speech_to_text'].includes(source))throw Error('Ukjent inputkilde.');if(typeof text!=='string')throw Error('Beskriv jobben med tekst.');return {brief:text.trim(),source};}
export function answerContext(context,question,answer){
 const brief=appendClarificationAnswers(context.brief,[question],{[question.id]:answer});
 if(brief===context.brief)throw Error('Velg eller skriv et svar.');
 return createEstimateContext(brief,{questionsAnswered:[...context.questionsAnswered,{id:question.id,answer:String(answer)}],experienceRates:context.priceBasis.experienceRates,scope:context.scope});
}
export function detailedContext(context){requireMode('detailed_copilot');return structuredClone(context);}
