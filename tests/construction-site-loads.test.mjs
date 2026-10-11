import {test} from 'node:test';import assert from 'node:assert/strict';
import {municipalities,canonicalMunicipality,municipalityMentions} from '../construction/municipalities.js';
import {weatherAreas,weatherReference,terrainParameters} from '../construction/weather-register.js';
import {siteLoadBasis} from '../construction/site-loads.js';
import {interpretDescription} from '../construction/language.js';
import {nextQuestion} from '../construction/conversation.js';
import {setFact,fact} from '../construction/context.js';
import {validateInterpretation,interpretationSchema} from '../construction/ai-contract.js';
const snow={actions:'snow',municipality:'4202',altitudeM:100,roofType:'gable',roofAngleDeg:30,snowExposure:'normal',snowSliding:'free',snowDrift:'none',thermal:'normal',confirmed:true,standardSource:'Testprosjekt: kontrollert NS-EN 1991-1-3 og NA:2018'};
test('Official municipality catalogue keeps duplicate names and disambiguates current and former boundaries',()=>{
 assert.equal(municipalities.length,357);assert.equal(new Set(municipalities.map(m=>m[0])).size,357);
 assert.equal(canonicalMunicipality('Grimstad'),'4202');assert.equal(canonicalMunicipality('Våler'),null);
 assert.equal(municipalityMentions('Grimstadhallen er ikke et kommunenavn').length,0);
 assert.deepEqual(weatherAreas('4204'),['Kristiansand','Søgne','Songdalen']);assert.equal(weatherReference('4204'),null);
 assert.equal(weatherReference('4204','Søgne').snow.sk0,3.5);assert.equal(weatherReference('4205','Mandal').wind.vb0,28);
 assert.equal(weatherReference('0301').snow,null);assert.equal(weatherReference('0301').wind,null);
});
test('Snow reference is altitude bounded; missing increment rules or data never turn into a guessed load',()=>{
 assert.equal(siteLoadBasis(snow).snow.groundKnM2,4.5);
 for(const altitudeM of [151,500]){const r=siteLoadBasis({...snow,altitudeM});assert.equal(r.snow.groundKnM2,null);assert(r.required.includes('groundSnowKnM2'));assert.equal(r.ready,false);}
 const r=siteLoadBasis({...snow,altitudeM:500,groundSnowKnM2:6,groundSnowSource:'Dokumentert NA-høyderegel for teststedet'});assert(Math.abs(r.snow.roofKnM2-4.8)<1e-12);
 assert.equal(siteLoadBasis({...snow,municipality:'0301'}).snow.roofKnM2,undefined);
 const overridden=siteLoadBasis({...snow,groundSnowKnM2:5,groundSnowSource:'Prosjektets kontrollerte alternative NA-grunnlag'});assert.equal(overridden.snow.groundKnM2,5);assert.equal(overridden.snow.groundSource,'Prosjektets kontrollerte alternative NA-grunnlag');
 assert.equal(siteLoadBasis({...snow,groundSnowKnM2:5,groundSnowSource:''}).snow.roofKnM2,undefined);
});
test('Roof snow preserves ground/roof distinction, balanced and asymmetric gable cases, and retention',()=>{
 const r=siteLoadBasis(snow);assert.equal(r.ready,true);assert.equal(r.snow.roofKnM2,3.6);assert.deepEqual(r.snow.cases.map(c=>[c.left,c.right]),[[3.6,3.6],[1.8,3.6],[3.6,1.8]]);
 assert.equal(siteLoadBasis({...snow,roofAngleDeg:45}).snow.roofKnM2,1.8);
 assert.equal(siteLoadBasis({...snow,roofAngleDeg:60,snowSliding:'retained'}).snow.roofKnM2,3.6);
 for(const change of [{snowDrift:'complex'},{thermal:'special'},{snowSliding:'complex'},{roofType:'hip'},{roofType:'flat',roofAngleDeg:15}]){const r=siteLoadBasis({...snow,...change});assert.equal(r.ready,false);assert.equal(r.snow.roofKnM2,undefined);}
 assert.equal(siteLoadBasis({...snow,confirmed:false}).snow.ready,false);
});
test('Wind uses the supplied Norwegian roughness minima; terrain transition and topography need separate controls',()=>{
 assert.deepEqual(terrainParameters.II,{kr:.19,z0:.05,zmin:4});assert.equal(terrainParameters.IV.zmin,16);
 const p={...snow,actions:'wind',heightM:10,terrain:'II',topography:'flat',terrainTransition:'no',altitudeFactor:1,altitudeFactorSource:'Dokumentert høydefaktor for teststed',turbulenceIntensity:.2,turbulenceSource:'Dokumentert Iv for testhøyde',airDensity:1.25};
 const r=siteLoadBasis(p);assert.equal(r.ready,true);assert.equal(r.wind.vb0,26);assert(Math.abs(r.wind.vm-26.17368779074722)<1e-8);assert(Math.abs(r.wind.qpKnM2-1.02759289782)<1e-8);
 assert.equal(siteLoadBasis({...p,heightM:1}).wind.z,4);
 for(const change of [{topography:'hill'},{terrainTransition:'yes'},{altitudeFactor:undefined},{turbulenceIntensity:undefined},{altitudeFactorSource:''},{turbulenceSource:''}]){const r=siteLoadBasis({...p,...change});assert.equal(r.ready,false);assert.equal(r.wind.qpKnM2,undefined);}
 assert(r.notes.some(s=>s.includes('ikke inn som positiv tyngdelast')));
});
test('Natural site questions distinguish altitude, building height and duplicate municipality names',()=>{
 let c=interpretDescription('Beregn snølast og vindlast for en bygning i Grimstad, 70 moh. Bygget er 8 meter høyt.');
 assert.equal(fact(c,'goal'),'site_loads');assert.equal(fact(c,'siteMunicipality'),'4202');assert.equal(fact(c,'siteAltitudeM'),70);assert.equal(fact(c,'buildingHeightM'),8);assert.equal(nextQuestion(c).id,'siteTerrain');assert.equal(nextQuestion(c).type,'select');
 c=interpretDescription('Jeg vil finne snølast i Våler.');assert.equal(fact(c,'siteMunicipality'),undefined);assert.equal(nextQuestion(c).id,'siteMunicipality');
 c=interpretDescription('Beregn vindlast. Bygget er 8 meter over havet.');assert.equal(fact(c,'siteAltitudeM'),8);assert.equal(fact(c,'buildingHeightM'),undefined);
 c=interpretDescription('Beregn snølast i Kristiansand.');c=setFact(c,'siteAltitudeM',100);assert.equal(nextQuestion(c).id,'siteArea');assert.equal(nextQuestion(c).options.length,3);
});
test('AI must quote one municipality and distinguish altitude; norm registers and formulas stay outside its schema',()=>{
 const brief='Snølast i Grimstad, 70 moh. Bygget er 8 meter høyt.';
 assert.equal(validateInterpretation({facts:[{field:'siteMunicipality',value:'4202',evidence:'Grimstad'},{field:'siteAltitudeM',value:70,evidence:'70 moh'}]},brief).facts.length,2);
 for(const [text,f]of [['Våler',{field:'siteMunicipality',value:'3419',evidence:'Våler'}],[brief,{field:'siteAltitudeM',value:8,evidence:'Bygget er 8 meter høyt'}],['Terreng ved huset',{field:'siteTerrain',value:'0',evidence:'Terreng ved huset'}]])assert.throws(()=>validateInterpretation({facts:[f]},text));
 const schema=JSON.stringify(interpretationSchema());for(const key of ['vb0','groundSnowKnM2','altitudeFactor','turbulenceIntensity','qpKnM2'])assert(!schema.includes('"'+key+'"'));
});
