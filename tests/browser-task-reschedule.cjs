const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..');
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if (!file.startsWith(root+'/')) return res.writeHead(403).end();
  fs.readFile(file,(error,data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)]||'application/json');
    res.end(data);
  });
});
(async () => {
  let browser;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
    for (const [width,height] of [[375,667],[390,844],[430,932]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-09-10T15:53:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(() => {
        state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
        state.tasks=[{id:'move-me',name:'发抖音/ig',source:'MANUAL',reward:5,coins:5,status:'pending',
          date:dateKey(),createdDate:dateKey(),createdAt:new Date().toISOString(),timeStart:'16:00',timeEnd:'17:00',time:'16:00'}];
        state.habits=Array.from({length:8},(_,i)=>({id:'h'+i,name:'习惯'+i,createdDate:dateKey()}));
        saveState();render();
        window.dragMovePrevented=false;
      });
      const times=()=>page.locator('[data-task-timeline-slot] > time').allTextContents();
      assert.deepEqual(await times(),['16:00','17:00','18:00']);
      assert.equal(await page.locator('.task-hour-slot').count(),3);
      const taskCard=page.locator('[data-reschedule-task="move-me"]');
      await taskCard.locator('h3').click();
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),true,'short tap still edits');
      await page.evaluate(()=>closeSheet());
      await page.locator('.task-timeline-section__slots').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
      await page.waitForTimeout(250);
      const cdp=await context.newCDPSession(page);
      const from=await taskCard.locator('h3').boundingBox();
      const touch=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
      await page.evaluate(()=>{window.beforeMove=JSON.stringify(state);window.sourceNode=document.querySelector('[data-reschedule-task="move-me"]');});
      await touch('touchStart',[{x:from.x+15,y:from.y+10}]);
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(()=>activeHabitDrag?.sourceType),'TASK');
      assert.equal(await page.evaluate(()=>window.sourceNode.isConnected),true);
      await page.evaluate(()=>document.addEventListener('touchmove',event=>{window.dragMovePrevented=event.defaultPrevented;},{capture:true,passive:false,once:true}));
      const before=await page.evaluate(()=>({scroll:scrollY,preview:document.querySelector('.habit-drag-preview').style.transform}));
      await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerType:'touch',bubbles:true})));
      assert.equal(await page.evaluate(()=>activeHabitDrag.phase),'dragging');
      const target=await page.locator('[data-task-timeline-slot]').nth(2).boundingBox();
      await touch('touchMove',[{x:target.x+30,y:target.y+target.height/2}]);
      const after=await page.evaluate(()=>({scroll:scrollY,preview:document.querySelector('.habit-drag-preview').style.transform}));
      assert.equal(after.scroll,before.scroll);
      assert.notEqual(after.preview,before.preview);
      assert.equal(await page.evaluate(()=>window.dragMovePrevented),true);
      assert.equal(await page.evaluate(()=>document.getSelection().toString()),'');
      assert.equal(await taskCard.evaluate(el=>getComputedStyle(el).webkitUserSelect),'none');
      await touch('touchEnd');
      await page.waitForTimeout(300);
      const result=await page.evaluate(()=>{
        const before=JSON.parse(window.beforeMove),after=JSON.parse(JSON.stringify(state));
        for(const key of ['date','scheduledStart','scheduledEnd','timeStart','timeEnd','time']) {delete before.tasks[0][key];delete after.tasks[0][key];}
        return {unchanged:JSON.stringify(before)===JSON.stringify(after),time:state.tasks[0].timeStart,preview:document.querySelectorAll('.habit-drag-preview').length,lock:document.documentElement.style.overflow};
      });
      assert.deepEqual(result,{unchanged:true,time:'18:00',preview:0,lock:''});
      assert.deepEqual(await times(),['17:00','18:00','19:00']);
      await page.reload();
      assert.equal(await page.evaluate(()=>state.tasks[0].timeStart),'18:00');
      await taskCard.locator('h3').scrollIntoViewIfNeeded();
      const cancelFrom=await taskCard.locator('h3').boundingBox();
      await touch('touchStart',[{x:cancelFrom.x+15,y:cancelFrom.y+10}]);
      await page.waitForTimeout(450);
      await touch('touchCancel');
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.habit-drag-preview').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
      assert.equal(await page.evaluate(()=>state.tasks.length),1);
      await taskCard.locator('h3').scrollIntoViewIfNeeded();
      const outsideFrom=await taskCard.locator('h3').boundingBox();
      const unchanged=await page.evaluate(()=>JSON.stringify(state));
      await touch('touchStart',[{x:outsideFrom.x+15,y:outsideFrom.y+10}]);
      await page.waitForTimeout(450);
      await touch('touchMove',[{x:5,y:5}]);
      await touch('touchEnd');
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(()=>JSON.stringify(state)),unchanged);
      assert.equal(await page.locator('.habit-drag-preview').count(),0);
      const imageDir=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(imageDir,{recursive:true});
      await page.screenshot({path:path.join(imageDir,`reschedule-${width}.png`),fullPage:true});
      await page.locator('[data-complete-task="move-me"]').click();
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(()=>state.coins),5);
      assert.equal(await page.locator('.habit-drag-preview').count(),0);
      await page.locator('[data-contextual-undo]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>state.coins),0);
      assert.equal(await page.locator('[data-fail-task]').count(),0);
      await page.locator('[data-complete-task="move-me"]').click();
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(()=>state.coins),5);
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({width,before,after,result,buttonsWork:true,errors}));
      await context.close();
    }
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
