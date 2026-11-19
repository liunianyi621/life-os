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
 for(const [width,height] of [[375,812],[390,844],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>typeof LifeOSPersistence==='undefined'||LifeOSPersistence.writable);
 await page.evaluate(()=>{state=cloneEmptyState();state.coins=123.45;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();});
 await page.evaluate(()=>{saveHabit({name:'专注测试',coins:5});startFocusSession('habit',state.habits[0].id);render();});
 const focusBefore=await page.evaluate(()=>JSON.stringify(state.currentFocus));
 assert.equal(await page.locator('#procrastinationToolbar,[data-record-marker],.marker-float-button,[data-marker-avoid]').count(),0);
 await page.evaluate(()=>recordProcrastination());
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 await page.waitForTimeout(300);await page.evaluate(()=>recordProcrastination());
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 await page.waitForTimeout(1900);await page.evaluate(()=>recordProcrastination());
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),2);
 await page.evaluate(()=>revokeProcrastination(procrastinationEvents().at(-1).id));
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 assert.equal(await page.evaluate(()=>JSON.stringify(state.currentFocus)),focusBefore);
 await page.reload(); await page.waitForFunction(()=>typeof LifeOSPersistence==='undefined'||LifeOSPersistence.writable);assert.equal(await page.evaluate(()=>procrastinationEvents(dateKey()).length),1);
 assert.deepEqual(await page.locator('#todayModeBar button').evaluateAll(nodes=>nodes.map(n=>n.dataset.selectDayMode)),['vacation','normal','sprint']);
 await page.waitForTimeout(100);assert.equal(await page.locator('#homeCoins').innerText(),'123');
 const geometry=await page.evaluate(()=>{const h=document.querySelector('.home-header h1').getBoundingClientRect(),d=document.getElementById('todayDate').getBoundingClientRect();return {sameLine:d.top<h.bottom&&d.bottom>h.top};});
 assert.ok(geometry.sameLine);
 await page.evaluate(()=>{for(let i=0;i<10;i++)saveHabit({name:'需要保留完整名称的每日习惯 '+i,coins:5});saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(0,24);render();});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>document.querySelector('.home-memo-section').compareDocumentPosition(document.getElementById('sprintSection'))&Node.DOCUMENT_POSITION_FOLLOWING),4);
 await page.evaluate(()=>window.scrollTo(0,700));await page.waitForTimeout(150);
 const columns=await page.evaluate(()=>{const a=document.getElementById('sprintSection').getBoundingClientRect(),b=document.querySelector('.today-habit-section').getBoundingClientRect();return {left:a.right,right:b.left,top:a.top===b.top};});assert.ok(columns.top&&columns.right-columns.left>=8);
 assert.equal(await page.locator('[data-sprint-hour]').count(),24);
 await page.locator('[data-sprint-hour="23"]').fill('编辑中不应失焦');await page.evaluate(()=>render());assert.equal(await page.locator('[data-sprint-hour="23"]').evaluate(n=>n===document.activeElement),true);await page.locator('[data-sprint-hour="23"]').fill('');await page.locator('[data-sprint-hour="23"]').press('Enter');
 assert.equal(await page.locator('#habitList [data-complete-habit]').count(),11);
 const hitAreas=await page.locator('#habitList [data-complete-habit],#habitList [data-habit-handle]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=innerWidth;}));assert.ok(hitAreas.every(Boolean));
 assert.equal(await page.locator('#habitList .daily-habit-reward').first().isVisible(),false);
 const scrollPanes=await page.locator('#todayExecutionColumns').evaluate(n=>[n,...n.querySelectorAll('section,.daily-habit-list')].filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)).length);assert.equal(scrollPanes,0);
 await page.locator('[data-sprint-hour="23"]').scrollIntoViewIfNeeded();await page.locator('[data-sprint-hour="23"]').fill('需要编辑的完整长任务名称 Long hourly task');await page.locator('[data-sprint-hour="23"]').press('Enter');assert.equal(await page.locator('[data-sprint-hour="23"]').inputValue(),'需要编辑的完整长任务名称 Long hourly task');
 await page.evaluate(()=>{state.coins=123456789012345.67;updatePrimaryReadouts();window.scrollTo(0,0);});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.evaluate(()=>document.getElementById('todayDate').getBoundingClientRect().right<=document.querySelector('.home-coin-balance').getBoundingClientRect().left),true);
 await page.evaluate(()=>{state.coins=123.45;updatePrimaryReadouts();openSprintRangeSheet();});await page.waitForTimeout(50);assert.equal(await page.locator('[data-record-marker]').count(),0);await page.locator('#closeSheetBtn').tap();
 const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});await page.waitForTimeout(250);await page.screenshot({path:path.join(evidence,'awareness-'+width+'.png'),fullPage:true});
 await page.locator('[data-nav="stats"]').tap();await page.waitForTimeout(300);
 assert.equal(await page.locator('[data-record-marker]').count(),0);
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
