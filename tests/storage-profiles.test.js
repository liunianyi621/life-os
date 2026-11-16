const test=require('node:test'),assert=require('node:assert/strict');
const profiles=require('../js/storage-profiles.js');
const id='11111111-1111-4111-8111-111111111111';
const seed=()=>({coins:0,tasks:[],dailyTasks:[],habits:[],memos:[],history:[],rewards:[],achievements:[],longTermGoals:[],dailyReviews:{},pastCoinHistoryScaleMigrationVersion:1});
function storage(values={}){const map=new Map(Object.entries(values));return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};}
function create(s,extra={}){return profiles.create(s,{id,seed:seed(),expectedSelection:null,createdAt:'2026-11-16T08:00:00.000Z',assertLock(){},...extra});}
test('No selection retains legacy routing, corrupt selection never silently falls back',()=>{
 assert.equal(profiles.selection(storage()).isolated,false);
 for(const raw of ['{broken',JSON.stringify({version:1,key:'minimal-discipline-v2'})])assert.ok(profiles.selection(storage({[profiles.selector]:raw})).error);
});
test('Explicit fresh creation keeps every legacy key and snapshot byte for byte',()=>{
 const legacy={'minimal-discipline-v1':'original private data','minimal-discipline-v2':'{broken','minimal-discipline-v3':'{}','minimal-discipline-v3-legacy-source':'backup'};
 const s=storage(legacy),result=create(s),choice=profiles.selection(s);
 assert.equal(choice.isolated,true);assert.equal(choice.key,result.key);assert.equal(JSON.parse(result.raw).coins,0);
 for(const [key,raw] of Object.entries(legacy))assert.equal(s.getItem(key),raw);
 s.setItem('minimal-discipline-v2','new independent old write');assert.equal(profiles.inspect(s,choice).canRead,true);
});
test('Selection persists and cannot be repointed to a legacy key',()=>{
 const s=storage();create(s);const copy=storage(Object.fromEntries(s.map));
 assert.equal(profiles.inspect(copy,profiles.selection(copy)).status,'profile-readable');
 assert.equal(profiles.validKey('minimal-discipline-v3'),false);
});
test('An isolated profile remains readable even when an obsolete key throws on read',()=>{
 const s=storage();create(s);const selected=profiles.selection(s),read=s.getItem;
 s.getItem=k=>{if(k==='minimal-discipline-v2')throw Error('obsolete read fixture');return read(k);};
 assert.equal(profiles.inspect(s,selected).canRead,true);
});
test('Concurrent fresh requests never replace the first selected profile',()=>{
 const s=storage();const result=create(s),before=[...s.map];
 assert.throws(()=>create(s,{id:'22222222-2222-4222-8222-222222222222'}),/已经切换/);
 assert.deepEqual([...s.map],before);assert.equal(profiles.selection(s).key,result.key);
});
test('Pointer write failure retains old selection and raw sources; retry uses a new empty namespace',()=>{
 const s=storage({'minimal-discipline-v1':'raw'}),set=s.setItem;
 s.setItem=(k,v)=>{if(k===profiles.selector)throw Error('QuotaExceededError');set(k,v);};
 assert.throws(()=>create(s),/Quota/);assert.equal(s.getItem(profiles.selector),null);
 assert.equal(s.getItem('minimal-discipline-v1'),'raw');assert.ok(s.getItem(profiles.prefix+id));
 s.setItem=set;const result=create(s,{id:'22222222-2222-4222-8222-222222222222'});
 assert.equal(profiles.selection(s).key,result.key);assert.ok(s.getItem(profiles.prefix+id));
});
test('Replacing a damaged selected profile preserves both its data and the old pointer',()=>{
 const s=storage();const first=create(s);s.setItem(first.key,'{damaged');const oldPointer=s.getItem(profiles.selector);
 const nextId='22222222-2222-4222-8222-222222222222';create(s,{id:nextId,expectedSelection:oldPointer});
 assert.equal(s.getItem(first.key),'{damaged');assert.equal(s.getItem(profiles.selector+'-before-'+nextId),oldPointer);
});
test('Missing or damaged selected data remains protected, never returns a default state',()=>{
 const s=storage();const first=create(s),selection=profiles.selection(s);
 s.setItem(first.key,'{broken');assert.equal(profiles.inspect(s,selection).canRead,false);
 s.map.delete(first.key);assert.equal(profiles.inspect(s,selection).canRead,false);
});
test('Creation requires a lock assertion, a zero state, a current scale marker and a unique key',()=>{
 assert.throws(()=>create(storage(),{assertLock:null}));
 assert.throws(()=>create(storage(),{assertLock(){throw Error('lock lost');}}),/lock lost/);
 assert.throws(()=>create(storage(),{seed:{...seed(),coins:50}}),/从零/);
 assert.throws(()=>create(storage(),{seed:{...seed(),pastCoinHistoryScaleMigrationVersion:0}}),/结构/);
 const s=storage({[profiles.prefix+id]:'retain'});assert.throws(()=>create(s),/冲突/);assert.equal(s.getItem(profiles.prefix+id),'retain');
});
