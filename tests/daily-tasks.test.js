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
  for (const name of ['storage', 'backup', 'tasks', 'habits', 'economy', 'daily-tasks', 'focus', 'settlement', 'memos']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  run(`state=cloneEmptyState();state.coins=1000;
    render=()=>{};scheduleRender=()=>{};showToast=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};hideToast=()=>{};
    showUndoToast=data=>{pendingUndo=data};els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    runAutomaticChecks({initializeDailyHabits:true,showToast:false});`);
  return { run, context, at: time => { clock.time = time; } };
}

test('Daily tasks bind to creation day, store reward/10x penalty, and never populate old scheduled tasks', () => {
  const { run } = runtime();
  run("const id=saveDailyTask({name:'交付',reward:10,localDateKey:'2099-01-01',scheduledStart:'2099-01-01'})");
  assert.equal(run('state.dailyTasks[0].localDateKey'), '2026-10-18');
  assert.equal(run('state.dailyTasks[0].penalty'), 100);
  assert.equal(run('state.tasks.length'), 0); assert.equal(run('state.coins'), 1000);
  assert.equal(run('state.history.length'), 0);
  assert.equal(run('Object.hasOwn(state.dailyTasks[0],"scheduledStart")'), false);
});

for (const reward of [0, 5, 10, 20]) {
  test(`Completion / repeat / Undo / repeat completion reward ${reward} only once`, () => {
    const { run } = runtime(); run(`const id=saveDailyTask({name:'交付',reward:${reward}});completeDailyTask(id);completeDailyTask(id)`);
    assert.equal(run('state.coins'), 1000 + reward);
    assert.equal(run('pendingDailyTasks().length'), 0); assert.equal(run('dailyTasksForToday().length'), 1);
    assert.equal(run('state.history.length'), 1);
    run('undoLastAction();undoLastAction()'); assert.equal(run('state.coins'), 1000);
    assert.equal(run('pendingDailyTasks().length'), 1);
    run('completeDailyTask(id);state=loadState();completeDailyTask(id)');
    assert.equal(run('state.coins'), 1000 + reward); assert.equal(run('state.history.length'), 1);
  });
}

test('Midnight failure catches up offline exactly once, retains historical amounts and never repeats next day', () => {
  const { run, at } = runtime(); run("const id=saveDailyTask({name:'联系客户',reward:20})");
  at('2026-10-18T23:59:59'); run('runAutomaticChecks()'); assert.equal(run('state.coins'), 1000);
  at('2026-10-22T15:00:00'); run('state=loadState();runAutomaticChecks()');
  assert.equal(run('state.coins'), 800); assert.equal(run('state.dailyTasks[0].status'), 'failed');
  assert.equal(run('pendingDailyTasks().length'), 0); assert.equal(run('dailyTasksForToday().length'), 0);
  assert.equal(run('state.history[0].date'), '2026-10-18');
  assert.equal(run('state.history[0].penaltyAmount'), 200);
  run('runAutomaticChecks();state=loadState();runAutomaticChecks();completeDailyTask(id)');
  assert.equal(run('state.coins'), 800); assert.equal(run('state.history.length'), 1);
});

test('Completion and failure share one identity; history and receipt independently prevent duplicate settlement', () => {
  const { run, at } = runtime(); run("const id=saveDailyTask({name:'作品集',reward:10});completeDailyTask(id)");
  run('state.dailyTasks[0].status="pending";delete state.dailyTasks[0].settlementKey;completeDailyTask(id)');
  assert.equal(run('state.coins'), 1010);
  at('2026-10-19T12:00:00'); run('runAutomaticChecks()'); assert.equal(run('state.coins'), 1010);
  run('state.dailyTasks[0].settlementKey=state.history[0].settlementKey;state.history=[];runAutomaticChecks()');
  assert.equal(run('state.coins'), 1010);
});

test('Edit only changes an unsettled current task; delete cancels future settlement and ends its focus', () => {
  const { run, at } = runtime(); run("const id=saveDailyTask({name:'作品集',reward:5});startFocusSession('dailyTask',id)");
  run("saveDailyTask({id,name:'作品集更新',reward:10,localDateKey:'2099-01-01'})");
  assert.equal(run('state.dailyTasks[0].localDateKey'), '2026-10-18');
  assert.equal(run('state.dailyTasks[0].penalty'), 100);
  run('deleteDailyTask(id)'); assert.equal(run('state.currentFocus'), null);
  assert.equal(run('state.dailyTasks[0].status'), 'deleted'); assert.equal(run('dailyTasksForToday().length'), 0);
  at('2026-10-20T12:00:00'); run('runAutomaticChecks()'); assert.equal(run('state.coins'), 1000);
  assert.equal(run('state.history.length'), 0);
});

