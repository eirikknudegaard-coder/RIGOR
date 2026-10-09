// A budget is a scope, not a request to append it to unrelated seed rows.
export function conversionRows(rows,context){
 const keys=new Set(context.scope.flatMap(item=>item.taskIds.map(id=>item.elementId+'.'+id)));
 return rows.filter(row=>!row.wizardGenerated||row.userEdited).map(row=>({...row,conversionOutsideScope:!keys.has(row.taskKey)}));
}
export function conversionSettings(settings,context){
 const facts=context.facts||{},roof=facts.domain==='roof',next={...settings};
 if(Number.isFinite(facts.area)&&facts.area>0)next.area=facts.area;
 if(roof){for(const [key,value]of Object.entries(context.measurements||{}))if(value!==null&&value!==undefined&&key in next)next[key]=value;next.job='roof';}
 else if(['terrace','exterior_wall'].includes(facts.domain)){next.basis='surface';next.angle=0;if(facts.domain==='exterior_wall')next.job='insulation';}
 if(facts.access==='normal')next.difficulty=1;
 return next;
}
export function benchmarkDiff(simple,detailed){
 const midpoint=(simple.price.min+simple.price.max)/2,difference=detailed.price-midpoint;
 const percent=midpoint>0?difference/midpoint*100:difference===0?0:null;
 return {simpleMidpoint:midpoint,detailedTotal:detailed.price,difference,percent,pass:percent!==null&&Math.abs(percent)<=20,largeDifference:Math.abs(difference)>=100000};
}
