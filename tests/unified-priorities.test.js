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
  for (const name of ['storage', 'backup', 'tasks', 'habits', 'economy', 'daily-tasks', 'focus', 'settlement', 'memos', 'priority-plan', 'unified-priorities']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  run(`state=cloneEmptyState();state.coins=1000;
    render=()=>{};scheduleRender=()=>{};showToast=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};hideToast=()=>{};
    showUndoToast=data=>{pendingUndo=data};els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    runAutomaticChecks({initializeDailyHabits:true,showToast:false});`);
  return { run, context, at: time => { clock.time = time; } };
}


test('Merges same-name legacy sources by ID exactly once, preserving coins/history/active focus',()=>{
 const {run,at}=runtime();
 run("state.unifiedPriorities=undefined;state.priorityTaskByDate[dateKey()]={date:dateKey(),title:'同名',status:'pending'};state.priorityPlans={[dateKey()]:{version:1,date:dateKey(),items:[{id:'p',title:'同名',status:'pending'}]}};const id=saveDailyTask({name:'同名',reward:5});startFocusSession('dailyTask',id);const coins=state.coins;runAutomaticChecks();state=loadState();runAutomaticChecks()");
 assert.equal(run('pendingDailyTasks().length'),3);assert.equal(run('state.coins'),1000);assert.equal(run('state.history.length'),0);
 assert.equal(run('state.currentFocus.sourceId'),run('id'));
 assert.equal(run('pendingDailyTasks().every(t=>t.reward===50 && t.penalty===200)'),true);
 at('2026-10-19T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),400);
 assert.equal(run('state.history.length'),3);
});
test('Unlimited focus completion / Undo / completion; offline end-of-day -200 once, never during focus expiry',()=>{
 const {run,at}=runtime();run("const ids=Array.from({length:10},(_,i)=>saveDailyTask({name:'重点'+i,reward:10}));startFocusSession('dailyTask',ids[0]);completeHabitFocus(state.currentFocus.id);completeDailyTask(ids[0])");
 assert.equal(run('state.coins'),1050);assert.equal(run('unifiedCompletedRecords(dateKey()).length'),1);
 run('undoLastAction()');assert.equal(run('state.coins'),1000);
 run('completeDailyTask(ids[0])');assert.equal(run('state.coins'),1050);
 at('2026-10-18T23:59:59');run('runAutomaticChecks()');assert.equal(run('state.coins'),1050);
 at('2026-10-21T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),-750);assert.equal(run("state.history.filter(e=>e.type==='task_failed').length"),9);
});
test('Review stable plan IDs merge with manual tasks and never duplicate or overwrite manual edits',()=>{
 const {run,at}=runtime();
 run("saveDailyReview=undefined;const review={priorityEntries:[{id:'a',text:'A'},{id:'b',text:'B'}]};syncUnifiedReviewPlan(dateKey(),review);syncUnifiedReviewPlan(dateKey(),review);const future=shiftDateKey(dateKey(),1);state.dailyTasks.push(unifiedPriorityTask('手动',future));state.dailyTasks[0].manuallyEdited=true;state.dailyTasks[0].name='已手改';review.priorityEntries[0].text='覆盖';syncUnifiedReviewPlan(dateKey(),review)");
 assert.equal(run('state.dailyTasks.length'),3);assert.equal(run('state.dailyTasks[0].name'),'已手改');
 at('2026-10-19T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('pendingDailyTasks().length'),3);
 run('const backup=createLifeOSBackup();restoreLifeOSBackup(backup)');
 assert.equal(run('pendingDailyTasks().length'),3);
});
test('Deleted items never reimport or incur penalties; habits keep their own reward and penalty',()=>{
 const {run,at}=runtime();run("const id=saveDailyTask({name:'删除',reward:5});deleteDailyTask(id);state.habits=[{id:'h',name:'习惯',coins:10,createdDate:dateKey()}];completeHabit('h')");
 assert.equal(run('state.coins'),1010);
 at('2026-10-19T10:00:00');run('runAutomaticChecks();runAutomaticChecks()');
 assert.equal(run('state.coins'),1010);
});

test('Old review plans keep stable slot identities and settled items are never recreated',()=>{
 const {run}=runtime();
 run(`state.unifiedPriorities=undefined;
  const day=dateKey(),source=shiftDateKey(day,-1);
  state.priorityPlans={[day]:{version:1,source:'review',sourceDate:source,items:[
   {id:'empty',title:'',status:'pending'},{id:'a',title:'未完成',status:'pending'},
   {id:'b',title:'已完成',status:'done',historyId:'old'}]}};
  state.history=[{id:'old',type:'priority_task_reward',date:day,name:'已完成',priorityItemId:'b',coins:50}];
  runAutomaticChecks();
  const review={priorityItems:['','未完成','已完成']};
  syncUnifiedReviewPlan(source,review);syncUnifiedReviewPlan(source,review);`);
 assert.equal(run('pendingDailyTasks().length'),1);
 assert.equal(run('unifiedCompletedRecords(dateKey()).length'),1);
 run(`const task=pendingDailyTasks()[0];deleteDailyTask(task.id);runAutomaticChecks();syncUnifiedReviewPlan(source,review)`);
 assert.equal(run('pendingDailyTasks().length'),0);
 assert.equal(run('state.history.length'),1);
});

test('Previously blocked review plans merge once with manually created priorities without title dedupe',()=>{
 const {run}=runtime();
 run(`state.unifiedPriorities=undefined;
  state.priorityTaskByDate[dateKey()]={title:'同名',status:'pending',source:'manual'};
  state.dailyReviews[yesterdayKey()]={priorityItems:['同名','来自复盘',''],dailyScore:7};
  runAutomaticChecks();state=loadState();runAutomaticChecks();`);
 assert.equal(run('pendingDailyTasks().length'),3);
 assert.equal(run('pendingDailyTasks().filter(t=>t.name==="同名").length'),2);
 assert.equal(run('state.coins'),1000);
 run('reorderDailyTask(state.dailyTasks[2].id,state.dailyTasks[0].id);const order=state.dailyTasks.map(t=>t.id).join();runAutomaticChecks()');
 assert.equal(run('state.dailyTasks.map(t=>t.id).join()'),run('order'));
});

test('Formal review saves preserve old good/mistake verbatim and reorder only linked pending plan rows',()=>{
 const {run}=runtime('2026-12-31T10:00:00');
 run(String.raw`selectedReviewDate=dateKey();renderDailyReview=()=>{};showReviewSavedStatus=()=>{};
  state.dailyReviews[dateKey()]={best:'  原始长文本\n第二段  ',bestItems:['  原始长文本\n第二段  ','',''],mistake:'旧改进',dailyScore:6};
  const entries=[{id:'1',text:'A'},{id:'2',text:'B'},{id:'3',text:'C'}];
  saveDailyReview({priorityEntries:entries,dailyScore:7});
  const next=shiftDateKey(dateKey(),1);state.dailyTasks.push(unifiedPriorityTask('手动',next));
  saveDailyReview({priorityEntries:[entries[2],entries[0],entries[1]],dailyScore:8});`);
 assert.equal(run('state.dailyReviews[dateKey()].best'),'  原始长文本\n第二段  ');
 assert.equal(run('state.dailyReviews[dateKey()].mistake'),'旧改进');
 assert.equal(run('state.dailyTasks.map(t=>t.name).join()'),'C,A,B,手动');
 assert.equal(run('state.dailyTasks.every(t=>t.localDateKey==="2027-01-01")'),true);
 assert.equal(run('state.history.length'),0);assert.equal(run('state.coins'),1000);
});

test('Past settlements retain exact amounts, old backups migrate safely, reversed day-end never charges twice',()=>{
 const {run,at}=runtime();
 run(`const old=createLifeOSBackup();delete old.data.unifiedPriorities;
  old.data.dailyTasks=[{id:'historic',name:'历史',reward:10,penalty:100,status:'completed',localDateKey:'2026-10-17'},
    {id:'prior',name:'过去未结算',reward:20,penalty:200,status:'pending',localDateKey:'2026-10-17'}];
  old.data.history=[{id:'saved',type:'task_completed',date:'2026-10-17',name:'历史',coins:10,earnedCoins:10,taskKind:'dailyTask',taskId:'historic'}];
  restoreLifeOSBackup(old);runAutomaticChecks();
  const taskId=saveDailyTask({name:'当日新重点',reward:5});`);
 assert.equal(run('state.dailyTasks[0].reward'),10);
 assert.equal(run('state.history.find(e=>e.id==="saved").coins'),10);
 assert.equal(run('state.dailyTasks.find(t=>t.id===taskId).reward'),50);
 at('2026-10-19T10:00:00');run('runAutomaticChecks();undoLastAction();const afterUndo=state.coins;runAutomaticChecks();state=loadState();runAutomaticChecks()');
 assert.equal(run('state.coins'),run('afterUndo'));
});

test('Review saving immediately after reset/import cannot revive the three-item legacy planner',()=>{
 const {run}=runtime();
 run(`state=cloneEmptyState();selectedReviewDate=dateKey();renderDailyReview=()=>{};showReviewSavedStatus=()=>{};
  saveDailyReview({priorityEntries:Array.from({length:10},(_,i)=>({id:String(i),text:'重点'+i})),dailyScore:7});`);
 assert.equal(run('state.dailyTasks.length'),10);
 assert.equal(run('state.dailyTasks.every(t=>t.reward===50 && t.penalty===200)'),true);
 assert.equal(run('Object.keys(state.priorityTaskByDate).length'),0);
 assert.equal(run('state.coins'),0);
});
