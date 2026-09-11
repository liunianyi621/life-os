const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+'/'))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{
    if(error)return res.writeHead(404).end();
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/json');res.end(data);
  });
});
(async()=>{
  let browser;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-09-11T09:59:58Z')});
    await page.clock.pauseAt(new Date('2026-09-11T09:59:59Z'));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const seed=async(mode='manual')=>page.evaluate(mode=>{
      state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();state.coins=1000;
      const record={id:'deadline-task',name:'看书',reward:5,coins:5,status:'pending',date:dateKey(),createdDate:dateKey(),source:'MANUAL',timeStart:'10:00',timeEnd:'11:00',time:'10:00'};
      if(mode==='habit'){
        state.habits=[{id:'h',name:'看书',createdDate:dateKey()}];
        Object.assign(record,{source:'HABIT',originId:'h',sourceHabitId:'h',sourceHabitScheduledDate:dateKey()});
      }
      if(mode==='memo'){
        state.memos=[{id:'m',text:'看书',status:'SCHEDULED',linkedTaskId:record.id}];
        Object.assign(record,{source:'MEMO',originId:'m',sourceMemoId:'m'});
      }
      state.tasks=[record];saveState();render();
    },mode);
    await seed();
    assert.equal(await page.evaluate(()=>state.tasks[0].status),'pending');
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(()=>state.tasks[0].status),'failed');
    assert.equal(await page.evaluate(()=>state.coins),950);
    assert.equal(await page.locator('[data-complete-task]').count(),0);
    assert.equal(await page.locator('[data-task-timeline-slot]').count(),3);
    await page.reload();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.equal(await page.evaluate(()=>state.coins),950);
    assert.equal(await page.evaluate(()=>state.history.length),1);

    await page.clock.setSystemTime(new Date('2026-09-11T09:40:00Z'));
    await seed();
    assert.equal(await page.evaluate(()=>rescheduleTask('deadline-task',new Date(2026,8,11,12))),true);
    await page.clock.runFor(20*60*1000);
    assert.equal(await page.evaluate(()=>state.coins),1000,'old 11:00 wake-up is cancelled');
    await page.clock.runFor(2*60*60*1000);
    assert.equal(await page.evaluate(()=>state.coins),950,'new 13:00 deadline fires');
    assert.equal(await page.evaluate(()=>state.tasks.length),1);

    await page.clock.setSystemTime(new Date('2026-09-11T09:59:59Z'));
    await seed('habit');await page.clock.runFor(1000);
    assert.equal(await page.evaluate(()=>state.coins),950);
    await page.clock.setSystemTime(new Date('2026-09-12T08:00:00Z'));
    await page.reload();
    assert.equal(await page.evaluate(()=>state.coins),950,'habit is not charged again on next-day startup');

    await page.clock.setSystemTime(new Date('2026-09-11T09:40:00Z'));
    await seed('memo');
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    await page.clock.setSystemTime(new Date('2026-09-11T14:00:00Z'));
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
    assert.equal(await page.evaluate(()=>state.coins),950);
    assert.equal(await page.evaluate(()=>state.memos[0].status),'ACTIVE');
    await page.reload();
    assert.equal(await page.evaluate(()=>state.coins),950);
    await page.clock.setSystemTime(new Date('2026-09-11T09:59:59Z'));
    await seed();
    await page.locator('[data-nav="review"]').click();
    await page.locator('#reviewBest').fill('未保存的复盘草稿');
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(()=>state.coins),950);
    assert.equal(await page.locator('#reviewBest').inputValue(),'未保存的复盘草稿');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({foregroundDeadline:true,refreshIdempotent:true,rescheduleCancelsOldDeadline:true,habitSinglePenalty:true,resumeCatchesMemoDeadline:true,threeSlots:true,errors}));
    await context.close();
  }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
