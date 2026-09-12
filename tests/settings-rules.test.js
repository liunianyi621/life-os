const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function runtime() {
  const clock = {now:new Date(2026,8,11,10).toISOString()}, storage = new Map();
  const context = vm.createContext({console, Date:class extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return new Date(clock.now).getTime(); }
  }, localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  window:{setTimeout,clearTimeout},document:{},setTimeout,clearTimeout});
  for (const file of ['storage','backup','tasks','habits','economy','settlement','memos','ui/time-picker']) {
    vm.runInContext(fs.readFileSync(path.join(root,`js/${file}.js`),'utf8'),context);
  }
  const run = code => vm.runInContext(code,context);
  run(`state = cloneEmptyState(); state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();state.coins=2000;
    render=()=>{};renderTasks=()=>{};closeSheet=()=>{};updatePrimaryReadouts=()=>{};prepareActionCard=()=>{};
    showCoinFeedback=()=>{};scheduleRender=()=>{};showToast=()=>{};
    els={dayDetailBackdrop:{classList:{contains:()=>true}}};
    showUndoToast=data=>{pendingUndo=data;};showTaskRewardToast=()=>{};
    state.habits=[{id:'h',name:'看书',createdDate:dateKey()}];`);
  const set = (section,key,val) => run(`updateLifeOSSetting('${section}','${key}',${JSON.stringify(val)})`);
  const at = (day,hour,minute=0) => {clock.now=new Date(2026,8,day,hour,minute).toISOString();};
  return {context,run,set,at,storage};
}

test('Settings 默认值、旧用户 fallback 和无效值不会生成 NaN 或零奖励',()=>{
  const {run}=runtime();
  assert.deepEqual(JSON.parse(run('JSON.stringify(currentSettings().economy)')),{defaultTaskReward:5,habitReward:5,penaltyMultiplier:10,priorityReward:100,priorityPenalty:500});
  run('delete state.settings');
  assert.equal(run('defaultTaskReward()'),5);
  run('state.settings={version:1,economy:{habitReward:0,penaltyMultiplier:null},settlement:{autoFailTimedTasks:"false"}}');
  assert.equal(run('habitRewardAmount(state.habits[0])'),5);
  assert.equal(run('getIncompletePenalty(5)'),50);
  assert.equal(run('currentSettings().settlement.autoFailTimedTasks'),true);
});

test('Settings 保存及 reload，改设置不改余额或历史',()=>{
  const {run,set}=runtime();
  run("state.history=[{id:'past',taskId:'past-task',date:'2025-01-01',type:'task_failed',coinDelta:-50,source:'behavior',category:'habit_performance',action:'task_failed',entityType:'task',affectsBehaviorScore:true}]");
  const history=run('JSON.stringify(state.history)');
  assert.equal(set('economy','penaltyMultiplier',20),true);
  run('state=loadState()');
  assert.equal(run('penaltyMultiplier()'),20);
  assert.equal(run('JSON.stringify(state.history)'),history);
  assert.equal(run('state.coins'),2000);
  assert.equal(set('economy','penaltyMultiplier',0),false);
});

test('Settings 保存失败恢复全部配置和本地存储',()=>{
  const {run,set,context,storage}=runtime();
  run('saveState()');const before=run('JSON.stringify(state)'),stored=[...storage.entries()];
  context.localStorage.setItem=()=>{throw Error('quota');};
  assert.equal(set('economy','habitReward',10),false);
  assert.equal(run('JSON.stringify(state)'),before);assert.deepEqual([...storage.entries()],stored);
});

test('新旧 Backup 均可恢复，Settings 和生效历史随新备份保存',()=>{
  const {run,set}=runtime();
  set('economy','habitReward',10);set('settlement','autoFailTimedTasks',false);
  const settings=run('JSON.stringify(state.settings)');
  run('const backup=createLifeOSBackup();state.settings=normalizeSettings();restoreLifeOSBackup(backup)');
  assert.equal(run('JSON.stringify(state.settings)'),settings);
  run('delete backup.data.settings;restoreLifeOSBackup(backup)');
  assert.equal(run('currentSettings().economy.habitReward'),5);
  assert.equal(run('currentSettings().settlement.autoFailTimedTasks'),true);
});

for (const mutation of ['backup.data.settings.version=99','backup.data.settings.economy.habitReward=0','backup.data.settings.settlement.autoFailTimedTasks="off"','backup.data.settings.changes=[{effectiveAt:"invalid"}]']) {
  test(`无效 Settings Backup 不覆盖数据：${mutation}`,()=>{
    const {run,storage}=runtime();run('saveState();const backup=createLifeOSBackup()');
    const before=run('JSON.stringify(state)'),stored=[...storage.entries()];run(mutation);
    assert.throws(()=>run('restoreLifeOSBackup(backup)'));assert.equal(run('JSON.stringify(state)'),before);assert.deepEqual([...storage.entries()],stored);
  });
}

