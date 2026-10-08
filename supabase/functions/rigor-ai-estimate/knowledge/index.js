import terrace from './terrace.js';
import roof from './roof.js';
import wall from './exterior-wall.js';
export const knowledgeModules=[terrace,roof,wall];
export const knowledgeFor=brief=>knowledgeModules.filter(module=>module.matches.test(brief));
