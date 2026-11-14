const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function runtime(){
 const store=new Map(),clock={now:new Date('2026-11-14T23:59:59').getTime()};
 const ctx=vm.createContext({console,setTimeout,clearTimeout,Date:class extends Date{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}},
  document:{addEventListener(){}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
 for(const file of ['storage','backup','tasks','habits','economy','daily-tasks','focus','settlement','procrastination'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);run('state=cloneEmptyState();state.coins=123.45;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey()');
 return {run,advance:ms=>clock.now+=ms};
}
test('Independent marker events persist, debounce duplicates, Undo only the chosen ID and leave other data unchanged',()=>{
 const {run,advance}=runtime();run('saveState();state=loadState();const original=JSON.stringify(state);const a=recordProcrastination();recordProcrastination()');
 assert.equal(run('procrastinationEvents().length'),1);advance(300);run('const b=recordProcrastination();state=loadState()');
 assert.equal(run('procrastinationEvents().length'),2);assert.equal(run('revokeProcrastination(b.id)'),true);
 assert.equal(run('revokeProcrastination(b.id)'),false);assert.equal(run('procrastinationEvents()[0].id'),run('a.id'));
 assert.equal(run('state.coins'),123.45);assert.equal(run('state.history.length'),0);
 run('const unchanged={...state};delete unchanged.procrastinationMarkers');assert.equal(run('JSON.stringify(unchanged)'),run('original'));
});
test('Local midnight, four-week grid and last seven-day counts retain historical events',()=>{
 const {run,advance}=runtime();run('recordProcrastination()');advance(2000);run('recordProcrastination();const rows=procrastinationDays()');
 assert.equal(run('procrastinationEvents(dateKey()).length'),1);assert.equal(run('procrastinationEvents(yesterdayKey()).length'),1);
 assert.equal(run('rows.length'),28);assert.equal(run('rows[0].day'),run('shiftDateKey(dateKey(),-27)'));
 assert.equal(run('rows.slice(-7).reduce((n,r)=>n+r.count,0)'),2);
});
test('Backup preserves events and revocations; old backups work; invalid events cannot overwrite data',()=>{
 const {run}=runtime();run('const e=recordProcrastination();revokeProcrastination(e.id);const backup=createLifeOSBackup();restoreLifeOSBackup(backup)');
 assert.equal(run('state.procrastinationMarkers.length'),1);assert.equal(run('procrastinationEvents().length'),0);
 run('const before=JSON.stringify(state);backup.data.procrastinationMarkers[0].localDateKey="bad"');
 assert.throws(()=>run('restoreLifeOSBackup(backup)'));assert.equal(run('JSON.stringify(state)'),run('before'));
 run('delete backup.data.procrastinationMarkers;restoreLifeOSBackup(backup)');assert.equal(run('procrastinationEvents().length'),0);
});
