const assert=require('node:assert/strict'),test=require('node:test'),vm=require('node:vm');
const path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
const audit=require('../js/storage-audit.js');
function storage(seed={}){
  const data=new Map(Object.entries(seed)),writes=[];
  return {data,writes,get length(){return data.size;},key:i=>[...data.keys()][i]??null,
    getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);data.set(k,v);}};
}
const raw=(extra={})=>JSON.stringify({coins:0,tasks:[],habits:[],memos:[],history:[],rewards:[],dailyReviews:{},pastCoinHistoryScaleMigrationVersion:1,...extra});
const decide=s=>audit.decide(audit.capture(s));
test('Only an entirely readable empty container qualifies as a first installation',()=>{
  assert.equal(decide(storage()).status,'first-install');
  assert.equal(decide(storage({backup:raw()})).canRead,false);
  const inaccessible={get length(){throw Error('SecurityError');}};
  assert.equal(decide(inaccessible).status,'unreadable');
});
for(const key of audit.mains.slice(1))test(`${key} alone is protected, never auto-copied or settled`,()=>{
  const s=storage({[key]:raw({coins:123.45,habits:[{id:'old'}]})});
  const before=[...s.data];for(let i=0;i<3;i++)assert.equal(decide(s).canRead,false);
  assert.deepEqual([...s.data],before);assert.deepEqual(s.writes,[]);
});
test('Empty v3 does not hide populated v2, v1, source, conflict or before-import snapshots',()=>{
  for(const key of ['minimal-discipline-v2','minimal-discipline-v1','minimal-discipline-v3-legacy-source','minimal-discipline-v3-legacy-conflict-1','minimal-discipline-v3-before-import','backup','unknown-valid-original']){
    const s=storage({[audit.canonical]:raw(),[key]:raw({coins:3.79,history:[{id:'keep'}]})});
    assert.equal(decide(s).status,'empty-shadowed');assert.deepEqual(s.writes,[]);
  }
});
test('All-zero balances do not imply empty journals, goals or funded rewards',()=>{
  for(const extra of [{dailyReviews:{'2026-11-15':{best:'private'}}},{longTermGoals:[{id:'g'}]},{notes:[{id:'old-note'}]},{habitCompletions:{'2026-11-15':{h:true}}},{rewards:[{id:'reward-fund-1',currentCoins:42}]}]){
    assert.equal(audit.summarize(raw(extra)).meaningful,true);
  }
});
test('Malformed, partial, array and null roots are never treated as new users',()=>{
  for(const value of ['{broken','{}','null','[]',JSON.stringify({coins:999,habits:{old:'retain'}})]){
    const s=storage({[audit.canonical]:value});assert.equal(decide(s).status,'damaged-current');
    assert.equal(s.getItem(audit.canonical),value);assert.deepEqual(s.writes,[]);
  }
});
test('Old coin scale versions require review, never rerun coin multiplication',()=>{
  const s=storage({[audit.canonical]:raw({coins:19.79,pastCoinHistoryScaleMigrationVersion:undefined})});
  assert.equal(decide(s).status,'migration-review');assert.deepEqual(s.writes,[]);
});
test('Known unchanged legacy source can coexist, independent legacy changes block editing',()=>{
  const old=raw({coins:10}),current=raw({coins:60});
  const s=storage({[audit.canonical]:current,'minimal-discipline-v2':old,[audit.canonical+'-legacy-source']:old});
  assert.equal(decide(s).status,'current-readable');
  s.data.set('minimal-discipline-v2',raw({coins:11}));assert.equal(decide(s).status,'version-conflict');
  assert.equal(s.getItem(audit.canonical),current);
});
test('A read error or data changing during capture produces an incomplete snapshot',()=>{
  const s=storage({[audit.canonical]:raw()});s.getItem=()=>{throw Error('read denied');};
  assert.equal(decide(s).status,'unreadable');
  const changing=storage({[audit.canonical]:raw()});let n=0;
  changing.getItem=()=>raw({coins:n++});assert.equal(decide(changing).status,'unreadable');
  assert.equal(decide({length:2,key:()=>null,getItem:()=>null}).status,'unreadable');
});
test('Explicit approved copy is byte-preserving, repeatable and never replaces an existing v3',()=>{
  const source=raw({coins:33.79,history:[{coins:-50.01,id:'settled'}]});
  const s=storage({'minimal-discipline-v2':source}),plan=audit.planMigration(s,'minimal-discipline-v2');
  assert.deepEqual(s.writes,[]);
  assert.throws(()=>audit.commitVerifiedMigration(s,plan,{}));
  const approval={backupConfirmed:true,userApproved:true,assertLock(){}};
  assert.equal(audit.commitVerifiedMigration(s,plan,approval).status,'copied-without-transformation');
  assert.equal(audit.commitVerifiedMigration(s,plan,approval).status,'already-installed');
  assert.equal(s.getItem(audit.canonical),source);assert.equal(s.getItem('minimal-discipline-v2'),source);
  const conflict=storage({'minimal-discipline-v2':source,[audit.canonical]:raw()});
  assert.throws(()=>audit.commitVerifiedMigration(conflict,audit.planMigration(conflict,'minimal-discipline-v2'),approval),/禁止覆盖/);
});
test('Interrupted explicit copy can resume; source changes, lock loss and full storage stop safely',()=>{
  const source=raw({coins:1.79}),s=storage({'minimal-discipline-v1':source});
  const plan=audit.planMigration(s,'minimal-discipline-v1'),approval={backupConfirmed:true,userApproved:true,assertLock(){}};
  const set=s.setItem;s.setItem=(k,v)=>{if(k===audit.canonical)throw Error('QuotaExceededError');set.call(s,k,v);};
  assert.throws(()=>audit.commitVerifiedMigration(s,plan,approval),/Quota/);
  assert.equal(s.getItem(audit.canonical),null);assert.equal(s.getItem('minimal-discipline-v1'),source);
  s.setItem=set;audit.commitVerifiedMigration(s,plan,approval);assert.equal(s.getItem(audit.canonical),source);
  s.data.set('minimal-discipline-v1',raw({coins:2}));assert.throws(()=>audit.commitVerifiedMigration(s,plan,approval),/源数据已变化/);
  assert.throws(()=>audit.commitVerifiedMigration(s,plan,{...approval,assertLock(){throw Error('lost lock');}}),/lost lock/);
});
const exporter=execFileSync(process.execPath,[path.join(__dirname,'../scripts/iphone-raw-export.cjs')],{encoding:'utf8'});
test('Phone raw exporter only reads, keeps every exact string and does not log private contents',()=>{
  const s=storage({[audit.canonical]:'{broken','minimal-discipline-v2':raw({coins:129.79}),
    'minimal-discipline-v1-legacy-conflict-1':'raw private original','unknown-backup':'not json'});
  s.setItem=()=>{throw Error('No writes permitted');};let copied;const logs=[];
  const context={TextEncoder,localStorage:s,sessionStorage:storage(),navigator:{standalone:true,userAgent:'iPhone'},
    matchMedia:()=>({matches:true}),location:{origin:'https://life-os-zeta-amber.vercel.app',pathname:'/'},
    copy:text=>copied=text,console:{table:rows=>logs.push(JSON.stringify(rows)),info:text=>logs.push(text)}};
  const result=vm.runInNewContext(exporter,context);assert.equal(result.complete,true);assert.equal(result.clipboardCopied,true);
  const backup=JSON.parse(copied);assert.equal(backup.userDataVerified,false);
  assert.deepEqual(backup.localStorage.entries.map(e=>[e.key,e.raw]),[...s.data].sort(([a],[b])=>a.localeCompare(b)));
  assert.equal(logs.join('').includes('raw private original'),false);assert.deepEqual(s.writes,[]);
  const verify=text=>spawnSync(process.execPath,[path.join(__dirname,'../scripts/verify-raw-recovery.cjs'),'-'],{input:text,encoding:'utf8'});
  const checked=verify(copied);assert.equal(checked.status,0);assert.equal(checked.stdout.includes('raw private original'),false);
  assert.match(checked.stdout,/fileSHA256/);
  backup.localStorage.entries[0].raw+='tampered';assert.equal(verify(JSON.stringify(backup)).status,1);
  backup.localStorage.entries[0].raw=s.getItem(backup.localStorage.entries[0].key);
  backup.sessionStorage.complete=false;assert.equal(verify(JSON.stringify(backup)).status,1);
});
test('Phone exporter refuses a Mac browser or non-standalone Safari container',()=>{
  for(const navigator of [{standalone:false,userAgent:'iPhone'},{standalone:true,userAgent:'Macintosh'}]){
    assert.throws(()=>vm.runInNewContext(exporter,{TextEncoder,navigator,matchMedia:()=>({matches:false})}),/不是 iPhone/);
  }
});
test('Exporter still captures error metadata when the storage property itself is inaccessible',()=>{
  let copied;const context={TextEncoder,navigator:{standalone:true,userAgent:'iPhone'},
    matchMedia:()=>({matches:true}),location:{origin:'https://example.test',pathname:'/'},
    sessionStorage:storage(),copy:text=>copied=text,console:{table(){},info(){}}};
  Object.defineProperty(context,'localStorage',{get(){throw Error('SecurityError');}});
  const result=vm.runInNewContext(exporter,context);assert.equal(result.complete,false);
  assert.match(JSON.parse(copied).localStorage.errors[0].operation,/^(access|list)$/);
});
