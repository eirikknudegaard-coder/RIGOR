import {readCsv,validatePrices} from './kalkyle-prices.js?v=20261005-bibliotek2';
export const fields=['prisnokkel','enhet','pris','kilde','dato','valuta','mva'];
const aliases={prisnokkel:['prisnokkel','prisnøkkel','post','key'],enhet:['enhet','unit'],pris:['pris','nettopris','price','innkjøpspris'],kilde:['kilde','leverandør','supplier'],dato:['dato','prisdato','date'],valuta:['valuta','currency'],mva:['mva','vat']};
export function prepareImport(text){
 const records=readCsv(text),headers=records.shift();
 if(headers.length>80||records.length>10000||records.some(r=>r.length!==headers.length))throw Error('Filen må ha høyst 80 kolonner, 10 000 rader og likt antall kolonner på hver rad.');
 const mapping=Object.fromEntries(fields.map(k=>[k,headers.findIndex(h=>aliases[k].includes(h.toLowerCase().trim()))]));
 for(const k of fields)if(mapping[k]<0)mapping[k]=null;
 return {headers,records,mapping};
}
export function sampleImport(file){
 const sample={headers:file.headers.map(s=>s.slice(0,120)),rows:file.records.slice(0,8).map(row=>row.map(s=>s.slice(0,200)))};
 if(JSON.stringify(sample).length>16000)throw Error('Utvalget har for mye tekst. Velg færre kolonner før AI-analyse.');
 return sample;
}
export function checkMapping(mapping,width){
 if(!mapping||fields.some(k=>mapping[k]!==null&&(!Number.isInteger(mapping[k])||mapping[k]<0||mapping[k]>=width)))throw Error('Ugyldig kolonneforslag.');
 const selected=fields.map(k=>mapping[k]).filter(v=>v!==null);
 if(new Set(selected).size!==selected.length)throw Error('Samme kolonne er koblet til flere felt.');
 return mapping;
}
export function mapImport(file,mapping,defaults){
 checkMapping(mapping,file.headers.length);
 if(mapping.pris===null||mapping.prisnokkel===null)throw Error('Velg kolonner for prisnøkkel og pris. Varenummer kan ikke automatisk brukes som kalkylens prisnøkkel.');
 const records=file.records.map(row=>Object.fromEntries(fields.map(k=>[k,mapping[k]===null?defaults[k]||'':row[mapping[k]]])));
 return validatePrices(records);
}
