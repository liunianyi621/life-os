const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
module.exports=async function run(scenario){
  const root=path.resolve(__dirname,'../..');
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+'/'))return res.writeHead(403).end();
    try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    const safari = process.env.LIFEOS_BROWSER === 'webkit';
    browser=await (safari ? webkit : chromium).launch({executablePath:safari ? process.env.WEBKIT_PATH : process.env.CHROMIUM_PATH});
    for(const [width,height] of [[390,844],[393,852],[430,932]]){
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.clock.install({time:new Date('2026-10-12T10:00:00+01:00')});
      await page.goto(process.env.LIFEOS_TEST_URL || 'http://127.0.0.1:'+server.address().port);
      await page.addStyleTag({content:'* {animation:none !important;transition:none !important}'});
      await page.evaluate(()=>{
        state=cloneEmptyState();state.coins=1000;state.fixedRewardRulesSince='2026-08-01';state.settledThroughDate='2026-08-01';
        state.habits=[{id:'a',name:'一个外部可验证行动',coins:10},{id:'b',name:'运动',coins:5},{id:'c',name:'每日复盘',coins:20}];
        state.memos=[{id:'m',text:'旅行装 / 手机防水壳'}];
        state.priorityTaskByDate[dateKey()]={title:'今天最重要的交付',status:'pending'};
        runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();
      });
      assert.equal(await page.locator('[data-task-timeline-slot], [data-habit-card], [data-open-task]').count(),0);
      assert.equal(await page.locator('[data-habit-row]').count(),3);
      assert.equal(await page.locator('#habitProgress').innerText(),'0 / 3');
      if(scenario==='overview'){
        const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
          priority:document.querySelector('#priorityTaskCard').getBoundingClientRect().bottom,
          habits:document.querySelector('#habitList').getBoundingClientRect().top,
          memo:document.querySelector('.home-memo-section').getBoundingClientRect().top,
          nav:document.querySelector('[data-nav="today"]').getBoundingClientRect().top}));
        assert.equal(layout.overflow,false);assert.ok(layout.priority<layout.habits&&layout.habits<layout.memo);
        for(const control of await page.locator('.habit-complete-control,.habit-order-handle').all()){
          const r=await control.boundingBox();assert.ok(r.width>=44&&r.height>=44);
        }
        const out=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(out,{recursive:true});
        await page.screenshot({path:path.join(out,'daily-habits-'+width+'.png'),fullPage:true});
      }
      if(scenario==='completion'){
        const top=await page.locator('#habitList').evaluate(el=>el.getBoundingClientRect().top);
        await page.locator('[data-complete-habit="a"]').tap();
        assert.equal(await page.evaluate(()=>state.coins),1010);
        await page.clock.runFor(220);
        assert.equal(await page.locator('[data-habit-row="a"]').count(),0);
        assert.equal(await page.locator('#habitProgress').innerText(),'1 / 3');
        assert.equal(await page.locator('#habitList').evaluate(el=>el.getBoundingClientRect().top),top);
        const capsule=await page.locator('.contextual-undo-capsule').boundingBox();
        const balance=await page.locator('.view.active .home-coin-balance').boundingBox();
        assert.ok(capsule.x+capsule.width<=balance.x || capsule.x>=balance.x+balance.width || capsule.y+capsule.height<=balance.y || capsule.y>=balance.y+balance.height,'Undo must not overlap balance: '+JSON.stringify({capsule,balance}));
        await page.evaluate(()=>completeHabit('a'));assert.equal(await page.evaluate(()=>state.coins),1010);
        await page.locator('[data-contextual-undo]').tap();
        assert.equal(await page.evaluate(()=>state.coins),1000);
        assert.equal(await page.locator('[data-habit-row]').evaluateAll(rows=>rows.map(r=>r.dataset.habitRow).join(',')),'a,b,c');
        assert.equal(await page.locator('#habitProgress').innerText(),'0 / 3');
        await page.locator('[data-complete-habit="a"]').tap();await page.clock.runFor(50);
        await page.locator('[data-contextual-undo]').tap();await page.clock.runFor(220);
        assert.equal(await page.locator('[data-habit-row="a"]').count(),1);
        assert.equal(await page.evaluate(()=>state.coins),1000);
        await page.locator('[data-complete-habit="a"]').tap();await page.clock.runFor(3800);
        assert.equal(await page.locator('[data-contextual-undo]').count(),0);
        await page.locator('[data-toggle-memo="m"]').tap();await page.clock.runFor(200);
        assert.equal(await page.evaluate(()=>state.coins),1010);
        assert.equal(await page.locator('[data-complete-priority]').count(),1);
        assert.equal(await page.locator('[data-fail-priority]').count(),1);
        await page.reload();assert.equal(await page.locator('[data-habit-row="a"]').count(),0);
        await page.addStyleTag({content:'* {animation:none !important;transition:none !important}'});
        assert.equal(await page.locator('#habitProgress').innerText(),'1 / 3');
        const saved=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
        await page.clock.runFor(10000);
        assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),saved);
        await page.locator('[data-nav="stats"]').tap();
        const gear=await page.locator('[data-open-settings]').boundingBox();assert.ok(gear.width>=44&&gear.height>=44);
        await page.locator('[data-nav="today"]').tap();
        await page.locator('[data-complete-habit="b"]').tap();await page.clock.runFor(220);
        await page.locator('[data-complete-habit="c"]').tap();await page.clock.runFor(220);
        assert.equal(await page.locator('#habitProgress').innerText(),'3 / 3');
        assert.equal(await page.locator('[data-habit-row]').count(),0);
        assert.equal(await page.locator('#habitList').innerText(),'今日习惯已全部完成 ✓');
        await page.evaluate(()=>{
          Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+01:00'));
        await page.evaluate(()=>{
          Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
          document.dispatchEvent(new Event('visibilitychange'));
        });
        assert.equal(await page.locator('#habitProgress').innerText(),'0 / 3');
        assert.equal(await page.locator('[data-habit-row]').count(),3);
        assert.equal(await page.evaluate(()=>state.coins),535); // 1000 +35, unchanged Priority day-end -500
        await page.locator('[data-complete-habit="a"]').tap();await page.clock.runFor(220);
        assert.equal(await page.evaluate(()=>state.coins),545);
      }
      if(scenario==='order'){
        const cdp=safari ? null : await context.newCDPSession(page);
        const touch=async(type,x,y)=>{
          if(cdp) return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
          await page.evaluate(({type,x,y})=>{
            if(type==='touchStart') window.orderTouchTarget=document.elementFromPoint(x,y);
            // Desktop WebKit cannot construct native Touch objects; validate the touch handler path.
            const point={identifier:1,target:window.orderTouchTarget,clientX:x,clientY:y};
            const event=new Event(({touchStart:'touchstart',touchMove:'touchmove',touchEnd:'touchend'})[type],{bubbles:true,cancelable:true});
            Object.defineProperties(event,{touches:{value:type==='touchEnd'?[]:[point]},changedTouches:{value:[point]}});
            window.orderTouchTarget.dispatchEvent(event);
          },{type,x,y});
        };
        const handle=await page.locator('[data-habit-handle="c"]').boundingBox();
        const target=await page.locator('[data-habit-row="a"]').boundingBox();
        const x=handle.x+22,y=handle.y+22,scroll=await page.evaluate(()=>scrollY);
        await touch('touchStart',x,y);
        await page.clock.runFor(430);
        assert.equal(await page.locator('.habit-drag-preview').count(),1);
        await touch('touchMove',x,target.y+10);
        assert.equal(await page.locator('.habit-order-before').count(),1);
        assert.equal(await page.evaluate(()=>scrollY),scroll);
        await touch('touchEnd',x,target.y+10);await page.clock.runFor(250);
        assert.equal(await page.evaluate(()=>state.habits.map(h=>h.id).join(',')),'c,a,b');
        assert.equal(await page.locator('.habit-drag-preview').count(),0);
        assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
        await page.locator('[data-habit-handle="c"]').focus();
        await page.locator('[data-habit-handle="c"]').press('Enter');
        await page.locator('[data-move-habit="c"][data-direction="1"]').tap();
        await page.evaluate(()=>closeSheet());await page.reload();
        assert.equal(await page.evaluate(()=>state.habits.map(h=>h.id).join(',')),'a,c,b');
        await page.locator('[data-complete-habit="a"]').tap();assert.equal(await page.locator('.habit-drag-preview').count(),0);
        await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+01:00'));await page.reload();
        assert.equal(await page.evaluate(()=>state.habits.map(h=>h.id).join(',')),'a,c,b');
        assert.equal(await page.locator('#habitProgress').innerText(),'0 / 3');
      }
      if(scenario==='daily'){
        await page.evaluate(()=>{state.priorityTaskByDate={};saveState();});
        await page.evaluate(()=>{state.tasks=[{id:'old',name:'旧定时任务',date:dateKey(),scheduledStart:new Date().toISOString(),status:'pending',fixedReward:20}];saveState();});
        await page.locator('[data-complete-habit="a"]').tap();
        await page.clock.pauseAt(new Date('2026-10-12T23:59:59+01:00'));
        await page.evaluate(()=>render());
        await page.clock.runFor(1000);
        assert.equal(await page.evaluate(()=>state.coins),760);
        assert.equal(await page.locator('#habitProgress').innerText(),'0 / 3');
        await page.clock.setFixedTime(new Date('2026-10-15T10:00:00+01:00'));await page.reload();
        assert.equal(await page.evaluate(()=>state.coins),60); // +10 -250 -350 -350
        assert.equal(await page.evaluate(()=>state.tasks[0].status),'pending');
        const snapshot=await page.evaluate(()=>JSON.stringify(state.history));
        await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(state.history)),snapshot);
        assert.equal(await page.locator('#habitProgress').innerText(),'0 / 3');
      }
      if(scenario==='editor'){
        await page.locator('[data-open-habit]').tap();
        await page.locator('#sheetForm [name="name"]').fill('先交付再研究');
        await page.locator('#sheetForm [name="coins"]').fill('10');
        await page.locator('#sheetForm [type="submit"]').tap();
        assert.equal(await page.evaluate(()=>state.habits.at(-1).coins),10);
        await page.locator('[data-edit-habit="b"]').tap();
        await page.locator('#sheetForm [name="coins"]').fill('20');
        await page.locator('#sheetForm [type="submit"]').tap();
        await page.reload();assert.equal(await page.evaluate(()=>habitRewardAmount(state.habits.find(h=>h.id==='b'))),20);
        assert.equal(await page.locator('[data-schedule-habit], [data-arrange-source]').count(),0);
        await page.evaluate(()=>{const b=createLifeOSBackup();restoreLifeOSBackup(b);});
        assert.equal(await page.evaluate(()=>dailyHabitSystemEnabled()),true);
      }
      assert.deepEqual(errors,[]);console.log(JSON.stringify({scenario,width,passed:true}));await context.close();
    }
  }finally{if(browser)await browser.close();server.close();}
};
