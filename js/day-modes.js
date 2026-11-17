const DAY_MODE_NAMES={normal:'普通模式',vacation:'休假模式',sprint:'冲刺模式'};
function localDayValid(day){return typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dateKey(dateFromKey(day))===day;}
function dayMode(day=dateKey()){return state.dayModes?.byDate?.[day]?.mode||'normal';}
function vacationDay(day=dateKey()){return dayMode(day)==='vacation';}
function habitAppliesToDay(habit,day){return (habit.modeScope==='vacation')===vacationDay(day);}
function modeDataValid(data){return data && typeof data==='object' && data.version===1 && data.byDate && typeof data.byDate==='object' && !Array.isArray(data.byDate) && Array.isArray(data.log)
  && (data.sprintRanges===undefined || (data.sprintRanges && typeof data.sprintRanges==='object' && !Array.isArray(data.sprintRanges) && Object.entries(data.sprintRanges).every(([day,r])=>localDayValid(day)&&sprintRangeValid(r))))
  && (data.lockedThrough===undefined||localDayValid(data.lockedThrough))
  && data.log.every(r=>r && typeof r.id==='string' && localDayValid(r.date) && Object.hasOwn(DAY_MODE_NAMES,r.from) && Object.hasOwn(DAY_MODE_NAMES,r.to) && Number.isFinite(Date.parse(r.at)))
  && Object.entries(data.byDate).every(([day,r])=>localDayValid(day) && r && Object.hasOwn(DAY_MODE_NAMES,r.mode)
    && Number.isFinite(Date.parse(r.createdAt)) && Number.isFinite(Date.parse(r.updatedAt)));}
function saveDayModes(from,to,mode,{now=new Date()}={}){
  runAutomaticChecks({now,showToast:false});
  const today=dateKey(now);
  if(!localDayValid(from)||!localDayValid(to)||from>to||!Object.hasOwn(DAY_MODE_NAMES,mode))throw Error('请检查日期与模式');
  if(from<today || (mode==='vacation' && from<=today))throw Error('休假只能提前预约，从明天起生效');
  if(from>today && state.dayModes?.lockedThrough>=from)throw Error('该日期已经生效，不能修改');
  if(from===today && (vacationDay(today)||to!==today||mode==='vacation'))throw Error('当天休假已锁定，不能更改');
  if(from===today && dayMode(today)==='sprint' && mode==='normal' && (state.dailyTasks||[]).some(t=>t.localDateKey===today && t.sprintWindow && !dailyTaskSettled(t)))throw Error('请先完成、失败或删除未结算的冲刺任务');
  const days=[];for(let day=from;day<=to;day=shiftDateKey(day,1)){days.push(day);if(days.length>3660)throw Error('一次预约最多十年，请缩短日期范围');}
  const before=JSON.stringify(state),stamp=now.toISOString();
  state.dayModes ||= {version:1,byDate:{},log:[],lockedThrough:today};
  for(const day of days){const previous=state.dayModes.byDate[day];state.dayModes.byDate[day]={mode,createdAt:previous?.createdAt||stamp,updatedAt:stamp};
    state.dayModes.log.push({id:createId('mode'),date:day,from:previous?.mode||'normal',to:mode,at:stamp});}
  if(!saveTaskAction(before))throw Error('模式未能保存，请重试');
  return true;
}
function observeDayMode(now=new Date()){
  if(!state.dayModes)return false;
  const day=dateKey(now);
  if(state.dayModes.lockedThrough && state.dayModes.lockedThrough>=day)return false;
  state.dayModes.lockedThrough=day;return true;
}
function validSprintWindow(task){const w=task.sprintWindow;return w && Number.isFinite(Date.parse(w.startsAt)) && Number.isFinite(Date.parse(w.endsAt))
  && Date.parse(w.startsAt)<Date.parse(w.endsAt);}
