import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {jobs,propose,calculate} from '../kalkyle-engine.js';
const rates={wage:283,direct:35,indirect:25,billing:80,laborMarkup:20,materialMarkup:20};
test('Timepris beholder presisjon fra lønn og faktureringsgrad',()=>assert.equal(calculate([],rates,100).hourly,596.953125));
for(const job of Object.keys(jobs))test(`${job}: mengder, påslag, MVA og fravalg`,()=>{
 const s={job,area:100,angle:30,basis:'surface',material:'metal',difficulty:1,options:jobs[job].options.map(x=>x[0])};
 const rows=propose(s),r=calculate(rows,rates,100);
 assert(r.price>0);assert(Math.abs(r.price-r.cost*1.2)<1e-7);
 assert(Math.abs(r.gross-r.price*1.25)<1e-9);
 assert(Math.abs(calculate(propose({...s,area:200}),rates,200).price-r.price*2)<1e-7);
 assert.equal(calculate(rows.map(x=>({...x,enabled:false})),rates,100).price,0);
});
test('Takflate beregnes fra projisert areal uten å omregne målt takflate',()=>{
 const s={job:'roof',area:100,angle:60,basis:'footprint',material:'metal',difficulty:1,options:['cover']};
 assert(Math.abs(propose(s)[0].quantity-200)<1e-9);
 assert.equal(propose({...s,basis:'surface'})[0].quantity,100);
});
