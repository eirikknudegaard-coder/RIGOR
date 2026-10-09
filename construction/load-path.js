import {fact} from './context.js';
export function buildLoadPath(context){
 if(fact(context,'goal')==='plan_terrace'){
  const nodes=['Terrassebord','Tverrgående bjelkelag','Langsgående dragere','Stolper / bæring ved huset','Fundament'];
  return {nodes,edges:nodes.slice(1).map((_,i)=>({from:i,to:i+1,status:'REQUIRED'})),suspected:true,confirmedByUser:false,findings:[{id:'terrace_layout',text:'Du spør om antall og plassering av dragere og stolper. Vi trenger lengde, dybde og høyde før en plan kan lages. c/c-avstanden gjelder normalt tverrbjelkene og bestemmer ikke alene antall stolper.'},{id:'terrace_members',text:'Hvert bjelkespenn, hver drager og hver stolpe må kontrolleres med riktige laster og avstivning. Doble bjelker får ikke automatisk samvirkning. Skjemaet lager en geometriplan fra dokumenterte spenn.'}]};
 }
 const wall=fact(context,'goal')==='remove_wall',bearing=fact(context,'roofBearsOnWall'),direction=fact(context,'direction');
 const roof=wall||fact(context,'memberRole')==='rafters';
 const suspected=wall&&(direction==='across'||bearing==='yes');
 const findings=[];
 if(wall){
  findings.push({id:'wall_path',text:bearing==='yes'?'Du oppgir at taksperrene har opplegg på veggen. Å fjerne veggen bryter denne oppgitte lastveien.':bearing==='no'?'Du oppgir at sperrene ikke har opplegg på veggen. Det avklarer ikke eventuell bæring fra etasjeskiller, andre dragere eller byggets avstivning.':suspected?'Sperrer på tvers av veggen gjør at veggen kan inngå i takets lastvei. Retningen alene bekrefter ikke at veggen er bærende.':'Det er foreløpig ikke avklart hva veggen bærer. Sperrer langs veggen utelukker heller ikke last fra etasjeskiller, andre dragere eller avstivning.'});
  if(bearing==='yes')findings.push({id:'replacement',text:'Ved fjerning må den oppgitte taklasten føres videre, for eksempel gjennom en ny drager og opplegg i endene. Valg av løsning må kontrolleres.'});
  if(fact(context,'floorAbove')!=='no')findings.push({id:'upper_floor',text:'Last fra etasjeskiller eller andre konstruksjoner over veggen er ikke avklart i takmodellen.'});
 }
 findings.push({id:'support_path',text:fact(context,'supportBelow')==='unsupported'?'Du oppgir at støtte under opplegget mangler. Denne lastveien må løses før en drager kan være en aktuell løsning.':fact(context,'supportBelow')==='documented'?'Støtten under opplegget er oppgitt som dokumentert. Kapasiteten er fortsatt ikke kontrollert her.':'Hvor endelastene føres videre til stendere, bjelkelag, grunnmur og fundament, er ikke kontrollert.'});
 const nodes=roof?['Tak','Sperrer / takstoler',wall?'Vegg → mulig ny drager':'Drager','Opplegg / stendere','Bjelkelag / grunnmur','Fundament']:['Last over bjelken','Bjelke / drager','Opplegg / søyler','Underliggende konstruksjon','Fundament'];
 const edges=nodes.slice(1).map((_,i)=>({from:i,to:i+1,status:roof&&i===1&&bearing==='yes'?'KNOWN':i>=(roof?2:1)&&fact(context,'supportBelow')==='documented'?'KNOWN':'REQUIRED'}));
 return {nodes,edges,suspected,confirmedByUser:bearing==='yes',findings};
}
