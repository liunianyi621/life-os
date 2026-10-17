const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function runtime(time = '2026-10-17T10:00:00') {
  const clock = { time }, store = new Map();
  let writes = 0;
  const context = vm.createContext({ console, setTimeout, clearTimeout,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [clock.time])); }
      static now() { return new Date(clock.time).getTime(); }
    }, window: { setTimeout, clearTimeout }, document: {},
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { writes++; store.set(key, value); }, removeItem: key => store.delete(key) }
  });
  for (const name of ['storage', 'backup', 'tasks', 'habits', 'economy', 'focus', 'settlement', 'memos']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  run(`state=cloneEmptyState();state.coins=1000;state.habits=[{id:'a',name:'交付',coins:10},{id:'b',name:'运动',coins:5}];
    render=()=>{};scheduleRender=()=>{};showToast=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};hideToast=()=>{};
    showUndoToast=data=>{pendingUndo=data};els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    runAutomaticChecks({initializeDailyHabits:true,showToast:false});`);
  return { run, context, at: time => { clock.time = time; }, writes: () => writes };
}

test('Start binds a single 60-minute session to the local habit day without coins or tasks', () => {
  const { run } = runtime();
  assert.equal(run("startHabitFocus('a')"), true);
  assert.equal(run('state.currentFocus.localDateKey'), '2026-10-17');
  assert.equal(run('Date.parse(state.currentFocus.endsAt)-Date.parse(state.currentFocus.startedAt)'), 3600000);
  assert.equal(run('focusTimeLabel(focusSecondsRemaining(state.currentFocus))'), '60:00');
  assert.equal(run('state.history.length'), 0); assert.equal(run('state.coins'), 1000);
  assert.equal(run('state.tasks.length'), 0); assert.equal(run('visibleHabitsToday().length'), 2);
});

test('Background and reload recover from timestamps, without per-second persistence', () => {
  const { run, at, writes } = runtime(); run("startHabitFocus('a')");
  const count = writes(); at('2026-10-17T10:45:00');
  for (let i = 0; i < 60; i++) run('focusSecondsRemaining(state.currentFocus)');
  assert.equal(writes(), count);
  run('state=loadState();runAutomaticChecks({showToast:false})');
  assert.equal(run('focusTimeLabel(focusSecondsRemaining(state.currentFocus))'), '15:00');
  assert.equal(writes(), count);
});

test('Only explicit replacement may end the existing session; duplicate start does not restart it', () => {
  const { run, at } = runtime(); run("startHabitFocus('a');const original=JSON.stringify(state.currentFocus)");
  at('2026-10-17T10:10:00');
  assert.equal(run("startHabitFocus('b')"), false);
  run("startHabitFocus('a')"); assert.equal(run('JSON.stringify(state.currentFocus)'), run('original'));
  assert.equal(run("startHabitFocus('b',{replaceSessionId:'stale'})"), false);
  assert.equal(run("startHabitFocus('b',{replaceSessionId:state.currentFocus.id})"), true);
  assert.equal(run('state.currentFocus.habitId'), 'b'); assert.equal(run('state.coins'), 1000);
});

test('Focus completion and repeated clicks reward exactly once; Undo never restarts focus', () => {
  const { run } = runtime(); run("startHabitFocus('a');const sessionId=state.currentFocus.id");
  assert.equal(run('completeHabitFocus(sessionId)'), true);
  assert.equal(run('completeHabitFocus(sessionId)'), false);
  assert.equal(run('state.coins'), 1010); assert.equal(run('visibleHabitsToday().length'), 1);
  assert.equal(run('state.currentFocus'), null);
  run('undoLastAction();undoLastAction()');
  assert.equal(run('state.coins'), 1000); assert.equal(run('state.currentFocus'), null);
  assert.equal(run("visibleHabitsToday().map(h=>h.id).join(',')"), 'a,b');
});

test('The ordinary completion circle atomically ends focus and preserves normal Undo', () => {
  const { run } = runtime(); run("startHabitFocus('a');completeHabit('a');state=loadState()");
  assert.equal(run('state.currentFocus'), null); assert.equal(run('state.coins'), 1010);
  run('undoLastAction()'); assert.equal(run('state.currentFocus'), null);
  assert.equal(run('state.coins'), 1000);
});

test('End focus changes no obligation, history, reward or priority order', () => {
  const { run } = runtime(); run("startHabitFocus('a');const previous=JSON.stringify({...state,currentFocus:null})");
  assert.equal(run("endHabitFocus('stale')"), false);
  assert.equal(run('endHabitFocus()'), true);
  assert.equal(run('JSON.stringify(state)'), run('previous'));
  assert.equal(run("startHabitFocus('a')"), true);
});

