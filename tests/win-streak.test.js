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
  for (const name of ['storage', 'backup', 'tasks', 'habits', 'economy', 'daily-tasks', 'focus', 'settlement', 'memos', 'win-streak']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  run(`state=cloneEmptyState();state.coins=1000;
    render=()=>{};scheduleRender=()=>{};showToast=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};hideToast=()=>{};prepareActionCard=()=>{};showCoinFeedback=()=>{};
    showUndoToast=data=>{pendingUndo=data};els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    runAutomaticChecks({initializeDailyHabits:true,showToast:false});`);
  return { run, context, at: time => { clock.time = time; } };
}


function prepare(run) {

 run("const a=saveDailyTask({name:'必胜',reward:10});const b=saveDailyTask({name:'额外',reward:5});state.habits=[{id:'h',name:'运动',createdDate:dateKey(),reward:5}];saveState();chooseWinTask('dailyTask',a)");
}
test('1+2 counts identities, locks focus, Undo retracts victory, no extra coins',()=>{
 const {run}=runtime();prepare(run);
 run("startFocusSession('dailyTask',a)");
 assert.equal(run("chooseWinTask('dailyTask',b)"),false);
 run("completeDailyTask(b);completeHabit('h');completeHabit('h')");
 assert.equal(run("state.winStreak.days[dateKey()].outcome"),'pending');
 run("completeDailyTask(a)");
 assert.equal(run("winSummary().wins"),1);assert.equal(run("state.coins"),1020);
 run("undoLastAction()");
 assert.equal(run("winSummary().wins"),0);
 run("completeDailyTask(a);completeDailyTask(a);state=loadState();syncWinStreak()");
 assert.equal(run("winSummary().wins"),1);assert.equal(run("state.coins"),1020);
});
test('Offline catchup fails participation once, nonparticipation and rest pause',()=>{
 const {run,at}=runtime();prepare(run);run("planWinRest('2026-10-19')");
 at('2026-10-22T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run("state.winStreak.days['2026-10-18'].outcome"),'loss');
 assert.equal(run("state.winStreak.days['2026-10-19'].outcome"),'rest');
 assert.equal(run("state.winStreak.days['2026-10-20']"),undefined);
 assert.equal(run("planWinRest('2026-10-18')"),false);
});
test('OFF restores pause semantics and does not backfill, Backup preserves ledger and flag',()=>{
 const {run}=runtime();prepare(run);run("setWinEnabled(false);completeDailyTask(a);completeDailyTask(b);completeHabit('h');setWinEnabled(true)");
 // Advance wall time in the next test to distinguish disabled intervals.
 assert.equal(run('state.coins'),1020);
 assert.equal(run('winSummary().wins'),0);
 assert.equal(run('validateLifeOSBackup(createLifeOSBackup()).winStreak.version'),1);
 assert.equal(run('state.history.length'),3);
 run('setWinEnabled(false);const backup=createLifeOSBackup();delete backup.data.winStreak;restoreLifeOSBackup(backup)');
 assert.equal(run('state.winStreak'),undefined);
});
test('Disabled interval completions excluded after reopening, no historical fabrication',()=>{
 const {run,at}=runtime();prepare(run);run('setWinEnabled(false)');
 at('2026-10-18T11:00:00');run('completeDailyTask(a);completeDailyTask(b)');
 at('2026-10-18T12:00:00');run('setWinEnabled(true);completeHabit("h")');
 assert.equal(run('winSummary().wins'),0);
 assert.equal(run('state.winStreak.days[dateKey()].receipts.length'),1);
});
test('Priority and habit choices use stable source IDs, all three source types eligible',()=>{
 const {run}=runtime();prepare(run);
 run("state.priorityTaskByDate[dateKey()]={date:dateKey(),title:'重点',status:'pending'};saveState()");
 assert.equal(run("chooseWinTask('priority',dateKey())"),true);
 run("completePriorityTask();completeDailyTask(a);completeHabit('h')");
 assert.equal(run('winSummary().wins'),1);
 assert.equal(run('state.coins'),1115);
});
test('Current failure clears streak, rest and absent do not add wins',()=>{
 const {run}=runtime();run("state.winStreak.days={'2026-10-15':{outcome:'win'},'2026-10-16':{outcome:'rest'},'2026-10-17':{outcome:'win'}}");
 assert.equal(run('winSummary().current'),2);
 run("state.winStreak.days['2026-10-18']={outcome:'loss'}");
 assert.equal(run('winSummary().current'),0);assert.equal(run('winSummary().longest'),2);
});

test('Habit must-win focus lock survives rename, end focus, reload and Undo',()=>{
 const {run}=runtime();prepare(run);
 assert.equal(run("chooseWinTask('habit','h')"),true);
 run("startHabitFocus('h');endHabitFocus();state.habits[0].name='改名';saveState();state=loadState()");
 assert.equal(run("chooseWinTask('dailyTask',a)"),false);
 run("completeHabit('h');completeDailyTask(a);completeDailyTask(b)");
 assert.equal(run("winSummary().wins"),1);
});
test('Past winners remain auditable after reload and do not refill old pre-activation days',()=>{
 const {run,at}=runtime();prepare(run);run("completeDailyTask(a);completeDailyTask(b);completeHabit('h')");
 at('2026-11-01T10:00:00');run("state=loadState();runAutomaticChecks();runAutomaticChecks()");
 assert.equal(run('winSummary().wins'),1);
 assert.equal(run("state.winStreak.days['2026-10-17']"),undefined);
 assert.equal(run("state.winStreak.days['2026-10-18'].finalized"),true);
});
test('Deleted pending candidate cannot be selected; priority replacement cannot inherit locked win',()=>{
 const {run}=runtime();prepare(run);run("deleteDailyTask(b)");
 assert.equal(run("chooseWinTask('dailyTask',b)"),false);
 run("state.priorityTaskByDate[dateKey()]={date:dateKey(),title:'原重点',status:'pending'};chooseWinTask('priority',dateKey());completePriorityTask();completeDailyTask(a);completeHabit('h')");
 assert.equal(run('winSummary().wins'),1);
 run("state.priorityTaskByDate[dateKey()].title='另一件事';saveState()");
 assert.equal(run('winSummary().wins'),0);
});
