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

test('Old reminders stay active; completed statuses remain hidden without changing data',()=>{
  const {run}=runtime();
  run("state.memos=[{id:'old',text:'原来的提醒'},{id:'done',text:'已做',status:'COMPLETED',completedAt:'2026-09-10T10:00:00Z'}]");
  const original=run('JSON.stringify(state.memos)');
  assert.equal(run('memoIsActive(state.memos[0])'),true);
  assert.equal(run('memoIsActive(state.memos[1])'),false);
  assert.equal(run('JSON.stringify(state.memos)'),original);
});

test('Complete and Undo only change Memo, never coins/history/tasks/habits/statistics',()=>{
  const {run}=runtime();
  run("hideToast=()=>{};state.memos=[{id:'one',text:'第一条',createdAt:'2026-09-10'},{id:'two',text:'第二条',createdAt:'2026-09-09'}]");
  const original=run('JSON.stringify(state.memos)');
  const rest=run('JSON.stringify({...state,memos:[]})');
  run("toggleMemo('one');toggleMemo('one')");
  assert.equal(run('state.memos[0].status'),'COMPLETED');
  assert.ok(run('state.memos[0].completedAt'));
  assert.equal(run('JSON.stringify({...state,memos:[]})'),rest);
  run('undoLastAction()');
  assert.equal(run('JSON.stringify(state.memos)'),original);
  assert.equal(run('JSON.stringify({...state,memos:[]})'),rest);
});

test('Completed reminders persist through reload and backup without reappearing',()=>{
  const {run}=runtime();
  run("state.memos=[{id:'m',text:'提醒'}];toggleMemo('m');state=loadState()");
  assert.equal(run('memoIsActive(state.memos[0])'),false);
  run('const backup=createLifeOSBackup();restoreLifeOSBackup(backup)');
  assert.equal(run('state.memos[0].status'),'COMPLETED');
  assert.ok(run('state.memos[0].completedAt'));
  run('delete backup.data.memos[0].status;delete backup.data.memos[0].completedAt;delete backup.data.memos[0].completed;restoreLifeOSBackup(backup)');
  assert.equal(run('memoStatus(state.memos[0])'),'ACTIVE');
});

test('Add/edit are persisted, no task linkage or economy fields are created',()=>{
  const {run}=runtime();
  run("saveMemoText('新提醒')");
  assert.equal(run('state.memos[0].status'),'ACTIVE');
  assert.equal(run('state.memos[0].completedAt'),null);
  assert.equal(run("'linkedTaskId' in state.memos[0]"),false);
  run("editingMemoId=state.memos[0].id;saveMemoText('修改内容');state=loadState()");
  assert.equal(run('state.memos[0].text'),'修改内容');
  assert.equal(run('state.tasks.length'),0);
  assert.equal(run('state.history.length'),0);
});

test('Storage failure does not complete or lose a reminder; Undo failure remains retryable',()=>{
  const {run,context}=runtime();
  run("state.memos=[{id:'m',text:'不能丢失'}];saveState()");
  const saved=context.localStorage.setItem;
  context.localStorage.setItem=()=>{throw Error('quota');};
  run("toggleMemo('m')");
  assert.equal(run('memoIsActive(state.memos[0])'),true);
  assert.equal(run('pendingUndo'),null);
  context.localStorage.setItem=saved;
  run("toggleMemo('m');hideToast=()=>{}");
  context.localStorage.setItem=()=>{throw Error('quota');};
  run('undoLastAction()');
  assert.equal(run('state.memos[0].status'),'COMPLETED');
  assert.equal(run('pendingUndo.type'),'memo_completed');
  context.localStorage.setItem=saved;run('undoLastAction()');
  assert.equal(run('memoIsActive(state.memos[0])'),true);
});

test('No production Memo-to-task factory or arrangement/drop entry remains',()=>{
  const {run}=runtime();
  assert.equal(run('typeof scheduleMemoAsTask'),'undefined');
  const source=['memos','ui','ui/sheets'].map(f=>fs.readFileSync(path.join(root,'js/'+f+'.js'),'utf8')).join('');
  assert.doesNotMatch(source,/scheduleMemoAsTask|data-arrange-memo|data-memo-card/);
});
