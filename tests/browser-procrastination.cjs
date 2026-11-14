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
 await page.evaluate(()=>{state=cloneEmptyState();state.coins=123.45;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();});
 await page.locator('[data-record-marker]').tap();
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 await page.waitForTimeout(300);await page.locator('[data-record-marker]').tap();
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),2);
 await page.locator('[data-undo-marker]').tap();
 assert.equal(await page.evaluate(()=>procrastinationEvents().length),1);
 await page.reload();assert.match(await page.locator('#procrastinationToolbar').innerText(),/今日 1 次/);
 await page.locator('[data-nav="stats"]').tap();await page.waitForTimeout(300);
 assert.equal(await page.locator('[data-marker-day]').count(),28);
 const today=await page.evaluate(()=>dateKey());
 await page.locator('[data-marker-day="'+today+'"]').tap();
 assert.match(await page.locator('#markerDayDetail').innerText(),/1 次/);
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
