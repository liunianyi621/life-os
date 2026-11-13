const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
test('Automatic good never creates a formal review or overwrites three manual drafts',()=>{
 const {run}=runtime();
 run("syncPriorityPlan(dateKey(),['A','B','C'],'manual');state.reviewDrafts={[dateKey()]:{bestItems:['手动1','手动2','手动3']}};const draft=JSON.stringify(state.reviewDrafts);state.priorityPlans[dateKey()].items.forEach(i=>completePriorityItem(dateKey(),i.id))");
 assert.equal(run('priorityAutoGood(dateKey()).length'),3);
 assert.equal(run('state.dailyReviews[dateKey()]'),undefined);
 assert.equal(run('JSON.stringify(state.reviewDrafts)'),run('draft'));
 run('undoLastAction()');
 assert.equal(run('priorityAutoGood(dateKey()).length'),2);
 assert.equal(run('JSON.stringify(state.reviewDrafts)'),run('draft'));
});
for(const [day,next] of [['2026-10-31','2026-11-01'],['2026-12-31','2027-01-01'],['2026-03-28','2026-03-29']]) {
 test('Priority local date rollover '+day,()=>{
  const {run,at}=runtime(day+'T12:00:00');
  run("saveDailyReview({best:'好',priorityItems:['唯一重点','',''],dailyScore:6})");
  assert.equal(run('Object.keys(state.priorityPlans)[0]'),next);
  at(next+'T12:00:00');
  run("runAutomaticChecks();completePriorityItem(dateKey(),state.priorityPlans[dateKey()].items[0].id);state=loadState();runAutomaticChecks()");
  assert.equal(run('state.coins'),1050);
 });
}

function runtime(time = '2026-10-18T10:00:00') {
  const clock = { time }, store = new Map();
  const context = vm.createContext({ console, setTimeout, clearTimeout,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [clock.time])); }
      static now() { return new Date(clock.time).getTime(); }
    }, window: { setTimeout, clearTimeout }, document: {},
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }
  });
  for (const name of ['storage', 'backup', 'tasks', 'habits', 'economy', 'daily-tasks', 'focus', 'settlement', 'memos', 'priority-plan']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  run(`state=cloneEmptyState();state.coins=1000;
    render=()=>{};scheduleRender=()=>{};showToast=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};hideToast=()=>{};prepareActionCard=()=>{};showCoinFeedback=()=>{};renderDailyReview=()=>{};showReviewSavedStatus=()=>{};
    showUndoToast=data=>{pendingUndo=data};els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    runAutomaticChecks({initializeDailyHabits:true,showToast:false});`);
  return { run, context, at: time => { clock.time = time; } };
}

test('Review three priorities creates stable next-local-day group; completion and Undo preserve manual good',()=>{
 const {run,at}=runtime();run("state.dailyReviews[dateKey()]={best:'手动好事',mistake:'历史改进'};saveDailyReview({best:'手动好事',priorityItems:['A','B','C'],dailyScore:7})");
 assert.equal(run("state.dailyReviews[dateKey()].mistake"),'历史改进');
 const ids=run("JSON.stringify(state.priorityPlans['2026-10-19'].items.map(i=>i.id))");
 run("saveDailyReview({best:'手动好事',priorityItems:['A','B','C'],dailyScore:7})");
 assert.equal(run("JSON.stringify(state.priorityPlans['2026-10-19'].items.map(i=>i.id))"),ids);
 at('2026-10-19T10:00:00');run("runAutomaticChecks();const group=state.priorityPlans[dateKey()];const [a,b,c]=group.items.map(i=>i.id);completePriorityItem(dateKey(),a);completePriorityItem(dateKey(),a);completePriorityItem(dateKey(),b)");
 assert.equal(run('state.coins'),1100);assert.equal(run('priorityAutoGood(dateKey()).length'),2);
 run('undoLastAction()');assert.equal(run('state.coins'),1050);assert.equal(run('priorityAutoGood(dateKey()).length'),1);
 assert.equal(run("state.dailyReviews['2026-10-18'].best"),'手动好事');
 at('2026-10-20T10:00:00');run('runAutomaticChecks();runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),50);
 run('undoLastAction();runAutomaticChecks()');assert.equal(run('state.coins'),1050);
});
test('Manual edits and executed dates block review overwrite and retain requested plan',()=>{
 const {run}=runtime();run("syncPriorityPlan('2026-10-19',['手动','',''],'manual');saveDailyReview({best:'好',priorityItems:['新计划','',''],dailyScore:5})");
 assert.equal(run("state.priorityPlans['2026-10-19'].items[0].title"),'手动');
 assert.equal(run("state.priorityPlanConflicts[dateKey()].titles[0]"),'新计划');
 assert.equal(run('state.coins'),1000);
});
test('Legacy single priority keeps configured old reward, new groups do not mutate history or backups',()=>{
 const {run}=runtime();run("setPriorityTaskForDate('2026-10-18','旧重点');completePriorityTask()");
 assert.equal(run('state.coins'),1100);
 run("syncPriorityPlan('2026-10-19',['新重点','',''],'review',dateKey());const backup=createLifeOSBackup();restoreLifeOSBackup(backup)");
 assert.equal(run("state.priorityTaskByDate['2026-10-18'].status"),'done');
 assert.equal(run("state.priorityPlans['2026-10-19'].items.filter(i=>i.title).length"),1);
});
