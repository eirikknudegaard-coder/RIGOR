// RIGOR's own editable templates. Times/consumption are assumptions, not industry norms.
// task(id, title, hours/unit, price key, demonstration price, material unit, consumption)
const task=(id,name,hours,priceKey=null,exampleMaterial=0,materialUnit='m²',materialRatio=1)=>({id,name,hours,priceKey,exampleMaterial,materialUnit,materialRatio});
export const roofTypes={
 flat:{name:'Flatt tak',note:'Lavt fall. Kontroller falloppbygging, sluk, overløp og oppkanter. Membran er foreslått tekking.'},
 shed:{name:'Pulttak',note:'Én skrå takflate. Kontroller høy og lav avslutning samt beslag.'},
 gable:{name:'Saltak',note:'To takflater. Horisontalt areal kan omregnes når begge sider har lik takvinkel.'},
 hip:{name:'Valmtak',note:'Flere takflater. Arealomregning forutsetter lik takvinkel på alle flater. Oppgi valmlengdene separat.'},
 mansard:{name:'Mansardtak',note:'To vinkler og knekk i takflatene. Ved projisert areal må andelen øvre tak og begge vinkler oppgis. Kontroller knekkbeslag separat.'}
};
export const library=[
 {id:'roof.removal',name:'Rive eksisterende taktekking',category:'40 · Tak / Riving',trade:'Tømrer',type:'Rehab',unit:'m²',tasks:[task('cover','Rive tekking',.15),task('clean','Renske underlag og festemidler',.10)]},
 {id:'roof.underlay',name:'Undertak, sløyfer og lekter',category:'41 · Tak / Underlag',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('underlay','Legge undertak',.25,'roof.underlay.undertak',140),task('battens','Montere sløyfer',.12,'roof.underlay.sloyfer',24,'m',1.67),task('laths','Montere lekter',.13,'roof.underlay.lekter',30,'m',2)]},
 {id:'roof.deck',name:'Fast underlag for membran',category:'41 · Tak / Underlag',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('deck','Montere taktro / plateunderlag',.30,'roof.deck',180)]},
 {id:'roof.cover.metal',name:'Metalltekking',category:'42 · Tak / Tekking',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('cover','Montere metalltekking',.35,'roof.cover.metal',290)]},
 {id:'roof.cover.tile',name:'Takstein',category:'42 · Tak / Tekking',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('cover','Legge takstein',.35,'roof.cover.tile',350)]},
 {id:'roof.cover.membrane',name:'Takmembran',category:'42 · Tak / Tekking',trade:'Taktekker',type:'Alle',unit:'m²',tasks:[task('cover','Legge / sveise takmembran',.40,'roof.cover.membrane',230)]},
 {id:'roof.ridge',name:'Møne',category:'43 · Tak / Beslag og avslutninger',trade:'Taktekker',type:'Alle',unit:'m',measure:'ridgeLength',tasks:[task('ridge','Montere mønebeslag / mønestein',.15,'roof.ridge',120,'m')]},
 {id:'roof.hip',name:'Valmer',category:'43 · Tak / Beslag og avslutninger',trade:'Taktekker',type:'Alle',unit:'m',measure:'hipLength',tasks:[task('hip','Montere valmbeslag / valmstein',.20,'roof.hip',140,'m')]},
 {id:'roof.break',name:'Knekk i mansardtak',category:'43 · Tak / Beslag og avslutninger',trade:'Taktekker',type:'Alle',unit:'m',measure:'breakLength',tasks:[task('break','Montere knekkbeslag',.25,'roof.break',170,'m')]},
 {id:'roof.edge',name:'Kantbeslag og takfot',category:'43 · Tak / Beslag og avslutninger',trade:'Taktekker',type:'Alle',unit:'m',measure:'edgeLength',tasks:[task('edge','Montere kant- og takfotbeslag',.18,'roof.edge',110,'m')]},
 {id:'roof.drain',name:'Sluk og overløp',category:'43 · Tak / Beslag og avslutninger',trade:'Taktekker',type:'Alle',unit:'stk',measure:'drainCount',tasks:[task('drain','Montere sluk / overløp',1,'roof.drain',700,'stk')]},
 {id:'roof.rig',name:'Stillas og fallsikring',category:'10 · Rigg, drift og sikring',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('safety','Etablere fallsikring',.04,'roof.rig.sikring',20),task('scaffold','Stillas: montering, demontering og leieavsetning',.08,'roof.rig.stillas',70)]},
 {id:'roof.waste',name:'Transport og avfall',category:'11 · Avfall og transport',trade:'Tømrer',type:'Rehab',unit:'m²',tasks:[task('waste','Håndtere og transportere avfall',.05,'roof.waste',65)]},
 {id:'insulation.removal',name:'Rive ytterkledning',category:'30 · Yttervegg / Riving',trade:'Tømrer',type:'Rehab',unit:'m²',tasks:[task('remove','Rive kledning',.20),task('clean','Renske og klargjøre vegg',.10)]},
 {id:'insulation.insulation',name:'Etterisolering utvendig, 100 mm',category:'31 · Yttervegg / Isolasjon',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('frame','Montere utlekting (forbruk må kontrolleres)',.30,'insulation.utlekting',45,'m',1.67),task('insulation','Montere 100 mm isolasjon',.25,'insulation.isolasjon100',180)]},
 {id:'insulation.cladding',name:'Vindsperre og ytterkledning',category:'32 · Yttervegg / Kledning',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('barrier','Montere vindsperre',.15,'insulation.vindsperre',60),task('cladding','Montere kledning',.50,'insulation.kledning',320)]},
 {id:'insulation.rig',name:'Stillas ved yttervegg',category:'10 · Rigg, drift og sikring',trade:'Tømrer',type:'Alle',unit:'m²',tasks:[task('rig','Montering, demontering og leieavsetning',.12,'insulation.rig',75)]},
 {id:'insulation.waste',name:'Avfall fra veggarbeid',category:'11 · Avfall og transport',trade:'Tømrer',type:'Rehab',unit:'m²',tasks:[task('waste','Transport og avfall',.05,'insulation.waste',55)]},
 {id:'extension.foundation',name:'Fundament og grunnarbeid (budsjett)',category:'20 · Grunn og fundament',trade:'Betong',type:'Nybygg',unit:'m²',tasks:[task('foundation','Fundament og grunnarbeid – må prosjekteres',1.8,'extension.foundation',2200)]},
 {id:'extension.frame',name:'Bærende konstruksjon og vegger (budsjett)',category:'30 · Yttervegg / Konstruksjon',trade:'Tømrer',type:'Nybygg',unit:'m²',tasks:[task('frame','Konstruksjon per m² gulvareal',4,'extension.frame',4200)]},
 {id:'extension.roof',name:'Tak på tilbygg (budsjett)',category:'42 · Tak / Tekking',trade:'Tømrer',type:'Nybygg',unit:'m²',tasks:[task('roof','Takavsetning per m² gulvareal',1.5,'extension.roof',1600)]},
 {id:'extension.interior',name:'Innvendige overflater (budsjett)',category:'50 · Innvendig / Overflater',trade:'Tømrer',type:'Nybygg',unit:'m²',tasks:[task('interior','Innvendige overflater per m² gulvareal',2.5,'extension.interior',1800)]},
 {id:'extension.technical',name:'Elektro og VVS (budsjett)',category:'60 · Tekniske fag',trade:'Tekniske fag',type:'Nybygg',unit:'m²',tasks:[task('technical','Avsetning – innhent fagtilbud',0,'extension.technical',2200)]},
 {id:'extension.rig',name:'Rigg på tilbygg',category:'10 · Rigg, drift og sikring',trade:'Tømrer',type:'Nybygg',unit:'m²',tasks:[task('rig','Rigg og drift per m² gulvareal',.7,'extension.rig',650)]}
];
export function instantiate(element,quantity,factor=1,selected=element.tasks.map(t=>t.id),instance=''){
 return element.tasks.filter(t=>selected.includes(t.id)).map(t=>({id:element.id+'.'+t.id+instance,elementId:element.id+instance,elementName:element.name,category:element.category,
 name:t.name,quantity,unit:element.unit,materialQuantity:quantity*t.materialRatio,materialRatio:t.materialRatio,materialUnit:t.materialUnit,material:0,exampleMaterial:t.exampleMaterial,
 hours:t.hours,factor,priceKey:t.priceKey,enabled:true,requiresQuantity:Boolean(element.measure)&&quantity===0}));
}
export function searchLibrary(elements,{search='',trade='Alle',type='Alle',category='Alle'}={}){
 const needle=search.toLocaleLowerCase('nb');
 return elements.filter(e=>(trade==='Alle'||e.trade===trade)&&(type==='Alle'||e.type==='Alle'||e.type===type)&&(category==='Alle'||e.category===category)&&`${e.name} ${e.category} ${e.tasks.map(t=>t.name).join(' ')}`.toLocaleLowerCase('nb').includes(needle));
}
