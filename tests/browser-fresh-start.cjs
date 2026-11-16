const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../outputs/life-rpg');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+'/'))return res.writeHead(403).end();
 fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);});
});
const stateRaw=extra=>JSON.stringify({coins:0,tasks:[],habits:[],memos:[],history:[],rewards:[],dailyReviews:{},pastCoinHistoryScaleMigrationVersion:1,...extra});
const original=stateRaw({coins:1234.79,habits:[{id:'original',name:'保留的旧习惯'}],dailyReviews:{'2026-10-01':{best:'保留的旧复盘'}}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await (process.env.LIFEOS_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.LIFEOS_BROWSER==='webkit'?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH,
    ...(process.env.LIFEOS_TEST_PROXY?{proxy:{server:process.env.LIFEOS_TEST_PROXY,bypass:'127.0.0.1,localhost'}}:{})});
  const url=process.env.LIFEOS_TEST_URL||'http://127.0.0.1:'+server.address().port,origin=new URL(url).origin;
  const seeds=[
   {'minimal-discipline-v1':original},
   {'minimal-discipline-v2':original,'minimal-discipline-v3':stateRaw({})},
   {'minimal-discipline-v3':'{damaged','minimal-discipline-v3-before-import':original},
   {'minimal-discipline-v3':original,'minimal-discipline-v2':stateRaw({coins:888})},
   {'lifeos-active-profile-v1':'{bad selection','minimal-discipline-v1':original}
  ];
  for(const [width,height] of [[390,844],[393,852],[430,932]]){
   for(const [index,seed] of seeds.entries()){
    const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,
     storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(seed).map(([name,value])=>({name,value}))}]}});
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.getByRole('button',{name:'开始全新使用',exact:true}).click();
    await page.getByRole('button',{name:'取消',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))),seed);
    await page.getByRole('button',{name:'开始全新使用',exact:true}).click();
    await page.getByRole('button',{name:'确认开始',exact:true}).click();
    await page.waitForFunction(()=>typeof LifeOSPersistence!=='undefined'&&LifeOSPersistence.writable&&LifeOSPersistence.isolated);
    const key=await page.evaluate(()=>STORAGE_KEY);assert.match(key,/^lifeos-profile-v1-/);
    for(const [oldKey,raw] of Object.entries(seed)){
     if(oldKey==='lifeos-active-profile-v1'){
      assert.equal(await page.evaluate(raw=>Object.keys(localStorage).some(k=>k.startsWith('lifeos-active-profile-v1-before-')&&localStorage.getItem(k)===raw),raw),true);
     }else assert.equal(await page.evaluate(k=>localStorage.getItem(k),oldKey),raw);
    }
    assert.deepEqual(await page.evaluate(()=>({coins:state.coins,tasks:state.dailyTasks.length,habits:state.habits.length,memos:state.memos.length,reviews:Object.keys(state.dailyReviews).length,history:state.history.length,goals:state.longTermGoals.length})),
     {coins:0,tasks:0,habits:0,memos:0,reviews:0,history:0,goals:0});
    assert.equal(await page.locator('#currentFocusTask').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(index===0){
     await page.locator('[data-open-daily-task]').first().tap();
     await page.locator('#sheetForm input[name="name"]').fill('全新重点');
     await page.getByRole('button',{name:'保存任务',exact:true}).tap();
     const task=await page.evaluate(()=>state.dailyTasks.find(t=>t.name==='全新重点').id);
     await page.locator('[data-complete-daily-task="'+task+'"]').tap();
     assert.equal(await page.evaluate(()=>state.coins),50);
     await page.locator('#toast [data-contextual-undo]').tap();assert.equal(await page.evaluate(()=>state.coins),0);
     await page.evaluate(id=>{completeDailyTask(id);completeDailyTask(id);},task);assert.equal(await page.evaluate(()=>state.coins),50);
     await page.evaluate(()=>{saveHabit({name:'新习惯',coins:5});completeHabit(state.habits[0].id);completeHabit(state.habits[0].id);
      saveDailyReview({dailyScore:7,priority:''});saveMemoText('新的提醒');recordProcrastination();render();});
     await page.evaluate(()=>saveGoal({name:'新的长期目标',deadline:shiftDateKey(dateKey(),10),kind:'completion',reward:123.45,penalty:'休息',milestones:[]}));
     await page.evaluate(()=>{const id=saveDailyTask({name:'专注中的新重点'});startFocusSession('dailyTask',id);render();});
     assert.equal(await page.evaluate(()=>state.coins),55);
     const backup=await page.evaluate(()=>createLifeOSBackup());assert.equal(backup.data.coins,55);
     await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);
     assert.equal(await page.evaluate(()=>STORAGE_KEY),key);
     assert.deepEqual(await page.evaluate(()=>({coins:state.coins,habits:state.habits.length,reviews:state.dailyReviews[dateKey()].dailyScore,memos:state.memos.length,goals:state.longTermGoals.length,markers:procrastinationEvents().length,focus:state.currentFocus?.sourceType})),
      {coins:55,habits:1,reviews:7,memos:1,goals:1,markers:1,focus:'dailyTask'});
     const beforeEnd=await page.evaluate(()=>state.coins);await page.evaluate(()=>endHabitFocus());assert.equal(await page.evaluate(()=>state.coins),beforeEnd);
     await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pageshow'));});
     await page.waitForFunction(()=>LifeOSPersistence.writable);
     // A different old page can still write its old key without touching this profile.
     const old=await context.newPage();await old.goto(origin+'/icon.svg');
     await old.evaluate(()=>localStorage.setItem('minimal-discipline-v2','{independent old write'));
     await old.close();await page.bringToFront();await page.waitForFunction(()=>LifeOSPersistence.writable);
     await page.evaluate(()=>{state.coins+=0.79;saveState();});assert.equal(await page.evaluate(()=>state.coins),55.79);
     await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);assert.equal(await page.evaluate(()=>state.coins),55.79);
     // A reopened PWA uses only persisted selection/data, not a memory-only flag.
     const persisted=await context.storageState();await page.close();
     const reopened=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,storageState:persisted});
     const p=await reopened.newPage();await p.goto(url);await p.waitForFunction(()=>LifeOSPersistence.writable);
     assert.equal(await p.evaluate(()=>STORAGE_KEY),key);assert.equal(await p.evaluate(()=>state.coins),55.79);
     const evidence=path.join(root,'test-evidence');fs.mkdirSync(evidence,{recursive:true});await p.waitForTimeout(300);await p.screenshot({path:path.join(evidence,'fresh-start-'+width+'.png')});
     const sibling=await reopened.newPage();await sibling.goto(url);
     if(!await sibling.evaluate(()=>LifeOSPersistence.writable))await sibling.getByRole('button',{name:'在此窗口继续',exact:true}).click();
     await sibling.waitForFunction(()=>LifeOSPersistence.writable);
     await p.waitForFunction(()=>!LifeOSPersistence.writable);
     await sibling.evaluate(async()=>{const id=state.longTermGoals[0].id;await settleGoal(id);await settleGoal(id);});
     assert.equal(await sibling.evaluate(()=>state.coins),179.24);
     assert.equal(await p.evaluate(()=>{try{saveState();return false;}catch{return true;}}),true);
     assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).coins),179.24);
     await sibling.close();await p.bringToFront();await p.waitForFunction(()=>LifeOSPersistence.writable);
     assert.equal(await p.evaluate(()=>state.coins),179.24);
     assert.equal(await p.evaluate(()=>state.history.filter(e=>e.type==='goal_reward').length),1);
     await p.evaluate(()=>resetAllData());assert.equal(await p.evaluate(()=>state.coins),0);
     assert.equal(await p.evaluate(()=>localStorage.getItem('minimal-discipline-v1')),seed['minimal-discipline-v1']);
     await reopened.close();
    }else{
     await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);assert.equal(await page.evaluate(()=>STORAGE_KEY),key);
     assert.equal(await page.getByRole('button',{name:'开始全新使用',exact:true}).count(),0);
    }
    assert.deepEqual(errors,[]);await context.close();
   }
   console.log(JSON.stringify({width,freshCases:seeds.length,confirmation:true,legacyPreserved:true,isolatedWrites:true,reopen:true,coinsUndo:true,features:true}));
  }
  const failed=await browser.newContext({storageState:{cookies:[],origins:[{origin,localStorage:[{name:'minimal-discipline-v2',value:original}]}]}}),p=await failed.newPage();
  await p.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('lifeos-profile-v1-'))throw Error('Quota fixture');return set.call(this,k,v);};});
  await p.goto(url);await p.getByRole('button',{name:'开始全新使用',exact:true}).click();await p.getByRole('button',{name:'确认开始',exact:true}).click();
  await p.getByText('Quota fixture',{exact:false}).waitFor();
  assert.equal(await p.evaluate(()=>localStorage.getItem('lifeos-active-profile-v1')),null);assert.equal(await p.evaluate(()=>localStorage.getItem('minimal-discipline-v2')),original);await failed.close();
  // A held native lock without a responsive editor is not proof of another active editor.
  const locked=await browser.newContext(),holder=await locked.newPage();await holder.goto(origin+'/icon.svg');
  await holder.evaluate(()=>{navigator.locks.request('lifeos-editor-v3',()=>new Promise(resolve=>{globalThis.testLockHeld=true;globalThis.releaseTestLock=resolve;}));});
  await holder.waitForFunction(()=>globalThis.testLockHeld);
  const waiting=await locked.newPage();await waiting.goto(url);
  await waiting.waitForFunction(()=>document.getElementById('storageOwnerNotice')?.innerText.includes('等待浏览器释放'));
  assert.doesNotMatch(await waiting.locator('#storageOwnerNotice').innerText(),/另一窗口正在编辑/);
  await holder.close();await waiting.bringToFront();await waiting.waitForFunction(()=>LifeOSPersistence.writable);
  assert.equal(await waiting.evaluate(()=>state.coins),0);await locked.close();
  console.log('Unresponsive editor is not mislabelled; browser releases abandoned native lock: PASS');
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
