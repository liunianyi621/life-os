const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function runtime(time = '2026-10-18T10:00:00') {
  const clock = { time }, store = new Map();
  const context = vm.createContext({ console, setTimeout, clearTimeout,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [clock.time])); }
      static now() { return new Date(clock.time).getTime(); }
    }, window: { setTimeout, clearTimeout }, document: {},
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }
  });
  for (const name of ['storage', 'backup', 'tasks', 'habits', 'economy', 'daily-tasks', 'focus', 'settlement', 'memos', 'priority-plan', 'unified-priorities', 'day-modes']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  run(`state=cloneEmptyState();state.coins=1000;
    render=()=>{};scheduleRender=()=>{};showToast=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};hideToast=()=>{};
    showUndoToast=data=>{pendingUndo=data};els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    runAutomaticChecks({initializeDailyHabits:true,showToast:false});`);
  return { run, context, at: time => { clock.time = time; } };
}


test('Default normal, vacation advance booking, ranges, cancellation and active-date lock',()=>{
 const {run,at}=runtime();
 assert.equal(run('dayMode()'),'normal');assert.equal(run('state.dayModes'),undefined);
 assert.throws(()=>run("saveDayModes(dateKey(),dateKey(),'vacation')"));
 run("saveDayModes('2026-10-19','2026-10-21','vacation');saveDayModes('2026-10-21','2026-10-21','normal');state=loadState()");
 assert.equal(run("dayMode('2026-10-19')"),'vacation');assert.equal(run("dayMode('2026-10-20')"),'vacation');assert.equal(run("dayMode('2026-10-21')"),'normal');
 at('2026-10-19T10:00:00');
 assert.throws(()=>run("saveDayModes(dateKey(),dateKey(),'normal')"));
 assert.throws(()=>run("saveDayModes(dateKey(),dateKey(),'sprint')"));
 assert.equal(run('state.coins'),1000);
});
test('Vacation obligations isolate habits, exempt priorities, retain past settlements and resume normal scope',()=>{
 const {run,at}=runtime();
 run("state.habits=[{id:'n',name:'正常习惯',coins:10,createdDate:dateKey()},{id:'v',name:'休假习惯',coins:5,createdDate:dateKey(),modeScope:'vacation'}];completeHabit('n');saveDayModes('2026-10-19','2026-10-19','vacation');state.dailyTasks.push(unifiedPriorityTask('预先安排','2026-10-19'));saveState()");
 at('2026-10-19T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('habitsDueToday().map(h=>h.id).join()'),'v');assert.equal(run('state.coins'),1010);
 run("completeHabit('n');completeHabit('v');completeHabit('v')");assert.equal(run('state.coins'),1015);
 at('2026-10-20T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('visibleHabitsToday().map(h=>h.id).join()'),'n');assert.equal(run('state.coins'),1015);
 assert.equal(run('state.dailyTasks[0].status'),'pending');
 at('2026-10-21T10:00:00');run('runAutomaticChecks();runAutomaticChecks()');assert.equal(run('state.coins'),915);
 assert.equal(run("state.history.filter(e=>e.type==='habit_failed' && e.date==='2026-10-19').length"),0);
});
test('Sprint timeout / Undo / scanner / complete reuses one canonical task and one reward',()=>{
 const {run,at}=runtime();
 run("saveDayModes(dateKey(),dateKey(),'sprint');const id=saveSprintTask({name:'冲刺',start:'10:00',end:'11:00'});startFocusSession('dailyTask',id)");
 assert.throws(()=>run("saveDayModes(dateKey(),dateKey(),'normal')"));
 at('2026-10-18T10:59:59');run('completeDailyTask(id)');assert.equal(run('state.coins'),1050);
 run('undoLastAction()');at('2026-10-18T11:00:00');run('runAutomaticChecks()');assert.equal(run('state.coins'),800);
 run('undoLastAction();runAutomaticChecks();state=loadState();runAutomaticChecks()');assert.equal(run('state.coins'),1050);
 run('completeDailyTask(id);completeDailyTask(id)');assert.equal(run('state.coins'),1050);
 assert.equal(run('unifiedCompletedRecords(dateKey()).length'),1);
 run("saveDayModes(dateKey(),dateKey(),'normal')");assert.equal(run('dayMode()'),'normal');
 assert.equal(run("state.history[0].dayMode"),'sprint');
});
test('Manual sprint reversal still reactivates a changed deadline and permits deletion',()=>{
 const {run,at}=runtime();
 run("saveDayModes(dateKey(),dateKey(),'sprint');const id=saveSprintTask({name:'A',start:'10:00',end:'11:00'})");
 run('failSprintTask(id);undoLastAction();saveSprintTask({id,name:"A",start:"11:00",end:"12:00"})');
 assert.equal(run('state.coins'),1000);
 at('2026-10-18T11:30:00');run('failSprintTask(id)');assert.equal(run('state.coins'),800);
 run('undoLastAction();deleteDailyTask(id)');assert.equal(run('state.coins'),1000);
 run("saveDayModes(dateKey(),dateKey(),'normal')");assert.equal(run('dayMode()'),'normal');
});
test('Vacation missed obligations settle once offline; backups retain schedule, scopes and sprint fields',()=>{
 const {run,at}=runtime();
 run("state.habits=[{id:'n',name:'正常',coins:5,createdDate:dateKey()},{id:'v',name:'休假',coins:10,createdDate:dateKey(),modeScope:'vacation'}];completeHabit('n');saveDayModes('2026-10-19','2026-10-20','vacation');const backup=createLifeOSBackup();restoreLifeOSBackup(backup)");
 at('2026-10-21T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),805);assert.equal(run("state.history.filter(e=>e.type==='habit_failed'&&e.habitId==='v').length"),2);
 run("const backup2=createLifeOSBackup();restoreLifeOSBackup(backup2)");assert.equal(run("dayMode('2026-10-20')"),'vacation');
});
test('Observed vacation dates cannot be cancelled after local time moves backward',()=>{
 const {run,at}=runtime();run("saveDayModes('2026-10-19','2026-10-20','vacation')");
 at('2026-10-20T10:00:00');run('runAutomaticChecks();state=loadState()');
 at('2026-10-19T10:00:00');assert.throws(()=>run("saveDayModes('2026-10-20','2026-10-20','normal')"));
 assert.equal(run("dayMode('2026-10-20')"),'vacation');
});
test('Vacation habit CRUD/order preserve normal definitions; normal and sprint share completions',()=>{
 const {run,at}=runtime();
 run("state.habits=[{id:'n',name:'普通',coins:5,createdDate:dateKey()}];completeHabit('n');saveDayModes(dateKey(),dateKey(),'sprint');completeHabit('n');saveDayModes(dateKey(),dateKey(),'normal');saveDayModes('2026-10-19','2026-10-19','vacation')");
 assert.equal(run('state.coins'),1005);
 at('2026-10-19T10:00:00');run("runAutomaticChecks();editingId=null;saveHabit({name:'休假 A',coins:10});const a=state.habits.at(-1).id;saveHabit({name:'休假 B',coins:5});const b=state.habits.at(-1).id;reorderHabit(b,a);editingId=a;saveHabit({name:'休假 A 编辑',coins:20})");
 assert.equal(run("state.habits.find(h=>h.id==='n').name"),'普通');
 assert.equal(run("visibleHabitsToday().map(h=>h.name).join()"),'休假 B,休假 A 编辑');
 run('deleteHabit(b);saveState();state=loadState()');
 assert.equal(run('visibleHabitsToday().length'),1);
 at('2026-10-20T10:00:00');run("runAutomaticChecks();editingId=a;saveHabit({name:'不应修改',coins:99})");
 assert.equal(run('state.habits.find(h=>h.id===a).coins'),20);
 assert.equal(run("visibleHabitsToday().map(h=>h.id).join()"),'n');
});
test('Previous-day sprint correction grants the reward on its original date exactly once',()=>{
 const {run,at}=runtime();run("saveDayModes(dateKey(),dateKey(),'sprint');const id=saveSprintTask({name:'昨日',start:'10:00',end:'11:00'})");
 at('2026-10-19T10:00:00');run('runAutomaticChecks();undoLastAction();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),1050);assert.equal(run('completeDailyTask(id)'),false);
 assert.equal(run('state.history.length'),1);
 assert.equal(run('state.history[0].date'),'2026-10-18');
 assert.equal(run('state.history[0].reversedSprintFailure.refundedCoins'),200);
});
test('Settlement itself rejects a completion crossing the deadline, even before the scanner runs',()=>{
 const {run,at}=runtime();run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintTask({name:'边界',start:'10:00',end:'11:00'})");
 at('2026-10-18T11:00:00');assert.equal(run("settleDailyTask(state.dailyTasks[0],'completed')"),null);
 assert.equal(run('state.coins'),1000);run('runAutomaticChecks();runAutomaticChecks()');assert.equal(run('state.coins'),800);
});

test('History correction makes one atomic write, uses original debit and task reward, and can retry',async()=>{
 const {run,at}=runtime();
 run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintTask({name:'旧金额任务',start:'10:00',end:'11:00'})");
 at('2026-10-18T11:00:00');
 run(`runAutomaticChecks({showToast:false});const failure=state.history[0].id;
 Object.assign(state.dailyTasks[0],{ruleVersion:1,reward:17.5,penalty:175});saveState();
 const original=JSON.stringify(state);
 askForConfirmation=async()=>true;let writes=0;const write=localStorage.setItem;
 localStorage.setItem=()=>{writes++;throw Error('storage full');};`);
 await run('deleteHistoryDayRecord(failure)');
 assert.equal(run('JSON.stringify(state)===original'),true);
 assert.equal(run('loadState().dailyTasks[0].status'),'failed');
 assert.equal(run('loadState().coins'),800);
 run('localStorage.setItem=(...args)=>{writes++;write(...args);};');
 await run('Promise.all([deleteHistoryDayRecord(failure),deleteHistoryDayRecord(failure)])');
 assert.equal(run('writes'),2);
 assert.equal(run('state.coins'),1017.5);
 assert.equal(run('state.dailyTasks[0].status'),'completed');
 assert.equal(run('state.history.length'),1);
 assert.equal(run('state.history[0].coinDelta'),17.5);
 assert.equal(run('state.history[0].reversedSprintFailure.original.coinDelta'),-200);
 assert.equal(run('state.totals.coinsPenalty'),0);
 run('const backup=createLifeOSBackup();restoreLifeOSBackup(backup);state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),1017.5);
 assert.equal(run('state.history[0].reversedSprintFailure.original.id'),run('failure'));
});

test('Old refund with the original result removed is ambiguous and must never issue more coins',()=>{
 const {run,at}=runtime();
 run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintTask({name:'旧记录',start:'10:00',end:'11:00'})");
 at('2026-10-18T11:00:00');
 run(`runAutomaticChecks({showToast:false});const oldFailure=state.history[0];
 recordDeletionCorrection({originalEntries:[oldFailure],amount:200,day:dateKey(),title:'任务失败纠错'});
 removeHistoryEntry(oldFailure);applyHistoryRecordDeletion(oldFailure,dateKey());saveState();
 state=loadState();runAutomaticChecks();state=loadState();runAutomaticChecks();`);
 assert.equal(run('state.coins'),1000);
 assert.equal(run('state.dailyTasks[0].status'),'failed');
 assert.equal(run('state.history.length'),1);
 assert.equal(run('state.history[0].type'),'day_record_correction');
});

test('Undoing an automatic batch corrects sprint tasks without changing how habits are undone',()=>{
 const {run,at}=runtime();
 run(`saveDayModes(dateKey(),dateKey(),'sprint');
 state.habits=[{id:'h',name:'普通习惯',coins:5,createdDate:dateKey()}];
 saveSprintTask({name:'跨日冲刺',start:'23:00',end:'24:00'});`);
 at('2026-10-19T00:00:00');
 run('runAutomaticChecks()');
 assert.equal(run('state.coins'),750);
 assert.equal(run('pendingUndo.habitEntries.length'),1);
 run('undoLastAction();state=loadState();runAutomaticChecks();');
 assert.equal(run('state.coins'),1050);
 assert.equal(run('state.dailyTasks[0].status'),'completed');
 assert.equal(run('state.history.length'),1);
 assert.equal(run("Boolean(state.habitFailures['2026-10-18'].h)"),true);
});

test('Hourly range creates no empty obligations; expansion, shortening and 24:00 retain data',()=>{
 const {run}=runtime();run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(12,21)");
 assert.equal(run('state.dayModes.sprintRanges[dateKey()].endHour-state.dayModes.sprintRanges[dateKey()].startHour'),9);
 assert.equal(run('state.dailyTasks.length'),0);
 assert.throws(()=>run('saveSprintRange(21,12)'));assert.throws(()=>run('saveSprintRange(12,12)'));assert.throws(()=>run('saveSprintRange(12.5,21)'));
 run("const hourId=saveSprintHour(dateKey(),12,'剪辑');saveSprintRange(10,22);state=loadState()");
 assert.equal(run('sprintHourTask(dateKey(),12).id'),run('hourId'));
 assert.throws(()=>run('saveSprintRange(13,22)'));
 run("saveSprintHour(dateKey(),12,'修改');saveSprintHour(dateKey(),12,'');saveSprintRange(13,24)");
 assert.equal(run('state.dailyTasks[0].status'),'deleted');assert.equal(run('state.history.length'),0);
 assert.equal(run("dateKey(new Date(sprintWindowForDay(dateKey(),'23:00','24:00').endsAt))"),'2026-10-19');
 run('const b=createLifeOSBackup();restoreLifeOSBackup(b)');assert.equal(run('state.dayModes.sprintRanges[dateKey()].endHour'),24);
});
test('Hourly completion, Undo and timeout share stable settlement; settled slots cannot be recycled',()=>{
 const {run,at}=runtime();run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(10,14);const hourId=saveSprintHour(dateKey(),10,'工作');completeDailyTask(hourId);completeDailyTask(hourId)");
 assert.equal(run('state.coins'),1050);assert.throws(()=>run("saveSprintHour(dateKey(),10,'')"));assert.throws(()=>run('saveSprintRange(11,14)'));
 run('undoLastAction();completeDailyTask(hourId)');assert.equal(run('state.coins'),1050);
 run("saveSprintHour(dateKey(),11,'后续')");at('2026-10-18T12:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),850);assert.equal(run("state.history.filter(h=>h.type==='task_failed').length"),1);
 run('undoLastAction();state=loadState();runAutomaticChecks()');assert.equal(run('state.coins'),1100);
 run('completeDailyTask(sprintHourTask(dateKey(),11).id)');assert.equal(run('state.coins'),1100);
 run("saveDayModes(dateKey(),dateKey(),'normal');saveDayModes(dateKey(),dateKey(),'sprint')");assert.equal(run('sprintHourTask(dateKey(),11).status'),'completed');
 at('2026-10-19T12:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');assert.equal(run('state.coins'),1100);assert.equal(run('state.dayModes.sprintRanges[dateKey()]'),undefined);
});
test('Empty hours never settle; year-boundary deadlines retain one historical penalty',()=>{
 const {run,at}=runtime('2026-12-31T22:00:00');
 run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(0,24);saveSprintHour(dateKey(),23,'年末行动')");
 at('2027-01-01T00:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),800);assert.equal(run('state.history.length'),1);
 assert.equal(run('state.history[0].date'),'2026-12-31');assert.equal(run('dailyTasksForToday().length'),0);
 assert.throws(()=>run("saveSprintHour('2026-12-31',23,'修改历史')"));
 const empty=runtime();empty.run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(0,24)");empty.at('2026-10-19T10:00:00');empty.run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(empty.run('state.coins'),1000);assert.equal(empty.run('state.history.length'),0);
});
test('A nonexistent daylight-saving hour cannot crash or create a billable obligation',()=>{
 const {run}=runtime('2026-03-29T00:00:00');run("saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(0,24)");
 assert.equal(run('sprintHourWindow(dateKey(),1)'),null);
 assert.throws(()=>run("saveSprintHour(dateKey(),1,'不存在的小时')"));
 assert.equal(run('state.dailyTasks.length'),0);assert.equal(run('state.coins'),1000);
});
