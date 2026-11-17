const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function runtime(){
 const clock={time:'2026-11-17T10:00:00'},store=new Map();
 const context=vm.createContext({console,setTimeout,clearTimeout,Date:class extends Date{constructor(...a){super(...(a.length?a:[clock.time]));}static now(){return new Date(clock.time).getTime();}},window:{setTimeout,clearTimeout},document:{},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 for(const n of ['workbench','storage','backup','tasks','habits','economy','daily-tasks','focus','settlement','memos','priority-plan','unified-priorities','day-modes'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+n+'.js'),'utf8'),context);
 const run=s=>vm.runInContext(s,context);
 run(`state=cloneEmptyState();state.coins=1000;state.rewards=defaultFundRewards();render=()=>{};scheduleRender=()=>{};showToast=()=>{};closeSheet=()=>{};hideToast=()=>{};updatePrimaryReadouts=()=>{};showUndoToast=d=>pendingUndo=d;els={dayDetailBackdrop:{classList:{contains:()=>true}}};runAutomaticChecks({initializeDailyHabits:true,showToast:false});`);
 run("const defaultProject=saveWorkbenchProject({name:'测试项目'});function task(data){return saveWorkbenchTask({projectId:data.id?wbTask(data.id).projectId:defaultProject,...data})}");
 return {run,at:t=>clock.time=t};
}
test('Projects CRUD, archive and deletion preserve tasks; task states, filters, movement and stable sorting',()=>{
 const {run}=runtime();run(`const p=saveWorkbenchProject({name:'摄影'}),q=saveWorkbenchProject({name:'旅行'});const a=task({name:'A',projectId:p,priority:'high'}),b=task({name:'B',priority:'high',dueDate:'2026-11-20'}),c=task({name:'C',status:'waiting'});`);
 assert.equal(run('wbTasks()[0].id'),run('b'));assert.equal(run('wbTasks(p).length'),1);assert.equal(run("wbTasks('none').length"),0);
 assert.throws(()=>run("setWorkbenchProjectStatus(p,'deleted')"));
 run("task({id:a,name:'编辑',projectId:q,status:'active'});saveWorkbenchProject({id:q,name:'远行'});setWorkbenchProjectStatus(p,'archived');setWorkbenchProjectStatus(q,'deleted',{targetProjectId:defaultProject})");
 assert.equal(run('wbTask(a).projectId'),run('defaultProject'));assert.equal(run('wbTask(a).status'),'active');assert.equal(run('wbTasks(p).length'),0);
 run("task({id:a,name:'编辑',status:'waiting',priority:'high'});task({id:a,name:'编辑',status:'todo',priority:'high'});completeWorkbenchTask(a);completeWorkbenchTask(a)");
 assert.equal(run('wbEffectiveStatus(wbTask(a))'),'completed');assert.equal(run('state.coins'),1000);assert.equal(run('state.history.length'),0);
 run('undoLastAction();state=loadState()');assert.equal(run('wbEffectiveStatus(wbTask(a))'),'todo');run('deleteWorkbenchTask(a)');assert.equal(run('wbTask(a)'),undefined);
});
test('Today links use one identity, both completion entries share reward and Undo, cancellation retains original',()=>{
 const {run}=runtime();run("const a=task({name:'联动'});const e=addWorkbenchToday(a)");
 assert.throws(()=>run('addWorkbenchToday(a)'));run('completeDailyTask(e);completeWorkbenchTask(a)');assert.equal(run('state.coins'),1050);assert.equal(run('wbEffectiveStatus(wbTask(a))'),'completed');
 run('undoLastAction();completeWorkbenchTask(a);completeDailyTask(e)');assert.equal(run('state.coins'),1050);run('undoLastAction();cancelWorkbenchToday(a)');assert.equal(run('state.coins'),1000);assert.ok(run('wbTask(a)'));
 run('const e2=addWorkbenchToday(a)');assert.equal(run('e2'),run('e'));assert.equal(run('state.dailyTasks.length'),1);
 run('deleteWorkbenchTask(a)');assert.equal(run('state.dailyTasks[0].status'),'deleted');assert.equal(run('state.coins'),1000);
});
test('Sprint conflict never overwrites, deadline remains idempotent, Undo permits completion, vacation rejects',()=>{
 const {run,at}=runtime();run("const a=task({name:'冲刺A'}),b=task({name:'冲刺B'});saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(10,20);const e=addWorkbenchToday(a,{hour:10})");
 assert.throws(()=>run('addWorkbenchToday(b,{hour:10})'));assert.equal(run('state.dailyTasks.length'),1);
 at('2026-11-17T11:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');assert.equal(run('state.coins'),800);
 run('undoLastAction();runAutomaticChecks();completeWorkbenchTask(a);completeWorkbenchTask(a)');assert.equal(run('state.coins'),1050);
 run("saveDayModes('2026-11-18','2026-11-18','vacation')");at('2026-11-18T10:00:00');run('runAutomaticChecks()');assert.throws(()=>run('addWorkbenchToday(b)'));
});
test('Past failure preserved offline, no duplicate settlement, next-day execution is a new dated reference',()=>{
 const {run,at}=runtime();run("const a=task({name:'跨日'});addWorkbenchToday(a)");at('2026-11-20T10:00:00');run('runAutomaticChecks();state=loadState();runAutomaticChecks()');assert.equal(run('state.coins'),800);
 run('addWorkbenchToday(a);completeWorkbenchTask(a)');assert.equal(run('state.coins'),850);assert.equal(run('wbTask(a).executionIds.length'),2);
});
test('Restoring completed board task preserves settlement and cannot duplicate today reward',()=>{
 const {run}=runtime();run("const a=task({name:'恢复'});addWorkbenchToday(a);completeWorkbenchTask(a);task({id:a,name:'恢复',status:'todo'});completeWorkbenchTask(a)");
 assert.equal(run('state.coins'),1050);assert.equal(run('state.history.length'),1);assert.throws(()=>run('addWorkbenchToday(a)'));
});
test('Backup, repeated load and optional old schema preserve all legacy records without migration',()=>{
 const {run}=runtime();run(`state.dailyReviews={'2026-11-01':{best:'旧好事',mistake:'旧改进',priority:'旧明日重点',dailyScore:8}};state.calendarEvents=[{id:'calendar',title:'保留',startDate:'2026-11-01',endDate:'2026-11-01'}];state.longTermGoals=[];const legacy=JSON.stringify([state.coins,state.history,state.habits,state.dailyReviews,state.rewards,state.achievements,state.calendarEvents]);const old=createLifeOSBackup();const p=saveWorkbenchProject({name:'保存'});const a=task({name:'任务',projectId:p});addWorkbenchToday(a);const backup=createLifeOSBackup();restoreLifeOSBackup(backup);state=loadState();state=loadState();`);
 assert.equal(run('state.workbench.tasks.length'),1);assert.equal(run('state.dailyTasks.length'),1);
 assert.equal(run('JSON.stringify([state.coins,state.history,state.habits,state.dailyReviews,state.rewards,state.achievements])'),run('JSON.stringify(JSON.parse(legacy).slice(0,6))'));
 assert.equal(run('state.calendarEvents[0].title'),'保留');assert.equal(run('state.calendarEvents[0].id'),'calendar');
 run('delete old.data.workbench;restoreLifeOSBackup(old)');assert.equal(run('state.workbench'),undefined);assert.equal(run('state.dailyReviews["2026-11-01"].dailyScore'),8);
});
test('Fixed groups map old values without migration; legacy unassigned records require explicit assignment',()=>{
 const {run}=runtime();assert.throws(()=>run("saveWorkbenchTask({name:'没有项目'})"));
 run("const a=task({name:'旧低优先级',priority:'low',status:'active'});const snapshot=JSON.stringify(wbTask(a));const group=wbGroup(wbTask(a));");
 assert.equal(run('group'),'important');assert.equal(run('JSON.stringify(wbTask(a))'),run('snapshot'));
 run("wbMutate(d=>d.tasks.push({...wbTask(a),id:'legacy',groupId:undefined,projectId:null}));state=loadState()");assert.equal(run("wbTask('legacy').projectId"),null);
 run("assignWorkbenchProject(['legacy'],defaultProject);moveWorkbenchGroup(a,'waiting');state=loadState()");assert.equal(run('wbGroup(wbTask(a))'),'waiting');assert.equal(run('wbTask(a).priority'),'low');
 run("moveWorkbenchGroup(a,'urgent');moveWorkbenchGroup(a,'important')");assert.equal(run('wbGroup(wbTask(a))'),'important');assert.equal(run('state.coins'),1000);
});
test('Write failure, malformed and orphan links cannot replace valid local state',()=>{
 const {run}=runtime();run("const a=task({name:'原始'});saveState();const before=JSON.stringify(state);const set=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota')}");
 assert.throws(()=>run("task({name:'失败'})"));assert.equal(run('JSON.stringify(state)'),run('before'));
 run('localStorage.setItem=set;const backup=createLifeOSBackup();backup.data.workbench.tasks[0].executionIds.push("missing")');assert.throws(()=>run('restoreLifeOSBackup(backup)'));assert.equal(run('JSON.stringify(state)'),run('before'));
 run('const invalid=JSON.parse(before);invalid.workbench.version=99;localStorage.setItem(STORAGE_KEY,JSON.stringify(invalid));state=loadState()');assert.equal(run('storageReadBlocked'),true);assert.throws(()=>run('saveState()'));
});
test('Edits made in Today retain the linked name after canceling and scheduling again',()=>{
 const {run,at}=runtime();run("const a=task({name:'原始'});const e=addWorkbenchToday(a)");at('2026-11-17T10:01:00');
 run("saveDailyTask({id:e,name:'今天修改的名称',reward:50});cancelWorkbenchToday(a);addWorkbenchToday(a)");
 assert.equal(run('wbTaskName(wbTask(a))'),'今天修改的名称');assert.equal(run('state.dailyTasks.length'),1);
});
test('Custom groups are project-owned, stable across rename/reload and independently ordered',()=>{
 const {run}=runtime();run("const p=saveWorkbenchProject({name:'A'}),q=saveWorkbenchProject({name:'B'});const g=saveWorkbenchGroup(p,{name:'剪辑'}),h=saveWorkbenchGroup(p,{name:'待发布'});const t=saveWorkbenchTask({name:'视频',projectId:p,groupId:g});saveWorkbenchGroup(p,{id:g,name:'编辑中'});reorderWorkbenchGroup(p,h,-1);state=loadState()");
 assert.equal(run('wbTask(t).groupId'),run('g'));assert.equal(run('wbProjectGroups(p).find(g=>g.id===wbTask(t).groupId).name'),'编辑中');assert.equal(run('wbProjectGroups(q).length'),3);
 assert.throws(()=>run('moveWorkbenchGroup(t,wbProjectGroups(q)[0].id)'));
 assert.throws(()=>run('deleteWorkbenchGroup(p,g)'));run('deleteWorkbenchGroup(p,g,h)');assert.equal(run('wbTask(t).groupId'),run('h'));assert.equal(run('state.coins'),1000);
 run('const backup=createLifeOSBackup();restoreLifeOSBackup(backup);state=loadState()');assert.equal(run('wbTask(t).groupId'),run('h'));
});
test('Legacy group conversion is deterministic and idempotent without changing ledger or task identity',()=>{
 const {run}=runtime();run("const t=task({name:'旧任务',priority:'high'});delete state.workbench.projects[0].groups;delete state.workbench.projects[0].groupsVersion;delete state.workbench.tasks.find(x=>x.id===t).groupId;const old=JSON.stringify(state);const virtual=wbTaskGroupId(wbTask(t));const viewed=wbProjectGroups(defaultProject);const afterView=JSON.stringify(state);saveWorkbenchGroup(defaultProject,{id:viewed[0].id,name:'现在'});const once=JSON.stringify(state);ensureWorkbenchGroups(state.workbench)");
 assert.equal(run('old'),run('afterView'));assert.equal(run('wbTask(t).groupId'),run('virtual'));assert.equal(run('JSON.stringify(state)'),run('once'));assert.equal(run('state.history.length'),0);
});
test('Last populated group cannot be removed and empty custom lists never regenerate defaults',()=>{
 const {run}=runtime();run('for(const g of [...wbProjectGroups(defaultProject)])deleteWorkbenchGroup(defaultProject,g.id);saveWorkbenchProject({id:defaultProject,name:"仍为空"})');assert.equal(run('wbProjectGroups(defaultProject).length'),0);
 run("const g=saveWorkbenchGroup(defaultProject,{name:'唯一'});const t=saveWorkbenchTask({name:'保留',projectId:defaultProject,groupId:g})");assert.throws(()=>run('deleteWorkbenchGroup(defaultProject,g)'));
 run('const backup=createLifeOSBackup();delete backup.data.workbench.projects[0].groups');assert.throws(()=>run('restoreLifeOSBackup(backup)'));assert.equal(run('wbTask(t).groupId'),run('g'));
});
test('Outline notes, sibling orders and confirmed hierarchy removal preserve ledger and raw history',()=>{
 const {run}=runtime();run("const p=saveOutlineProject({name:'大纲'});const a=saveWorkbenchGroup(p,{name:'A'}),b=saveWorkbenchGroup(p,{name:'B'});const t=saveWorkbenchTask({name:'行动',projectId:p,groupId:a});const n=saveWorkbenchNote({projectId:p,groupId:a,text:'第一行\\nhttps://example.com'});const second=saveWorkbenchNote({projectId:p,groupId:a,text:'第二条'});reorderWorkbenchOutline('content',second,t,p,a);reorderWorkbenchOutline('group',b,a,p);const backup=createLifeOSBackup();restoreLifeOSBackup(backup);state=loadState()");
 assert.equal(run('wbProjectGroups(p)[0].id'),run('b'));assert.equal(run('wbOutlineContents(p,a)[0].item.id'),run('second'));assert.equal(run('state.workbench.notes[0].text'),'第一行\nhttps://example.com');assert.equal(run('state.coins'),1000);assert.equal(run('state.history.length'),0);
 assert.throws(()=>run('reorderWorkbenchOutline("content",n,t,p,b)'));
 run('const execution=addWorkbenchToday(t);deleteWorkbenchOutline("project",p)');assert.equal(run('state.dailyTasks[0].status'),'deleted');assert.equal(run('state.workbench.notes[0].status'),'deleted');assert.equal(run('state.workbench.projects.find(x=>x.id===p).status'),'deleted');assert.equal(run('state.coins'),1000);
});
