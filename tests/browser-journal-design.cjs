const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + (new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}
  catch {res.writeHead(404).end();}
});
(async()=>{
  let browser;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
    const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
    for(const [width,height] of [[390,844],[393,852],[430,932]]) {
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.clock.setFixedTime(new Date('2026-09-12T10:30:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(()=>{
        state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
        state.dailyReviews={'2026-09-11':{best:'该干的都干了',mistake:'睡得有点晚',priority:'整理冰岛行程',dailyScore:6},'2026-09-10':{best:'终于完成拍摄',dailyScore:9},'2025-12-31':{best:'慢下来的一天',dailyScore:null}};
        state.priorityTaskByDate[dateKey()]={date:dateKey(),title:'相册清到3k，gym，修照片，zmy2创业',status:'pending'};
        state.habits=['Duolingo','看书','清理相册','每日复盘'].map((name,i)=>({id:'h'+i,name,createdDate:dateKey()}));
        state.memos=['filthy baby调色','曼城活动'].map((text,i)=>({id:'m'+i,text,createdAt:new Date().toISOString()}));
        saveState();render();
      });
      assert.equal(await page.locator('.today-page h1').innerText(),'今天');
      assert.equal(await page.locator('#todayTaskCount,#habitCount,#homeMemoCount').count(),0);
      await page.screenshot({path:path.join(evidence,`today-journal-${width}.png`)});
      await page.locator('[data-nav="review"]').click();
      await page.locator('#reviewBest').fill('今天拍完了照片');
      await page.locator('#reviewMistake').fill('早点休息');
      await page.locator('#reviewPriority').fill('整理照片');
      await page.locator('#reviewDailyScore').fill('8');
      await page.locator('#dailyReviewForm button[type="submit"]').click();
      assert.equal(await page.evaluate(()=>state.dailyReviews[dateKey()].dailyScore),8);
      assert.equal(await page.evaluate(()=>state.priorityTaskByDate[shiftDateKey(dateKey(),1)].title),'整理照片');
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});await page.waitForTimeout(300);
      await page.screenshot({path:path.join(evidence,`journal-${width}.png`)});
      const card=page.locator('[data-review-card="2026-09-11"]');
      assert.match(await card.innerText(),/明日 → 整理冰岛行程/);
      assert.equal(await card.locator('.review-row-score').innerText(),'6');
      assert.match(await page.locator('[data-review-card="2025-12-31"]').innerText(),/2025年/);
      await card.click();
      assert.equal(await page.locator('#sheetForm textarea[name="best"]').inputValue(),'该干的都干了');
      await page.locator('#sheetForm textarea[name="best"]').fill('修改后的记忆');
      await page.locator('#sheetForm button[type="submit"]').click();
      await page.reload();await page.locator('[data-nav="review"]').click();
      assert.match(await card.innerText(),/修改后的记忆/);
      await page.locator('[data-review-card="2025-12-31"]').scrollIntoViewIfNeeded();
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(300);
      const layout=await page.evaluate(()=>({last:document.querySelector('[data-review-card="2025-12-31"]').getBoundingClientRect().bottom,nav:document.querySelector('.bottom-nav').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.ok(layout.last<=layout.nav);assert.equal(layout.overflow,false);assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(evidence,`journal-history-${width}.png`)});
      console.log(JSON.stringify({width,save:true,score:true,tomorrowPriority:true,historyEdit:true,reload:true,layout}));
      await context.close();
    }
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
