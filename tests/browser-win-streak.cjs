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
 try {
 browser=await (process.env.LIFEOS_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.LIFEOS_BROWSER==='webkit'?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH});
 for(const [width,height] of [[390,844],[393,852],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(()=>{
 state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
 state.coins=123.45;
 state.rewards=normalizeRewards([{id:'experiment-fund',name:'实验期基金',totalCoins:50000,currentCoins:1234.56,amountPerDeposit:10}]);
 state.habits=[{id:'experiment-habit',name:'实验期习惯',createdDate:dateKey(),coins:5}];
 state.memos=[{id:'m',text:'实验期提醒',status:'ACTIVE'}];
 state.dailyReviews={[yesterdayKey()]:{best:'实验期复盘',mistake:'保留',priority:'实验期重点',dailyScore:8}};
 state.priorityTaskByDate=normalizePriorityTasks({[dateKey()]:{date:dateKey(),title:'保留重点',status:'pending'}});
 state.calendarEvents=[{id:'old',title:'历史日历',startDate:'2026-09-01',endDate:'2026-09-02',category:'normal'}];
 state.winStreak={version:1,enabled:true,windows:[{start:new Date().toISOString(),end:null}],days:{[dateKey()]:{choice:{type:'habit',id:'experiment-habit',name:'实验期习惯'},locked:true,receipts:[],outcome:'pending'}}};
 runAutomaticChecks({initializeDailyHabits:true,showToast:false});saveState();
 saveDailyTask({name:'实验期新增任务',reward:20});render();
 });
 await page.reload();
 const before=await page.evaluate(()=>createLifeOSBackup().data);
 await page.reload();
 assert.deepEqual(await page.locator('.bottom-nav [data-nav]').evaluateAll(nodes=>nodes.map(n=>n.innerText.trim())),['今天','复盘','奖励','统计']);
 assert.equal(await page.locator('#winToday,#winRecords,[data-win-toggle],[data-win-choose]').count(),0);
 assert.equal(await page.evaluate(()=>winEnabled()),false);
 assert.equal(await page.locator('#currentFocusTask').isVisible(),true);
 assert.equal(await page.locator('[data-task-timeline-slot],[data-nav="calendar"]').count(),0);
 await page.locator('[data-nav="rewards"]').click();
 assert.equal(await page.locator('[data-view="rewards"] h1').innerText(),'主线基金');
 assert.equal(await page.locator('#rewardList').isVisible(),true);
 await page.locator('[data-nav="stats"]').click();await page.locator('[data-open-settings]').click();
 assert.equal(await page.getByText('每日胜负实验版',{exact:true}).count(),0);
 await page.locator('[data-nav="today"]').click();
 const id=await page.evaluate(()=>state.dailyTasks.find(t=>t.name==='实验期新增任务').id);
 await page.evaluate(id=>{startFocusSession('dailyTask',id);render();},id);
 await page.reload();
 assert.equal(await page.evaluate(()=>state.currentFocus.sourceId),id);
 await page.evaluate(id=>{completeDailyTask(id);completeDailyTask(id);render();},id);
 assert.equal(await page.evaluate(()=>state.coins),173.45);
 await page.locator('#toast [data-contextual-undo]').click();
 assert.equal(await page.evaluate(()=>state.coins),123.45);
 const after=await page.evaluate(()=>createLifeOSBackup().data);
 for(const key of ['winStreak','habits','dailyReviews','priorityTaskByDate','rewards','calendarEvents','memos']) assert.deepEqual(after[key],before[key],key+' preserved');
 assert.deepEqual(after.history,before.history);
 await page.evaluate(()=>{const backup=createLifeOSBackup();restoreLifeOSBackup(backup);saveState();render();});
 await page.reload();
 assert.equal(await page.evaluate(()=>winEnabled()),false);
 assert.deepEqual(await page.evaluate(()=>state.winStreak),before.winStreak);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 await page.waitForTimeout(250);
 const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
 await page.screenshot({path:path.join(evidence,`restored-legacy-${width}.png`),fullPage:true});
 console.log(JSON.stringify({width,restored:true,experimentalDataPreserved:true,focus:true,coinsUndo:true}));
 await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
