const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  fs.readFile(file,(error,data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)] || 'application/json');
    res.end(data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
    const evidence = path.join(root,'outputs/life-rpg/test-evidence');
    fs.mkdirSync(evidence,{recursive:true});
    for (const [width,height] of [[375,667],[390,844],[393,852],[430,932]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-09-10T11:30:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(() => {
        state = cloneEmptyState(); state.fixedRewardRulesSince = dateKey(); state.settledThroughDate = yesterdayKey();
        state.habits = Array.from({length:8},(_,i) => ({id:'h'+i,name:'今日习惯'+i,createdDate:dateKey()}));
        state.memos = Array.from({length:8},(_,i) => ({id:'m'+i,text:'以后要做的事情'+i,createdAt:new Date().toISOString()}));
        saveState(); render();
      });
      assert.equal(await page.locator('#homeMemoList [data-memo-card]').count(),3);
      await page.locator('[data-habit-card="h0"]').click();
      await page.locator('[data-schedule-habit="h0"]').click();
      await page.locator('[data-arrange-slot]').nth(2).click();
      const task = await page.evaluate(() => state.tasks[0]);
      assert.equal(new Date(task.scheduledStart).getUTCHours(),14);
      assert.equal(task.status,'pending');
      assert.equal(task.startedAt,null);
      assert.equal(await page.locator('[data-habit-card="h0"]').count(),0);
      assert.equal(await page.locator('#habitCount').count(),0);
      assert.equal(await page.evaluate(() => state.habits.filter(h => !habitCompletedToday(h.id)).length),8);
      await page.waitForTimeout(400);
      const complete = page.locator(`[data-complete-task="${task.id}"]`);
      const box = await complete.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      await complete.click();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      assert.equal(await page.evaluate(() => state.coins),5);
      assert.equal(await page.evaluate(() => state.habits.filter(h => !habitCompletedToday(h.id)).length),7);
      await page.locator('[data-memo-card="m0"]').click();
      await page.locator('[data-arrange-memo="m0"]').click();
      await page.locator('[data-arrange-slot]').first().click();
      assert.equal(await page.evaluate(() => state.memos[0].status),'SCHEDULED');
      await page.locator('#toast [data-contextual-undo]').click();
      assert.equal(await page.locator('[data-memo-card="m0"]').count(),1);
      await page.locator('[data-nav="calendar"]').click();
      await page.locator('button[data-calendar-day="2026-09-09"]').click();
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      assert.match(await page.locator('#calendarSelectedDateLabel').innerText(),/9/);
      await page.locator('[data-calendar-add-selected]').click();
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),true);
      await page.evaluate(() => closeSheet());
      await page.locator('button[data-calendar-day="2026-09-11"]').click();
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      await page.locator('button[data-calendar-day="2026-09-11"]').click();
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),true);
      await page.evaluate(() => closeSheet());
      await page.locator('[data-nav="review"]').click();
      assert.equal(await page.locator('.bottom-nav').isVisible(),true);
      assert.equal(await page.getByRole('button',{name:'返回',exact:true}).count(),0);
      for (const viewportHeight of [430,320]) {
        await page.evaluate(h => {
          Object.defineProperty(window.visualViewport,'height',{configurable:true,value:h});
          Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,value:12});
        },viewportHeight);
        for (const id of ['reviewBest','reviewMistake','reviewPriority']) {
          await page.locator('#'+id).focus();
          await page.evaluate(() => { syncSheetViewport(); ensureFocusedFormFieldVisible(); });
          await page.waitForTimeout(500);
          const layout = await page.evaluate(id => {
            const field = document.getElementById(id).getBoundingClientRect();
            const body = document.querySelector('.review-keyboard-form__body').getBoundingClientRect();
            const button = document.querySelector('#dailyReviewForm button[type="submit"]').getBoundingClientRect();
            return {fieldTop:field.top,fieldBottom:field.bottom,bodyTop:body.top,bodyBottom:body.bottom,saveTop:button.top,saveBottom:button.bottom};
          },id);
          assert.ok(layout.fieldTop >= layout.bodyTop-1 && layout.fieldBottom <= layout.bodyBottom+1,JSON.stringify({width,viewportHeight,id,layout}));
          assert.ok(layout.saveBottom <= viewportHeight+12 && layout.saveTop >= layout.bodyBottom,JSON.stringify(layout));
          console.log(JSON.stringify({width,viewportHeight,id,layout}));
        }
        await page.screenshot({path:path.join(evidence,`execution-review-${width}-${viewportHeight}.png`)});
      }
      await page.evaluate(() => { document.activeElement.blur(); delete window.visualViewport.height; delete window.visualViewport.offsetTop; syncSheetViewport(); });
      await page.locator('[data-nav="stats"]').click();
      await page.locator('[data-open-settings]').click();
      await page.locator('[data-settings-page="data"]').click();
      const [download] = await Promise.all([page.waitForEvent('download'),page.locator('[data-export-backup]').click()]);
      const backup = JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      assert.equal(backup.version,1);
      const before = await page.evaluate(() => JSON.stringify(state));
      await page.locator('#lifeosBackupFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":2}')});
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => JSON.stringify(state)),before);
      await page.evaluate(() => { state.coins=999;saveState(); });
      await page.locator('#lifeosBackupFile').setInputFiles({name:'LifeOS.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
      await page.locator('#confirmAcceptBtn').click();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => JSON.stringify(state)),before);
      await page.reload();
      assert.equal(await page.evaluate(() => state.coins),5);
      assert.equal(await page.evaluate(() => state.history.filter(item => item.type==='habit_completed'||item.type==='task_completed').length),1);
      await page.clock.setFixedTime(new Date('2026-09-11T11:30:00Z'));
      await page.reload();
      assert.equal(await page.evaluate(() => state.coins),5-7*50);
      await page.reload();
      assert.equal(await page.evaluate(() => state.coins),5-7*50);
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({width,backupRoundtrip:true,habitCrossDay:'7 x -50 once',pageErrors:errors}));
      await page.close();
    }
  } finally {
    console.log('All mobile assertions passed; closing browser.');
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);process.exitCode=1;});