test('Settled or expired tasks cannot be edited/deleted to erase historical settlement', () => {
  const { run, at } = runtime(); run("const id=saveDailyTask({name:'申请',reward:10});completeDailyTask(id);const snapshot=JSON.stringify(state.dailyTasks)");
  assert.equal(run("saveDailyTask({id,name:'改历史',reward:20})"), null);
  assert.equal(run('deleteDailyTask(id)'), false);
  assert.equal(run('JSON.stringify(state.dailyTasks)'), run('snapshot'));
  at('2026-10-19T10:00:00'); run('runAutomaticChecks()'); assert.equal(run('state.coins'), 1010);
});

test('Typed focus references keep equal IDs and equal names in different sources independent', () => {
  const { run } = runtime(); run("const id=saveDailyTask({name:'阅读',reward:10});state.habits=[{id,name:'阅读',coins:5}];startHabitFocus(id)");
  assert.equal(run("startFocusSession('dailyTask',id)"), false);
  assert.equal(run("startFocusSession('dailyTask',id,{replaceSessionId:state.currentFocus.id})"), true);
  run('completeHabit(id)'); assert.equal(run('state.currentFocus.sourceType'), 'dailyTask');
  assert.equal(run('state.coins'), 1005);
  run('completeHabitFocus(state.currentFocus.id)'); assert.equal(run('state.currentFocus'), null);
  assert.equal(run('state.coins'), 1015);
});

test('Focus and list completion converge on the same once-only task settlement; Undo does not restart focus', () => {
  const { run } = runtime(); run("const id=saveDailyTask({name:'交付',reward:10});startFocusSession('dailyTask',id);const sessionId=state.currentFocus.id");
  assert.equal(run('completeHabitFocus(sessionId)'), true);
  assert.equal(run('completeDailyTask(id)'), false); assert.equal(run('state.coins'), 1010);
  run('undoLastAction()'); assert.equal(run('state.currentFocus'), null);
  run("startFocusSession('dailyTask',id);completeDailyTask(id)");
  assert.equal(run('state.currentFocus'), null); assert.equal(run('state.coins'), 1010);
});

test('An expired focus is not a failed task; midnight still fails the original day and rejects its stale card', () => {
  const { run, at } = runtime(); run("const id=saveDailyTask({name:'交付',reward:10});startFocusSession('dailyTask',id)");
  at('2026-10-18T11:00:00'); run('runAutomaticChecks()');
  assert.equal(run('state.currentFocus.status'), 'expired'); assert.equal(run('state.dailyTasks[0].status'), 'pending');
  assert.equal(run('state.coins'), 1000); run('endHabitFocus()'); assert.equal(run('state.coins'), 1000);
  at('2026-10-18T23:40:00'); run("startFocusSession('dailyTask',id);const oldId=state.currentFocus.id");
  at('2026-10-19T00:00:00'); assert.equal(run('completeHabitFocus(oldId)'), false);
  assert.equal(run('state.currentFocus'), null); assert.equal(run('state.coins'), 900);
});

test('Daily task order persists independently from habits, including hidden completed items and Undo', () => {
  const { run } = runtime(); run(`state.habits=[{id:'h1',name:'运动',coins:5},{id:'h2',name:'看书',coins:5}];
    const a=saveDailyTask({name:'A',reward:5}),b=saveDailyTask({name:'B',reward:5}),c=saveDailyTask({name:'C',reward:5});
    completeDailyTask(b);reorderDailyTask(c,a);state=loadState()`);
  assert.equal(run("pendingDailyTasks().map(t=>t.name).join(',')"), 'C,A');
  assert.equal(run("state.habits.map(h=>h.id).join(',')"), 'h1,h2');
  run('undoLastAction();reorderHabit("h2","h1");state=loadState()');
  assert.equal(run("state.dailyTasks.map(t=>t.name).join(',')"), 'C,A,B');
  assert.equal(run("state.habits.map(h=>h.id).join(',')"), 'h2,h1');
});

test('Old backup and old running habit focus preserve IDs, dates, history and remaining time', () => {
  const { run } = runtime(); run(`state.tasks=[{id:'old',name:'历史任务',status:'completed'}];state.memos=[{id:'m',text:'提醒'}];
    state.habits=[{id:'h',name:'运动',coins:5}];startHabitFocus('h');const backup=createLifeOSBackup();
    const focusBefore=JSON.stringify(state.currentFocus);delete backup.data.dailyTasks;delete backup.data.currentFocus.sourceType;delete backup.data.currentFocus.sourceId;
    restoreLifeOSBackup(backup);runAutomaticChecks()`);
  assert.equal(run('JSON.stringify(state.currentFocus)'), run('focusBefore'));
  assert.equal(run('state.dailyTasks.length'), 0); assert.equal(run('state.tasks[0].id'), 'old');
  assert.equal(run('state.memos.length'), 1); assert.equal(run('state.coins'), 1000);
  run("saveDailyTask({name:'新任务',reward:20});const saved=createLifeOSBackup();restoreLifeOSBackup(saved);state=loadState()");
  assert.equal(run('state.dailyTasks[0].penalty'), 200);
});

