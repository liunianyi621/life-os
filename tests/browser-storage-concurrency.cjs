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
 await other.locator('#storageOwnerNotice button').click();await other.waitForFunction(()=>LifeOSPersistence.writable);
 assert.equal(await page.evaluate(()=>LifeOSPersistence.writable),false);
 assert.equal(await other.evaluate(()=>state.coins),1500);
 await other.evaluate(()=>recordProcrastination());
 assert.equal(await page.evaluate(()=>{try{state.coins=1;saveState();return false;}catch{return true;}}),true);
 await page.evaluate(()=>localStorage.setItem('minimal-discipline-v1',JSON.stringify({coins:1050,history:[]})));
 await other.waitForTimeout(200);
 assert.equal(await other.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).coins),1500);
 assert.equal(await other.evaluate(()=>LifeOSPersistence.conflicts().length>0),true);
 await other.reload();await other.waitForFunction(()=>LifeOSPersistence.writable);
 assert.equal(await other.evaluate(()=>state.coins),1500);
 assert.equal(await other.evaluate(()=>procrastinationEvents().length),1);
 assert.equal(await other.evaluate(()=>state.longTermGoals.length),1);
 assert.equal(await other.evaluate(()=>state.history.filter(e=>e.type==='goal_reward').length),1);
 assert.equal(await other.evaluate(()=>createLifeOSBackup().legacyConflictCopies.length>0),true);
 const saved=await other.evaluate(()=>JSON.stringify(state));
 if(process.env.LIFEOS_BROWSER==='webkit'){
   // Reverse activation of an existing background page hangs in this desktop WebKit driver.
   // Chromium below covers reverse handoff and first-upgrade byte preservation.
   assert.deepEqual(errors,[]);console.log(JSON.stringify({width,exclusiveWriter:true,handoff:true,legacyIsolated:true,reload:true,rewardOnce:true,reverseHandoff:'Chromium only'}));
   await context.close();continue;
 }
 // Headless desktop WebKit cannot reliably activate the previous page after closing its front page.
 if(process.env.LIFEOS_BROWSER==='webkit')await page.evaluate(()=>document.querySelector('#storageOwnerNotice button').click());
 else await page.locator('#storageOwnerNotice button').click();
 await page.waitForFunction(()=>LifeOSPersistence.writable);
 await page.evaluate(()=>{const id=saveDailyTask({name:'另一个窗口的行动'});completeDailyTask(id);});
 assert.equal(await page.evaluate(()=>state.coins),1550);
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 await other.close();
 const url=process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`;
 const upgradeContext=await browser.newContext({storageState:{cookies:[],origins:[{origin:new URL(url).origin,localStorage:[{name:'minimal-discipline-v1',value:saved}]}]}});
 const upgrade=await upgradeContext.newPage();upgrade.setDefaultTimeout(15000);await upgrade.goto(url);await upgrade.waitForFunction(()=>LifeOSPersistence.writable);
 assert.equal(await upgrade.evaluate(()=>state.coins),1500);
 assert.equal(await upgrade.evaluate(()=>state.longTermGoals.length),1);
 assert.equal(await upgrade.evaluate(()=>state.history.filter(e=>e.type==='goal_reward').length),1);
 assert.equal(await upgrade.evaluate(()=>localStorage.getItem('minimal-discipline-v2-legacy-source')),saved);
 await upgradeContext.close();assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,exclusiveWriter:true,handoff:true,legacyIsolated:true,reload:true,rewardOnce:true}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
