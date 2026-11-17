const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
 if(!file.startsWith(root+'/'))return res.writeHead(403).end();
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,...(process.env.LIFEOS_TEST_PROXY?{proxy:{server:process.env.LIFEOS_TEST_PROXY,bypass:'127.0.0.1,localhost'}}:{})});
 for(const [width,height] of [[375,812],[390,844],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>LifeOSPersistence.writable);
 await page.clock.setFixedTime(new Date('2026-11-17T10:00:00+08:00'));
 await page.evaluate(()=>{state=cloneEmptyState();state.coins=1000;state.rewards=defaultFundRewards();state.settledThroughDate=yesterdayKey();state.fixedRewardRulesSince=dateKey();state.dailyReviews={'2026-11-01':{best:'保留的历史',mistake:'旧记录',dailyScore:8}};runAutomaticChecks({initializeDailyHabits:true,showToast:false});saveState();render();});
 assert.deepEqual(await page.locator('[data-nav]').evaluateAll(ns=>ns.map(n=>n.dataset.nav)),['today','workbench','goals','stats']);
 assert.equal(await page.locator('[data-view=review],#dailyReviewForm').count(),0);
 await page.locator('[data-nav=workbench]').tap();await page.locator('[data-wb-manage]').tap();await page.locator('[data-wb-project-new]').tap();await page.locator('#sheetForm [name=name]').fill('旅行品牌');await page.locator('#sheetForm [type=submit]').tap();
 await page.locator('#closeSheetBtn').tap();const project=await page.evaluate(()=>state.workbench.projects[0].id);
 await page.locator(`[data-wb-filter="${project}"]`).tap();await page.locator('[data-wb-new]').first().tap();assert.equal(await page.locator('#sheetForm [name=name]').evaluate(n=>document.activeElement===n),true);
 assert.equal(await page.locator('#sheetForm [name=projectId]').inputValue(),project);
 await page.locator('#sheetForm [name=name]').fill('确认供应商报价');await page.locator('[name=priority]').selectOption('high');await page.locator('#sheetForm [type=submit]').tap();
 const id=await page.evaluate(()=>state.workbench.tasks[0].id);await page.locator(`[data-wb-edit="${id}"]`).tap();await page.locator('[data-wb-today]').tap();
 assert.equal(await page.evaluate(()=>state.dailyTasks.filter(t=>t.workbenchTaskId).length),1);
 await page.locator(`[data-wb-complete="${id}"]`).tap();assert.equal(await page.evaluate(()=>state.coins),1050);await page.locator('[data-contextual-undo]').tap();assert.equal(await page.evaluate(()=>state.coins),1000);
 await page.locator('[data-nav=today]').tap();await page.locator('[data-complete-daily-task]').tap();await page.waitForTimeout(250);await page.locator('[data-nav=workbench]').tap();assert.equal(await page.locator('[data-wb-row]').count(),0);
 await page.locator('[data-wb-history]').tap();assert.equal(await page.locator('[data-wb-row]').count(),1);
 await page.locator('[data-wb-history]').tap();
 await page.evaluate(()=>{const p=state.workbench.projects[0].id;saveWorkbenchTask({name:'整理摄影作品集',projectId:p});saveWorkbenchTask({name:'等待当地向导回复',status:'waiting',projectId:p});saveWorkbenchTask({name:'长中文与英文混合任务 very long project action '.repeat(3),priority:'low',projectId:p});render();});
 const out=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'workbench-'+width+'.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);await page.locator('[data-nav=workbench]').tap();assert.equal(await page.locator('[data-wb-row]').count(),3);assert.equal(await page.evaluate(()=>state.coins),1050);
 await page.evaluate(()=>switchView('review'));assert.equal(await page.locator('[data-view=workbench]').isVisible(),true);
 await page.locator('[data-nav=stats]').tap();assert.equal(await page.evaluate(()=>state.dailyReviews['2026-11-01'].dailyScore),8);
 await page.evaluate(()=>{saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(10,22);switchView('workbench');render();});
 const second=await page.evaluate(()=>state.workbench.tasks[1].id);await page.locator(`[data-wb-edit="${second}"]`).tap();await page.locator('[data-wb-today]').tap();await page.locator('[name=hour]').selectOption('11');await page.locator('#sheetForm [type=submit]').tap();
 assert.equal(await page.evaluate(()=>state.dailyTasks.filter(t=>t.sprintWindow&&t.workbenchTaskId).length),1);
 await page.locator(`[data-wb-edit="${second}"]`).tap();await page.locator('[data-wb-cancel]').tap();assert.equal(await page.evaluate(()=>wbEffectiveStatus(state.workbench.tasks[1])),'todo');
 if(width===390){
   await page.evaluate(()=>{saveWorkbenchProject({id:state.workbench.projects[0].id,name:'很长的项目名称 mixed project name '.repeat(5)});for(let i=0;i<120;i++)saveWorkbenchTask({name:'批量任务 '+i});render();});
   assert.ok(await page.locator('[data-wb-row]').count()>120);
   await page.locator('[data-wb-row]').last().scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const peer=await context.newPage();await peer.goto(process.env.LIFEOS_TEST_URL||`http://127.0.0.1:${server.address().port}`);
   await peer.locator('#storageOwnerNotice button').filter({hasText:'在此窗口继续'}).click();await peer.waitForFunction(()=>LifeOSPersistence.writable);
   await peer.evaluate(()=>saveWorkbenchProject({name:'另一窗口保存'}));
   const saved=await peer.evaluate(()=>localStorage.getItem(STORAGE_KEY));
   assert.equal(await page.evaluate(()=>{try{saveWorkbenchProject({name:'旧页面不能覆盖'});return true;}catch{return false;}}),false);
   assert.equal(await peer.evaluate(()=>localStorage.getItem(STORAGE_KEY)),saved);
   assert.equal(await peer.evaluate(()=>state.workbench.projects.at(-1).name),'另一窗口保存');await peer.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,workbench:true,projects:true,linkedReward:true,undo:true,reload:true,sprint:true,legacy:true}));await context.close();
 }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
