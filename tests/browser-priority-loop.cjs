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
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(()=>{state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();});
 const ids=await page.evaluate(()=>Array.from({length:10},(_,i)=>saveDailyTask({name:'重点 '+i,reward:10})));
 assert.equal(await page.locator('[data-complete-daily-task]').count(),10);
 assert.equal(await page.locator('#priorityTaskCard').count(),0);
 await page.locator('[data-complete-daily-task]').nth(0).click();await page.waitForTimeout(250);
 await page.locator('[data-complete-daily-task]').nth(0).click();await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>state.coins),100);
 await page.locator('#toast [data-contextual-undo]').click();
 assert.equal(await page.evaluate(()=>state.coins),50);
 assert.equal(await page.locator('#dailyTaskProgress').innerText(),'1 / 10');
 await page.locator('[data-nav="review"]').click();
 assert.equal(await page.locator('[data-completion-ref]').count(),1);
 assert.equal(await page.locator('#reviewBest,#reviewMistake').count(),0);
 for(const text of ['明天 A','明天 B','明天 C','明天 D']){
  await page.locator('[data-add-review-plan]').click();
  await page.locator('[data-review-priority]').last().fill(text);
 }
 await page.locator('[data-plan-move="-1"]').last().click();
 await page.locator('#reviewDailyScore').fill('7');
 await page.locator('#dailyReviewForm button[type="submit"]').click();
 await page.locator('#dailyReviewForm button[type="submit"]').click();
 assert.equal(await page.evaluate(()=>state.dailyTasks.filter(t=>t.localDateKey===shiftDateKey(dateKey(),1)).length),4);
 assert.equal(await page.evaluate(()=>state.dailyTasks.filter(t=>t.localDateKey===shiftDateKey(dateKey(),1)).map(t=>t.name).join()),'明天 A,明天 B,明天 D,明天 C');
 await page.reload();await page.locator('[data-nav="review"]').click();
 assert.equal(await page.locator('[data-completion-ref]').count(),1);
 assert.equal(await page.locator('[data-review-priority]').count(),4);
 assert.equal(await page.locator('#reviewDailyScore').inputValue(),'7');
 assert.equal(await page.evaluate(()=>state.coins),50);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
 await page.screenshot({path:path.join(evidence,`unified-loop-${width}.png`),fullPage:true});
 await page.evaluate(()=>Object.defineProperty(visualViewport,'height',{configurable:true,value:320}));
 await page.locator('[data-review-priority]').nth(2).focus();
 await page.evaluate(()=>{syncSheetViewport();ensureFocusedFormFieldVisible();});
 await page.waitForTimeout(500);
 const keyboard=await page.evaluate(()=>{
  const input=document.querySelectorAll('[data-review-priority]')[2].getBoundingClientRect();
  const body=document.querySelector('.review-keyboard-form__body').getBoundingClientRect();
  const save=document.querySelector('#dailyReviewForm button[type="submit"]').getBoundingClientRect();
  return {top:input.top,bottom:input.bottom,bodyTop:body.top,bodyBottom:body.bottom,saveBottom:save.bottom};
 });
 assert.ok(keyboard.top>=keyboard.bodyTop && keyboard.bottom<=keyboard.bodyBottom && keyboard.saveBottom<=320,JSON.stringify(keyboard));
 await page.evaluate(()=>{document.activeElement.blur();delete visualViewport.height;syncSheetViewport();});
 console.log(JSON.stringify({width,priority:true,undo:true,unlimited:true,reviewNextDay:true,score:true}));await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
