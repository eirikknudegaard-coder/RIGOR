import {requestEstimate} from './ai-estimate-client.js?v=20261008-ai-modes';
import {requireMode} from './kalkyle-ai-modes.js?v=20261009-qa-release';
// A different transport/provider can implement run without touching pricing.
export function createEstimateAI(transport=requestEstimate){return {run({mode,context}){requireMode(mode);return transport(context.brief,{mode,context:{questionsAnswered:context.questionsAnswered,scope:context.scope}});}};}
export const estimateAI=createEstimateAI();
