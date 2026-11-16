const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../outputs/life-rpg');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+'/'))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
});
const canonical='minimal-discipline-v3';
const raw=extra=>JSON.stringify({coins:0,tasks:[],habits:[],memos:[],history:[],rewards:[],dailyReviews:{},pastCoinHistoryScaleMigrationVersion:1,...extra});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const engine=process.env.LIFEOS_BROWSER==='webkit'?webkit:chromium;
  browser=await engine.launch({executablePath:process.env.LIFEOS_BROWSER==='webkit'?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH});
  const url='http://127.0.0.1:'+server.address().port;
  const rich=raw({coins:129.79,habits:[{id:'old',name:'保留习惯'}],history:[{id:'private-event',coins:129.79}]});
  const cases=[
    ['v1',{'minimal-discipline-v1':rich}],['v2',{'minimal-discipline-v2':rich}],
    ['shadow',{[canonical]:raw({}),'minimal-discipline-v2':rich}],
    ['partial',{[canonical]:'{}','minimal-discipline-v1':rich}],
    ['broken',{[canonical]:'{broken'}],['backup-only',{[canonical+'-before-import']:rich}],
    ['scale-not-confirmed',{[canonical]:raw({coins:12,pastCoinHistoryScaleMigrationVersion:undefined})}],
    ['conflict',{[canonical]:rich,'minimal-discipline-v2':raw({coins:77})}]
  ];
  for(const [width,height] of [[390,844],[393,852],[430,932]]){
   for(const [name,seed] of cases){
    const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,
      storageState:{cookies:[],origins:[{origin:url,localStorage:Object.entries(seed).map(([name,value])=>({name,value}))}]}});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForSelector('#storageOwnerNotice:not([hidden])');
    assert.equal(await page.evaluate(()=>LifeOSPersistence.writable),false,name);
    assert.equal(await page.locator('.app').isVisible(),false,name);
    await page.evaluate(()=>{
      runAutomaticChecks({initializeDailyHabits:true});window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('pagehide'));
    });
    assert.equal(await page.evaluate(()=>{try{saveState();return false;}catch{return true;}}),true,name);
    assert.equal(await page.evaluate(()=>{try{createLifeOSBackup();return false;}catch{return true;}}),true,name);
    const after=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
    assert.deepEqual(after,seed,name);assert.deepEqual(errors,[],name);
    await page.reload();await page.waitForSelector('#storageOwnerNotice:not([hidden])');
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))),seed);
    await context.close();
   }
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
   const page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>LifeOSPersistence.writable);
   await page.evaluate(()=>{
     state.calendarEvents=[{id:'archived',title:'历史原件',startDate:'2026-09-01',endDate:'2026-09-02',custom:'retain'}];saveState();
     const original=localStorage.getItem(STORAGE_KEY),first=loadState(),second=loadState();
     if(localStorage.getItem(STORAGE_KEY)!==original)throw Error('Read unexpectedly wrote storage');
     if(JSON.stringify(first.calendarEvents)!==JSON.stringify(second.calendarEvents)
       ||first.calendarEvents[0].createdAt!==undefined||first.calendarEvents[0].custom!=='retain')throw Error('Read changed archived event');
   });
   await page.evaluate(()=>{state.coins=123.79;saveState();window.dispatchEvent(new Event('pagehide'));});
   await page.waitForFunction(()=>!LifeOSPersistence.writable);
   await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.waitForFunction(()=>LifeOSPersistence.writable);
   assert.equal(await page.evaluate(()=>state.coins),123.79);
   await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);
   assert.equal(await page.evaluate(()=>state.coins),123.79);
   // Same-window/raw writes do not generate a storage event; the write guard still detects them.
   await page.evaluate(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,coins:999.79})));
   assert.equal(await page.evaluate(()=>{try{saveState();return false;}catch{return true;}}),true);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).coins),999.79);
   await context.close();console.log(JSON.stringify({width,protectedCases:cases.length,firstInstall:true,resume:true,reload:true,staleSaveBlocked:true}));
  }
  // A browser storage read exception must never lead to first-install persistence.
  const context=await browser.newContext(),page=await context.newPage();
  await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('SecurityError fixture');};Storage.prototype.setItem=function(){throw Error('Unexpected write fixture');};});
  await page.goto(url);await page.waitForSelector('#storageOwnerNotice:not([hidden])');
  assert.equal(await page.evaluate(()=>LifeOSPersistence.writable),false);
  assert.equal(await page.locator('.app').isVisible(),false);await context.close();
  for(const kind of ['unavailable','reject']){
   const lockedContext=await browser.newContext(),p=await lockedContext.newPage();
   await p.addInitScript(kind=>Object.defineProperty(navigator,'locks',{value:kind==='unavailable'?undefined:{request:()=>Promise.reject(Error('Lock fixture'))}}),kind);
   await p.goto(url);await p.waitForFunction(()=>LifeOSPersistence.status==='protected');
   const text=await p.locator('#storageOwnerNotice').innerText();
   assert.match(text,kind==='unavailable'?/不支持安全保存/:/无法取得安全编辑权/);
   assert.equal(await p.evaluate(()=>localStorage.length),0);await lockedContext.close();
  }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