function sprintWindowForDay(day,start,end){
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(end))throw Error('请输入开始和结束时间');
  const time=value=>{const d=dateFromKey(day),[h,m]=value.split(':').map(Number);d.setHours(h,m,0,0);if(h!==24&&(d.getHours()!==h||d.getMinutes()!==m))throw Error('该本地时间不存在');return d.toISOString();};
  const w={startsAt:time(start),endsAt:time(end)};
  if(Date.parse(w.endsAt)<=Date.parse(w.startsAt))throw Error('结束时间需晚于开始时间（同一天）');return w;
}
function sprintRangeValid(range){return Boolean(range && range.version===1 && Number.isInteger(range.startHour) && Number.isInteger(range.endHour) && range.startHour>=0 && range.endHour<=24 && range.startHour<range.endHour);}
function sprintHourLabel(hour){return String(hour).padStart(2,'0')+':00';}
function sprintHourWindow(day,hour){
  try{return sprintWindowForDay(day,sprintHourLabel(hour),sprintHourLabel(hour+1));}
  catch{return null;}
}
function sprintHourTask(day,hour){
  const window=sprintHourWindow(day,hour);if(!window)return null;
  return (state.dailyTasks||[]).find(t=>t.localDateKey===day && t.status!=='deleted' && t.sprintWindow?.startsAt===window.startsAt && t.sprintWindow?.endsAt===window.endsAt);
}
function saveSprintRange(startHour,endHour,expectedDay=dateKey()){
  if(expectedDay!==dateKey()||dayMode()!=='sprint')throw Error('日期或模式已变化，请重新设置');
  const range={version:1,startHour:Number(startHour),endHour:Number(endHour)};
  if(!sprintRangeValid(range))throw Error('请选择当天连续的整点范围，结束需晚于开始');
  const window=sprintWindowForDay(expectedDay,sprintHourLabel(range.startHour),sprintHourLabel(range.endHour));
  const excluded=dailyTasksForToday().some(t=>t.sprintWindow&&(Date.parse(t.sprintWindow.startsAt)<Date.parse(window.startsAt)||Date.parse(t.sprintWindow.endsAt)>Date.parse(window.endsAt)));
  if(excluded)throw Error('范围外已有任务或结算记录，请保留包含它们的范围；未结算任务可先清空，历史记录不会删除');
  const before=JSON.stringify(state);
  state.dayModes.sprintRanges ||= {};
  state.dayModes.sprintRanges[expectedDay]={...range,updatedAt:new Date().toISOString()};
  if(!saveTaskAction(before))throw Error('时间范围未能保存');
  return range;
}
function saveSprintHour(day,hour,name){
  if(day!==dateKey()||dayMode()!=='sprint')throw Error('日期或模式已变化，请重新填写');
  const range=state.dayModes?.sprintRanges?.[day];
  if(!sprintRangeValid(range)||!Number.isInteger(hour)||hour<range.startHour||hour>=range.endHour)throw Error('该时段不在今日范围内');
  runAutomaticChecks({showToast:false});
  const task=sprintHourTask(day,hour),title=String(name||'').trim();
  if(task&&dailyTaskSettled(task))throw Error('该时段已结算，不能修改');
  if(task?.name===title||(!task&&!title))return task?.id||null;
  const window=sprintHourWindow(day,hour);
  if(!window)throw Error('该小时因本地时区调整不可用，请选择其他时段');
  if(Date.parse(window.endsAt)<=Date.now()&&task?.reversedSprintDeadline!==window.endsAt)throw Error('该时段已结束，不能新增任务');
  const before=JSON.stringify(state),stamp=new Date().toISOString();
  if(!title){task.status='deleted';task.deletedAt=stamp;task.updatedAt=stamp;}
  else if(task){task.name=title;task.updatedAt=stamp;}
  else state.dailyTasks.push(unifiedPriorityTask(title,day,createId('sprint'),{sprintWindow:window}));
  if(!saveTaskAction(before))throw Error('任务未能保存，请重试');
  return title?(task?.id||state.dailyTasks.at(-1).id):null;
}
function saveSprintTask({id=null,name,start,end}){
  runAutomaticChecks({showToast:false});
  if(dayMode()!=='sprint')throw Error('请先切换到冲刺模式');
  if(!String(name).trim())throw Error('请输入任务名称');
  const window=sprintWindowForDay(dateKey(),start,end);
  if(Date.parse(window.endsAt)<=Date.now())throw Error('截止时间必须晚于现在');
  const existing=state.dailyTasks.find(t=>t.id===id);
  if(id && (!existing?.sprintWindow||existing.localDateKey!==dateKey()||dailyTaskSettled(existing)))throw Error('该任务已结算，不能编辑');
  const before=JSON.stringify(state);
  const task=existing?{...existing,name:String(name).trim(),sprintWindow:window,updatedAt:new Date().toISOString()}
    :unifiedPriorityTask(String(name).trim(),dateKey(),createId('sprint'),{sprintWindow:window});
  state.dailyTasks=existing?state.dailyTasks.map(t=>t.id===id?task:t):[...state.dailyTasks,task];
  if(!saveTaskAction(before))throw Error('任务保存失败');return task.id;
}
function failSprintTask(id){
  runAutomaticChecks({showToast:false});const task=state.dailyTasks.find(t=>t.id===id);
  if(!task?.sprintWindow||task.localDateKey!==dateKey()||dailyTaskSettled(task))return false;
  const before=JSON.stringify(state),entry=settleDailyTask(task,'failed',new Date(),buildSettledEventKeys(),{manual:true});
  if(!entry)return false;
  if(state.currentFocus?.sourceId===id)state.currentFocus=null;
  if(!saveTaskAction(before))return false;
  render();showUndoToast({type:'task_failed',taskEntries:[entry],historyId:entry.historyId,amount:entry.amount});return true;
}
