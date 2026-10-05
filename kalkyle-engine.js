// Illustrative rates only. Replace with RIGOR's maintained cost and time data.
export const jobs = {
 roof: {name:'Bytte tak', options:[['removal','Rive eksisterende tekking',true],['underlay','Nytt undertak, sløyfer og lekter',true],['cover','Ny taktekking',true],['rig','Stillas og fallsikring',true],['waste','Transport og avfall',true]], uncertainty:'Beslag, takrenner, piper, takvinduer og råteskader er ikke inkludert. Avklar høyde, geometri og faktisk stillasbehov.'},
 insulation: {name:'Etterisolere',options:[['removal','Rive eksisterende kledning',true],['insulation','100 mm utvendig isolasjon og utlekting',true],['cladding','Vindsperre og ny kledning',true],['rig','Stillas og sikring',true],['waste','Transport og avfall',true]],uncertainty:'Gjelder utvendig veggflate. Vindustilpasninger, beslag, fuktforhold og råteskader må vurderes separat.'},
 extension: {name:'Tilbygg',options:[['foundation','Fundament og grunnarbeid',true],['frame','Bærende konstruksjon og yttervegger',true],['roof','Takoppbygging og tekking',true],['interior','Innvendige overflater',true],['technical','Avsetning til elektro og VVS',true],['rig','Rigg og drift',true]],uncertainty:'Kun grovt budsjett for én etasje uten våtrom. Prosjektering, søknader, gebyrer, vanskelige grunnforhold og tilkobling til eksisterende bygg er ikke inkludert. Tekniske fag er en eksempelavsetning, ikke et tilbud.'}
};
export function propose(s) {
 const area=s.job==='roof' && s.basis==='footprint' ? s.area/Math.cos(s.angle*Math.PI/180) : s.area;
 const slope=s.job==='roof' ? (s.angle>40?1.25:s.angle>25?1.1:1) : 1;
 const definitions={roof:[['removal','Rive tekking',0,0.25],['underlay','Undertak, sløyfer og lekter',240,0.5],['cover',s.material==='tile'?'Takstein':'Metalltekking',s.material==='tile'?350:290,0.35],['rig','Rigg, stillas og sikring (avsetning)',90,0.12],['waste','Transport og avfall (avsetning)',65,0.05]],insulation:[['removal','Rive kledning',0,0.3],['insulation','100 mm isolasjon og utlekting',260,0.55],['cladding','Vindsperre og kledning',380,0.65],['rig','Stillas og sikring (avsetning)',75,0.12],['waste','Transport og avfall (avsetning)',55,0.05]],extension:[['foundation','Fundament og grunnarbeid',2200,1.8],['frame','Konstruksjon og yttervegger',4200,4],['roof','Tak (avsetning per m² gulvareal)',1600,1.5],['interior','Innvendige overflater',1800,2.5],['technical','Elektro og VVS (avsetning)',2200,0],['rig','Rigg og drift',650,0.7]]};
 return definitions[s.job].map(([id,name,material,hours])=>({id,name,quantity:area,unit:'m²',material,hours,enabled:s.options.includes(id),factor:s.difficulty*slope}));
}
export function calculate(rows,rates,area) {
 const hourly=rates.wage*(1+rates.direct/100)*(1+rates.indirect/100)/(rates.billing/100);
 const items=rows.map(r=>{const hours=r.enabled?r.quantity*r.hours*r.factor:0;const material=r.enabled?r.quantity*r.material:0;const labor=hours*hourly;const cost=material+labor;const price=material*(1+rates.materialMarkup/100)+labor*(1+rates.laborMarkup/100);return {...r,workHours:hours,cost,price};});
 const cost=items.reduce((a,r)=>a+r.cost,0),price=items.reduce((a,r)=>a+r.price,0),hours=items.reduce((a,r)=>a+r.workHours,0);
 return {items,hourly,cost,price,hours,profit:price-cost,vat:price*0.25,gross:price*1.25,perArea:price/area};
}
