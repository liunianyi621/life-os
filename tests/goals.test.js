const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function runtime(){const clock={time:'2026-12-31T12:00:00'},store=new Map();let queue=Promise.resolve();
 const ctx=vm.createContext({console,setTimeout,clearTimeout,navigator:{locks:{request:(name,fn)=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;}}},
 Date:class extends Date{constructor(...a){super(...(a.length?a:[clock.time]));}static now(){return new Date(clock.time).getTime();}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{},window:{}});
 for(const name of ['storage','backup','tasks','habits','economy','daily-tasks','focus','settlement','priority-plan','unified-priorities','goals'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+name+'.js'),'utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);run(`state=cloneEmptyState();state.coins=1000;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();saveState();state=loadState();showToast=()=>{};render=()=>{};scheduleRender=()=>{};updatePrimaryReadouts=()=>{};closeSheet=()=>{};showUndoToast=u=>pendingUndo=u;els={dayDetailBackdrop:{classList:{contains:()=>true}}};`);
 return {run,at:t=>clock.time=t};}
const data={name:'目标',deadline:'2026-12-31',kind:'completion',reward:500,penalty:'一周不刷视频',milestones:[]};
test('Goal settlements serialize, reward once, reverse auditably and cannot farm coins',async()=>{
 const {run}=runtime();const id=await run(`saveGoal(${JSON.stringify(data)})`);
 await Promise.all([run(`settleGoal('${id}')`),run(`settleGoal('${id}')`)]);
 assert.equal(run('state.coins'),1500);await run(`correctGoal('${id}')`);assert.equal(run('state.coins'),1000);
 await run(`settleGoal('${id}')`);assert.equal(run('state.coins'),1500);assert.equal(run('state.longTermGoals[0].log.filter(l=>l.action==="reversed").length'),1);
 run('const backup=createLifeOSBackup();restoreLifeOSBackup(backup)');assert.equal(run('state.longTermGoals.length'),1);
});
test('Deadline inclusive, offline catchup across year, no failure coins, correction persists without refailing',async()=>{
 const {run,at}=runtime();const id=await run(`saveGoal(${JSON.stringify(data)})`);await run('goalTransaction(()=>{})');assert.equal(run('state.longTermGoals[0].status'),'active');
 at('2027-01-02T10:00:00');await run('goalTransaction(()=>{})');await run('goalTransaction(()=>{})');assert.equal(run('state.coins'),1000);assert.equal(run('state.longTermGoals[0].status'),'failed');
 await run(`correctGoal('${id}')`);await run('goalTransaction(()=>{})');assert.equal(run('state.longTermGoals[0].status'),'active');assert.equal(await run(`settleGoal('${id}')`),false);
 await run(`saveGoal({...state.longTermGoals[0],deadline:'2027-01-03'},'${id}')`);await run(`settleGoal('${id}')`);assert.equal(run('state.coins'),1500);
});
test('Numeric rising/falling, equal start, clipping and linked milestone Undo reuse +50 daily ledger',async()=>{
 const {run}=runtime();for(const [start,target,current,expected] of [[0,10,5,.5],[60,55,57,.6],[0,0,0,1],[10,20,50,1]])assert.equal(run(`goalProgress({kind:'numeric',start:${start},target:${target},current:${current}})`),expected);
 const id=await run(`saveGoal(${JSON.stringify({...data,kind:'milestones',milestones:[{id:'m',name:'行动',done:false}]})})`);
 const task=await run(`goalTodayAction('${id}','行动','m')`);assert.equal(await run(`goalTodayAction('${id}','行动','m')`),task);
 run(`completeDailyTask('${task}')`);assert.equal(run('state.coins'),1050);assert.equal(run('goalProgress(state.longTermGoals[0])'),1);run('undoLastAction()');assert.equal(run('state.coins'),1000);assert.equal(run('goalProgress(state.longTermGoals[0])'),0);
});
test('Inclusive deadline handles month, leap day and year boundaries without extra transactions',async()=>{
 for(const [start,deadline,end] of [['2026-01-31T12:00:00','2026-01-31','2026-02-01T00:00:00'],['2024-02-29T23:59:59','2024-02-29','2024-03-01T00:00:00'],['2026-12-31T23:59:59','2026-12-31','2027-01-01T00:00:00']]){
  const {run,at}=runtime();at(start);const id=await run(`saveGoal(${JSON.stringify({...data,deadline})})`);
  await run('goalTransaction(()=>{})');assert.equal(run('state.longTermGoals[0].status'),'active');at(end);
  await run('goalTransaction(()=>{})');await run(`settleGoal('${id}')`);await run(`fulfillGoalPenalty('${id}')`);await run(`fulfillGoalPenalty('${id}')`);
  assert.equal(run('state.longTermGoals[0].status'),'failed');assert.equal(run('state.coins'),1000);
  assert.equal(run('state.longTermGoals[0].log.filter(l=>l.action==="penalty_fulfilled").length'),1);
 }
});
test('Failed persistence rolls goal reward back, invalid backup cannot replace state',async()=>{
 const {run}=runtime();const id=await run(`saveGoal(${JSON.stringify(data)})`);
 run('const set=localStorage.setItem;localStorage.setItem=()=>{throw Error("quota")};const before=JSON.stringify(state)');
 await assert.rejects(run(`settleGoal('${id}')`));assert.equal(run('JSON.stringify(state)'),run('before'));
 run('localStorage.setItem=set;const backup=createLifeOSBackup();backup.data.longTermGoals[0].reward=-1');
 assert.throws(()=>run('restoreLifeOSBackup(backup)'));assert.equal(run('state.coins'),1000);
});
