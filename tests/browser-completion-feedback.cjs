const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
  if(!file.startsWith(root+'/'))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
    for(const [width,height] of [[390,844],[393,852],[430,932]]){
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.clock.install({time:new Date('2026-09-12T10:30:00Z')});
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.addStyleTag({content:'* { animation: none !important; transition: none !important; }'});
      for(const source of ['MANUAL','HABIT','MEMO']){
        const id=await page.evaluate(source=>{
          UndoController.clear();state=cloneEmptyState();state.coins=100;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
          state.habits=[{id:'h',name:'看书',createdDate:dateKey()}];state.memos=[{id:'m',text:'存照片',createdAt:new Date().toISOString()}];
          if(source==='HABIT')scheduleHabitAsTask('h');
          else if(source==='MEMO')scheduleMemoAsTask('m');
          else saveTask({name:'普通任务',coins:20,timeStart:'12:00',timeEnd:'13:00',date:dateKey()});
          UndoController.clear();pendingUndo=null;render();return state.tasks[0].id;
        },source);
        await page.clock.runFor(500);
        const before=await page.evaluate(()=>({coins:state.coins,history:state.history.length,scheduled:state.tasks[0].scheduledStart,top:document.querySelector('#todayTaskList').getBoundingClientRect().top}));
        await page.locator(`[data-complete-task="${id}"]`).click();
        await page.clock.runFor(250);
        assert.equal(await page.locator(`[data-task-card="${id}"]`).count(),0);
        assert.equal(await page.locator('.task-contextual-undo-row').count(),0);
        assert.equal(await page.locator('.task-hour-slot.is-empty').count(),3);
        assert.equal(await page.locator('#toast button').count(),1);
        assert.equal((await page.locator('#toast').innerText()).replace(/\s/g,''),'已完成撤回');
        const layout=await page.evaluate(()=>({top:document.querySelector('#todayTaskList').getBoundingClientRect().top,host:getComputedStyle(els.toast).pointerEvents,cap:getComputedStyle(els.toast.firstChild).pointerEvents,hit:document.elementFromPoint(5,20)===els.toast}));
        assert.equal(layout.top,before.top);assert.equal(layout.host,'none');assert.equal(layout.cap,'auto');assert.equal(layout.hit,false);
        await page.locator('#toast [data-contextual-undo]').click();await page.clock.runFor(250);
        assert.equal(await page.locator(`[data-task-card="${id}"]`).count(),1);
        const after=await page.evaluate(()=>({coins:state.coins,history:state.history.length,scheduled:state.tasks[0].scheduledStart,memo:state.memos.length,completed:habitCompletedToday('h')}));
        assert.equal(after.coins,before.coins);assert.equal(after.history,before.history);assert.equal(after.scheduled,before.scheduled);
        assert.equal(after.memo,1);assert.equal(after.completed,false);
        await page.locator(`[data-complete-task="${id}"]`).click();await page.clock.runFor(3800);
        assert.equal(await page.evaluate(()=>pendingUndo),null);assert.equal(await page.locator('#toast').innerText(),'');
      }
      await page.evaluate(()=>{saveTask({name:'连续一',coins:5,timeStart:'12:00',timeEnd:'13:00',date:dateKey()});saveTask({name:'连续二',coins:5,timeStart:'12:00',timeEnd:'13:00',date:dateKey()});render();});
      await page.locator('[data-complete-task]').first().click();await page.clock.runFor(50);
      await page.locator('[data-complete-task]').first().click();await page.clock.runFor(50);
      assert.equal(await page.locator('.contextual-undo-capsule').count(),1);
      assert.equal(await page.locator('.task-contextual-undo-row').count(),0);
      const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
      await page.screenshot({path:path.join(evidence,`completion-${width}.png`)});
      await page.locator('#toast button').click();await page.clock.runFor(50);
      assert.equal(await page.locator('[data-complete-task]').count(),1);
      await page.clock.runFor(3000);
      await page.locator('[data-nav="stats"]').click();await page.clock.runFor(300);
      const gear=page.locator('[data-open-settings]'),rect=await gear.boundingBox();assert.ok(rect.width>=44&&rect.height>=44);
      assert.equal(await gear.evaluate(el=>getComputedStyle(el).boxShadow),'none');
      await page.screenshot({path:path.join(evidence,`settings-gear-${width}.png`)});
      await gear.click();assert.equal(await page.locator('[data-view="settings"]').isVisible(),true);
      assert.deepEqual(errors,[]);console.log(JSON.stringify({width,completionUndoSources:3,expiry:true,emptySlots:true,gear:true}));await context.close();
    }
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