test('Expiry persists once at zero, does not fail or repeat, and still allows manual completion', () => {
  const { run, at, writes } = runtime(); run("startHabitFocus('a')"); at('2026-10-17T11:00:00');
  run('state=loadState();runAutomaticChecks({showToast:false})');
  assert.equal(run('state.currentFocus.status'), 'expired'); assert.equal(run('focusSecondsRemaining(state.currentFocus)'), 0);
  assert.equal(run('state.coins'), 1000); assert.equal(run('state.history.length'), 0);
  const count = writes(); run('runAutomaticChecks();runAutomaticChecks()'); assert.equal(writes(), count);
  assert.equal(run('completeHabitFocus(state.currentFocus.id)'), true); assert.equal(run('state.coins'), 1010);
});

test('Midnight settles yesterday once and rejects a stale focus completion without awarding today', () => {
  const { run, at } = runtime('2026-12-31T23:40:00');
  run("startHabitFocus('a');const yesterdaySession=state.currentFocus.id");
  at('2027-01-01T00:00:00');
  assert.equal(run('completeHabitFocus(yesterdaySession)'), false);
  assert.equal(run('state.currentFocus'), null); assert.equal(run('state.coins'), 850);
  assert.equal(run('visibleHabitsToday().length'), 2);
  run('state=loadState();runAutomaticChecks();runAutomaticChecks()'); assert.equal(run('state.coins'), 850);
  run("startHabitFocus('a');completeHabitFocus(state.currentFocus.id)"); assert.equal(run('state.coins'), 860);
});

test('Deleting or invalidating a habit safely clears its session', () => {
  const { run } = runtime(); run("startHabitFocus('a');deleteHabit('a');state=loadState()");
  assert.equal(run('state.currentFocus'), null); assert.equal(run('state.coins'), 1000);
  run("startHabitFocus('b');state.habits=state.habits.filter(h=>h.id!=='b');runAutomaticChecks()");
  assert.equal(run('state.currentFocus'), null);
});

test('A click that crosses midnight between focus validation and completion cannot reward the new day', () => {
  const { run, at, context } = runtime('2026-10-17T23:59:59');
  run("startHabitFocus('a');const oldId=state.currentFocus.id");
  const complete = run('completeHabit');
  context.completeHabit = (...args) => { at('2026-10-18T00:00:00'); return complete(...args); };
  assert.equal(run('completeHabitFocus(oldId)'), false);
  assert.equal(run('state.coins'), 850); assert.equal(run('state.currentFocus'), null);
  assert.equal(run("habitCompletedToday('a')"), false);
});

test('An already expired session stays at zero even if the device clock is moved backward', () => {
  const { run, at } = runtime(); run("startHabitFocus('a')");
  at('2026-10-17T11:01:00'); run('runAutomaticChecks({showToast:false})');
  at('2026-10-17T10:15:00');
  assert.equal(run('focusSecondsRemaining(state.currentFocus)'), 0);
  assert.equal(run('state.currentFocus.status'), 'expired');
});

test('Failed persistence rolls back focus start, replacement, completion and deletion together', () => {
  const { run, context } = runtime(); const write = context.localStorage.setItem;
  context.localStorage.setItem = () => { throw Error('quota'); };
  assert.equal(run("startHabitFocus('a')"), false); assert.equal(run('state.currentFocus'), null);
  context.localStorage.setItem = write; run("startHabitFocus('a');const before=JSON.stringify(state)");
  context.localStorage.setItem = () => { throw Error('quota'); };
  run("startHabitFocus('b',{replaceSessionId:state.currentFocus.id});completeHabitFocus(state.currentFocus.id);deleteHabit('a')");
  assert.equal(run('JSON.stringify(state)'), run('before'));
});

test('Old backups default to no focus; new backups restore focus without altering the ledger', () => {
  const { run } = runtime(); run("startHabitFocus('a');const b=createLifeOSBackup();const original=JSON.stringify(state);restoreLifeOSBackup(b)");
  assert.equal(run('JSON.stringify(state)'), run('original'));
  run('delete b.data.currentFocus;restoreLifeOSBackup(b)'); assert.equal(run('state.currentFocus'), null);
  run("b.data.currentFocus={habitId:'bad'};const before=JSON.stringify(state)");
  assert.throws(() => run('restoreLifeOSBackup(b)')); assert.equal(run('JSON.stringify(state)'), run('before'));
});

test('Malformed stored focus safely degrades without discarding habits or history', () => {
  const { run } = runtime(); run("state.currentFocus={id:'bad',habitId:'a',status:'active',endsAt:'invalid'};saveState();state=loadState()");
  assert.equal(run('state.currentFocus'), null); assert.equal(run('state.habits.length'), 2);
  assert.equal(run('state.coins'), 1000);
});
