let workbenchProjectFilter='all';
let workbenchShowingCompleted=false;
function reportWorkbenchError(error) {
  const host=!els.sheetBackdrop.classList.contains('hidden')?(els.sheetForm.querySelector('.keyboard-form-sheet__body')||els.sheetForm):document.getElementById('workbenchList');
  let message=host.querySelector('[data-wb-error]');
  if(!message){message=document.createElement('p');message.dataset.wbError='';message.className='field-help';message.setAttribute('role','alert');host.prepend(message);}
  message.textContent=error.message||'保存未成功，请重试';
}
function wbProjectName(id) { return state.workbench?.projects.find(p=>p.id===id)?.name||'未分类'; }
function renderWorkbench() {
  const filters=document.getElementById('workbenchFilters'),list=document.getElementById('workbenchList');
  if(!filters||!list)return;
  const data=workbenchData();
  if(!['all','none'].includes(workbenchProjectFilter)&&!data.projects.some(p=>p.id===workbenchProjectFilter&&p.status!=='deleted'))workbenchProjectFilter='all';
  const projects=[{id:'all',name:'全部'},{id:'none',name:'未分类'},...data.projects.filter(p=>p.status==='active'||p.id===workbenchProjectFilter)];
  filters.innerHTML=projects.map(p=>`<button type="button" data-wb-filter="${escapeAttr(p.id)}" aria-pressed="${p.id===workbenchProjectFilter}" title="${escapeAttr(p.name)}">${escapeHtml(p.name)}</button>`).join('')+'<button type="button" data-wb-manage>管理</button>';
  const tasks=wbTasks(workbenchProjectFilter,workbenchShowingCompleted);
  const groups=workbenchShowingCompleted?[['completed','已完成']]:[...Object.entries(WORKBENCH_PRIORITIES),['waiting','等待中']];
  list.innerHTML=groups.map(([key,title])=>{
    const rows=tasks.filter(t=>key==='completed'||(wbEffectiveStatus(t)==='waiting'?key==='waiting':t.priority===key&&key!=='waiting'));
    if(!rows.length)return '';
    return `<section class="workbench-group"><div class="workbench-group-heading"><h2>${title}</h2><span>${rows.length}</span></div><div class="workbench-rows">${rows.map(t=>{
      const execution=wbTodayExecution(t),today=execution&&execution.status!=='deleted';
      const meta=[wbProjectName(t.projectId),today?'今天':t.dueDate?journalDateLabel(t.dueDate).split(' · ')[0]:'',t.dueDate&&t.dueDate<dateKey()&&wbEffectiveStatus(t)!=='completed'?'已逾期':'',wbEffectiveStatus(t)==='active'?'进行中':''].filter(Boolean).join(' · ');
      return `<div class="workbench-row" data-wb-row="${escapeAttr(t.id)}"><button type="button" class="habit-complete-control" data-wb-complete="${escapeAttr(t.id)}" aria-label="完成${escapeAttr(wbTaskName(t))}" ${workbenchShowingCompleted?'disabled':''}>${workbenchShowingCompleted?actionIcons['checkmark.circle']:'<span class="habit-empty-circle" aria-hidden="true"></span>'}</button><button type="button" class="workbench-task-content" data-wb-edit="${escapeAttr(t.id)}"><span><strong>${escapeHtml(wbTaskName(t))}</strong><small>${escapeHtml(meta)}</small></span><span class="workbench-chevron" aria-hidden="true">›</span></button></div>`;
    }).join('')}</div></section>`;
  }).join('')||`<div class="workbench-empty"><p>${workbenchShowingCompleted?'暂无完成记录':'还没有待办'}</p>${workbenchShowingCompleted?'':'<button type="button" data-wb-new>＋ 新建任务</button>'}</div>`;
  document.getElementById('workbenchHistory').textContent=workbenchShowingCompleted?'返回待办':'已完成';
}
function wbSelect(name,label,options,value) {
  return `<label class="field"><span>${label}</span><select name="${name}">${options.map(([key,text])=>`<option value="${escapeAttr(key)}" ${key===value?'selected':''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
}
function openWorkbenchTask(id=null) {
  const task=id?wbTask(id):null;if(id&&!task)throw Error('任务已不存在');
  sheetMode='workbench-task';editingId=id;els.sheetTitle.textContent=task?'任务详情':'新建任务';
  const projectId=task?.projectId||(!['all','none'].includes(workbenchProjectFilter)?workbenchProjectFilter:'');
  const options=[['','未分类'],...workbenchData().projects.filter(p=>p.status==='active'||p.id===projectId).map(p=>[p.id,p.name])];
  const execution=task&&wbTodayExecution(task),pending=execution&&!dailyTaskSettled(execution);
  const settled=task&&wbExecutions(task).some(e=>e.status==='completed'||e.status==='failed');
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:`<label class="field"><span>任务名称</span><input name="name" aria-label="任务名称" value="${escapeAttr(task?wbTaskName(task):'')}" required autocomplete="off" enterkeyhint="done"></label><div class="workbench-field-pair">${wbSelect('projectId','项目',options,projectId)}${wbSelect('priority','优先级',Object.entries(WORKBENCH_PRIORITIES),task?.priority||'normal')}</div><div class="workbench-field-pair"><label class="field"><span>截止日期</span><input name="dueDate" aria-label="截止日期" type="date" value="${escapeAttr(task?.dueDate||'')}"></label>${wbSelect('status','状态',Object.entries(WORKBENCH_STATUSES),task?wbEffectiveStatus(task):'todo')}</div>${settled?'<p class="field-help">已结算的今日执行记录保留；恢复待办不会再次领取同日奖励。</p>':''}${task?`<div class="workbench-task-actions">${wbEffectiveStatus(task)!=='completed'&&!vacationDay()?`<button type="button" data-wb-today="${escapeAttr(task.id)}" ${execution&&execution.status!=='deleted'?'disabled':''}>${execution&&execution.status!=='deleted'?'今天已安排':'加入今天'}</button>`:''}${pending?`<button type="button" data-wb-cancel="${escapeAttr(task.id)}">取消今日安排</button>`:''}</div>`:''}`,submitLabel:'保存',dangerHtml:task?`<button type="button" class="keyboard-form-sheet__danger" data-wb-delete="${escapeAttr(task.id)}">删除任务</button>`:''});
  openSheet({position:'bottom',kind:'workbench-edit',keyboardForm:true});
  if(!task)els.sheetForm.querySelector('[name=name]').focus();
}
function openWorkbenchProjects() {
  sheetMode='workbench-projects';editingId=null;els.sheetTitle.textContent='项目';
  els.sheetForm.innerHTML=`<div class="workbench-projects">${workbenchData().projects.filter(p=>p.status!=='deleted').map(p=>`<button type="button" data-wb-project="${escapeAttr(p.id)}"><span>${escapeHtml(p.name)}${p.status==='archived'?'<small>已归档</small>':''}</span><span aria-hidden="true">›</span></button>`).join('')}<button type="button" data-wb-project-new>＋ 新建项目</button></div>`;
  openSheet({position:'bottom',kind:'workbench-projects'});
}
function openWorkbenchProject(id=null) {
  const project=id?workbenchData().projects.find(p=>p.id===id&&p.status!=='deleted'):null;
  if(id&&!project)throw Error('项目已不存在');
  sheetMode='workbench-project';editingId=id;els.sheetTitle.textContent=project?'编辑项目':'新建项目';
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:`<label class="field"><span>项目名称</span><input name="name" aria-label="项目名称" value="${escapeAttr(project?.name||'')}" required></label>${project?`<div class="workbench-task-actions"><button type="button" data-wb-project-view="${escapeAttr(id)}">查看任务</button><button type="button" data-wb-project-status="${project.status==='archived'?'active':'archived'}" data-project-id="${escapeAttr(id)}">${project.status==='archived'?'取消归档':'归档项目'}</button></div>`:''}`,submitLabel:'保存',dangerHtml:project?`<button type="button" class="keyboard-form-sheet__danger" data-wb-project-delete="${escapeAttr(id)}">删除项目</button>`:''});
  openSheet({position:'bottom',kind:'workbench-edit',keyboardForm:true});if(!project)els.sheetForm.querySelector('[name=name]').focus();
}
function openWorkbenchSchedule(id) {
  const task=wbTask(id);if(!task)return;
  if(vacationDay())throw Error('休假日不能安排工作任务');
  if(dayMode()==='normal'){addWorkbenchToday(id);closeSheet();render();return;}
  sheetMode='workbench-schedule';editingId=id;els.sheetTitle.textContent='安排到今天';
  const range=state.dayModes?.sprintRanges?.[dateKey()];
  const hours=[];if(sprintRangeValid(range))for(let h=range.startHour;h<range.endHour;h++){
    const window=sprintHourWindow(dateKey(),h);if(window&&Date.parse(window.endsAt)>Date.now())hours.push([h,sprintHourLabel(h),Boolean(sprintHourTask(dateKey(),h))]);
  }
  const available=hours.some(h=>!h[2]);
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:available?`<label class="field"><span>小时</span><select name="hour" aria-label="安排小时">${hours.map(([h,label,occupied])=>`<option value="${h}" ${occupied?'disabled':''}>${label}${occupied?' · 已有任务':''}</option>`).join('')}</select></label>`:`<p class="field-help">${range?'没有可用时段，请先在今天调整安排。':'请先在今天设置时间范围。'}</p><button type="button" class="q-secondary-button" data-wb-go-today>前往今天</button>`,submitLabel:'加入今天'});
  if(!available)els.sheetForm.querySelector('button[type=submit]').disabled=true;
  openSheet({position:'bottom',kind:'workbench-edit',keyboardForm:true});
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  try {
    if(b.hasAttribute('data-wb-filter')){workbenchProjectFilter=b.dataset.wbFilter;renderWorkbench();}
    else if(b.hasAttribute('data-wb-new'))openWorkbenchTask();
    else if(b.dataset.wbEdit)openWorkbenchTask(b.dataset.wbEdit);
    else if(b.dataset.wbComplete)completeWorkbenchTask(b.dataset.wbComplete);
    else if(b.hasAttribute('data-wb-history')){workbenchShowingCompleted=!workbenchShowingCompleted;renderWorkbench();}
    else if(b.hasAttribute('data-wb-manage'))openWorkbenchProjects();
    else if(b.hasAttribute('data-wb-project-new'))openWorkbenchProject();
    else if(b.dataset.wbProject)openWorkbenchProject(b.dataset.wbProject);
    else if(b.dataset.wbProjectView){workbenchProjectFilter=b.dataset.wbProjectView;workbenchShowingCompleted=false;closeSheet();render();}
    else if(b.dataset.wbProjectStatus){setWorkbenchProjectStatus(b.dataset.projectId,b.dataset.wbProjectStatus);openWorkbenchProjects();render();}
    else if(b.dataset.wbProjectDelete){
      const id=b.dataset.wbProjectDelete;
      if(await askForConfirmation({title:'删除项目？',message:'项目中的任务将保留并移至未分类。',confirmText:'保留任务并删除项目'})){setWorkbenchProjectStatus(id,'deleted');openWorkbenchProjects();render();}
    } else if(b.dataset.wbToday)openWorkbenchSchedule(b.dataset.wbToday);
    else if(b.dataset.wbCancel){cancelWorkbenchToday(b.dataset.wbCancel);closeSheet();render();}
    else if(b.dataset.wbDelete){
      const id=b.dataset.wbDelete;
      if(await askForConfirmation({title:'删除任务？',message:'未结算的今日安排会取消；已结算的历史与金币记录保留。',confirmText:'删除任务'})){deleteWorkbenchTask(id);closeSheet();render();}
    }else if(b.hasAttribute('data-wb-go-today')){closeSheet();switchView('today');render();}
  }catch(error){reportWorkbenchError(error);}
});
document.addEventListener('submit',event=>{
  if(event.target!==els.sheetForm||!['workbench-task','workbench-project','workbench-schedule'].includes(sheetMode))return;
  event.preventDefault();const data=Object.fromEntries(new FormData(els.sheetForm));
  try {
    if(sheetMode==='workbench-project'){saveWorkbenchProject({id:editingId,name:data.name});openWorkbenchProjects();render();return;}
    if(sheetMode==='workbench-schedule'){addWorkbenchToday(editingId,{hour:Number(data.hour)});closeSheet();render();return;}
    const task=editingId&&wbTask(editingId),status=data.status;
    const id=saveWorkbenchTask({...data,id:editingId,status:status==='completed'&&task&&wbEffectiveStatus(task)!=='completed'?task.status:status});
    if(status==='completed'&&wbEffectiveStatus(wbTask(id))!=='completed')completeWorkbenchTask(id);
    closeSheet();render();
  }catch(error){reportWorkbenchError(error);}
});