test('任务默认值只影响新建，用户选择和已有任务奖励不变；Memo 同样读取默认',()=>{
  const {run,set}=runtime();
  run("saveTask({name:'旧任务',coins:5})");set('economy','defaultTaskReward',20);
  assert.equal(run('taskRewardInputValue(null)'),20);
  run("saveTask({name:'默认任务'});saveTask({name:'自选任务',coins:10});state.memos=[{id:'m',text:'买书',status:'ACTIVE'}];scheduleMemoAsTask('m')");
  assert.deepEqual(JSON.parse(run('JSON.stringify(state.tasks.map(task=>task.reward))')),[5,20,10,20]);
});

test('新安排 Habit 奖励快照，修改后原任务不变，完成实际获得 10',()=>{
  const {run,set}=runtime();set('economy','habitReward',10);
  run("scheduleHabitAsTask('h')");set('economy','habitReward',20);
  assert.equal(run('taskRewardAmount(state.tasks[0])'),10);
  run('completeTask(state.tasks[0].id);completeTask(state.tasks[0].id)');
  assert.equal(run('state.coins'),2010);assert.equal(run('state.history.filter(e=>e.type==="task_completed").length'),1);
});

test('未安排习惯直接完成使用全局奖励，重复完成不奖励',()=>{
  const {run,set}=runtime();set('economy','habitReward',20);
  run("completeHabit('h');completeHabit('h')");assert.equal(run('state.coins'),2020);
});

for (const [reward,multiple,penalty] of [[5,10,50],[20,5,100],[10,20,200]]) {
  test(`Task deadline 配置奖励 ${reward} × ${multiple}，刷新重开只扣 ${penalty}`,()=>{
    const {run,set,at}=runtime();set('economy','penaltyMultiplier',multiple);
    run(`saveTask({name:'任务',coins:${reward},date:dateKey(),timeStart:'16:00',timeEnd:'17:00'})`);
    at(11,17);run('runAutomaticChecks({showToast:false});state=loadState();runAutomaticChecks({showToast:false});runPendingSettlements()');
    assert.equal(run('state.coins'),2000-penalty);assert.equal(run('state.history.filter(e=>e.type==="task_failed").length'),1);
    run('completeTask(state.tasks[0].id)');assert.equal(run('state.coins'),2000-penalty);
  });
}

test('Habit 全局奖励 10，次日 -100，安排不是完成，截止与跨日共用身份',()=>{
  const {run,set,at}=runtime();set('economy','habitReward',10);
  run("scheduleHabitAsTask('h')");at(11,12);run('runAutomaticChecks({showToast:false})');
  assert.equal(run('state.coins'),1900);at(12,10);
  run('runAutomaticChecks({showToast:false});state=loadState();runAutomaticChecks({showToast:false})');
  assert.equal(run('state.coins'),1900);assert.equal(run('state.history.filter(e=>e.type==="habit_failed").length'),1);
});

test('未安排 Habit 次日使用配置 -100；多次补结算不会重复',()=>{
  const {run,set,at}=runtime();set('economy','habitReward',10);at(12,10);
  run('runAutomaticChecks({showToast:false});runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1900);
});

test('任务自动失败 OFF 阻断 deadline 和跨日入口，过期仍可手动完成',()=>{
  const {run,set,at}=runtime();set('settlement','autoFailTimedTasks',false);
  run("state.habits=[];saveTask({name:'任务',coins:20,timeStart:'10:00',timeEnd:'11:00',date:dateKey()})");at(12,10);
  run('runAutomaticChecks({showToast:false});runPendingSettlements();state=loadState()');assert.equal(run('state.coins'),2000);
  run('completeTask(state.tasks[0].id)');assert.equal(run('state.coins'),2020);
});

test('习惯自动失败 OFF 跳过当天，重新开启不追扣关闭日期',()=>{
  const {run,set,at}=runtime();set('settlement','autoFailHabitsDaily',false);at(12,10);
  run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),2000);
  set('settlement','autoFailHabitsDaily',true);run("settleMissedHabits('2026-09-11')");assert.equal(run('state.coins'),2000);
  at(13,10);run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1950);
});

test('关闭时离线，重新开启也不会追扣旧 slot；新 slot 正常失败',()=>{
  const {run,set,at}=runtime();set('settlement','autoFailTimedTasks',false);
  run("state.habits=[];saveTask({name:'关闭期间',coins:5,date:dateKey(),timeStart:'10:00'})");at(11,12);
  set('settlement','autoFailTimedTasks',true);run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),2000);
  run("saveTask({name:'开启后',coins:5,date:dateKey(),timeStart:'12:00'})");at(11,13);run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1950);
});

test('两个开关独立：关闭习惯跨日并不免除已安排任务的 slot deadline',()=>{
  const {run,set,at}=runtime();set('settlement','autoFailHabitsDaily',false);
  run("scheduleHabitAsTask('h')");at(11,12);run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1950);
});

