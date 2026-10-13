const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
function runtime(now='2026-10-12T10:00:00+01:00') {
  const clock={now},store=new Map();
  const context=vm.createContext({console,Date:class extends Date{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return new Date(clock.now).getTime();}},
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},window:{setTimeout,clearTimeout},document:{},setTimeout,clearTimeout});
  for(const name of ['storage','backup','tasks','habits','economy','settlement','memos','ui/time-picker'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),context);
  const run=s=>vm.runInContext(s,context);
  run(`state=cloneEmptyState();state.rewards=defaultFundRewards();state.coins=1000;state.fixedRewardRulesSince='2026-08-01';state.settledThroughDate='2026-08-01';
    state.habits=[{id:'a',name:'交付',coins:10,createdDate:'2026-08-01'},{id:'b',name:'运动',reward:5,createdDate:'2026-08-01'}];
    render=()=>{};scheduleRender=()=>{};showToast=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};hideToast=()=>{};
    showUndoToast=data=>{pendingUndo=data};els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    runAutomaticChecks({initializeDailyHabits:true});`);
  return {run,context,store,at:value=>{clock.now=value;}};
}
test('Activation preserves rewards/tasks/history and never charges the pre-upgrade period',()=>{
  const {run}=runtime();
  assert.equal(run('state.coins'),1000);assert.equal(run('state.history.length'),0);
  assert.equal(run('habitRewardAmount(state.habits[0])'),10);assert.equal(run('habitRewardAmount(state.habits[1])'),5);
  const before=run('JSON.stringify(state)');run('runAutomaticChecks({initializeDailyHabits:true});state=loadState();runAutomaticChecks({initializeDailyHabits:true})');
  assert.equal(run('JSON.stringify(state)'),before);
});
test('Direct completion, repeated click and Undo use one existing coin event',()=>{
  const {run}=runtime();run("completeHabit('a');completeHabit('a')");
  assert.equal(run('state.coins'),1010);assert.equal(run('state.history.length'),1);
  assert.equal(run('visibleHabitsToday().length'),1);assert.equal(run('habitsDueToday().length'),2);assert.equal(run('state.tasks.length'),0);
  run('undoLastAction()');assert.equal(run('state.coins'),1000);assert.equal(run("habitCompletedToday('a')"),false);
  run("completeHabit('a')");assert.equal(run('state.coins'),1010);
});
test('Midnight and several offline days settle each local obligation once',()=>{
  const {run,at}=runtime();run("completeHabit('a')");at('2026-10-15T10:00:00+01:00');
  run('runAutomaticChecks()');assert.equal(run('state.coins'),660); // +10 -50 -150 -150
  assert.equal(run("habitCompletedToday('a')"),false);
  const count=run('state.history.length');run('state=loadState();runAutomaticChecks();runAutomaticChecks()');
  assert.equal(run('state.coins'),660);assert.equal(run('state.history.length'),count);
});
test('New habits begin on creation day; edits never recalculate settled or earlier rewards',()=>{
  const {run,at}=runtime();run("saveHabit({name:'新习惯',coins:20})");
  assert.equal(run('state.habits.at(-1).createdDate'),'2026-10-12');
  assert.equal(run("habitActiveOnDate(state.habits.at(-1),'2026-10-11')"),false);
  run("completeHabit('a')");at('2026-10-13T10:00:00+01:00');
  run("editingId='a';saveHabit({name:'交付',coins:20})");
  assert.equal(run('state.coins'),760); // +10 -50 -200
  assert.equal(run("habitRewardAmount(state.habits[0],'2026-10-12')"),10);
  assert.equal(run('habitRewardAmount(state.habits[0])'),20);
  assert.equal(run("state.history.find(item=>item.type==='habit_completed').coins"),10);
});
test('Deletion settles past obligations, preserves definition, and never charges future days',()=>{
  const {run,at}=runtime();at('2026-10-13T10:00:00+01:00');run("deleteHabit('a')");
  assert.equal(run('state.coins'),850);assert.equal(run('state.habits.length'),2);
  at('2026-10-15T10:00:00+01:00');run('runAutomaticChecks()');assert.equal(run('state.coins'),750);
});
test('Priority and Memo remain independent; legacy global toggles do not change the new x10 daily rule',()=>{
  const {run,at}=runtime();
  run('state.settings.economy.penaltyMultiplier=5;state.settings.settlement.autoFailHabitsDaily=false;state.memos=[{id:"m",text:"提醒"}];toggleMemo("m")');
  assert.equal(run('state.coins'),1000);
  assert.equal(run('priorityTaskSettlementAmount("done")'),100);assert.equal(run('priorityTaskSettlementAmount("failed")'),500);
  at('2026-10-13T00:00:00+01:00');run('runAutomaticChecks()');assert.equal(run('state.coins'),850);
});
test('User order persists, completed rows hide without losing priority and reset the next day',()=>{
  const {run,at}=runtime();run("completeHabit('a');reorderHabit('b','a');state=loadState()");
  assert.equal(run("visibleHabitsToday().map(h=>h.id).join(',')"),'b');
  at('2026-10-13T10:00:00+01:00');run('runAutomaticChecks()');
  assert.equal(run("visibleHabitsToday().map(h=>h.id).join(',')"),'b,a');assert.equal(run("habitCompletedToday('a')"),false);
});
test('Historical tasks and backups survive; scheduled habit is completed without mutating its old task',()=>{
  const {run}=runtime();run(`state.tasks=[{id:'legacy',name:'旧任务',source:'HABIT',originId:'a',sourceHabitScheduledDate:dateKey(),status:'pending',date:dateKey(),scheduledStart:new Date().toISOString()}];
    const oldTasks=JSON.stringify(state.tasks);completeHabit('a');runAutomaticChecks();`);
  assert.equal(run('JSON.stringify(state.tasks)'),run('oldTasks'));assert.equal(run('state.coins'),1010);
  run('const backup=createLifeOSBackup();restoreLifeOSBackup(backup);state=loadState()');
  assert.equal(run('JSON.stringify(state.tasks)'),run('oldTasks'));assert.equal(run('dailyHabitSystemEnabled()'),true);
  run('delete backup.data.dailyHabitSystem;restoreLifeOSBackup(backup);runAutomaticChecks({initializeDailyHabits:true})');
  assert.equal(run('state.coins'),1010);assert.equal(run('dailyHabitSystemEnabled()'),true);
});
for(const [start,end] of [['2026-10-24T12:00:00+01:00','2026-10-26T12:00:00Z'],['2026-12-31T12:00:00Z','2027-01-02T12:00:00Z'],['2026-10-31T12:00:00Z','2026-11-02T12:00:00Z']]){
  test('Local day catch-up across DST/month/year: '+start,()=>{const {run,at}=runtime(start);at(end);run('runAutomaticChecks()');assert.equal(run('state.coins'),700);});
}
test('Failed persistence rolls back completion, order and activation without partial coin changes',()=>{
  const {run,context}=runtime();const original=run('JSON.stringify(state)');context.localStorage.setItem=()=>{throw Error('quota')};
  run("completeHabit('a');reorderHabit('b','a')");assert.equal(run('JSON.stringify(state)'),original);
});

