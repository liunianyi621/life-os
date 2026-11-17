function modeIcon(mode){return {normal:'sun',vacation:'coffee',sprint:'clock'}[mode];}
function renderDayMode(){
  const mode=dayMode(),holiday=mode==='vacation';
  const bar=document.getElementById('todayModeBar');if(!bar)return;
  const tomorrowVacation=dayMode(shiftDateKey(dateKey(),1))==='vacation';
  bar.querySelectorAll('[data-select-day-mode]').forEach(button=>{
    const option=button.dataset.selectDayMode;
    button.setAttribute('aria-pressed',String(option===mode));button.disabled=holiday&&option!=='vacation';
    button.setAttribute('aria-label',DAY_MODE_NAMES[option]+(option==='vacation'&&tomorrowVacation?'，明天已预约，点击取消':''));
    button.querySelector('[data-mode-icon]').innerHTML=actionIcons[modeIcon(option)];
  });
  document.getElementById('tomorrowVacationLabel').hidden=!tomorrowVacation;
  document.querySelector('.today-page').dataset.dayMode=mode;
  for(const selector of ['#currentFocusTask','#procrastinationToolbar','.today-daily-task-section','.home-memo-section'])document.querySelector(selector).hidden=holiday;
  document.getElementById('currentFocusTask').hidden=mode!=='normal';
  if(mode==='sprint')stopFocusTick();
  const tasks=dailyTasksForToday().filter(t=>t.sprintWindow).sort((a,b)=>Date.parse(a.sprintWindow.startsAt)-Date.parse(b.sprintWindow.startsAt));
  const timeline=document.getElementById('sprintSection');timeline.hidden=holiday || (mode!=='sprint'&&!tasks.some(t=>!dailyTaskSettled(t)));
  timeline.insertAdjacentElement(mode==='sprint'?'afterend':'beforebegin',document.getElementById('procrastinationToolbar'));
  timeline.querySelector('[data-new-sprint]').hidden=true;
  timeline.querySelector('h2').textContent=mode==='sprint'?'今日时间线':'待处理时间任务';
  if(timeline.hidden)return;
  if(mode==='sprint')document.querySelector('.today-daily-task-section').hidden=!dailyTasksForToday().some(t=>!t.sprintWindow);
  renderSprintHours(tasks,mode);
}
function sprintLegacyRows(tasks){return tasks.map(t=>{
    const pending=!dailyTaskSettled(t),active=Date.now()>=Date.parse(t.sprintWindow.startsAt);
    const label=t.status==='completed'?'已完成':t.status==='failed'?'已失败':active?'进行中':'等待中';
    return `<div class="sprint-row"><div class="sprint-row-title"><time>${historyTimeLabel(t.sprintWindow.startsAt)}–${historyTimeLabel(t.sprintWindow.endsAt)}</time><span>${label}</span></div><strong>${escapeHtml(t.name)}</strong><small>+${t.reward} / −${t.penalty}</small>${pending?`<div class="sprint-row-actions"><button type="button" data-complete-daily-task="${escapeAttr(t.id)}">完成</button><button type="button" data-fail-sprint="${escapeAttr(t.id)}">失败</button><button type="button" data-edit-sprint="${escapeAttr(t.id)}">编辑</button><button type="button" data-delete-daily-task="${escapeAttr(t.id)}">删除</button></div>`:''}</div>`;
  }).join('');}
