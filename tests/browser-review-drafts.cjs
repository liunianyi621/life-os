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
 await page.evaluate(()=>{state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();saveState();render();});
 await page.locator('[data-nav="review"]').click();
 await page.locator('#reviewBest').fill('上午完成第一件');
 await page.locator('[data-nav="today"]').click();
 await page.reload();await page.locator('[data-nav="review"]').click();
 assert.equal(await page.locator('#reviewBest').inputValue(),'上午完成第一件');
 await page.locator('#dailyReviewForm [name="best1"]').fill('下午第二件');
 await page.waitForTimeout(700);await page.reload();await page.locator('[data-nav="review"]').click();
 assert.equal(await page.locator('[name="best1"]').inputValue(),'下午第二件');
 assert.equal(await page.evaluate(()=>Object.keys(state.dailyReviews).length),0);
 assert.equal(await page.evaluate(()=>Object.keys(state.priorityTaskByDate).length),0);
 assert.equal(await page.evaluate(()=>state.coins),0);
 const yesterday=await page.evaluate(()=>yesterdayKey());
 await page.locator('#reviewDateInput').fill(yesterday);await page.locator('#reviewDateInput').dispatchEvent('change');
 assert.equal(await page.locator('#reviewBest').inputValue(),'');
 const today=await page.evaluate(()=>dateKey());
 await page.locator('#reviewDateInput').fill(today);await page.locator('#reviewDateInput').dispatchEvent('change');
 assert.equal(await page.locator('#reviewBest').inputValue(),'上午完成第一件');
 await page.locator('[name="best1"]').fill('');
 await page.locator('#reviewPriority').fill('次日唯一重点');
 for(const value of [1,10,7]) await page.locator('#reviewDailyScore').fill(String(value));
 await page.locator('#dailyReviewForm button[type="submit"]').click();
 const saved=await page.evaluate(()=>state.dailyReviews[dateKey()]);
 assert.deepEqual(saved.bestItems,['上午完成第一件','','']);assert.equal(saved.dailyScore,7);
 assert.equal(await page.evaluate(()=>state.priorityPlans[shiftDateKey(dateKey(),1)].items[0].title),'次日唯一重点');
 await page.evaluate(()=>{state.dailyReviews[yesterdayKey()]={best:'旧长文本。不可拆句\n保留第二段',mistake:'',priority:'',dailyScore:null};saveState();renderDailyReview();});
 await page.locator(`[data-review-card="${yesterday}"]`).click();
 const scoreBox=await page.locator('#editReviewDailyScore').boundingBox();
 assert.ok(scoreBox.width>=44 && scoreBox.height>=44);
 await page.locator('#sheetForm button[type="submit"]').click();
 assert.deepEqual(await page.evaluate(()=>state.dailyReviews[yesterdayKey()].bestItems),['旧长文本。不可拆句\n保留第二段','','']);
 assert.equal(await page.evaluate(()=>state.dailyReviews[yesterdayKey()].dailyScore),null);
 await page.evaluate(()=>{window.scrollTo(0,0);});await page.waitForTimeout(250);
 const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
 await page.screenshot({path:path.join(evidence,`review-three-${width}.png`)});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,drafts:true,dateIsolation:true,legacyText:true,score:true,priority:true,coins:0}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
