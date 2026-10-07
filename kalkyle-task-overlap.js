// These library tasks describe the same operation inside different packages.
// Do not deduplicate by task name: walls, ceilings and product variants often
// share a label while describing different work or different materials.
const aliases=new Map([
 ['terrace.strip.joists.step0','terrace.strip.deck.step0'],
 ['roof.strip.battens.step0','roof.remove.structure.laths'],
 ['wall.cladding.horizontal.barrier','insulation.cladding.barrier'],
 ['wall.cladding.vertical.barrier','insulation.cladding.barrier']
]);

export function workKey(row){
 if(!row.taskKey||!row.unit)return null;
 return (aliases.get(row.taskKey)||row.taskKey)+'|'+row.unit;
}

// Excluded existing work also belongs to the project. An AI rerun must not
// reinsert a task the user deliberately excluded or replace its saved values.
export function reviewAssistantTasks(selections,existingRows,catalog){
 const occupied=new Map();
 for(const row of existingRows){const key=workKey(row);if(key&&!occupied.has(key))occupied.set(key,{kind:'existing',row});}
 const plans=selections.map((selection,index)=>{
  const element=catalog.find(e=>e.id===selection.elementId);
  return {...selection,index,element,tasks:selection.taskIds.map(id=>{
   const task=element.tasks.find(t=>t.id===id);
   return {task,key:workKey({taskKey:element.id+'.'+id,unit:element.unit}),wanted:!selection.selectedTaskIds||selection.selectedTaskIds.includes(id)};
  })};
 });
 const priority={requested:0,related:1,optional:2};
 for(const plan of [...plans].sort((a,b)=>(priority[a.scope]??0)-(priority[b.scope]??0))){
  if(!plan.selected)continue;
  for(const task of plan.tasks)if(task.wanted&&!occupied.has(task.key))occupied.set(task.key,{kind:'proposal',index:plan.index,element:plan.element});
 }
 return plans.map(plan=>({...plan,tasks:plan.tasks.map(task=>{
  const owner=occupied.get(task.key),blocked=owner&&(owner.kind==='existing'||owner.index!==plan.index)?owner:null;
  return {...task,blocked,included:Boolean(plan.selected&&task.wanted&&!blocked)};
 })}));
}

// Repeat the check at application time, independently of preview checkboxes.
export function uniqueAssistantRows(candidates,existingRows){
 const seen=new Set(existingRows.map(workKey).filter(Boolean)),rows=[],skipped=[];
 for(const row of candidates){const key=workKey(row);if(key&&seen.has(key)){skipped.push(row);continue;}rows.push(row);if(key)seen.add(key);}
 return {rows,skipped};
}

// Equal task and quantity only flag a possible overlap. Separate areas can
// legitimately contain the same task, so saved rows are never removed here.
export function findWorkOverlaps(rows){
 const groups=new Map();
 for(const row of rows){const key=workKey(row);if(!key||!row.enabled||!Number.isFinite(row.quantity)||row.quantity<=0)continue;
  const scope=key+'|'+row.quantity;if(!groups.has(scope))groups.set(scope,[]);groups.get(scope).push(row);
 }
 return [...groups.values()].filter(group=>group.length>1);
}
