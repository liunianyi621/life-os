function activatePriorityPlan(now = new Date()) {
  if (state.priorityPlanVersion) return false;
  state.priorityPlanVersion={version:1,from:dateKey(now)};
  return true;
}
function usesPriorityPlan(day) {
  return state.priorityPlanVersion?.version===1 && day>=state.priorityPlanVersion.from && !state.priorityTaskByDate?.[day];
}
function reviewPriorityItems(review) {
  if(Array.isArray(review?.priorityEntries)) return review.priorityEntries.map(r=>String(r.text||""));
  return Array.isArray(review?.priorityItems) && review.priorityItems.length===3 && review.priorityItems.every(x=>typeof x==="string")
    ? [...review.priorityItems] : [String(review?.priority||""),"",""];
}
function syncPriorityPlan(day, titles, source, sourceDate=null) {
  const existing=state.priorityPlans?.[day];
  const blocked=Boolean(state.priorityTaskByDate?.[day]) || day<dateKey() || (source==="review" && existing && (existing.source!=="review"
    || existing.sourceDate!==sourceDate || existing.items.some(i=>i.status!=="pending")));
  if(blocked) {
    state.priorityPlanConflicts ||= {};
    state.priorityPlanConflicts[sourceDate||day]={day,titles:[...titles],recordedAt:new Date().toISOString()};
    if(typeof showToast==="function") showToast("计划已保留；该日重点已手改或执行，未覆盖，请在今日重点核对");
    return {protected:true,changed:false,date:day};
  }
  state.priorityPlans ||= {};
  const items=Array.from({length:3},(_,index)=>{
    const previous=existing?.items[index];
    if(previous && previous.status!=="pending") return previous;
    return {...previous,id:previous?.id||createId("priority-item"),title:String(titles[index]||"").trim(),status:"pending"};
  });
  state.priorityPlans[day]={version:1,date:day,source,sourceDate,items};
  return {changed:true,protected:false,date:day};
}
function settlePriorityItem(day,id,outcome,now=new Date()) {
  if(typeof prioritySourceImported==="function" && prioritySourceImported(day,id)) return null;
  const item=state.priorityPlans?.[day]?.items.find(i=>i.id===id);
  if(!item?.title || item.status!=="pending") return null;
  if(outcome==="done" && day!==dateKey(now)) return null;
  if(outcome==="failed" && (day>=dateKey(now) || item.failureReversed)) return null;
  const key=settlementIdentity("priority-item",id,day);
  if(state.history.some(e=>e.settlementKey===key)) return null;
  const previousTask={...item},amount=outcome==="done"?50:500;
  const event=recordCoinEvent({type:outcome==="done"?"priority_task_reward":"priority_task_penalty",
    amount:outcome==="done"?amount:-amount,date:day,timestamp:now.toISOString(),
    source:"behavior",category:"habit_performance",entityType:"priority_task",
    history:{priorityItemId:id,name:item.title,coins:amount,rewardAmount:50,penaltyAmount:500,settlementKey:key}});
  Object.assign(item,{status:outcome,historyId:event.historyId,settledAt:now.toISOString()});
  if(outcome==="failed") state.totals.coinsPenalty=parseCoinAmount(state.totals.coinsPenalty+amount);
  return {itemId:id,date:day,historyId:event.historyId,previousTask,amount};
}
function completePriorityItem(day,id) {
  runAutomaticChecks({showToast:false});
  const before=JSON.stringify(state),entry=settlePriorityItem(day,id,"done");
  if(!entry || !saveTaskAction(before)) return false;
  render();showUndoToast({type:"priority_item_completed",...entry});return true;
}
function restorePriorityItem(entry,failed=false) {
  const group=state.priorityPlans?.[entry.date];
  if(group) group.items=group.items.map(item=>item.id===entry.itemId
    ? {...entry.previousTask,...(failed?{failureReversed:true}:{})} : item);
}
function undoPriorityItem(undo) {
  const event=state.history.find(e=>e.id===undo.historyId && e.priorityItemId===undo.itemId);
  if(!event) return false;
  const before=JSON.stringify(state);
  removeCoinHistoryByIds([event.id]);undoCoinEvent({coinDelta:event.coinDelta,removeHistory:false});
  restorePriorityItem(undo);
  if(!saveTaskAction(before)) {showUndoToast(undo);return false;}
  render();return true;
}
function settlePriorityPlans(now,result) {
  for(const [day,group] of Object.entries(state.priorityPlans||{})) {
    if(!Array.isArray(group?.items) || group.version!==1) continue;
    for(const item of group.items) {
      if(!item || typeof item.id!=="string" || typeof item.title!=="string") continue;
      if(typeof prioritySourceImported==="function" && prioritySourceImported(day,item.id)) continue;
      const entry=settlePriorityItem(day,item.id,"failed",now);
      if(entry) {result.entries.push(entry);result.count++;result.totalPenalty=parseCoinAmount(result.totalPenalty+entry.amount);}
    }
  }
}
function priorityAutoGood(day) {
  return (state.priorityPlans?.[day]?.items||[]).filter(item=>item.status==="done"
    && state.history.some(e=>e.id===item.historyId && e.priorityItemId===item.id))
    .map(item=>({id:item.id,title:item.title}));
}
