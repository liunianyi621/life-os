function unifiedSourceKey(day,id=null) { return id ? "plan:"+day+":"+id : "legacy:"+day; }
function prioritySourceImported(day,id=null) { return Boolean(state.unifiedPriorities?.imports?.[unifiedSourceKey(day,id)]); }
function unifiedPriorityTask(name,day,id=createId("daily-task"),extra={}) {
  const timestamp=new Date().toISOString();
  return {id,name,localDateKey:day,status:"pending",reward:50,penalty:200,ruleVersion:2,createdAt:timestamp,updatedAt:timestamp,...extra};
}
function migrateUnifiedPriorities(now=new Date()) {
  const before=JSON.stringify([state.unifiedPriorities,state.dailyTasks]);
  const firstActivation=!state.unifiedPriorities;
  state.unifiedPriorities ||= {version:1,from:dateKey(now),imports:{}};
  const marker=state.unifiedPriorities;
  if(marker.version!==1) throw Error("Unsupported unified priorities version");
  const importItem=(key,day,title,snapshot,extra={})=>{
    if(marker.imports[key]) return;
    const id="unified:"+key;
    if(!(state.dailyTasks||[]).some(t=>t.id===id)) state.dailyTasks.push(unifiedPriorityTask(title,day,id,{legacySource:key,legacySnapshot:cloneForUndo(snapshot),...extra}));
    marker.imports[key]=id;
  };
  for(const [day,item] of Object.entries(state.priorityTaskByDate||{})) {
    const reviewKey=item?.source==="daily_review" && item.sourceReviewDate ? "review:"+item.sourceReviewDate+":legacy-slot-0" : null;
    if(day>=marker.from && item?.title && item.status==="pending" && !priorityTaskHasSettlementEvidence(day,item))
      importItem(unifiedSourceKey(day),day,item.title,item,reviewKey?{reviewPlanKey:reviewKey}:{});
    else if(day>=marker.from && reviewKey && item?.title) {
      marker.protectedReviewKeys ||= [];
      if(!marker.protectedReviewKeys.includes(reviewKey)) marker.protectedReviewKeys.push(reviewKey);
    }
  }
  for(const [day,group] of Object.entries(state.priorityPlans||{})) {
    if(day<marker.from || !Array.isArray(group?.items)) continue;
    for(const [index,item] of group.items.entries()) {
      const key=group.source==="review" && group.sourceDate ? "review:"+group.sourceDate+":legacy-slot-"+index : null;
      if(item?.title && item.status==="pending" && !item.historyId && !state.history.some(e=>e.date===day && e.priorityItemId===item.id))
        importItem(unifiedSourceKey(day,item.id),day,item.title,item,key?{reviewPlanKey:key}:{});
      else if(key && item?.title) {
        marker.protectedReviewKeys ||= [];
        if(!marker.protectedReviewKeys.includes(key)) marker.protectedReviewKeys.push(key);
      }
    }
  }
  for(const task of state.dailyTasks||[]) {
    if(task.localDateKey>=marker.from && !dailyTaskSettled(task) && task.ruleVersion!==2) {
      task.previousEconomy={reward:task.reward,penalty:task.penalty};
      task.reward=50;task.penalty=200;task.ruleVersion=2;
    }
  }
  if(firstActivation) for(const [sourceDate,review] of Object.entries(state.dailyReviews||{})) {
    if(/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) && shiftDateKey(sourceDate,1)>=marker.from)
      syncUnifiedReviewPlan(sourceDate,review);
  }
  return before!==JSON.stringify([state.unifiedPriorities,state.dailyTasks]);
}
function reviewPlanRows(review) {
  if(Array.isArray(review?.priorityEntries) && review.priorityEntries.every(r=>r && typeof r.id==="string" && typeof r.text==="string")) return review.priorityEntries.map(r=>({...r}));
  const values=Array.isArray(review?.priorityItems)?review.priorityItems:[String(review?.priority||"")];
  return values.map((text,index)=>({id:"legacy-slot-"+index,text})).filter(r=>typeof r.text==="string" && r.text.trim());
}
function syncUnifiedReviewPlan(sourceDate,review) {
  const day=shiftDateKey(sourceDate,1);
  if(day<dateKey()) return {changed:false,protected:true,date:day};
  const rows=reviewPlanRows(review);
  const sourcePrefix="review:"+sourceDate+":";
  for(const row of rows) {
    if(!row.text.trim()) continue;
    const key=sourcePrefix+row.id;
    if(state.unifiedPriorities?.protectedReviewKeys?.includes(key)) continue;
    const existing=state.dailyTasks.find(t=>t.reviewPlanKey===key);
    if(existing) {
      if(!dailyTaskSettled(existing) && !existing.manuallyEdited) existing.name=row.text.trim();
    } else state.dailyTasks.push(unifiedPriorityTask(row.text.trim(),day,"unified:"+key,{reviewPlanKey:key}));
  }
  const ids=new Set(rows.filter(r=>r.text.trim()).map(r=>sourcePrefix+r.id));
  for(const task of state.dailyTasks) if(task.reviewPlanKey?.startsWith(sourcePrefix) && !ids.has(task.reviewPlanKey)
    && !dailyTaskSettled(task) && !task.manuallyEdited) task.status="deleted";
  const ordered=rows.map(row=>state.dailyTasks.find(t=>t.reviewPlanKey===sourcePrefix+row.id))
    .filter(t=>t && !dailyTaskSettled(t) && !t.manuallyEdited);
  const movable=new Set(ordered.map(t=>t.id));
  state.dailyTasks=state.dailyTasks.map(task=>movable.has(task.id)?ordered.shift():task);
  return {changed:true,protected:false,date:day};
}
function unifiedCompletedRecords(day) {
  const records=new Map();
  for(const e of state.history||[]) {
    if(e.date!==day) continue;
    const key=e.taskKind==="dailyTask" && e.type==="task_completed" ? "task:"+e.taskId
      : e.type==="priority_task_reward" ? e.priorityItemId ? "priority:"+e.priorityItemId : "legacy:"+day : null;
    if(key && !records.has(key)) records.set(key,{id:key,title:e.name||"已完成重点"});
  }
  return [...records.values()];
}
