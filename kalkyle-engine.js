import {library,instantiate} from './kalkyle-library.js?v=20261006-enkel-pris';
// Illustrative rates only. Replace with RIGOR's maintained cost and time data.
export const jobs = {
 roof: {name:'Bytte tak', options:[['removal','Rive eksisterende tekking',true],['underlay','Nytt undertak, sløyfer og lekter',true],['cover','Ny taktekking',true],['rig','Stillas og fallsikring',true],['waste','Transport og avfall',true]], uncertainty:'Beslag, takrenner, piper, takvinduer og råteskader er ikke inkludert. Avklar høyde, geometri og faktisk stillasbehov.'},
 insulation: {name:'Etterisolere',options:[['removal','Rive eksisterende kledning',true],['insulation','100 mm utvendig isolasjon og utlekting',true],['cladding','Vindsperre og ny kledning',true],['rig','Stillas og sikring',true],['waste','Transport og avfall',true]],uncertainty:'Gjelder utvendig veggflate. Vindustilpasninger, beslag, fuktforhold og råteskader må vurderes separat.'},
 extension: {name:'Tilbygg',options:[['foundation','Fundament og grunnarbeid',true],['frame','Bærende konstruksjon og yttervegger',true],['roof','Takoppbygging og tekking',true],['interior','Innvendige overflater',true],['technical','Avsetning til elektro og VVS',true],['rig','Rigg og drift',true]],uncertainty:'Kun grovt budsjett for én etasje uten våtrom. Prosjektering, søknader, gebyrer, vanskelige grunnforhold og tilkobling til eksisterende bygg er ikke inkludert. Tekniske fag er en eksempelavsetning, ikke et tilbud.'}
};
export function roofGeometry(s) {
 const type=s.roofType||'gable',angle=type==='flat'?Math.min(s.angle,5):s.angle;
 let area=s.area,slope=angle>40?1.25:angle>25?1.1:1;
 if(type==='mansard'){
  const lower=s.lowerAngle??60,share=(s.upperShare??50)/100;
  if(s.basis==='footprint'){
   const upperArea=s.area*share/Math.cos(angle*Math.PI/180),lowerArea=s.area*(1-share)/Math.cos(lower*Math.PI/180);
   area=upperArea+lowerArea;slope=(upperArea*slope+lowerArea*(lower>40?1.25:lower>25?1.1:1))/area;
  } else slope=Math.max(slope,lower>40?1.25:lower>25?1.1:1);
 } else if(s.basis==='footprint')area=s.area/Math.cos(angle*Math.PI/180);
 return {area,slope};
}
export function timeFactor(element,settings){
 const access=settings.difficulty??1;
 return element.id.startsWith('roof.')&&element.unit==='m²'&&settings.job==='roof'?access*roofGeometry(settings).slope:access;
}
export function propose(s) {
 const geometry=s.job==='roof'?roofGeometry(s):{area:s.area,slope:1};
 const elements={roof:['removal',s.material==='membrane'?'deck':'underlay','cover.'+s.material,'rig','waste'],insulation:['removal','insulation','cladding','rig','waste'],extension:['foundation','frame','roof','interior','technical','rig']}[s.job];
 const rows=elements.flatMap(id=>{
  const option=id.startsWith('cover.')?'cover':id==='deck'?'underlay':id;
  const element=library.find(e=>e.id===s.job+'.'+id);if(!element)return [];
  return instantiate(element,geometry.area,timeFactor(element,s)).map(r=>roofConsumption({...r,enabled:s.options.includes(option)},s));
 });
 if(s.job==='roof'){
  const details={flat:['edge','drain'],shed:['edge'],gable:['ridge','edge'],hip:['ridge','hip','edge'],mansard:['ridge','break','edge']}[s.roofType||'gable'];
  for(const id of details)if(s.options.includes('details')){const element=library.find(e=>e.id==='roof.'+id);rows.push(...instantiate(element,Number(s[element.measure])||0,s.difficulty));}
 }
 return rows;
}
export function calculate(rows,rates,area) {
 const hourly=rates.wage*(1+rates.direct/100)*(1+rates.indirect/100)/(rates.billing/100);
 const items=rows.map(r=>{const hours=r.enabled?r.quantity*r.hours*r.factor:0;const material=r.enabled?(r.marketMaterialCost??((r.materialQuantity??r.quantity)*r.material)):0;const labor=hours*hourly;const cost=material+labor;const laborPrice=labor*(1+rates.laborMarkup/100),materialPrice=material*(1+rates.materialMarkup/100);const price=materialPrice+laborPrice;return {...r,workHours:hours,laborPrice,materialPrice,cost,price};});
 const cost=items.reduce((a,r)=>a+r.cost,0),price=items.reduce((a,r)=>a+r.price,0),hours=items.reduce((a,r)=>a+r.workHours,0);
 return {items,hourly,cost,price,hours,profit:price-cost,vat:price*0.25,gross:price*1.25,perArea:price/area};
}

export function roofConsumption(row,settings){
 const spacingKey={'roof.underlay.sloyfer':'battenSpacing','roof.underlay.lekter':'lathSpacing'}[row.priceKey];
 if(settings.job!=='roof'||!spacingKey||settings[spacingKey]===undefined)return row;
 const spacing=Number(settings[spacingKey]),waste=Number(settings.roofWaste??0);
 if(!Number.isFinite(spacing)||spacing<=0||!Number.isFinite(waste)||waste<0||waste>100)throw Error('Ugyldig avstand eller svinn');
 const ratio=1000/spacing*(1+waste/100);return {...row,materialRatio:ratio,materialQuantity:row.quantity*ratio};
}
