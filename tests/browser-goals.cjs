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
 await page.waitForFunction(()=>typeof LifeOSPersistence==='undefined'||LifeOSPersistence.writable);
 await page.locator('[data-nav="goals"]').tap();await page.waitForTimeout(300);
 await page.locator('[data-open-goal]').tap();
 await page.locator('#sheetForm [name=name]').fill('长期创作目标');
 await page.locator('#sheetForm [name=deadline]').fill('2027-12-31');
 await page.locator('#sheetForm [name=penalty]').fill('一周不刷视频');
 await page.locator('#sheetForm button[type=submit]').tap();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('[data-goal-detail]').count(),1);
 await page.locator('[data-goal-detail]').tap();
 await page.locator('[data-goal-action]').tap();
 await page.locator('[name=goalActionName]').fill('完成一个具体行动');
 await page.locator('#sheetForm button[type=submit]').tap();
 await page.waitForTimeout(200);
 await page.locator('[data-nav=today]').tap();
 assert.equal(await page.locator('[data-daily-task-row]').count(),1);
 await page.locator('[data-nav=goals]').tap();
 await page.locator('[data-goal-detail]').tap();
 await page.locator('[data-goal-settle]').tap();await page.locator('#confirmAcceptBtn').tap();
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>state.longTermGoals[0].status),'achieved');
 assert.equal(await page.evaluate(()=>state.history.filter(e=>e.type==='goal_reward').length),1);
 await page.locator('#sheetForm button[type=submit]').tap();
 await page.locator('[data-nav=stats]').tap();await page.locator('[data-open-funds]').tap();
 assert.equal(await page.locator('[data-view=rewards]').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,goals:true,linkedAction:true,reward:true,funds:true}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
