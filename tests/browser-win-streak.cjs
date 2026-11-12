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
 try {
 browser=await (process.env.LIFEOS_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.LIFEOS_BROWSER==='webkit'?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH});
 for(const [width,height] of [[390,844],[393,852],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(()=>{
 state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
 state.habits=['必胜习惯','额外一','额外二'].map((name,i)=>({id:'h'+i,name,createdDate:dateKey(),reward:5}));
 runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();
 });
 assert.equal(await page.locator('#winToday').isVisible(),true);
 await page.locator('[data-win-choose]').click();
 await page.locator('[data-win-id="h0"]').click();
 await page.evaluate(()=>{completeHabit('h0');completeHabit('h1');completeHabit('h2');render();});
 assert.equal(await page.evaluate(()=>winSummary().wins),1);
 assert.equal(await page.evaluate(()=>state.coins),15);
 await page.locator('#toast [data-contextual-undo]').click();
 assert.equal(await page.evaluate(()=>winSummary().wins),0);
 await page.evaluate(()=>{completeHabit('h2');render();});
 await page.locator('[data-nav="rewards"]').click();
 assert.equal(await page.locator('#winRecords').isVisible(),true);
 assert.equal(await page.locator('[data-view="rewards"] > header').isVisible(),false);
 await page.locator('[data-win-funds]').click();
 assert.equal(await page.locator('#rewardList').isVisible(),true);
 await page.locator('[data-win-back]').click();
 await page.locator('[data-win-rest]').click();
 await page.locator('[data-nav="stats"]').click();await page.locator('[data-open-settings]').click();
 await page.locator('[data-win-toggle]').uncheck();
 assert.equal(await page.locator('[data-nav="rewards"]').innerText(),'奖励');
 await page.locator('[data-nav="today"]').click();
 assert.equal(await page.locator('#winToday').isVisible(),false);
 assert.equal(await page.locator('#currentFocusTask').isVisible(),true);
 await page.locator('[data-nav="rewards"]').click();
 assert.equal(await page.locator('#rewardList').isVisible(),true);
 await page.reload();assert.equal(await page.evaluate(()=>winEnabled()),false);
 await page.evaluate(()=>{setWinEnabled(true);render();});
 assert.equal(await page.evaluate(()=>winSummary().wins),1);
 assert.equal(await page.evaluate(()=>state.coins),15);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.waitForTimeout(250);
 const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
 await page.screenshot({path:path.join(evidence,`win-streak-${width}.png`),fullPage:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,flag:true,undo:true,funds:true,coinsUnchanged:true}));await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