test('Old zero reward is preserved, and invalid new backup metadata cannot overwrite current state',()=>{
  const {run}=runtime();
  run("state.habits.push({id:'zero',name:'零奖励',coins:0});const snapshot=JSON.stringify(state);const broken=createLifeOSBackup();broken.data.dailyHabitSystem.version=99");
  assert.equal(run('habitRewardAmount(state.habits.at(-1))'),0);
  assert.throws(()=>run('restoreLifeOSBackup(broken)'));
  assert.equal(run('JSON.stringify(state)'),run('snapshot'));
});

test('Activation persistence failure retries safely, preserving old tasks and coin history',()=>{
  const {run,context}=runtime();
  run("delete state.dailyHabitSystem;state.tasks=[{id:'old',name:'旧任务',date:'2026-01-01',status:'pending',reward:20}];state.settledThroughDate='2026-01-01';saveState();const before=JSON.stringify(state)");
  const write=context.localStorage.setItem;context.localStorage.setItem=()=>{throw Error('quota')};
  run('runAutomaticChecks({initializeDailyHabits:true})');assert.equal(run('JSON.stringify(state)'),run('before'));
  context.localStorage.setItem=write;run('runAutomaticChecks()');
  assert.equal(run('state.coins'),1000);assert.equal(run('state.tasks[0].status'),'pending');
  assert.equal(run('state.history.length'),0);
});

test('Hidden completion persists through reload and Undo restores original order exactly once',()=>{
  const {run}=runtime();run("completeHabit('a');state=loadState()");
  assert.equal(run("visibleHabitsToday().map(h=>h.id).join(',')"),'b');
  assert.equal(run('habitsDueToday().length'),2);
  assert.equal(run('state.habits.length'),2);
  run('undoLastAction();undoLastAction()');
  assert.equal(run("visibleHabitsToday().map(h=>h.id).join(',')"),'a,b');
  assert.equal(run('state.coins'),1000);
});

test('Reordering remaining rows preserves hidden definitions and full-list relative order',()=>{
  const {run,at}=runtime();
  run("state.habits.push({id:'c',name:'阅读',coins:5},{id:'d',name:'练习',coins:5});completeHabit('b');moveHabit('d',-1);state=loadState()");
  assert.equal(run("visibleHabitsToday().map(h=>h.id).join(',')"),'a,d,c');
  assert.equal(run("state.habits.map(h=>h.id).join(',')"),'a,b,d,c');
  at('2026-10-13T10:00:00+01:00');run('runAutomaticChecks()');
  assert.equal(run("visibleHabitsToday().map(h=>h.id).join(',')"),'a,b,d,c');
});

test('All completed remains 2/2, then next day resets visibility without a second penalty or reward',()=>{
  const {run,at}=runtime();run("completeHabit('a');completeHabit('b');state=loadState()");
  assert.equal(run('visibleHabitsToday().length'),0);
  assert.equal(run('habitsDueToday().filter(h=>habitCompletedToday(h.id)).length'),2);
  assert.equal(run('habitsDueToday().length'),2);
  at('2026-10-13T00:00:00+01:00');run('runAutomaticChecks();runAutomaticChecks()');
  assert.equal(run('state.coins'),1015);
  assert.equal(run('visibleHabitsToday().length'),2);
  run("completeHabit('a');completeHabit('a');state=loadState();runAutomaticChecks()");
  assert.equal(run('state.coins'),1025);
  assert.equal(run("habitCompletedOnDate('a','2026-10-12')"),true);
  assert.equal(run('visibleHabitsToday().length'),1);
});
