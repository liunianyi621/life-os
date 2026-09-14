const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function runtime() {
  const storage = new Map();
  const context = vm.createContext({console:{log(){},warn(){},error(){}}, Date,
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    window:{setTimeout,clearTimeout},document:{},setTimeout,clearTimeout});
  for (const file of ['storage','backup','tasks','habits','economy','settlement','memos','ui/time-picker']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
  }
  const run = code => vm.runInContext(code,context);
  run(`state=cloneEmptyState();state.coins=1234;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
    render=()=>{};showToast=()=>{};reportAppFailure=()=>{};saveState();`);
  return {run,context,storage};
}

for (const key of ['memos','tasks','habits','badHabits','notes','calendarEvents','rewards','achievements','history']) {
  test(`Invalid ${key} entries are preserved outside live arrays; reload is idempotent`,()=>{
    const {run}=runtime();
    run(`state.${key}=[null,42,'legacy'];saveState();state=loadState()`);
    if (key !== 'rewards') assert.equal(run(`state.${key}.length`),0);
    assert.equal(run(`state.${key}.every(item=>item && typeof item==='object')`),true);
    assert.equal(run('state.coins'),1234);
    assert.equal(run('state.storageRecovery[0].records.length'),3);
    const recovery=run('JSON.stringify(state.storageRecovery)');
    run('state=loadState()');
    assert.equal(run('JSON.stringify(state.storageRecovery)'),recovery);
  });
}

test('Healthy reminders and their IDs/text/status are unchanged beside invalid records',()=>{
  const {run}=runtime();
  run(`state.memos=[{id:'keep',text:'Keep this',status:'COMPLETED'},null];saveState();state=loadState()`);
  assert.equal(run('JSON.stringify(state.memos)'),JSON.stringify([{id:'keep',text:'Keep this',status:'COMPLETED'}]));
  const backup=run('createLifeOSBackup()');
  assert.equal(backup.data.storageRecovery[0].records[0].value,null);
});

test('Wrong collection type is retained in recovery, not silently discarded',()=>{
  const {run}=runtime();
  run(`state.memos={old:'text'};saveState();state=loadState()`);
  assert.equal(run('state.memos.length'),0);
  assert.equal(run('state.storageRecovery[0].records[0].value.old'),'text');
});

for (const raw of ['{broken','[]','null','"legacy"']) {
  test(`Unreadable root ${raw} never overwrites its original bytes`,()=>{
    const {run,storage}=runtime();
    const key=run('STORAGE_KEY');storage.set(key,raw);
    run('state=loadState();runAutomaticChecks()');
    assert.equal(run('storageReadBlocked'),true);
    assert.throws(()=>run('saveState()'));
    assert.throws(()=>run('createLifeOSBackup()'));
    assert.equal(storage.get(key),raw);
  });
}

test('Quota failure during cleanup does not replace successfully read data with an empty state',()=>{
  const {run,context}=runtime();
  run('state.phoneTimer={legacy:true};saveState()');
  context.localStorage.setItem=()=>{throw Error('QuotaExceededError');};
  run('state=loadState()');
  assert.equal(run('state.coins'),1234);
  assert.equal(run('storageReadBlocked'),false);
  assert.match(run('storageRecoveryMessage'),/无法保存/);
});

test('Explicit valid backup restore preserves unreadable original and unlocks writes',()=>{
  const {run,storage}=runtime();
  run('const goodBackup=createLifeOSBackup()');
  storage.set(run('STORAGE_KEY'),'{broken');
  run('state=loadState();restoreLifeOSBackup(goodBackup);saveState()');
  assert.equal(run('state.coins'),1234);
  assert.equal(run('storageReadBlocked'),false);
  assert.equal(storage.get(run('LIFEOS_BEFORE_IMPORT_KEY')),'{broken');
});

test('Unexpected automatic-check error rolls back partial in-memory changes before saving',()=>{
  const {run,storage}=runtime();
  const before=storage.get(run('STORAGE_KEY'));
  run('settleTaskSlotDeadlines=()=>{state.coins=0;throw Error("broken record")};runAutomaticChecks()');
  assert.equal(run('state.coins'),1234);
  assert.equal(storage.get(run('STORAGE_KEY')),before);
});
