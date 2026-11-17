let workbenchProjectFilter='all';
let workbenchShowingCompleted=false;
let workbenchEditorContext=null;
const WORKBENCH_GROUPS={urgent:'紧急',important:'重要',waiting:'等待中'};
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
  if(workbenchProjectFilter!=='all'&&!data.projects.some(p=>p.id===workbenchProjectFilter&&p.status!=='deleted'))workbenchProjectFilter='all';
  const projects=[{id:'all',name:'全部'},...data.projects.filter(p=>p.status!=='deleted')];
  filters.innerHTML=projects.map(p=>`<button type="button" data-wb-filter="${escapeAttr(p.id)}" aria-pressed="${p.id===workbenchProjectFilter}" title="${escapeAttr(p.name)}" ${p.id==='all'?'':`aria-haspopup="dialog"`}>${escapeHtml(p.name)}</button>`).join('');
  const tasks=wbTasks(workbenchProjectFilter,workbenchShowingCompleted);
  const groups=workbenchShowingCompleted?[['completed','已完成']]:Object.entries(WORKBENCH_GROUPS);
  list.innerHTML=groups.map(([key,title])=>{
    const rows=tasks.filter(t=>key==='completed'||wbGroup(t)===key);
    return `<section class="workbench-group" data-wb-group="${key}"><div class="workbench-group-heading"><h2>${title}</h2>${key==='completed'?'':`<button type="button" class="habit-complete-control" data-wb-add-group="${key}" aria-label="在${title}新建任务">${actionIcons.plus}</button>`}</div>${rows.length?`<div class="workbench-rows">${rows.map(t=>{
      const meta=t.dueDate?journalDateLabel(t.dueDate).split(' · ')[0]:'';
      return `<div class="workbench-row" data-wb-row="${escapeAttr(t.id)}"><button type="button" class="habit-complete-control" data-wb-complete="${escapeAttr(t.id)}" aria-label="完成${escapeAttr(wbTaskName(t))}" ${workbenchShowingCompleted?'disabled':''}>${workbenchShowingCompleted?actionIcons['checkmark.circle']:'<span class="habit-empty-circle" aria-hidden="true"></span>'}</button><button type="button" class="workbench-task-content" data-wb-detail="${escapeAttr(t.id)}" aria-haspopup="dialog"><span><strong>${escapeHtml(wbTaskName(t))}</strong>${meta?`<small>${escapeHtml(meta)}</small>`:''}</span></button></div>`;
    }).join('')}</div>`:''}</section>`;
  }).join('');
  const unassigned=data.tasks.filter(t=>t.projectId===null&&t.status!=='deleted');
  if(unassigned.length)list.insertAdjacentHTML('afterbegin',`<button type="button" class="workbench-assign-entry" data-wb-assign>为 ${unassigned.length} 项旧任务选择项目 ›</button>`);
  document.getElementById('workbenchHistory').textContent=workbenchShowingCompleted?'返回待办':'已完成';
}
function wbSelect(name,label,options,value) {
  return `<label class="field"><span>${label}</span><select name="${name}">${options.map(([key,text])=>`<option value="${escapeAttr(key)}" ${key===value?'selected':''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
}
function openWorkbenchTask(id=null,{projectId=workbenchProjectFilter,group='important'}={}) {
  const task=id?wbTask(id):null;if(id&&!task)throw Error('任务已不存在');
  if(!task&&!workbenchData().projects.some(p=>p.id===projectId&&p.status!=='deleted'))return chooseWorkbenchProject({group});
  workbenchEditorContext={projectId:task?task.projectId:projectId,group:task?wbGroup(task):group};
  sheetMode='workbench-task';editingId=id;els.sheetTitle.textContent=task?'编辑任务':'新建任务';
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:`<label class="field"><span>任务名称</span><input name="name" aria-label="任务名称" value="${escapeAttr(task?wbTaskName(task):'')}" required autocomplete="off" enterkeyhint="done"></label><label class="field"><span>截止日期</span><input name="dueDate" aria-label="截止日期" type="date" value="${escapeAttr(task?.dueDate||'')}"></label>`,submitLabel:'保存'});
  openSheet({position:'bottom',kind:'workbench-edit',keyboardForm:true});
  if(!task)els.sheetForm.querySelector('[name=name]').focus();
}
function openWorkbenchProject(id=null) {
  const project=id?workbenchData().projects.find(p=>p.id===id&&p.status!=='deleted'):null;
  if(id&&!project)throw Error('项目已不存在');
  sheetMode='workbench-project';editingId=id;els.sheetTitle.textContent=project?'编辑项目':'新建项目';
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:`<label class="field"><span>项目名称</span><input name="name" aria-label="项目名称" value="${escapeAttr(project?.name||'')}" required></label>`,submitLabel:'保存'});
  openSheet({position:'bottom',kind:'workbench-edit',keyboardForm:true});if(!project)els.sheetForm.querySelector('[name=name]').focus();
}
function workbenchActionSheet(title,html){sheetMode='workbench-actions';editingId=null;els.sheetTitle.textContent=title;els.sheetForm.innerHTML=`<div class="workbench-projects">${html}</div>`;openSheet({position:'bottom',kind:'workbench-actions'});}
function openWorkbenchProjectMenu(id){
  const project=workbenchData().projects.find(p=>p.id===id&&p.status!=='deleted');if(!project)return;
  workbenchActionSheet(project.name,`<button type="button" data-wb-project="${escapeAttr(id)}">重命名项目</button><button type="button" data-wb-project-delete="${escapeAttr(id)}">删除项目</button>`);
}
function openWorkbenchTaskMenu(id){
  const task=wbTask(id);if(!task)return;
  const group=wbGroup(task),done=wbEffectiveStatus(task)==='completed';
  workbenchActionSheet(wbTaskName(task),`<button type="button" data-wb-edit="${escapeAttr(id)}">编辑任务</button>${done?`<button type="button" data-wb-restore="${escapeAttr(id)}">恢复待办（保留结算记录）</button>`:Object.entries(WORKBENCH_GROUPS).filter(([key])=>key!==group).map(([key,name])=>`<button type="button" data-wb-move="${key}" data-task-id="${escapeAttr(id)}">移动到${name}</button>`).join('')}<button type="button" data-wb-delete="${escapeAttr(id)}">删除任务</button>`);
}
function openWorkbenchDetail(id){
  const task=wbTask(id);if(!task)return;const execution=wbTodayExecution(task),pending=execution&&!dailyTaskSettled(execution);
  workbenchActionSheet(wbTaskName(task),`${task.dueDate?`<p class="field-help">${escapeHtml(journalDateLabel(task.dueDate))}</p>`:''}<button type="button" data-wb-edit="${escapeAttr(id)}">编辑任务</button>${wbEffectiveStatus(task)!=='completed'&&!vacationDay()?`<button type="button" data-wb-today="${escapeAttr(id)}" ${execution&&execution.status!=='deleted'?'disabled':''}>${execution&&execution.status!=='deleted'?'今天已安排':'加入今天'}</button>`:''}${pending?`<button type="button" data-wb-cancel="${escapeAttr(id)}">取消今日安排</button>`:''}${wbEffectiveStatus(task)==='completed'?`<button type="button" data-wb-restore="${escapeAttr(id)}">恢复待办（保留结算记录）</button>`:''}`);
}
let workbenchProjectChoice=null;
function chooseWorkbenchProject(context){
  workbenchProjectChoice=context;
  const projects=workbenchData().projects.filter(p=>p.status!=='deleted'&&p.id!==context.deleteProjectId);
  workbenchActionSheet(context.deleteProjectId?'选择接收任务的项目':context.assignIds?'为旧任务选择项目':'选择项目',projects.map(p=>`<button type="button" data-wb-project-choice="${escapeAttr(p.id)}">${escapeHtml(p.name)}</button>`).join('')+(projects.length?'':'<p class="field-help">请先创建一个项目，原任务会完整保留。</p><button type="button" data-wb-project-new>＋ 新建项目</button>'));
}
async function requestWorkbenchProjectDelete(id,targetProjectId=null){
  const project=workbenchData().projects.find(p=>p.id===id&&p.status!=='deleted');if(!project)return;
  const count=workbenchData().tasks.filter(t=>t.projectId===id&&t.status!=='deleted').length;
  if(count&&!targetProjectId)return chooseWorkbenchProject({deleteProjectId:id});
  if(await askForConfirmation({title:'删除项目？',message:`「${project.name}」中有 ${count} 项任务。${count?`任务将完整转移至「${wbProjectName(targetProjectId)}」，不会删除。`:'不会删除历史执行记录。'}`,confirmText:count?'转移任务并删除项目':'删除项目'})){
    setWorkbenchProjectStatus(id,'deleted',{targetProjectId});if(workbenchProjectFilter===id)workbenchProjectFilter=targetProjectId||'all';closeSheet();render();
  }
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
    else if(b.dataset.wbAddGroup)openWorkbenchTask(null,{group:b.dataset.wbAddGroup});
    else if(b.dataset.wbEdit)openWorkbenchTask(b.dataset.wbEdit);
    else if(b.dataset.wbDetail)openWorkbenchDetail(b.dataset.wbDetail);
    else if(b.dataset.wbMove){moveWorkbenchGroup(b.dataset.taskId,b.dataset.wbMove);closeSheet();render();}
    else if(b.dataset.wbRestore){const t=wbTask(b.dataset.wbRestore);saveWorkbenchTask({...t,name:wbTaskName(t),status:'todo'});closeSheet();render();}
    else if(b.dataset.wbComplete)completeWorkbenchTask(b.dataset.wbComplete);
    else if(b.hasAttribute('data-wb-history')){workbenchShowingCompleted=!workbenchShowingCompleted;renderWorkbench();}
    else if(b.hasAttribute('data-wb-project-new'))openWorkbenchProject();
    else if(b.dataset.wbProject)openWorkbenchProject(b.dataset.wbProject);
    else if(b.dataset.wbProjectDelete)await requestWorkbenchProjectDelete(b.dataset.wbProjectDelete);
    else if(b.hasAttribute('data-wb-assign'))chooseWorkbenchProject({assignIds:workbenchData().tasks.filter(t=>t.projectId===null&&t.status!=='deleted').map(t=>t.id)});
    else if(b.dataset.wbProjectChoice){
      const choice=workbenchProjectChoice,id=b.dataset.wbProjectChoice;
      if(choice.deleteProjectId)await requestWorkbenchProjectDelete(choice.deleteProjectId,id);
      else if(choice.assignIds){assignWorkbenchProject(choice.assignIds,id);closeSheet();render();}
      else openWorkbenchTask(null,{projectId:id,group:choice.group});
    }else if(b.dataset.wbToday)openWorkbenchSchedule(b.dataset.wbToday);
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
    if(sheetMode==='workbench-project'){workbenchProjectFilter=saveWorkbenchProject({id:editingId,name:data.name});workbenchShowingCompleted=false;closeSheet();render();return;}
    if(sheetMode==='workbench-schedule'){addWorkbenchToday(editingId,{hour:Number(data.hour)});closeSheet();render();return;}
    const task=editingId&&wbTask(editingId),context=workbenchEditorContext;
    saveWorkbenchTask({...data,id:editingId,projectId:context.projectId,priority:task?task.priority:context.group==='urgent'?'high':'normal',status:task?wbEffectiveStatus(task):context.group==='waiting'?'waiting':'todo'});
    closeSheet();render();
  }catch(error){reportWorkbenchError(error);}
});
let workbenchPress=null,workbenchSuppressed=null;
function clearWorkbenchPress(){if(workbenchPress)clearTimeout(workbenchPress.timer);workbenchPress=null;}
function workbenchPressTarget(target){
  if(target.closest('.habit-complete-control'))return null;
  const project=target.closest('[data-wb-filter]');
  if(project&&project.dataset.wbFilter!=='all')return {node:project,projectId:project.dataset.wbFilter};
  const row=target.closest('[data-wb-row]');return row?{node:row,taskId:row.dataset.wbRow}:null;
}
document.addEventListener('pointerdown',event=>{
  clearWorkbenchPress();if(event.button!==0||event.isPrimary===false)return;
  const target=workbenchPressTarget(event.target);if(!target)return;
  const press={...target,x:event.clientX,y:event.clientY};workbenchPress=press;
  press.timer=setTimeout(()=>{
    if(workbenchPress!==press)return;
    workbenchSuppressed={node:press.node,until:Date.now()+1200};
    press.projectId?openWorkbenchProjectMenu(press.projectId):openWorkbenchTaskMenu(press.taskId);
  },500);
});
document.addEventListener('pointermove',event=>{if(workbenchPress&&Math.hypot(event.clientX-workbenchPress.x,event.clientY-workbenchPress.y)>10)clearWorkbenchPress();},{passive:true});
for(const type of ['pointerup','pointercancel','scroll','visibilitychange'])document.addEventListener(type,clearWorkbenchPress,{capture:true,passive:true});
document.addEventListener('click',event=>{
  if(workbenchSuppressed&&Date.now()<workbenchSuppressed.until&&workbenchSuppressed.node.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();workbenchSuppressed=null;}
},true);
document.addEventListener('contextmenu',event=>{
  const target=workbenchPressTarget(event.target);if(!target)return;event.preventDefault();
  if(workbenchSuppressed&&Date.now()<workbenchSuppressed.until&&workbenchSuppressed.node.contains(event.target))return;
  clearWorkbenchPress();workbenchSuppressed={node:target.node,until:Date.now()+1200};
  target.projectId?openWorkbenchProjectMenu(target.projectId):openWorkbenchTaskMenu(target.taskId);
});
document.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){const target=workbenchPressTarget(event.target);if(target){event.preventDefault();target.projectId?openWorkbenchProjectMenu(target.projectId):openWorkbenchTaskMenu(target.taskId);}}});
