// RIGOR planning assumptions, in person-hours per work unit. These are not
// published tariff norms: the carpenter tariff treats demolition as elapsed
// work time (section 2.5). Keep estimates distinct from imported company norms.
const plans={
 'terrace.strip.deck':[.20,.05],
 'terrace.strip.joists':[.20,.15],
 'terrace.strip.handrail':[.10],
 'terrace.strip.railing':[.25],
 'terrace.strip.stairs':[1.5,1.5],
 'roof.remove.tile':[.15,.05,.10],
 'roof.remove.metal':[.12,.05,.10],
 'roof.remove.membrane':[.20,.05,.10],
 'roof.remove.structure':[.07,.05,.10]
};
const note='Eget planleggingsanslag ved normal tilkomst og demontering uten krav om gjenbruk. Festemidler, høyde og konstruksjon kan endre tiden. Stillas, borttransport, avfallsavgift og sanering inngår ikke. Beregnes som personarbeidstimer, ikke kalender-/lagtid.';
export function planningTimes(element){
 const plan=plans[element.id];
 if(!plan||plan.length!==element.tasks.length)return element;
 return {...element,tasks:element.tasks.map((task,index)=>({...task,hours:plan[index],requiresTime:false,timeSource:'RIGOR-planleggingsanslag',timeEstimate:true,timeNote:note}))};
}
