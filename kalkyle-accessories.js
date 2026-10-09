// Material dependencies belong to approved installation scope, independently
// of what an AI response happens to mention. No labour or universal fastening
// schedule is inferred here. Stable suffixes also identify purchase/sales rows.
export const accessoryDefinitions={
 deck_screws:{code:'901',name:'Terrasseskruer',kind:'fasteners',unit:'stk',note:'Oppgi antall etter bordbredde, bjelkeavstand og festepunkter. Velg lengde og korrosjonsklasse som passer trevirke og miljø. Skjult innfesting krever eget system.',match:/terrasseskrue/i,reject:/til-tak|invisible|skjult/i},
 cladding_fasteners:{code:'902',name:'Kledningsspiker / kledningsskruer',kind:'fasteners',unit:'stk',note:'Oppgi antall etter profil, bordbredde, lekteavstand og leverandørens monteringsanvisning. Velg spiker eller skruer; begge skal ikke telles for samme festepunkt.',match:/klednings(?:skrue|spiker)|fasade(?:skrue|spiker)|panelspiker/i},
 batten_fasteners:{code:'903',name:'Festemidler til sløyfer',kind:'fasteners',unit:'stk',note:'Oppgi antall og velg spiker/skruer etter sløyfedimensjon, underlag, forankring og innfestingsplan. Arealet alene bestemmer ikke antallet.',match:/treskrue|treskruer|konstruksjonsskrue|universalskrue|(?:tråd|traad|ring|maskin|kam)spiker/i},
 lath_fasteners:{code:'904',name:'Festemidler til taklekter',kind:'fasteners',unit:'stk',note:'Oppgi antall etter lekteavstand, krysningspunkter og innfestingsplan. Velg lengde og type som passer lekt, sløyfe og bærende underlag.',match:/treskrue|treskruer|konstruksjonsskrue|universalskrue|(?:tråd|traad|ring|maskin|kam)spiker/i},
 underlay_tape:{code:'905',name:'Undertakstape / systemtape',kind:'tape',unit:'m',note:'Oppgi faktisk skjøte- og detaljlengde etter undertakets monteringsanvisning. Velg bort posten dersom integrert klebing dekker behovet; gjennomføringer avklares separat.',match:/undertak|tak.*tape|tape.*tak|tyvek/i,reject:/dampsperre|mur|luftespalte/i},
 wind_tape:{code:'906',name:'Vindsperretape',kind:'tape',unit:'m',note:'Oppgi skjøter, overganger og åpninger som skal tapes. Tapen må være godkjent for valgt vindsperre og underlag. Integrert klebing kan redusere behovet.',match:/vindsperre|tyvek|flexwrap/i,reject:/dampsperre|mur|luftespalte/i},
 batten_seal:{code:'907',name:'Sløyfebånd / tetningsbånd',kind:'hardware',unit:'m',note:'Avklar om undertakssystemet krever tetningsbånd under sløyfene. Oppgi samlet faktisk sløyfelengde; velg bort posten hvis anvisningen ikke krever dette.',match:/sløyfebånd|sloyfeband|sløyfe.*(?:bånd|band)|tetningsbånd|tetningsband/i},
 tile_fixings:{code:'908',name:'Taksteinklips / taksteinfester',kind:'hardware',unit:'stk',note:'Oppgi antall og velg systemtilpasset innfesting etter taksteinprodusentens vindlast-/innfestingsplan. Én klips per stein er ikke en generell regel.',match:/takstein.*(?:klips|feste)|(?:klips|feste).*takstein|stormklips|stormclips/i},
 roof_screws:{code:'909',name:'Takplateskruer med tetning',kind:'fasteners',unit:'stk',note:'Oppgi antall etter plateprofil og leverandørens innfestingsplan. Velg skruer og tetning som passer platen og underlaget.',match:/tak(?:plate)?skrue|selvborende skrue|farmerskrue/i},
 mouse_band:{code:'910',name:'Musebånd / museprofil',kind:'hardware',unit:'m',note:'Oppgi faktisk lengde langs åpne luftespalter der gnagersikring er nødvendig. Velg en løsning som passer kledning og lufting, eller velg bort hvis sikringen finnes fra før.',match:/musebånd|museband|museprofil|musesperre/i}
};
export const accessoryRecipes={
 deck_28x120_cc600:{type:'deck_screws',label:'28 × 120 mm bord, c/c 600 mm – 27 skruer/m²',ratio:27,
  source:'https://www.bergeneholm.no/inspirasjon/byggeguider/montering-utegulv-av-terrassebord/',checkedAt:'2026-10-09',
  note:'Bergene Holm: 55 mm skruelengde og 27 skruer/m² ved 28 × 120 mm og c/c 600. Kontroller skjøter, kanter, ekstra festepunkter og korrosjonsklasse.'}
};
export function accessoriesForRow(row){
 if(row.materialOnly)return [];
 const key=row.priceKey||'';
 if(key==='terrace.new.deck')return ['deck_screws'];
 if(key==='insulation.kledning'||/^wall\.cladding\.(?:horizontal|vertical)\.cladding$/.test(key))return ['cladding_fasteners','mouse_band'];
 if(key==='roof.underlay.sloyfer')return ['batten_fasteners','batten_seal'];
 if(key==='roof.underlay.lekter')return ['lath_fasteners'];
 if(key==='roof.underlay.undertak')return ['underlay_tape'];
 if(key==='insulation.vindsperre'||/^wall\.cladding\.(?:horizontal|vertical)\.barrier$/.test(key))return ['wind_tape'];
 if(key==='roof.cover.tile')return ['tile_fixings'];
 if(key==='roof.cover.metal')return ['roof_screws'];
 // Expanded roof packages already have a combined "fasten" material post.
 // Adding individual fasteners there would double count the same allowance.
 return [];
}
export function synchronizeAccessories(rows){
 const existing=new Map(rows.filter(r=>r.materialOnly&&r.accessoryParentId).map(r=>[r.id,r]));
 const result=[];
 for(const parent of rows.filter(r=>!r.accessoryParentId)){
  result.push(parent);
  for(const key of accessoriesForRow(parent)){
   const definition=accessoryDefinitions[key],id=parent.id+'-material-'+key,old=existing.get(id);
   const quantity=parent.quantity,ratio=old?.materialRatio??0;
   result.push(Object.assign(old||{},{id,elementId:parent.elementId,elementName:parent.elementName,category:parent.category,
    elementDescription:parent.elementDescription,quantityNote:parent.quantityNote,excludes:parent.excludes,
    name:definition.name,taskKey:parent.taskKey+'-material-'+key,priceKey:parent.priceKey+'.material-'+key,
    accessoryType:key,accessoryParentId:parent.id,accessoryParentName:parent.name,materialOnly:true,
    quantity,unit:parent.unit,materialUnit:definition.unit,materialRatio:ratio,materialQuantity:quantity*ratio,
    material:old?old.material:0,hours:0,factor:1,requiresTime:false,timeEstimate:false,
    timeSource:'Montering inngår i «'+parent.name+'»',timeNote:definition.note,
    materialNote:definition.note,requiresMaterialQuantity:!(Number.isFinite(quantity*ratio)&&quantity*ratio>0),
    requiresQuantity:Boolean(parent.requiresQuantity),needsExamplePrice:true,exampleMaterial:0,
    enabled:Boolean(parent.enabled&&!old?.accessoryExcluded),wizardGenerated:parent.wizardGenerated
   }));
  }
 }
 return result;
}
export function materialQuantityMissing(row){return Boolean(row.requiresMaterialQuantity&&!(Number.isFinite(row.materialQuantity)&&row.materialQuantity>0));}
export function setAccessoryQuantity(row,quantity){
 if(!row.materialOnly||!Number.isFinite(quantity)||quantity<=0||quantity>1e7||!Number.isFinite(row.quantity)||row.quantity<=0)throw Error('Oppgi arbeidsmengde og en positiv tilbehørsmengde først.');
 Object.assign(row,{materialQuantity:quantity,materialRatio:quantity/row.quantity,requiresMaterialQuantity:false,manualMaterialQuantity:true,userEdited:true,accessoryRecipe:null});
}
export function setAccessoryRecipe(row,id){
 const recipe=accessoryRecipes[id];
 if(!recipe||recipe.type!==row.accessoryType||!['m²','m2'].includes(row.unit)||!(row.quantity>0))throw Error('Mengdegrunnlaget passer ikke denne materialposten.');
 setAccessoryQuantity(row,row.quantity*recipe.ratio);row.accessoryRecipe=id;
}
export function accessoryOfferMatches(row,offer){
 const d=accessoryDefinitions[row.accessoryType];
 return !d||d.match.test(offer.name)&&(!d.reject||!d.reject.test(offer.name));
}
