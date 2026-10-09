import {fact} from './context.js';
export function structuralChecks(context,model,beam){
 const checks={performed:['Likevekt og oppleggsreaksjoner','Moment og skjær for oppgitte vertikale laster'],notPerformed:['Bøynings- og skjærkapasitet etter Eurocode','Forbindelser og oppleggstrykk','Avstivning, vipping og horisontalkrefter','Stendere, søyler, bjelkelag og fundament','Brann, fukt, kryp og langtidsdeformasjon','Nasjonalt tillegg, lastkombinasjoner og sikkerhetsfaktorer'],deflection:null,stress:null};
 if(beam.maxDeflection&&model.section){
  const ratio=fact(context,'deflectionRatio')||300,limitMm=beam.spanM*1000/ratio;
  checks.deflection={actualMm:beam.maxDeflection.downM*1000,limitMm,ratio,overLimit:beam.maxDeflection.downM*1000>limitMm,criterionStatus:context.facts.deflectionRatio?.status||'ASSUMED',criterionSource:context.facts.deflectionRatio?.source||'Foreløpig sammenligning L/300, ikke et forskriftskrav.'};
  checks.performed.push('Øyeblikkelig elastisk nedbøyning, uten kryp eller skjærdeformasjon');
  checks.stress={bendingMPa:beam.maxMoment.absoluteNm/model.section.wM3/1e6,shearMPa:1.5*beam.maxShearN/model.section.areaM2/1e6,note:'Elastiske spenninger i massivt rektangel. Ingen dimensjonerende styrke eller kapasitetsutnyttelse er beregnet.'};
 }
 return checks;
}
