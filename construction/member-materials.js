import {materials} from './materials.js';
import {bounded} from './design-basis.js';
// Characteristic timber values: Svenskt Trä vol.2 (2022), tables 3.3/3.4.
export const timberGrades={
 C24:{...materials.C24,fmMPa:24,fcMPa:21,fvMPa:4,fc90MPa:2.5,e05Pa:7.4e9,betaC:.2,gPa:690e6,reference:'Svenskt Trä vol.2 (2022), tabell 3.3 s.10; EN 338:2016. fm,k=24, fc,0,k=21, fv,k=4, fc,90,k=2,5 MPa; E0,05=7400 MPa, Gmean=690 MPa.'},
 GL30c:{...materials.GL30c,fmMPa:30,fcMPa:24.5,fvMPa:3.5,fc90MPa:2.5,e05Pa:10.8e9,betaC:.1,gPa:650e6,reference:'Svenskt Trä vol.2 (2022), tabell 3.4 s.12; EN 14080:2013. fm,k=30, fc,0,k=24,5, fv,k=3,5, fc,90,k=2,5 MPa; E0,05=10800 MPa, Gmean=650 MPa.'}
};
const kmodTable={1:[.6,.7,.8,.9,1.1],2:[.6,.7,.8,.9,1.1],3:[.5,.55,.65,.7,.9]};
export function timberFactors(serviceClass,duration){
 const durations=['permanent','long','medium','short','instant'],index=durations.indexOf(duration);
 if(!kmodTable[serviceClass]||index<0)throw Error('Velg klimaklasse og lastvarighet.');
 return {kmod:kmodTable[serviceClass][index],kdef:({1:.6,2:.8,3:2})[serviceClass],reference:'EN 1995-1-1, tabell 3.1/3.2; Svenskt Trä vol.2 s.8 og s.32'};
}
export function memberMaterial(input){
 if(input.family==='timber'){
  if(!timberGrades[input.grade])throw Error('Velg C24 eller GL30c.');
  return {...timberGrades[input.grade],family:'timber'};
 }
 if(input.family==='steel'){
  bounded(input.fyMPa,'dokumentert flytegrense',100,460);
  if(typeof input.strengthSource!=='string'||input.strengthSource.trim().length<4)throw Error('Oppgi kilde for tykkelsesavhengig stålflytegrense.');
  return {...materials.S355,family:'steel',name:'Stål – dokumentert flytegrense '+input.fyMPa+' MPa',fyMPa:input.fyMPa,strengthSource:input.strengthSource,gPa:210e9/2.6,reference:'E=210000 MPa, G=E/2,6 og tetthet 7850 kg/m³. Flytegrense fra brukerens tykkelsesavhengige dokumentasjon: '+input.strengthSource};
 }
 if(input.family==='concrete'){
  bounded(input.fckMPa,'fck',12,50);bounded(input.fykMPa,'armeringens fyk',400,600);
  return {id:'RC',family:'concrete',name:'Armert betong C'+input.fckMPa, fckMPa:input.fckMPa,fykMPa:input.fykMPa,ePa:22e9*((input.fckMPa+8)/10)**.3,densityKgM3:2500,reference:'EN 1992-1-1:2004, tabell 3.1, fck ≤ 50 MPa; bruk dokumentert armering.'};
 }
 throw Error('Velg materiale.');
}
