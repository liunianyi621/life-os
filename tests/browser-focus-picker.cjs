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
 const useWebkit=process.env.LIFEOS_BROWSER==='webkit';
 browser=await (useWebkit?webkit:chromium).launch({executablePath:useWebkit?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH});
 for(const [width,height] of [[390,844],[393,852],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 for(const [tasks,habits] of [[2,3],[0,2],[2,0],[0,0],[35,35]]){
 await page.evaluate(({tasks,habits})=>{
 state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
 state.habits=Array.from({length:habits},(_,i)=>({id:'h'+i,name:i===0?'保持运动 / Exercise 每日可验证行动长名称测试':'习惯 '+i,coins:5,createdDate:dateKey()}));
 runAutomaticChecks({initializeDailyHabits:true,showToast:false});
 for(let i=0;i<tasks;i++)saveDailyTask({name:'今日任务 Task '+i,reward:10});render();
 },{tasks,habits});
 const before=await page.evaluate(()=>JSON.stringify({coins:state.coins,history:state.history}));
 await page.locator('[data-open-focus-picker]').tap();await page.waitForTimeout(250);
 assert.equal(await page.locator('#sheetBackdrop').getAttribute('data-sheet-kind'),'focus-picker');
 assert.equal(await page.locator('[data-pick-focus][data-focus-source="dailyTask"]').count(),tasks);
 assert.equal(await page.locator('[data-pick-focus][data-focus-source="habit"]').count(),habits);
 assert.equal(await page.locator('.focus-picker-group').count(),2);
 assert.equal(await page.locator('.focus-picker-intro > span:last-child').innerText(),await page.evaluate(()=>FOCUS_DURATION_MS/60000+' 分钟'));
 assert.equal(await page.evaluate(()=>document.body.classList.contains('modal-open')),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(tasks===2 && habits===3){
 const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
 await page.screenshot({path:path.join(evidence,`focus-picker-${useWebkit?'webkit':'chrome'}-${width}.png`)});
 }
 if(tasks===35){
 const initial=await page.locator('#sheetBackdrop .sheet-header').boundingBox();
 const body=page.locator('#sheetForm');
 assert.equal(await body.evaluate(el=>el.scrollHeight>el.clientHeight),true);
 if(!useWebkit){
 const box=await body.boundingBox(),cdp=await context.newCDPSession(page);
 await cdp.send('Input.synthesizeScrollGesture',{x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2),yDistance:-400,gestureSourceType:'touch'});
 assert.ok(await body.evaluate(el=>el.scrollTop)>0);await cdp.detach();
 }
 await body.evaluate(el=>el.scrollTop=el.scrollHeight);
 const last=page.locator('[data-pick-focus]').last(),box=await last.boundingBox();
 const form=await body.boundingBox();
 assert.ok(box.y+box.height<=form.y+form.height+1);
 assert.deepEqual(await page.locator('#sheetBackdrop .sheet-header').boundingBox(),initial);
 await last.tap();
 assert.equal(await page.evaluate(()=>state.currentFocus.sourceId),'h34');
 }else if(tasks||habits){
 const first=page.locator('[data-pick-focus]').first();
 const box=await first.boundingBox();assert.ok(box.height>=44);
 await first.tap();
 assert.equal(await page.evaluate(()=>Boolean(state.currentFocus)),true);
 }else{
 assert.equal(await page.locator('#sheetForm [data-open-daily-task]').isVisible(),true);
 await page.locator('#closeSheetBtn').tap();
 }
 assert.equal(await page.evaluate(()=>JSON.stringify({coins:state.coins,history:state.history})),before);
 assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('modal-open')),false);
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,groups:true,selection:true,scroll:true,ledgerUnchanged:true}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
