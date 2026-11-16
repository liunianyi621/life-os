const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if (!file.startsWith(root+'/')) return res.writeHead(403).end();
  fs.readFile(file,(error,data) => {
    if(error) return res.writeHead(404).end();
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)]||'application/json');
    res.end(data);
  });
});

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await (process.env.LIFEOS_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.LIFEOS_BROWSER==='webkit'?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH});
 for(const [width,height] of [[390,844],[393,852],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>typeof LifeOSPersistence==='undefined'||LifeOSPersistence.writable);
 await page.waitForFunction(()=>LifeOSPersistence.writable);
 await page.evaluate(()=>{state=cloneEmptyState();state.coins=1000;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();saveState();});
 const goal=await page.evaluate(()=>saveGoal({name:'并发目标',deadline:shiftDateKey(dateKey(),2),kind:'completion',reward:500,penalty:'休息',milestones:[]}));
 await page.evaluate(id=>settleGoal(id),goal);
 const other=await context.newPage();other.setDefaultTimeout(15000);await other.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await other.waitForSelector('#storageOwnerNotice:not([hidden])');
 assert.equal(await other.evaluate(()=>LifeOSPersistence.writable),false);
 await other.getByRole('button',{name:'在此窗口继续',exact:true}).click();await other.waitForFunction(()=>LifeOSPersistence.writable);
 assert.equal(await page.evaluate(()=>LifeOSPersistence.writable),false);
 assert.equal(await other.evaluate(()=>state.coins),1500);
 await other.evaluate(()=>recordProcrastination());
 assert.equal(await page.evaluate(()=>{try{state.coins=1;saveState();return false;}catch{return true;}}),true);
 await other.reload();await other.waitForFunction(()=>LifeOSPersistence.writable);
 assert.equal(await other.evaluate(()=>state.coins),1500);
 assert.equal(await other.evaluate(()=>procrastinationEvents().length),1);
 assert.equal(await other.evaluate(()=>state.longTermGoals.length),1);
 assert.equal(await other.evaluate(()=>state.history.filter(e=>e.type==='goal_reward').length),1);
 const saved=await other.evaluate(()=>JSON.stringify(state));
 if(process.env.LIFEOS_BROWSER==='webkit'){
   // Reverse activation of an existing background page hangs in this desktop WebKit driver.
   // Chromium below covers reverse handoff and first-upgrade byte preservation.
   assert.deepEqual(errors,[]);console.log(JSON.stringify({width,exclusiveWriter:true,handoff:true,legacyIsolated:true,reload:true,rewardOnce:true,reverseHandoff:'Chromium only'}));
   await context.close();continue;
 }
 // Headless desktop WebKit cannot reliably activate the previous page after closing its front page.
 if(process.env.LIFEOS_BROWSER==='webkit')await page.evaluate(()=>document.querySelector('#storageOwnerNotice button').click());
 else await page.getByRole('button',{name:'在此窗口继续',exact:true}).click();
 await page.waitForFunction(()=>LifeOSPersistence.writable);
 await page.evaluate(()=>{const id=saveDailyTask({name:'另一个窗口的行动'});completeDailyTask(id);});
 assert.equal(await page.evaluate(()=>state.coins),1550);
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 // Independently written old data must block further saves, not be merged or copied.
 const beforeConflict=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
 await other.evaluate(()=>localStorage.setItem('minimal-discipline-v2',JSON.stringify({coins:1060,history:[]})));
 await page.waitForFunction(()=>!LifeOSPersistence.writable);
 assert.equal(await page.evaluate(()=>{try{saveState();return false;}catch{return true;}}),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),beforeConflict);
 assert.equal(await page.evaluate(()=>LifeOSPersistence.conflicts().length),0);
 await page.reload();await page.waitForSelector('#storageOwnerNotice:not([hidden])');
 assert.equal(await page.evaluate(()=>LifeOSPersistence.status),'version-conflict');
 assert.equal(await page.locator('.app').isVisible(),false);
 await other.close();
 const url=process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`;
 const seeds=width===390?[{name:'minimal-discipline-v1',value:saved}]:[{name:'minimal-discipline-v1',value:JSON.stringify({coins:99999})},{name:'minimal-discipline-v2',value:saved}];
 const upgradeContext=await browser.newContext({storageState:{cookies:[],origins:[{origin:new URL(url).origin,localStorage:seeds}]}});
 const upgrade=await upgradeContext.newPage();upgrade.setDefaultTimeout(15000);await upgrade.goto(url);await upgrade.waitForSelector('#storageOwnerNotice:not([hidden])');
 assert.equal(await upgrade.evaluate(()=>LifeOSPersistence.writable),false);
 assert.equal(await upgrade.evaluate(()=>localStorage.getItem(LifeOSPersistence.key)),null);
 assert.equal(await upgrade.evaluate(()=>localStorage.getItem(LifeOSPersistence.key+'-legacy-source')),null);
 for(const seed of seeds)assert.equal(await upgrade.evaluate(k=>localStorage.getItem(k),seed.name),seed.value);
 await upgradeContext.close();assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,exclusiveWriter:true,handoff:true,legacyIsolated:true,reload:true,rewardOnce:true}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
