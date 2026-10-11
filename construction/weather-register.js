import {municipalities} from './municipalities.js';
// Transcribed from the user's standard excerpts, 2026-10-11. The original
// screenshots remain outside the repository. A current municipality name
// must never silently replace the former municipality used in these tables.
export const weatherSources={snow:'Brukervedlegg: NS-EN 1991-1-3:2003+A1:2015+NA:2018, tabell NA.4.1(901), utsnitt Karakteristisk snølast VEST 1 / VESTAUST 2',wind:'Brukervedlegg: NS-EN 1991-1-4:2005+NA:2009, utsnitt Referansevindhastighet / Terrengruhetskategori'};
const snowRows=[
 ['Arendal',4.5,150,.5,null],['Birkenes',4.5,350,.5,6.5],['Bygland',4.5,350,1,6.5],['Bykle',5,750,1,6.5],['Bykle – nær Rogaland',5,750,1,7.5],['Evje og Hornnes',4.5,250,.5,6.5],['Froland',4.5,150,.5,6.5],['Gjerstad',4.5,150,1,6.5],['Grimstad',4.5,150,.5,null],['Iveland',4.5,350,.5,6.5],['Lillesand',4.5,150,.5,null],['Risør',4.5,150,.5,null],['Tvedestrand',4.5,150,.5,null],['Valle',5,450,1,6.5],['Vegårshei',4.5,250,1,6.5],['Åmli',4.5,250,1,6.5],
 ['Audnedal',4.5,150,.5,6.5],['Farsund',2.5,150,.5,null],['Flekkefjord',2.5,150,.5,null],['Flekkefjord – nær Rogaland',2.5,150,.5,7.5],['Hægebostad',4.5,250,.5,6.5],['Kristiansand',4,150,.5,null],['Kvinesdal',3,150,.5,null],['Lindesnes',3,150,.5,null],['Lyngdal',3,150,.5,null],['Mandal',3.5,150,.5,null],['Marnardal',4.5,150,.5,6.5],['Sirdal',3,150,1,6.5],['Sirdal – nær Rogaland',3,150,1,7.5],['Songdalen',4.5,150,.5,6.5],['Søgne',3.5,150,.5,null],['Vennesla',4.5,150,.5,6.5],['Åseral',4.5,350,1,6.5]
];
const windRows=[['Fyresdal',24],['Tokke',24],['Vinje',24],['Risør',26],['Grimstad',26],['Arendal',26],['Gjerstad',24],['Vegårshei',24],['Tvedestrand',26],['Froland',24],['Lillesand',26],['Birkenes',24],['Åmli',24],['Iveland',24],['Evje og Hornnes',24],['Bygland',24],['Valle',24],['Bykle',24],['Kristiansand',26],['Mandal',28],['Farsund',28],['Flekkefjord',28],['Vennesla',24],['Songdalen',24],['Søgne',26],['Marnardal',24],['Åseral',24],['Audnedal',24],['Lindesnes',28],['Lyngdal',26],['Hægebostad',24],['Kvinesdal',24],['Sirdal',24]];
const merged={Kristiansand:['Kristiansand','Søgne','Songdalen'],Lindesnes:['Lindesnes','Mandal','Marnardal'],Lyngdal:['Lyngdal','Audnedal'],Bykle:['Bykle','Bykle – nær Rogaland'],Sirdal:['Sirdal','Sirdal – nær Rogaland'],Flekkefjord:['Flekkefjord','Flekkefjord – nær Rogaland']};
export function weatherAreas(id){const name=municipalities.find(m=>m[0]===id)?.[1];return merged[name]||[name].filter(Boolean);}
export function weatherReference(id,area){
 const areas=weatherAreas(id);if(!areas.length||areas.length>1&&!areas.includes(area))return null;
 const name=areas.length===1?areas[0]:area,base=name.split(' – ')[0],snow=snowRows.find(r=>r[0]===name),wind=windRows.find(r=>r[0]===base);
 return {municipality:id,area:name,snow:snow?{sk0:snow[1],altitudeLimitM:snow[2],increment:snow[3],maximum:snow[4],source:weatherSources.snow}:null,wind:wind?{vb0:wind[1],source:weatherSources.wind}:null};
}
// Norwegian NA table in the supplied excerpt: these differ from EN table 4.1.
export const terrainParameters={'0':{kr:.16,z0:.003,zmin:2},'I':{kr:.17,z0:.01,zmin:2},'II':{kr:.19,z0:.05,zmin:4},'III':{kr:.22,z0:.3,zmin:8},'IV':{kr:.24,z0:1,zmin:16}};