test('Bad backups cannot overwrite current state; invalid persisted tasks cannot crash or charge coins', () => {
  const { run } = runtime(); run("saveDailyTask({name:'交付',reward:5});const b=createLifeOSBackup();const before=JSON.stringify(state);b.data.dailyTasks[0].penalty=1");
  assert.throws(() => run('restoreLifeOSBackup(b)')); assert.equal(run('JSON.stringify(state)'), run('before'));
  run("state.dailyTasks=[null,{id:'bad'}];saveState();state=loadState();runAutomaticChecks()");
  assert.equal(run('state.coins'), 1000); assert.equal(run('pendingDailyTasks().length'), 0);
});

test('Failed persistence atomically rolls back creation, completion, Undo, deletion and automatic failure', () => {
  const { run, at, context } = runtime(); const write = context.localStorage.setItem;
  context.localStorage.setItem = () => { throw Error('quota'); };
  assert.equal(run("saveDailyTask({name:'交付',reward:10})"), null);
  context.localStorage.setItem = write; run("const id=saveDailyTask({name:'交付',reward:10});const before=JSON.stringify(state)");
  context.localStorage.setItem = () => { throw Error('quota'); };
  run('completeDailyTask(id);deleteDailyTask(id)'); assert.equal(run('JSON.stringify(state)'), run('before'));
  context.localStorage.setItem = write; run('completeDailyTask(id);const completed=JSON.stringify(state)');
  context.localStorage.setItem = () => { throw Error('quota'); }; run('undoLastAction()');
  assert.equal(run('JSON.stringify(state)'), run('completed'));
  context.localStorage.setItem = write; run('undoLastAction()'); at('2026-10-19T00:00:00');
  context.localStorage.setItem = () => { throw Error('quota'); }; run('runAutomaticChecks()'); assert.equal(run('state.coins'), 1000);
  context.localStorage.setItem = write; run('runAutomaticChecks();runAutomaticChecks()'); assert.equal(run('state.coins'), 900);
});

test('Automatic failure Undo restores its exact amount once without repeatedly charging the past obligation', () => {
  const { run, at } = runtime(); run("saveDailyTask({name:'交付',reward:10})"); at('2026-10-19T00:00:00');
  run('runAutomaticChecks();undoLastAction();state=loadState();runAutomaticChecks();runAutomaticChecks()');
  assert.equal(run('state.coins'), 1000); assert.equal(run('dailyTasksForToday().length'), 0);
});

test('Habit daily repetition, Priority amounts and independent Memo completion remain intact', () => {
  const { run, at } = runtime(); run("state.habits=[{id:'h',name:'运动',coins:5}];state.memos=[{id:'m',text:'提醒'}];toggleMemo('m');const id=saveDailyTask({name:'一次性',reward:10});completeHabit('h');completeDailyTask(id)");
  assert.equal(run('state.coins'), 1015);
  assert.equal(run('priorityTaskSettlementAmount("done")'), 100); assert.equal(run('priorityTaskSettlementAmount("failed")'), 500);
  at('2026-10-19T12:00:00'); run('runAutomaticChecks()');
  assert.equal(run('visibleHabitsToday().length'), 1); assert.equal(run('dailyTasksForToday().length'), 0);
  assert.equal(run('state.coins'), 1015);
});

test('History corrections target only the new task model and preserve past settlement protection', () => {
  const { run, at } = runtime();
  run("const id=saveDailyTask({name:'交付',reward:10});state.tasks=[{id,name:'旧记录',status:'completed'}];completeDailyTask(id);const event=cloneForUndo(state.history[0]);const snapshot=correctionSnapshot(dateKey(),event)");
  run('resetTaskAfterRecordDeletion(event,dateKey());removeCoinHistoryByIds([event.id])');
  assert.equal(run('state.dailyTasks[0].status'), 'pending'); assert.equal(run('state.tasks[0].status'), 'completed');
  run('restoreCorrectionSnapshot(snapshot,event);insertHistoryEntries([event])');
  assert.equal(run('state.dailyTasks[0].status'), 'completed');
  at('2026-10-19T12:00:00');run("resetTaskAfterRecordDeletion(event,'2026-10-18');removeCoinHistoryByIds([event.id]);runAutomaticChecks()");
  assert.equal(run('state.dailyTasks[0].status'), 'completed'); assert.equal(run('state.coins'), 1010);
});

test('A midnight race cannot award today for yesterday and global multipliers cannot change the fixed daily-task penalty', () => {
  const { run, at, context } = runtime('2026-10-18T23:59:59');
  run("const id=saveDailyTask({name:'交付',reward:20});state.settings.economy.penaltyMultiplier=5;startFocusSession('dailyTask',id);const sessionId=state.currentFocus.id");
  const complete = run('completeDailyTask');
  context.completeDailyTask = (...args) => { at('2026-10-19T00:00:00'); return complete(...args); };
  assert.equal(run('completeHabitFocus(sessionId)'), false);
  assert.equal(run('state.coins'), 800); assert.equal(run('state.currentFocus'), null);
});
