const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
  if(!file.startsWith(root+'/'))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
    const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
    for(const [width,height] of [[390,844],[393,852],[430,932]]){
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.clock.setFixedTime(new Date('2026-09-12T10:30:00Z'));await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(()=>{state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();state.calendarEvents=[
        {id:'trip',title:'高地旅行与拍摄长中文名称',startDate:'2026-09-14',endDate:'2026-09-18',category:'normal'},
        {id:'cross',title:'跨周计划',startDate:'2026-09-18',endDate:'2026-09-22',category:'important'},
        {id:'single',title:'拍摄',startDate:'2026-09-15',endDate:'2026-09-15',category:'normal'},
        {id:'year',title:'跨年',startDate:'2026-12-30',endDate:'2027-01-03',category:'normal'}];saveState();render();});
      const original=await page.evaluate(()=>JSON.stringify(state.calendarEvents));
      await page.locator('[data-nav="calendar"]').click();await page.waitForTimeout(300);
      assert.equal(await page.locator('.calendar-day-cell.today.selected').count(),0);
      const tomorrow=page.locator('button[data-calendar-day="2026-09-13"]');
      await tomorrow.click({position:{x:15,y:12}});
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      assert.equal(await page.locator('.calendar-day-cell.today:not(.selected)').count(),1);
      await tomorrow.click({position:{x:15,y:12}});
      assert.equal(await page.locator('#sheetForm input[name="startDate"]').inputValue(),'2026-09-13');
      assert.equal(await page.locator('#sheetForm input[name="endDate"]').inputValue(),'2026-09-13');
      assert.equal(await page.locator('[data-delete-calendar-event]').count(),0);
      await page.evaluate(()=>closeSheet());
      assert.equal(await page.evaluate(()=>JSON.stringify(state.calendarEvents)),original);
      await page.locator('button[data-calendar-day="2026-09-12"]').click({position:{x:15,y:12}});
      assert.equal(await page.locator('.calendar-day-cell.today.selected').count(),1);
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      await tomorrow.click({position:{x:15,y:12}});
      assert.equal(await page.locator('#calendarGrid [data-calendar-event="trip"]').count(),1);
      assert.equal(await page.locator('#calendarGrid [data-calendar-event="cross"]').count(),2);
      const segment=page.locator('#calendarGrid [data-calendar-event="trip"]');
      const bar=await segment.boundingBox(),grid=await page.locator('#calendarGrid').boundingBox();
      assert.ok(Math.abs(bar.width-grid.width*5/7)<2);
      await page.screenshot({path:path.join(evidence,`calendar-five-${width}.png`)});
      await page.evaluate(()=>{state.calendarEvents=[...state.calendarEvents,...Array.from({length:4},(_,i)=>({id:'overlap'+i,title:'重叠计划'+i,startDate:'2026-09-14',endDate:'2026-09-18',category:'normal'}))];renderCalendar();});
      assert.ok(await page.locator('[data-calendar-more="2026-09-15"]').count());
      await page.locator('[data-calendar-more="2026-09-15"]').click();
      assert.equal(await page.locator('#calendarSelectedPlans [data-calendar-event]').count(),6);
      await page.evaluate(original=>{state.calendarEvents=JSON.parse(original);renderCalendar();},original);
      await segment.click();await page.waitForTimeout(200);
      const sheet=await page.locator('#sheetBackdrop .sheet').boundingBox();assert.ok(sheet.height<height*.6,JSON.stringify(sheet));
      assert.match(await page.locator('[data-calendar-date-label="startDate"]').innerText(),/9月14日/);
      await page.screenshot({path:path.join(evidence,`calendar-sheet-${width}.png`)});
      await page.locator('#sheetForm input[name="title"]').fill('修改后的高地');
      await page.locator('#sheetForm input[name="endDate"]').fill('2026-09-19');
      await page.locator('#sheetForm button[type="submit"]').click();
      assert.equal(await page.evaluate(()=>state.calendarEvents.find(e=>e.id==='trip').endDate),'2026-09-19');
      await page.reload();await page.locator('[data-nav="calendar"]').click();
      assert.equal(await page.evaluate(()=>state.calendarEvents.find(e=>e.id==='trip').title),'修改后的高地');
      await page.evaluate(()=>{currentCalendarMonth='2026-08';renderCalendar();});
      assert.equal(await page.locator('.calendar-week').count(),6);
      await page.locator('button[data-calendar-day="2026-07-27"]').click({position:{x:15,y:12}});
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);
      await page.screenshot({path:path.join(evidence,`calendar-six-${width}.png`)});
      await page.evaluate(()=>{currentCalendarMonth='2026-12';renderCalendar();});
      assert.equal(await page.locator('#calendarGrid [data-calendar-event="year"]').count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.locator('#calendarGrid [data-calendar-event="year"]').click();
      for(const h of [430,320]){
        await page.evaluate(h=>Object.defineProperty(visualViewport,'height',{configurable:true,value:h}),h);
        await page.locator('#sheetForm input[name="title"]').focus();await page.evaluate(()=>{syncSheetViewport();ensureFocusedFormFieldVisible();});await page.waitForTimeout(250);
        const layout=await page.evaluate(()=>{const f=els.sheetForm.querySelector('input[name="title"]').getBoundingClientRect(),b=els.sheetForm.querySelector('button[type="submit"]').getBoundingClientRect();return {field:f.bottom,save:b.top,bottom:b.bottom};});
        assert.ok(layout.field<=layout.save && layout.bottom<=h+1,JSON.stringify(layout));
      }
      await page.evaluate(()=>{document.activeElement.blur();delete visualViewport.height;syncSheetViewport();closeSheet();});
      await page.evaluate(()=>openCalendarEventSheet('year'));
      await page.locator('[data-delete-calendar-event="year"]').click();
      await page.locator('#confirmCancelBtn').click();
      assert.equal(await page.evaluate(()=>state.calendarEvents.some(e=>e.id==='year')),true);
      await page.locator('[data-delete-calendar-event="year"]').click();
      await page.locator('#confirmAcceptBtn').click();
      assert.equal(await page.evaluate(()=>state.calendarEvents.some(e=>e.id==='year')),false);
      await page.evaluate(()=>openCalendarEventSheet(null,{date:'2026-09-13'}));
      await page.locator('#sheetForm input[name="title"]').fill('新建的重要计划');
      await page.locator('[data-calendar-category="important"]').click();
      await page.locator('#sheetForm button[type="submit"]').click();
      const created=await page.evaluate(()=>state.calendarEvents.find(e=>e.title==='新建的重要计划'));
      assert.equal(created.startDate,'2026-09-13');assert.equal(created.endDate,'2026-09-13');assert.equal(created.category,'important');assert.ok(created.id);
      assert.deepEqual(errors,[]);console.log(JSON.stringify({width,weeklyContinuity:true,firstSecondTap:true,editReload:true,sheetHeight:sheet.height,keyboard:true}));await context.close();
    }
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
