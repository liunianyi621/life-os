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
  if(event.target!==els.sheetForm||sheetMode!=='sprint-edit')return;
  event.preventDefault();const data=Object.fromEntries(new FormData(els.sheetForm));
  try{saveSprintTask({...data,id:editingId});closeSheet();render();}
  catch(error){showToast(error.message);}
});
