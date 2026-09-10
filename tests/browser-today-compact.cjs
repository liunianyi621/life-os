const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const baseline = '6c166aeb7f9ce3c9f00a8ea846f109b278f6ab24';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const old = url.pathname.startsWith('/before/');
  const relative = url.pathname.replace(/^\/(before|after)\//, '') || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  try {
    const data = old ? execFileSync('git', ['show', `${baseline}:${relative}`], {cwd:root,stdio:['ignore','pipe','ignore']}) : fs.readFileSync(file);
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)] || 'application/json');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const results = [];
  const evidence = path.join(root, 'outputs/life-rpg/test-evidence');
  fs.mkdirSync(evidence, {recursive:true});
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
    for (const [width,height] of [[390,844],[393,852],[430,932]]) {
      for (const version of ['before','after']) {
        const context = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.setFixedTime(new Date('2026-09-10T15:53:00Z'));
        await page.goto(`http://127.0.0.1:${server.address().port}/${version}/`);
        await page.evaluate(() => {
          state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();state.coins=140.79;
          state.tasks=['看书','清理相册'].map((name,i)=>({id:'t'+i,name,source:'MANUAL',reward:5,coins:5,status:'pending',date:dateKey(),createdDate:dateKey(),timeStart:`${16+i}:00`,timeEnd:`${17+i}:00`,time:`${16+i}:00`}));
          state.habits=['Duolingo','每日复盘'].map((name,i)=>({id:'h'+i,name,createdDate:dateKey()}));
          state.memos=['牙刷充电','买转换插头','整理签证材料','给 Raphael 回消息','action5 内存','洗衣服'].map((text,i)=>({id:'m'+i,text,createdAt:new Date().toISOString()}));
          saveState();render();
        });
        await page.waitForTimeout(250);
        const metrics = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect();
          const navTop=rect('.bottom-nav').top;
          return {
            pageHeight:document.documentElement.scrollHeight,
            contentHeight:Math.round(rect('.today-page').height),
            priorityHeight:Math.round(rect('#priorityTaskCard').height),
            timelineHeight:Math.round(rect('#todayTaskList').height),
            habitVisible:rect('.today-habit-section').bottom<=navTop,
            memoVisible:rect('.home-memo-section').bottom<=navTop,
            memoBottom:Math.round(rect('.home-memo-section').bottom),navTop,
            scroll:document.documentElement.scrollHeight>innerHeight,
            horizontalScroll:document.documentElement.scrollWidth>innerWidth
          };
        });
        assert.equal(await page.locator('[data-task-timeline-slot]').count(),3);
        assert.equal(metrics.horizontalScroll,false);
        if (version==='after' && !process.env.BASELINE_ONLY) {
          assert.equal(metrics.scroll,false);
          assert.equal(metrics.habitVisible,true);
          assert.equal(metrics.memoVisible,true);
          assert.equal(await page.getByText('接下来',{exact:true}).count(),0);
          assert.equal(await page.getByText('今天只放一件最重要的事',{exact:true}).count(),0);
          for (const button of await page.locator('[data-complete-task]').all()) {
            const bounds=await button.boundingBox();assert.ok(bounds.width>=44 && bounds.height>=44);
          }
          await page.locator('[data-open-memo]').last().click();
          assert.equal(await page.locator('#memoBackdrop').isVisible(),true);
          await page.evaluate(()=>closeMemoSheet());
        }
        assert.deepEqual(errors,[]);
        await page.screenshot({path:path.join(evidence,`today-${version}-${width}.png`),fullPage:true});
        if (version==='after' && !process.env.BASELINE_ONLY) {
          const original=await page.evaluate(()=>JSON.stringify(state));
          await page.evaluate(()=>{
            state.priorityTaskByDate[dateKey()]={date:dateKey(),title:'剪完 Raphael 视频',status:'pending'};
            render();
          });
          const populated=await page.evaluate(()=>{
            const priority=document.querySelector('#priorityTaskCard').getBoundingClientRect();
            return {height:priority.height,memoBottom:document.querySelector('.home-memo-section').getBoundingClientRect().bottom,navTop:document.querySelector('.bottom-nav').getBoundingClientRect().top};
          });
          assert.ok(populated.memoBottom<=populated.navTop);
          await page.screenshot({path:path.join(evidence,`today-priority-${width}.png`),fullPage:true});
          // A late-night label may wrap, but must stay in its own time column.
          await page.clock.setFixedTime(new Date('2026-09-10T21:30:00Z'));
          await page.evaluate(()=>{state.tasks=[];renderTasks();});
          const tomorrow=page.locator('[data-task-timeline-slot] > time').filter({hasText:'明天'}).first();
          assert.equal(await tomorrow.count(),1);
          assert.ok(await tomorrow.evaluate(el=>el.scrollWidth<=el.clientWidth));
          for (const coins of [0,8.5,280.8,999.99,1256.3,10000]) {
            await page.evaluate(value=>{state.coins=value;updatePrimaryReadouts();},coins);
            assert.ok(await page.locator('#homeCoins').evaluate(el=>el.scrollWidth<=el.clientWidth));
          }
          await page.clock.setFixedTime(new Date('2026-09-10T15:53:00Z'));
          await page.evaluate(serialized=>{state=JSON.parse(serialized);render();},original);
          assert.equal(await page.evaluate(()=>JSON.stringify(state)),original,'rendering leaves business data unchanged');
          await page.evaluate(()=>{
            state.habits=[];state.memos=[];state.tasks=[];render();
          });
          assert.equal(await page.locator('#habitList').innerText(),'还没有习惯');
          assert.equal(await page.locator('#homeMemoList').innerText(),'暂无备忘录');
          assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);
          // Dense data stays scrollable instead of being clipped under the nav.
          await page.evaluate(()=>{
            state.habits=Array.from({length:16},(_,i)=>({id:'dense'+i,name:'保留的长习惯名称'+i,createdDate:dateKey()}));render();
            window.scrollTo(0,document.documentElement.scrollHeight);
          });
          await page.waitForTimeout(200);
          assert.ok(await page.evaluate(()=>document.querySelector('#homeMemoList').getBoundingClientRect().bottom<document.querySelector('.bottom-nav').getBoundingClientRect().top));
          assert.deepEqual(errors,[]);
          metrics.populatedPriorityHeight=populated.height;
        }
        results.push({version,width,height,...metrics});
        await context.close();
      }
    }
    fs.writeFileSync(path.join(evidence,'today-compact-metrics.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
