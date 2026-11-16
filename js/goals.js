function goalValid(g) {
  return g && typeof g.id==='string' && typeof g.name==='string' && g.name.trim()
    && ['numeric','milestones','completion'].includes(g.kind) && ['active','achieved','failed'].includes(g.status)
    && /^\d{4}-\d{2}-\d{2}$/.test(g.deadline) && dateKey(dateFromKey(g.deadline))===g.deadline
    && Number.isFinite(g.reward) && g.reward>=0 && g.reward<=Number.MAX_SAFE_INTEGER
    && typeof g.penalty==='string' && g.penalty.trim() && Array.isArray(g.log)
    && (g.kind!=='numeric' || [g.start,g.target,g.current].every(Number.isFinite))
    && Array.isArray(g.milestones) && new Set(g.milestones.map(m=>m.id)).size===g.milestones.length
    && g.milestones.every(m=>typeof m.id==='string' && typeof m.name==='string' && typeof m.done==='boolean');
}
function goalProgress(g) {
  if(g.kind==='completion') return g.status==='achieved'?1:0;
  if(g.kind==='numeric') return g.start===g.target ? Number(g.current===g.target)
    : Math.max(0,Math.min(1,(g.current-g.start)/(g.target-g.start)));
  return g.milestones.length ? g.milestones.filter(m=>m.done || (state.dailyTasks||[]).some(t=>t.status==='completed'
    && t.goalLink?.goalId===g.id && t.goalLink.milestoneId===m.id)).length/g.milestones.length : 0;
}
function goalLog(g,action,extra={}) {g.log.push({id:createId('goal-log'),action,at:new Date().toISOString(),...extra});}
function expireGoals(now=new Date()) {
  let changed=false;
  for(const g of state.longTermGoals||[]) if(g.status==='active' && dateFromKey(g.deadline)<dateFromKey(dateKey(now)) && g.ignoredDeadline!==g.deadline) {
    g.status='failed';g.settledAt=now.toISOString();g.logicalDeadline=shiftDateKey(g.deadline,1);
    g.settlementKey='goal:'+g.id+':'+(g.revision||0);
    goalLog(g,'failed',{settlementKey:g.settlementKey,logicalDeadline:g.logicalDeadline});changed=true;
  }
  return changed;
}
async function goalTransaction(action) {
  if(typeof LifeOSPersistence!=='undefined')LifeOSPersistence.assertWrite();
  if(!navigator.locks?.request) throw Error('此浏览器不支持安全的目标结算，请使用新版 Safari 或 Chrome');
  return navigator.locks.request('lifeos-goals',()=>{
    if(typeof LifeOSPersistence!=='undefined')LifeOSPersistence.assertWrite();
    if(storageReadBlocked) throw Error('本机数据读取异常，暂不能修改目标');
    state=loadState();
    if(storageReadBlocked) throw Error('本机数据读取异常，原数据未改动');
    const before=JSON.stringify(state);
    try {state.longTermGoals ||= [];expireGoals();const result=action();if(JSON.stringify(state)!==before)saveState();return result;}
    catch(error){state=JSON.parse(before);throw error;}
  });
}
function saveGoal(data,id=null) {
  return goalTransaction(()=>{
    const previous=state.longTermGoals.find(g=>g.id===id);
    if(id && (!previous || previous.status!=='active')) throw Error('已结束目标不可编辑');
    const g={...previous,...data,id:previous?.id||createId('goal'),status:'active',log:previous?.log||[],createdAt:previous?.createdAt||new Date().toISOString()};
    if(!goalValid(g) || dateFromKey(g.deadline)<dateFromKey(dateKey())) throw Error('请检查必填内容、数值和截止日期');
    goalLog(g,previous?'edited':'created',{snapshot:JSON.parse(JSON.stringify(data))});
    state.longTermGoals=previous?state.longTermGoals.map(x=>x.id===id?g:x):[...state.longTermGoals,g];return g.id;
  });
}
function settleGoal(id) {
  return goalTransaction(()=>{
    const g=state.longTermGoals.find(x=>x.id===id);
    if(!g || g.status!=='active' || dateFromKey(g.deadline)<dateFromKey(dateKey())) return false;
    if(g.kind!=='completion' && goalProgress(g)<1) throw Error('尚未达到目标');
    const key='goal:'+id+':'+(g.revision||0);
    if(state.history.some(e=>e.settlementKey===key)) return false;
    const event=recordCoinEvent({type:'goal_reward',amount:g.reward,source:'goals',affectsBehaviorScore:false,
      history:{goalId:id,name:g.name,coins:g.reward,settlementKey:key}});
    Object.assign(g,{status:'achieved',settledAt:new Date().toISOString(),settlementKey:key,historyId:event.historyId});
    goalLog(g,'achieved',{settlementKey:key,amount:g.reward,historyId:event.historyId});return true;
  });
}
function correctGoal(id) {
  return goalTransaction(()=>{
    const g=state.longTermGoals.find(x=>x.id===id);
    if(!g || g.status==='active' || Date.now()-Date.parse(g.settledAt)>300000) throw Error('仅支持结算后五分钟内纠错');
    if(g.status==='achieved') {
      const entry=state.history.find(e=>e.id===g.historyId);
      if(!entry) throw Error('原结算记录缺失，不能安全撤销');
      recordCoinEvent({type:'goal_reward_reversed',amount:-historyCoinDelta(entry),source:'goals',affectsBehaviorScore:false,
        history:{goalId:id,name:g.name,reverses:entry.id,settlementKey:g.settlementKey+':reversed'}});
    } else g.ignoredDeadline=g.deadline;
    goalLog(g,'reversed',{settlementKey:g.settlementKey});g.status='active';g.revision=(g.revision||0)+1;return true;
  });
}
function fulfillGoalPenalty(id) {
  return goalTransaction(()=>{const g=state.longTermGoals.find(g=>g.id===id);
    if(!g || g.status!=='failed' || g.fulfilledAt) return false;
    g.fulfilledAt=new Date().toISOString();goalLog(g,'penalty_fulfilled');return true;});
}
function goalTodayAction(id,name,milestoneId=null) {
  if(typeof vacationDay==='function'&&vacationDay())return Promise.reject(Error('休假日请保留目标，改日再加入今日重点'));
  return goalTransaction(()=>{
    const g=state.longTermGoals.find(g=>g.id===id);
    if(!g || g.status!=='active' || !String(name).trim()) throw Error('目标或行动无效');
    const existing=state.dailyTasks.find(t=>t.localDateKey===dateKey() && t.status!=='deleted'
      && t.goalLink?.goalId===id && milestoneId && t.goalLink.milestoneId===milestoneId);
    if(existing)return existing.id;
    migrateUnifiedPriorities();
    const task=unifiedPriorityTask(String(name).trim(),dateKey(),createId('daily-task'),{goalLink:{goalId:id,milestoneId}});
    state.dailyTasks.push(task);goalLog(g,'today_action',{taskId:task.id,milestoneId});return task.id;
  });
}
