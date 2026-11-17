const WORKBENCH_PRIORITIES = { high: '优先处理', normal: '持续推进', low: '低优先级' };
const WORKBENCH_STATUSES = { todo: '待办', active: '进行中', waiting: '等待中', completed: '已完成' };
function wbObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function wbDateValid(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y,m,d] = day.split('-').map(Number), date = new Date(y,m-1,d);
  return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d;
}
function workbenchValid(data, executions = []) {
  if (!wbObject(data) || data.version!==1 || !Array.isArray(data.projects) || !Array.isArray(data.tasks)) return false;
  const stamp = value => typeof value==='string' && Number.isFinite(Date.parse(value));
  const ids = records => records.every(r=>wbObject(r)&&typeof r.id==='string'&&r.id) && new Set(records.map(r=>r.id)).size===records.length;
  if (!ids(data.projects) || !ids(data.tasks)) return false;
  if(data.notes!==undefined&&(!Array.isArray(data.notes)||!ids(data.notes)||!data.notes.every(n=>n.type==='note'&&typeof n.text==='string'&&['active','deleted'].includes(n.status)&&stamp(n.createdAt)&&stamp(n.updatedAt)&&data.projects.some(p=>p.id===n.projectId&&(n.status==='deleted'||p.groups?.some(g=>g.id===n.groupId))))))return false;
  if([...(data.notes||[]),...data.tasks].some(t=>t.outlineOrder!==undefined&&(!Number.isSafeInteger(t.outlineOrder)||t.outlineOrder<0)))return false;
  if(!data.projects.every(p=>p.groups===undefined ? p.groupsVersion===undefined : (p.groupsVersion===1&&Array.isArray(p.groups)&&ids(p.groups)&&p.groups.every(g=>typeof g.name==='string'&&g.name.trim()))))return false;
  if(!data.tasks.every(t=>t.groupId===undefined||t.status==='deleted'||(typeof t.groupId==='string'&&data.projects.find(p=>p.id===t.projectId)?.groups?.some(g=>g.id===t.groupId))))return false;
  const projects=new Set(data.projects.map(p=>p.id)),tasks=new Map(data.tasks.map(t=>[t.id,t]));
  if (!data.projects.every(p=>typeof p.name==='string'&&p.name.trim()&&['active','archived','deleted'].includes(p.status)&&stamp(p.createdAt)&&stamp(p.updatedAt))) return false;
  if (!data.tasks.every(t=>typeof t.name==='string'&&t.name.trim()&&(t.projectId===null||projects.has(t.projectId))
    && Object.hasOwn(WORKBENCH_PRIORITIES,t.priority) && (Object.hasOwn(WORKBENCH_STATUSES,t.status)||t.status==='deleted')
    && (t.dueDate===null||wbDateValid(t.dueDate)) && stamp(t.createdAt)&&stamp(t.updatedAt)
    && (t.completedAt===null||stamp(t.completedAt)) && Array.isArray(t.executionIds) && new Set(t.executionIds).size===t.executionIds.length
    && t.executionIds.every(id=>typeof id==='string')
    && (t.reopenedExecutionIds===undefined || (Array.isArray(t.reopenedExecutionIds)&&t.reopenedExecutionIds.every(id=>t.executionIds.includes(id)))))) return false;
  for(const t of data.tasks) {
    const dates=new Set();
    for(const id of t.executionIds) {
      const execution=executions.find(e=>e.id===id);
      if(!execution||execution.workbenchTaskId!==t.id||dates.has(execution.localDateKey))return false;
      dates.add(execution.localDateKey);
    }
  }
  return executions.every(e=>e.workbenchTaskId===undefined || (tasks.has(e.workbenchTaskId)&&tasks.get(e.workbenchTaskId).executionIds.includes(e.id)));
}
function workbenchData() {
  if(state.workbench!==undefined && !workbenchValid(state.workbench,state.dailyTasks||[]))throw Error('工作台数据暂时无法安全读取，未修改原始记录');
  return state.workbench || {version:1,projects:[],tasks:[]};
}
function wbTask(id) { return workbenchData().tasks.find(t=>t.id===id&&t.status!=='deleted'); }
function wbExecutions(task) { return task.executionIds.map(id=>(state.dailyTasks||[]).find(e=>e.id===id)).filter(Boolean); }
function wbTodayExecution(task) { return wbExecutions(task).find(e=>e.localDateKey===dateKey()); }
function wbEffectiveStatus(task) {
  if(task.status==='deleted')return 'deleted';
  if(task.status==='completed')return 'completed';
  return wbExecutions(task).some(e=>e.status==='completed'&&!task.reopenedExecutionIds?.includes(e.id))?'completed':task.status;
}
function wbTaskName(task) {
  const execution=wbExecutions(task).filter(e=>e.status!=='deleted').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  return execution && execution.status!=='deleted' && execution.updatedAt>task.updatedAt ? execution.name : task.name;
}
function wbTasks(project='all',completed=false) {
  return workbenchData().tasks.filter(t=>t.status!=='deleted' && (project==='all'||(project==='none'?t.projectId===null:t.projectId===project))
    && (wbEffectiveStatus(t)==='completed')===completed).sort((a,b)=>{
      const rank=t=>({urgent:0,important:1,waiting:2})[wbGroup(t)];
      return rank(a)-rank(b) || (a.dueDate||'9999').localeCompare(b.dueDate||'9999') || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
}
function wbMutate(change) {
  const before=JSON.stringify(state);
  try {
    workbenchData();
    state.workbench ||= {version:1,projects:[],tasks:[]};
    ensureWorkbenchGroups(state.workbench);
    const result=change(state.workbench);
    ensureWorkbenchGroups(state.workbench);
    if(!workbenchValid(state.workbench,state.dailyTasks||[]))throw Error('关联数据校验失败，未保存');
    if(!saveTaskAction(before))throw Error('保存失败，数据未更改，请重试');
    return result;
  } catch(error) {state=JSON.parse(before);throw error;}
}
function wbProjectGroups(projectId){
  const project=(state.workbench?.projects||[]).find(p=>p.id===projectId);
  if(!project)return [];
  return project.groups===undefined?['紧急','重要','等待中'].map((name,i)=>({id:`wb-group:${projectId}:${['urgent','important','waiting'][i]}`,name})):project.groups;
}
function wbTaskGroupId(task){return task.groupId||`wb-group:${task.projectId}:${wbGroup(task)}`;}
function ensureWorkbenchGroups(data){
  for(const p of data.projects)if(p.groups===undefined){p.groups=wbProjectGroups(p.id);p.groupsVersion=1;}
  for(const t of data.tasks)if(t.projectId&&t.groupId===undefined){const groups=wbProjectGroups(t.projectId);const legacy=`wb-group:${t.projectId}:${wbGroup(t)}`;t.groupId=(groups.find(g=>g.id===legacy)||groups[0])?.id;}
}
function saveWorkbenchGroup(projectId,{id=null,name}){
  name=String(name||'').trim();if(!name)throw Error('请输入分组名称');
  return wbMutate(data=>{const p=data.projects.find(p=>p.id===projectId&&p.status!=='deleted');if(!p)throw Error('项目已不存在');
    if(id){const group=p.groups.find(g=>g.id===id);if(!group)throw Error('分组已不存在');group.name=name;return id;}
    const group={id:createId('work-group'),name};p.groups.push(group);return group.id;
  });
}
function reorderWorkbenchGroup(projectId,id,direction){return wbMutate(data=>{const p=data.projects.find(p=>p.id===projectId);if(!p)throw Error('项目已不存在');const i=p.groups.findIndex(g=>g.id===id),j=i+direction;if(i<0||j<0||j>=p.groups.length)return false;[p.groups[i],p.groups[j]]=[p.groups[j],p.groups[i]];return true;});}
function deleteWorkbenchGroup(projectId,id,targetId=null){return wbMutate(data=>{
  const p=data.projects.find(p=>p.id===projectId);if(!p?.groups.some(g=>g.id===id))throw Error('分组已不存在');
  const tasks=data.tasks.filter(t=>t.projectId===projectId&&t.status!=='deleted'&&wbTaskGroupId(t)===id);
  if(tasks.length&&!p.groups.some(g=>g.id===targetId&&g.id!==id))throw Error('请先选择其他分组接收任务；没有其他分组时请先新增分组');
  for(const t of tasks)t.groupId=targetId;
  p.groups=p.groups.filter(g=>g.id!==id);return true;
});}
function saveWorkbenchProject({id=null,name}) {
  name=String(name||'').trim();if(!name)throw Error('请输入项目名称');
  return wbMutate(data=>{
    const existing=id&&data.projects.find(p=>p.id===id&&p.status!=='deleted');
    if(id&&!existing)throw Error('项目已不存在');
    const at=new Date().toISOString();
    if(existing){existing.name=name;existing.updatedAt=at;return existing.id;}
    const project={id:createId('project'),name,status:'active',createdAt:at,updatedAt:at};data.projects.push(project);return project.id;
  });
}
function setWorkbenchProjectStatus(id,status,{targetProjectId=null}={}) {
  if(!['active','archived','deleted'].includes(status))throw Error('无效项目状态');
  return wbMutate(data=>{
    const project=data.projects.find(p=>p.id===id&&p.status!=='deleted');if(!project)throw Error('项目已不存在');
    const tasks=data.tasks.filter(t=>t.projectId===id&&t.status!=='deleted');
    if(status==='deleted'&&tasks.length&&(!targetProjectId||targetProjectId===id||!data.projects.some(p=>p.id===targetProjectId&&p.status!=='deleted')))throw Error('请先选择接收任务的项目，任务不会删除');
    project.status=status;project.updatedAt=new Date().toISOString();
    if(status==='deleted')for(const t of tasks){if(!wbProjectGroups(targetProjectId).length)throw Error('接收项目需要先新增分组');t.name=wbTaskName(t);t.projectId=targetProjectId;delete t.groupId;t.updatedAt=project.updatedAt;}
    return true;
  });
}
function saveWorkbenchTask({id=null,name,projectId=null,priority='normal',dueDate=null,status='todo',groupId}) {
  name=String(name||'').trim();dueDate=dueDate||null;projectId=projectId||null;
  if(!name||!Object.hasOwn(WORKBENCH_PRIORITIES,priority)||!Object.hasOwn(WORKBENCH_STATUSES,status)||(dueDate&&!wbDateValid(dueDate)))throw Error('请检查名称、日期和状态');
  if(id&&wbTask(id)&&wbEffectiveStatus(wbTask(id))!==status){
    // Completion uses the same entry point as the list circle, never a form-only flag.
    if(status==='completed')throw Error('请使用完成按钮，确保今天同步结算');
  }
  return wbMutate(data=>{
    if(projectId&&!data.projects.some(p=>p.id===projectId&&p.status!=='deleted'))throw Error('项目已不存在');
    const existing=id&&data.tasks.find(t=>t.id===id&&t.status!=='deleted');if(id&&!existing)throw Error('任务已不存在');
    if(!existing&&!projectId)throw Error('新任务必须属于一个项目');
    if(projectId&&!wbProjectGroups(projectId).length)throw Error('请先新增分组');
    if(groupId!==undefined&&!wbProjectGroups(projectId).some(g=>g.id===groupId))throw Error('请选择本项目的有效分组');
    const at=new Date().toISOString();
    if(existing) {
      const previous=wbEffectiveStatus(existing);
      if(previous==='completed'&&status!=='completed')existing.reopenedExecutionIds=wbExecutions(existing).filter(e=>e.status==='completed').map(e=>e.id);
      Object.assign(existing,{name,projectId,priority,dueDate,status:previous==='completed'&&status==='completed'?existing.status:status,updatedAt:at,completedAt:status==='completed'?existing.completedAt:null});
      if(groupId!==undefined)existing.groupId=groupId;
      else if(existing.groupId&&!wbProjectGroups(projectId).some(g=>g.id===existing.groupId))delete existing.groupId;
      const execution=wbTodayExecution(existing);
      if(execution&&!dailyTaskSettled(execution)){execution.name=name;execution.updatedAt=at;}
      return existing.id;
    }
    if(status==='completed')throw Error('请先保存任务，再标记完成');
    const task={id:createId('work-task'),name,projectId,priority,dueDate,status,createdAt:at,updatedAt:at,completedAt:null,executionIds:[]};
    if(groupId!==undefined)task.groupId=groupId;data.tasks.push(task);return task.id;
  });
}
// Read-only mapping keeps old low-priority and active records intact.
function wbGroup(task){return wbEffectiveStatus(task)==='waiting'?'waiting':task.priority==='high'?'urgent':'important';}
function moveWorkbenchGroup(id,group){
  return wbMutate(()=>{
    const task=wbTask(id);if(!task||wbEffectiveStatus(task)==='completed')throw Error('任务已完成或不存在');
    const groups=wbProjectGroups(task.projectId),target=groups.find(g=>g.id===group)||groups.find(g=>g.id===`wb-group:${task.projectId}:${group}`);
    if(!target)throw Error('请选择当前项目的分组');task.groupId=target.id;
    task.name=wbTaskName(task);
    if(group==='waiting')task.status='waiting';
    else if(group==='urgent'||group==='important'){task.priority=group==='urgent'?'high':'normal';task.status='todo';}
    task.updatedAt=new Date().toISOString();return true;
  });
}
function assignWorkbenchProject(ids,projectId){
  return wbMutate(data=>{
    if(!data.projects.some(p=>p.id===projectId&&p.status!=='deleted'))throw Error('请选择有效项目');
    if(!wbProjectGroups(projectId).length)throw Error('请先在项目中新增分组');
    for(const id of ids){const task=wbTask(id);if(!task)throw Error('任务已不存在');task.name=wbTaskName(task);task.projectId=projectId;delete task.groupId;task.updatedAt=new Date().toISOString();}
    return true;
  });
}
function completeWorkbenchTask(id) {
  runAutomaticChecks({showToast:false});
  const task=wbTask(id);if(!task||wbEffectiveStatus(task)==='completed')return false;
  const execution=wbTodayExecution(task);
  if(execution&&execution.status!=='deleted') {
    if(execution.status==='failed')throw Error('今日执行已失败，请先撤回失败后再完成；历史扣款不会自动撤销');
    if(!dailyTaskSettled(execution)){
      if(!completeDailyTask(execution.id))throw Error('今日任务未能完成，请检查保存状态后重试');
      return true;
    }
  }
  const previous={status:task.status,completedAt:task.completedAt},at=new Date().toISOString();
  wbMutate(()=>Object.assign(task,{status:'completed',completedAt:at,updatedAt:at}));
  render();showUndoToast({type:'workbench_completed',taskId:id,at,previous});return true;
}
function validateWorkbenchState(data) {
  return data.workbench===undefined ? !(data.dailyTasks||[]).some(e=>e.workbenchTaskId!==undefined) : workbenchValid(data.workbench,data.dailyTasks||[]);
}
function undoWorkbenchCompletion(undo) {
  const task=wbTask(undo.taskId);
  if(!task||task.status!=='completed'||task.completedAt!==undo.at)return false;
  wbMutate(()=>Object.assign(task,undo.previous,{updatedAt:new Date().toISOString()}));render();return true;
}
function wbCancelExecution(task) {
  const execution=wbTodayExecution(task);
  if(execution&&execution.status!=='deleted') {
    if(dailyTaskSettled(execution))throw Error('已结算的执行记录不可取消，历史记录将保留');
    task.name=wbTaskName(task);
    execution.status='deleted';execution.deletedAt=new Date().toISOString();execution.updatedAt=execution.deletedAt;
    if(state.currentFocus?.sourceId===execution.id&&state.currentFocus.sourceType==='dailyTask')state.currentFocus=null;
  }
}
function cancelWorkbenchToday(id) {
  runAutomaticChecks({showToast:false});const task=wbTask(id);if(!task)return false;
  return wbMutate(()=>{wbCancelExecution(task);return true;});
}
function deleteWorkbenchTask(id) {
  runAutomaticChecks({showToast:false});const task=wbTask(id);if(!task)return false;
  return wbMutate(()=>{
    const execution=wbTodayExecution(task);if(execution&&!dailyTaskSettled(execution))wbCancelExecution(task);
    task.status='deleted';task.updatedAt=new Date().toISOString();return true;
  });
}
function addWorkbenchToday(id,{hour=null}={}) {
  runAutomaticChecks({showToast:false});const task=wbTask(id),day=dateKey();
  if(!task||wbEffectiveStatus(task)==='completed')throw Error('任务已完成或不存在');
  if(vacationDay())throw Error('休假日不能安排工作任务');
  const existing=wbTodayExecution(task);
  if(existing&&existing.status!=='deleted')throw Error('该任务今天已安排，不可重复加入');
  if(existing&&dailyTaskSettlementEvidence(existing))throw Error('该任务今天已有结算记录，不可再次安排');
  let window;
  if(dayMode()==='sprint') {
    const range=state.dayModes?.sprintRanges?.[day];
    if(!sprintRangeValid(range)||!Number.isInteger(hour)||hour<range.startHour||hour>=range.endHour)throw Error('请先在今天设置时间范围，再选择一个小时');
    window=sprintHourWindow(day,hour);if(!window||Date.parse(window.endsAt)<=Date.now())throw Error('该时段已结束或不可用');
    if(sprintHourTask(day,hour))throw Error('该小时已有任务，请选择其他时段；未替换原任务');
  }
  return wbMutate(()=>{
    const execution=unifiedPriorityTask(wbTaskName(task),day,existing?.id||createId('work-execution'),{workbenchTaskId:id,...(window?{sprintWindow:window}:{})});
    if(existing)state.dailyTasks=state.dailyTasks.map(t=>t.id===existing.id?execution:t);
    else {state.dailyTasks.push(execution);task.executionIds.push(execution.id);}
    task.name=execution.name;task.updatedAt=new Date().toISOString();return execution.id;
  });
}
function dailyTaskSettlementEvidence(task) {
  return Boolean(task.settlementKey||task.settlementHistoryId||buildSettledEventKeys().has(dailyTaskSettlementKey(task)));
}
function saveOutlineProject({id=null,name}){
  if(id)return saveWorkbenchProject({id,name});
  name=String(name||'').trim();if(!name)throw Error('请输入项目名称');
  return wbMutate(data=>{const at=new Date().toISOString(),p={id:createId('project'),name,status:'active',createdAt:at,updatedAt:at,groups:[],groupsVersion:1};data.projects.push(p);return p.id;});
}
function saveWorkbenchNote({id=null,projectId,groupId,text}){
  if(!String(text||'').trim())throw Error('请输入备注内容');
  return wbMutate(data=>{if(!data.projects.some(p=>p.id===projectId&&p.status!=='deleted'&&p.groups.some(g=>g.id===groupId)))throw Error('分类已不存在');
    data.notes ||= [];const existing=id&&data.notes.find(n=>n.id===id&&n.status==='active');if(id&&!existing)throw Error('备注已不存在');
    const at=new Date().toISOString();if(existing){existing.text=String(text);existing.updatedAt=at;return id;}
    const note={id:createId('work-note'),type:'note',projectId,groupId,text:String(text),status:'active',createdAt:at,updatedAt:at};data.notes.push(note);return note.id;
  });
}
function wbOutlineContents(projectId,groupId){
  const data=workbenchData(),items=[...data.tasks.filter(t=>t.status!=='deleted'&&t.projectId===projectId&&wbTaskGroupId(t)===groupId).map(t=>({kind:'task',item:t})),...(data.notes||[]).filter(n=>n.status==='active'&&n.projectId===projectId&&n.groupId===groupId).map(n=>({kind:'note',item:n}))];
  return items.map((x,i)=>({...x,index:i})).sort((a,b)=>(a.item.outlineOrder??items.length+a.index)-(b.item.outlineOrder??items.length+b.index));
}
function reorderWorkbenchOutline(kind,id,targetId,projectId=null,groupId=null){return wbMutate(data=>{
  let items;if(kind==='project')items=data.projects.filter(p=>p.status!=='deleted');
  else if(kind==='group')items=data.projects.find(p=>p.id===projectId)?.groups||[];
  else items=wbOutlineContents(projectId,groupId).map(x=>x.item);
  const from=items.findIndex(x=>x.id===id),to=items.findIndex(x=>x.id===targetId);if(from<0||to<0)throw Error('只能在同一父级内排序');
  const ordered=[...items];ordered.splice(to,0,ordered.splice(from,1)[0]);
  if(kind==='project'){const queue=[...ordered];data.projects=data.projects.map(p=>p.status==='deleted'?p:queue.shift());}
  else if(kind==='group')data.projects.find(p=>p.id===projectId).groups=ordered;
  else ordered.forEach((item,i)=>item.outlineOrder=i);
  return true;
});}
function deleteWorkbenchOutline(kind,id,projectId=null){
  runAutomaticChecks({showToast:false});
  return wbMutate(data=>{
    const tasks=data.tasks.filter(t=>t.status!=='deleted'&&(kind==='project'?t.projectId===id:kind==='group'?t.projectId===projectId&&wbTaskGroupId(t)===id:kind==='task'&&t.id===id));
    const notes=(data.notes||[]).filter(n=>n.status==='active'&&(kind==='project'?n.projectId===id:kind==='group'?n.projectId===projectId&&n.groupId===id:kind==='note'&&n.id===id));
    for(const t of tasks){const e=wbTodayExecution(t);if(e&&!dailyTaskSettled(e))wbCancelExecution(t);t.status='deleted';t.updatedAt=new Date().toISOString();}
    for(const n of notes){n.status='deleted';n.updatedAt=new Date().toISOString();}
    if(kind==='project'){const p=data.projects.find(p=>p.id===id);if(p){p.status='deleted';p.updatedAt=new Date().toISOString();}}
    if(kind==='group'){const p=data.projects.find(p=>p.id===projectId);if(p)p.groups=p.groups.filter(g=>g.id!==id);}
    return true;
  });
}
