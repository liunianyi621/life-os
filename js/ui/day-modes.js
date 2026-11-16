function modeIcon(mode){return {normal:'sun',vacation:'coffee',sprint:'clock'}[mode];}
function renderDayMode(){
  const mode=dayMode(),holiday=mode==='vacation';
  const button=document.getElementById('dayModeButton');if(!button)return;
  button.innerHTML=actionIcons[modeIcon(mode)];button.setAttribute('aria-label',DAY_MODE_NAMES[mode]);button.title=DAY_MODE_NAMES[mode];
  document.querySelector('.today-page').dataset.dayMode=mode;
  for(const selector of ['#currentFocusTask','#procrastinationToolbar','.today-daily-task-section','.home-memo-section'])document.querySelector(selector).hidden=holiday;
  const tasks=dailyTasksForToday().filter(t=>t.sprintWindow).sort((a,b)=>Date.parse(a.sprintWindow.startsAt)-Date.parse(b.sprintWindow.startsAt));
  const timeline=document.getElementById('sprintSection');timeline.hidden=holiday || (mode!=='sprint'&&!tasks.some(t=>!dailyTaskSettled(t)));
  timeline.querySelector('[data-new-sprint]').hidden=mode!=='sprint';
  timeline.querySelector('h2').textContent=mode==='sprint'?'今日时间线':'待处理时间任务';
  if(timeline.hidden)return;
  if(mode==='sprint')document.querySelector('.today-daily-task-section').hidden=!dailyTasksForToday().some(t=>!t.sprintWindow);
  document.getElementById('sprintList').innerHTML=tasks.length?tasks.map(t=>{
    const pending=!dailyTaskSettled(t),active=Date.now()>=Date.parse(t.sprintWindow.startsAt);
    const label=t.status==='completed'?'已完成':t.status==='failed'?'已失败':active?'进行中':'等待中';
    return `<div class="sprint-row"><div class="sprint-row-title"><time>${historyTimeLabel(t.sprintWindow.startsAt)}–${historyTimeLabel(t.sprintWindow.endsAt)}</time><span>${label}</span></div><strong>${escapeHtml(t.name)}</strong><small>+${t.reward} / −${t.penalty}</small>${pending?`<div class="sprint-row-actions"><button type="button" data-start-daily-focus="${escapeAttr(t.id)}">专注</button><button type="button" data-complete-daily-task="${escapeAttr(t.id)}">完成</button><button type="button" data-fail-sprint="${escapeAttr(t.id)}">失败</button><button type="button" data-edit-sprint="${escapeAttr(t.id)}">编辑</button><button type="button" data-delete-daily-task="${escapeAttr(t.id)}">删除</button></div>`:''}</div>`;
  }).join(''):'<p class="daily-task-empty">还没有时间任务</p>';
}
function openDayModeMenu(){
  sheetMode='day-modes';editingId=null;els.sheetTitle.textContent='今天的模式';
  const current=dayMode(),tomorrow=shiftDateKey(dateKey(),1),descriptions={normal:'保持日常节奏',vacation:'只执行休假习惯',sprint:'按时间安排今天'};
  els.sheetForm.innerHTML=`<p class="field-help">今天：${DAY_MODE_NAMES[current]} · 明天：${DAY_MODE_NAMES[dayMode(tomorrow)]}</p><div class="mode-options">${Object.keys(DAY_MODE_NAMES).map(mode=>`<button type="button" data-select-day-mode="${mode}" ${current==='vacation'||mode==='vacation'?'disabled':''} aria-pressed="${current===mode}">${actionIcons[modeIcon(mode)]}<span><strong>${DAY_MODE_NAMES[mode]}</strong><small>${descriptions[mode]}</small></span>${current===mode?'✓':''}</button>`).join('')}</div><button class="review-plan-add" type="button" data-schedule-mode>预约 / 修改未来模式</button>`;
  openSheet({position:'top',kind:'day-modes'});
}
function openDayModeSchedule(){
  sheetMode='day-mode-schedule';els.sheetTitle.textContent='安排未来模式';const tomorrow=shiftDateKey(dateKey(),1);
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:`<label class="field"><span>开始日期</span><input type="date" name="from" min="${tomorrow}" value="${tomorrow}" required></label><label class="field"><span>结束日期</span><input type="date" name="to" min="${tomorrow}" value="${tomorrow}" required></label><div class="mode-options">${Object.entries(DAY_MODE_NAMES).map(([mode,name])=>`<label><input type="radio" name="mode" value="${mode}" ${mode==='vacation'?'checked':''}>${actionIcons[modeIcon(mode)]}${name}</label>`).join('')}</div><p class="field-help">选择普通模式即可取消未来休假。</p>`,submitLabel:'保存安排'});
  openSheet({position:'bottom',kind:'day-mode-schedule',keyboardForm:true});
}
function openSprintSheet(id=null){
  if(dayMode()!=='sprint'){showToast('请切换到冲刺模式编辑时间');return;}
  runAutomaticChecks({showToast:false});const task=state.dailyTasks.find(t=>t.id===id);
  if(id&&(!task||dailyTaskSettled(task)))return;
  sheetMode='sprint-edit';editingId=id;els.sheetTitle.textContent=id?'编辑时间任务':'新建时间任务';
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:`<label class="field"><span>任务名称</span><input name="name" value="${escapeAttr(task?.name||'')}" required></label><div class="sprint-time-pair"><label class="field"><span>开始</span><input name="start" type="time" value="${task?historyTimeLabel(task.sprintWindow.startsAt):''}" required></label><label class="field"><span>结束</span><input name="end" type="time" value="${task?historyTimeLabel(task.sprintWindow.endsAt):''}" required></label></div><p class="field-help">完成 +50 / 未完成 −200 · 时间范围为当天</p>`,submitLabel:'保存任务'});
  openSheet({position:'bottom',kind:'sprint-edit',keyboardForm:true});
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  try{
    if(b.hasAttribute('data-open-day-mode'))openDayModeMenu();
    if(b.hasAttribute('data-schedule-mode'))openDayModeSchedule();
    if(b.dataset.selectDayMode){saveDayModes(dateKey(),dateKey(),b.dataset.selectDayMode);closeSheet();render();}
    if(b.hasAttribute('data-new-sprint'))openSprintSheet();
    if(b.dataset.editSprint)openSprintSheet(b.dataset.editSprint);
    if(b.dataset.failSprint)failSprintTask(b.dataset.failSprint);
  }catch(error){showToast(error.message);render();}
});
document.addEventListener('submit',event=>{
  if(event.target!==els.sheetForm||!['day-mode-schedule','sprint-edit'].includes(sheetMode))return;
  event.preventDefault();const data=Object.fromEntries(new FormData(els.sheetForm));
  try{if(sheetMode==='day-mode-schedule')saveDayModes(data.from,data.to,data.mode);else saveSprintTask({...data,id:editingId});closeSheet();render();}
  catch(error){showToast(error.message);}
});