function renderSprintHours(tasks,mode){
  const list=document.getElementById('sprintList'),day=dateKey(),range=state.dayModes?.sprintRanges?.[day];
  const active=document.activeElement,focused=active?.matches('[data-sprint-hour]')?{hour:active.dataset.sprintHour,value:active.value,start:active.selectionStart,end:active.selectionEnd}:null;
  if(mode!=='sprint'){list.innerHTML=sprintLegacyRows(tasks);return;}
  const options=(from,to,selected)=>Array.from({length:to-from+1},(_,i)=>`<option value="${i+from}" ${i+from===selected?'selected':''}>${sprintHourLabel(i+from)}</option>`).join('');
  const controls=`<details class="sprint-range" ${range?'':'open'}><summary>${range?`${sprintHourLabel(range.startHour)} → ${sprintHourLabel(range.endHour)}`:'设置今日时间范围'}</summary><form data-sprint-range data-day="${day}"><label><span class="sr-only">开始时间</span><select name="startHour" aria-label="开始时间">${options(0,23,range?.startHour??new Date().getHours())}</select></label><span aria-hidden="true">→</span><label><span class="sr-only">结束时间</span><select name="endHour" aria-label="结束时间">${options(1,24,range?.endHour??Math.min(24,new Date().getHours()+1))}</select></label><button type="submit">确定</button></form><p class="sprint-error" role="status" hidden></p></details>`;
  const mapped=new Set(),rows=[];
  if(range)for(let hour=range.startHour;hour<range.endHour;hour++){
    const task=sprintHourTask(day,hour),settled=task&&dailyTaskSettled(task);
    if(task)mapped.add(task.id);
    const current=new Date().getHours()===hour;
    const window=sprintHourWindow(day,hour),past=window&&Date.parse(window.endsAt)<=Date.now();
    const disabled=settled||!window||(!task&&past);
    rows.push(`<form class="sprint-hour-row${current?' is-current':''}" data-sprint-hour-form data-day="${day}"><time>${sprintHourLabel(hour)}–${sprintHourLabel(hour+1)}</time><input data-sprint-hour="${hour}" data-day="${day}" aria-label="${sprintHourLabel(hour)}任务" value="${escapeAttr(task?.name||'')}" placeholder="安排这一小时…" ${disabled?'disabled':''} enterkeyhint="done" autocomplete="off">${settled?`<span class="sprint-hour-status ${task.status==='completed'?'is-complete':''}">${task.status==='completed'?'已完成':'已失败'}</span>`:task?`<button type="button" class="habit-complete-control" data-complete-daily-task="${escapeAttr(task.id)}" aria-label="完成 ${escapeAttr(task.name)}"><span class="habit-empty-circle" aria-hidden="true"></span></button>`:'<span class="sprint-hour-empty" aria-hidden="true">○</span>'}</form>`);
  }
  const legacy=tasks.filter(t=>!mapped.has(t.id));
  list.innerHTML=controls+(rows.length?`<div class="sprint-hours">${rows.join('')}</div>`:'')+(legacy.length?`<div class="sprint-legacy"><h3>已有时间任务</h3>${sprintLegacyRows(legacy)}</div>`:'');
  if(focused){const input=list.querySelector(`[data-sprint-hour="${focused.hour}"]`);if(input&&!input.disabled){input.value=focused.value;input.focus({preventScroll:true});input.setSelectionRange(focused.start,focused.end);}}
}
async function toggleTomorrowVacation(){
  const today=dateKey(),tomorrow=shiftDateKey(today,1),scheduled=dayMode(tomorrow)==='vacation';
  const accepted=await askForConfirmation({title:scheduled?'取消明天的休假？':'将明天设为休假模式？',
    message:'今天的模式保持不变。',confirmText:scheduled?'取消预约':'预约明天'});
  if(!accepted)return;
  if(dateKey()!==today)throw Error('日期已变化，请重新安排明天');
  if((dayMode(tomorrow)==='vacation')!==scheduled)throw Error('明天的安排已变化，请重新确认');
  saveDayModes(tomorrow,tomorrow,scheduled?'normal':'vacation');render();
}
function openSprintSheet(id=null){
  if(dayMode()!=='sprint'){showToast('请切换到冲刺模式编辑时间');return;}
  runAutomaticChecks({showToast:false});const task=state.dailyTasks.find(t=>t.id===id);
  if(id&&(!task||dailyTaskSettled(task)))return;
  sheetMode='sprint-edit';editingId=id;els.sheetTitle.textContent=id?'编辑时间任务':'新建时间任务';
  els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:`<label class="field"><span>任务名称</span><input name="name" value="${escapeAttr(task?.name||'')}" required></label><div class="sprint-time-pair"><label class="field"><span>开始</span><input name="start" type="time" value="${task?historyTimeLabel(task.sprintWindow.startsAt):''}" required></label><label class="field"><span>结束</span><input name="end" type="time" value="${task?historyTimeLabel(task.sprintWindow.endsAt):''}" required></label></div><p class="field-help">完成 +50 / 未完成 −200 · 时间范围为当天</p>`,submitLabel:'保存任务'});
  openSheet({position:'bottom',kind:'sprint-edit',keyboardForm:true});
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  try{
    if(b.dataset.selectDayMode){
      if(b.dataset.selectDayMode==='vacation')await toggleTomorrowVacation();
      else if(b.dataset.selectDayMode!==dayMode()){saveDayModes(dateKey(),dateKey(),b.dataset.selectDayMode);render();}
    }
    if(b.hasAttribute('data-new-sprint'))openSprintSheet();
    if(b.dataset.editSprint)openSprintSheet(b.dataset.editSprint);
    if(b.dataset.failSprint)failSprintTask(b.dataset.failSprint);
  }catch(error){showToast(error.message);render();}
});
document.addEventListener('submit',event=>{
  if(event.target.matches('[data-sprint-range]')){
    event.preventDefault();const form=event.target,data=new FormData(form);
    try{saveSprintRange(data.get('startHour'),data.get('endHour'),form.dataset.day);render();}
    catch(error){const message=form.parentElement.querySelector('.sprint-error');message.hidden=false;message.textContent=error.message;}
    return;
  }
  if(event.target.matches('[data-sprint-hour-form]')){event.preventDefault();event.target.querySelector('input').blur();return;}
  if(event.target!==els.sheetForm||sheetMode!=='sprint-edit')return;
  event.preventDefault();const data=Object.fromEntries(new FormData(els.sheetForm));
  try{saveSprintTask({...data,id:editingId});closeSheet();render();}
  catch(error){showToast(error.message);}
});
document.addEventListener('focusout',event=>{
  const input=event.target;if(!input.matches('[data-sprint-hour]'))return;
  try{saveSprintHour(input.dataset.day,Number(input.dataset.sprintHour),input.value);}
  catch(error){showToast(error.message);}
  if(!event.relatedTarget?.closest('[data-complete-daily-task]'))render();
});