test('Priority 使用独立 +200 / -1000，倍率不干涉，历史不重算',()=>{
  const {run,set,at}=runtime();set('economy','priorityReward',200);set('economy','priorityPenalty',1000);set('economy','penaltyMultiplier',20);
  run("state.habits=[];state.priorityTaskByDate[dateKey()]={date:dateKey(),title:'重点',status:'pending'};completePriorityTask()");assert.equal(run('state.coins'),2200);
  run("state.priorityTaskByDate['2026-09-12']={date:'2026-09-12',title:'明天重点',status:'pending'}");at(13,10);run('runAutomaticChecks({showToast:false});runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1200);
  assert.equal(run('state.history.find(e=>e.type==="priority_task_reward").coinDelta'),200);
});

test('设置变更不改变过去截止日的应计规则，也不重算已结算记录',()=>{
  const {run,set,at}=runtime();run("state.habits=[];saveTask({name:'之前到期',coins:5,date:dateKey(),timeStart:'10:00'})");at(11,12);set('economy','penaltyMultiplier',20);
  run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1950);
  const history=run('JSON.stringify(state.history)');set('economy','penaltyMultiplier',5);run('runAutomaticChecks({showToast:false})');assert.equal(run('JSON.stringify(state.history)'),history);
});

test('Reset 恢复 Settings defaults 并清除旧 Undo，失败时保留原数据',()=>{
  const {run,set,context,storage}=runtime();set('economy','habitReward',20);
  const before=run('JSON.stringify(state)'), stored=storage.get('minimal-discipline-v1'),write=context.localStorage.setItem;
  context.localStorage.setItem=()=>{throw Error('quota');};assert.equal(run('resetAllData()'),false);
  assert.equal(run('JSON.stringify(state)'),before);assert.equal(storage.get('minimal-discipline-v1'),stored);
  context.localStorage.setItem=write;run('pendingUndo={amount:100}');assert.equal(run('resetAllData()'),true);
  assert.equal(run('currentSettings().economy.habitReward'),5);assert.equal(run('state.coins'),0);assert.equal(run('pendingUndo'),null);
});

test('手动失败也读取倍率，之后改规则再撤回仍返还原来的实际金额',()=>{
  const {run,set}=runtime();set('economy','penaltyMultiplier',5);
  run("saveTask({name:'任务',coins:20,date:dateKey(),timeStart:'16:00'});failTask(state.tasks[0].id)");
  assert.equal(run('state.coins'),1900);set('economy','penaltyMultiplier',20);
  run('hideToast=()=>{};undoLastAction()');assert.equal(run('state.coins'),2000);
});

test('关闭 task deadline 后仍可重新排期；重新开启仅使用新的截止规则',()=>{
  const {run,set,at}=runtime();set('settlement','autoFailTimedTasks',false);
  run("state.habits=[];saveTask({name:'任务',coins:10,date:dateKey(),timeStart:'10:00'})");at(11,12);
  assert.equal(run('rescheduleTask(state.tasks[0].id,new Date(2026,8,11,16))'),true);
  set('settlement','autoFailTimedTasks',true);at(11,17);run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1900);
});

test('Priority 修改配置不会改变之前日期的待补结算金额',()=>{
  const {run,set}=runtime();
  run("state.priorityTaskByDate['2026-09-10']={date:'2026-09-10',title:'过去重点',status:'pending'}");
  set('economy','priorityPenalty',1000);run('runAutomaticChecks({showToast:false})');assert.equal(run('state.coins'),1500);
});

test('导入拒绝当前设置与最后一次生效规则不一致的备份',()=>{
  const {run,set}=runtime();set('economy','habitReward',10);
  run('const backup=createLifeOSBackup();backup.data.settings.economy.habitReward=20');
  const before=run('JSON.stringify(state)');assert.throws(()=>run('restoreLifeOSBackup(backup)'));assert.equal(run('JSON.stringify(state)'),before);
});

test('关闭两个自动规则后，跨日 Habit task 仍可手动完成原责任日',()=>{
  const {run,set,at}=runtime();set('economy','habitReward',10);
  set('settlement','autoFailTimedTasks',false);set('settlement','autoFailHabitsDaily',false);
  run("scheduleHabitAsTask('h')");at(12,12);
  run('runAutomaticChecks({showToast:false});completeTask(state.tasks[0].id)');
  assert.equal(run('state.coins'),2010);assert.equal(run("habitCompletedOnDate('h','2026-09-11')"),true);
  assert.equal(run("habitCompletedOnDate('h','2026-09-12')"),false);
});

test('旧用户仅 fallback Settings，不改原来的任务或习惯奖励字段',()=>{
  const {run}=runtime();run("delete state.settings;state.habits[0].coins=37;saveTask({name:'旧任务',coins:10});saveState();state=loadState()");
  assert.equal(run('state.habits[0].coins'),37);assert.equal(run('state.tasks[0].coins'),10);assert.equal(run('state.settings.version'),1);
});

test('Settings 为次级页面，底部仍为五项，数据管理已从 Statistics DOM 移除',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const stats=html.slice(html.indexOf('data-view="stats"'),html.indexOf('data-view="settings"'));
  assert.match(stats,/data-open-settings/);assert.doesNotMatch(stats,/data-export-backup|resetAllBtn|data-export-debug/);
  assert.equal((html.match(/data-nav="/g)||[]).length,5);
});
