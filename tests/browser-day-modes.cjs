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
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>typeof LifeOSPersistence==='undefined'||LifeOSPersistence.writable);

 await page.clock.install({time:new Date('2026-11-16T10:00:00+08:00')});await page.clock.pauseAt(new Date('2026-11-16T10:00:00+08:00'));
 await page.addStyleTag({content:'*{animation:none!important;transition:none!important;scroll-behavior:auto!important}'});
 await page.evaluate(()=>{state=cloneEmptyState();state.coins=1000;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();state.habits=[{id:'n',name:'普通习惯',coins:5,createdDate:dateKey()}];runAutomaticChecks({initializeDailyHabits:true,showToast:false});state.dailyTasks.push(unifiedPriorityTask('休假预先计划','2026-11-17'));saveState();render();});
 await page.locator('[data-open-day-mode]').tap();await page.locator('[data-schedule-mode]').tap();
 await page.locator('[name=from]').fill('2026-11-17');await page.locator('[name=to]').fill('2026-11-18');await page.locator('#sheetForm button[type=submit]').tap();
 await page.locator('[data-open-day-mode]').tap();await page.locator('[data-select-day-mode=sprint]').tap();
 await page.locator('[data-new-sprint]').tap();await page.locator('#sheetForm [name=name]').fill('一个冲刺行动');await page.locator('[name=start]').fill('10:00');await page.locator('[name=end]').fill('11:00');await page.locator('#sheetForm button[type=submit]').tap();
 assert.equal(await page.locator('.sprint-row').count(),1);
 await page.locator('[data-open-day-mode]').tap();await page.locator('[data-select-day-mode=normal]').tap();
 assert.equal(await page.evaluate(()=>dayMode()),'sprint');await page.locator('#closeSheetBtn').tap();
 const out=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(out,{recursive:true});
 await page.screenshot({path:path.join(out,'sprint-mode-'+width+'.png'),fullPage:true});
 await page.clock.fastForward(60*60*1000);
 assert.equal(await page.evaluate(()=>state.coins),800);
 await page.locator('[data-open-day-mode]').tap();await page.locator('[data-select-day-mode=normal]').tap();
 await page.locator('[data-contextual-undo]').tap();await page.evaluate(()=>runAutomaticChecks());
 assert.equal(await page.evaluate(()=>state.coins),1000);
 assert.equal(await page.locator('#sprintSection').isVisible(),true);
 assert.match(await page.locator('#sprintSection h2').innerText(),/待处理/);
 await page.locator('.sprint-row [data-complete-daily-task]').tap();
 assert.equal(await page.evaluate(()=>state.coins),1050);
 await page.locator('[data-open-day-mode]').tap();await page.locator('[data-select-day-mode=normal]').tap();
 await page.clock.setFixedTime(new Date('2026-11-17T10:00:00+08:00'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>dayMode()),'vacation');
 for(const selector of ['#currentFocusTask','#procrastinationToolbar','.today-daily-task-section','#sprintSection','.home-memo-section'])assert.equal(await page.locator(selector).isVisible(),false,selector);
 assert.equal(await page.locator('[data-habit-row=n]').count(),0);
 await page.locator('[data-open-habit]').tap();await page.locator('#sheetForm [name=name]').fill('休假积累');await page.locator('#sheetForm [name=coins]').fill('10');await page.locator('#sheetForm button[type=submit]').tap();
 assert.equal(await page.evaluate(()=>state.habits.at(-1).modeScope),'vacation');
 await page.locator('[data-complete-habit]').tap();await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>state.coins),1010);
 await page.screenshot({path:path.join(out,'vacation-mode-'+width+'.png'),fullPage:true});
 await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);
 assert.equal(await page.evaluate(()=>dayMode()),'vacation');
 assert.equal(await page.locator('[data-complete-habit]').count(),0);
 await page.clock.setFixedTime(new Date('2026-11-19T10:00:00+08:00'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>dayMode()),'normal');
 assert.equal(await page.evaluate(()=>state.coins),910);
 assert.equal(await page.locator('[data-habit-row=n]').count(),1);
 assert.equal(await page.evaluate(()=>state.dailyTasks.find(t=>t.name==='休假预先计划').status),'pending');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,sprint:true,timeoutUndo:true,vacation:true,scope:true,crossDay:true,history:true}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
