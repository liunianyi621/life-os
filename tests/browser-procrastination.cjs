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
 browser=await (process.env.LIFEOS_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.LIFEOS_BROWSER==='webkit'?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH,...(process.env.LIFEOS_TEST_PROXY?{proxy:{server:process.env.LIFEOS_TEST_PROXY,bypass:'127.0.0.1,localhost'}}:{})});
 for(const [width,height] of [[390,844],[393,852],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>typeof LifeOSPersistence==='undefined'||LifeOSPersistence.writable);
 await page.evaluate(()=>{state=cloneEmptyState();state.coins=123.45;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();});
 await page.evaluate(()=>{saveHabit({name:'专注测试',coins:5});startFocusSession('habit',state.habits[0].id);render();});
 const focusBefore=await page.evaluate(()=>JSON.stringify(state.currentFocus));
 await page.locator('[data-record-marker]').tap();
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 assert.match(await page.locator('.marker-record-label').innerText(),/已记录/);
 await page.waitForTimeout(300);await page.locator('.marker-copy').tap();
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 await page.waitForTimeout(800);assert.equal(await page.locator('.marker-record-label').innerText(),'记一次');
 await page.waitForTimeout(1000);await page.locator('[data-record-marker]').tap();
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),2);
 await page.locator('[data-undo-marker]').tap();
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 assert.equal(await page.evaluate(()=>JSON.stringify(state.currentFocus)),focusBefore);
 await page.reload(); await page.waitForFunction(()=>typeof LifeOSPersistence==='undefined'||LifeOSPersistence.writable);assert.match(await page.locator('#procrastinationToolbar').innerText(),/今日觉察 1 次/);
 assert.deepEqual(await page.locator('#todayModeBar button').evaluateAll(nodes=>nodes.map(n=>n.dataset.selectDayMode)),['vacation','normal','sprint']);
 assert.equal(await page.locator('.marker-hand svg').getAttribute('data-lucide'),'hand');
 const geometry=await page.evaluate(()=>{const a=document.getElementById('currentFocusTask').getBoundingClientRect(),b=document.getElementById('procrastinationToolbar').getBoundingClientRect(),c=document.querySelector('.today-daily-task-section').getBoundingClientRect();return {a:a.bottom,b:b.top,end:b.bottom,c:c.top,width:b.width,focusWidth:a.width};});
 assert.ok(geometry.b>=geometry.a&&geometry.end<=geometry.c);assert.equal(geometry.width,geometry.focusWidth);
 const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});await page.waitForTimeout(250);await page.screenshot({path:path.join(evidence,'awareness-'+width+'.png'),fullPage:true});
 await page.locator('[data-nav="stats"]').tap();await page.waitForTimeout(300);
 assert.equal(await page.locator('[data-marker-day]').count(),28);
 const today=await page.evaluate(()=>dateKey());
 await page.locator('[data-marker-day="'+today+'"]').tap();
 assert.match(await page.locator('#markerDayDetail').innerText(),/1 次/);
 assert.match(await page.locator('.marker-summary').innerText(),/最近 7 天 1 次/);
 const out=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(out,{recursive:true});
 await page.screenshot({path:path.join(out,'marker-'+width+'.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.evaluate(()=>state.coins),123.45);
 assert.equal(await page.evaluate(()=>state.history.length),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,record:true,undo:true,reload:true,grid:28,coinsUnchanged:true}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
