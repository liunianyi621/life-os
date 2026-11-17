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
      const rank=t=>wbEffectiveStatus(t)==='waiting'?3:['high','normal','low'].indexOf(t.priority);
      return rank(a)-rank(b) || (a.dueDate||'9999').localeCompare(b.dueDate||'9999') || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
}
function wbMutate(change) {
  const before=JSON.stringify(state);
  try {
    workbenchData();
    state.workbench ||= {version:1,projects:[],tasks:[]};
    const result=change(state.workbench);
    if(!workbenchValid(state.workbench,state.dailyTasks||[]))throw Error('关联数据校验失败，未保存');
    if(!saveTaskAction(before))throw Error('保存失败，数据未更改，请重试');
    return result;
  } catch(error) {state=JSON.parse(before);throw error;}
}
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
function setWorkbenchProjectStatus(id,status) {
  if(!['active','archived','deleted'].includes(status))throw Error('无效项目状态');
  return wbMutate(data=>{
    const project=data.projects.find(p=>p.id===id&&p.status!=='deleted');if(!project)throw Error('项目已不存在');
    project.status=status;project.updatedAt=new Date().toISOString();
    if(status==='deleted')for(const t of data.tasks)if(t.projectId===id){t.name=wbTaskName(t);t.projectId=null;t.updatedAt=project.updatedAt;}
    return true;
  });
}
function saveWorkbenchTask({id=null,name,projectId=null,priority='normal',dueDate=null,status='todo'}) {
  name=String(name||'').trim();dueDate=dueDate||null;projectId=projectId||null;
  if(!name||!Object.hasOwn(WORKBENCH_PRIORITIES,priority)||!Object.hasOwn(WORKBENCH_STATUSES,status)||(dueDate&&!wbDateValid(dueDate)))throw Error('请检查名称、日期和状态');
  if(id&&wbTask(id)&&wbEffectiveStatus(wbTask(id))!==status){
    // Completion uses the same entry point as the list circle, never a form-only flag.
    if(status==='completed')throw Error('请使用完成按钮，确保今天同步结算');
  }
  return wbMutate(data=>{
    if(projectId&&!data.projects.some(p=>p.id===projectId&&p.status!=='deleted'))throw Error('项目已不存在');
    const existing=id&&data.tasks.find(t=>t.id===id&&t.status!=='deleted');if(id&&!existing)throw Error('任务已不存在');
    const at=new Date().toISOString();
    if(existing) {
      const previous=wbEffectiveStatus(existing);
      if(previous==='completed'&&status!=='completed')existing.reopenedExecutionIds=wbExecutions(existing).filter(e=>e.status==='completed').map(e=>e.id);
      Object.assign(existing,{name,projectId,priority,dueDate,status:previous==='completed'&&status==='completed'?existing.status:status,updatedAt:at,completedAt:status==='completed'?existing.completedAt:null});
      const execution=wbTodayExecution(existing);
      if(execution&&!dailyTaskSettled(execution)){execution.name=name;execution.updatedAt=at;}
      return existing.id;
    }
    if(status==='completed')throw Error('请先保存任务，再标记完成');
    const task={id:createId('work-task'),name,projectId,priority,dueDate,status,createdAt:at,updatedAt:at,completedAt:null,executionIds:[]};
    data.tasks.push(task);return task.id;
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
