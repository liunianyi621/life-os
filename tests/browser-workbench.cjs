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
 const hold=async locator=>{const box=await locator.boundingBox(),position={button:0,isPrimary:true,pointerId:9,pointerType:'touch',clientX:box.x+10,clientY:box.y+10};await locator.dispatchEvent('pointerdown',position);await page.waitForTimeout(550);await locator.dispatchEvent('pointerup',position);await locator.dispatchEvent('click');};
 await page.locator('[data-nav=workbench]').tap();assert.equal(await page.locator('[data-wb-manage],[data-wb-filter=none]').count(),0);
 await page.locator('[data-wb-project-new]').tap();await page.locator('#sheetForm [name=name]').fill('旅行品牌');await page.locator('#sheetForm [type=submit]').tap();
 const project=await page.evaluate(()=>state.workbench.projects[0].id);
 assert.deepEqual(await page.locator('[data-wb-group] h2').allTextContents(),['紧急','重要','等待中']);
 await hold(page.locator(`[data-wb-filter="${project}"]`));await page.locator('[data-wb-project]').tap();await page.locator('#sheetForm [name=name]').fill('旅行品牌更新');await page.locator('#sheetForm [type=submit]').tap();
 const tag=page.locator(`[data-wb-filter="${project}"]`);await tag.dispatchEvent('pointerdown',{button:0,isPrimary:true,clientX:20,clientY:20});await tag.dispatchEvent('pointermove',{clientX:20,clientY:50});await page.waitForTimeout(550);await tag.dispatchEvent('pointerup');assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
 for(const [group,name] of [['urgent','确认供应商报价'],['important','整理摄影作品集'],['waiting','等待向导回复']]){
   await page.locator(`[data-wb-add-group$=":${group}"]`).tap();assert.deepEqual(await page.locator('#sheetForm input').evaluateAll(ns=>ns.map(n=>n.name)),['name','dueDate']);assert.equal(await page.locator('#sheetForm select').count(),0);
   assert.equal(await page.locator('[name=name]').evaluate(n=>n===document.activeElement),true);await page.locator('[name=name]').fill(name);
   if(group==='urgent'){
     await page.setViewportSize({width,height:500});await page.evaluate(()=>syncSheetViewport());
     const nameBox=await page.locator('[name=name]').boundingBox(),dateBox=await page.locator('[name=dueDate]').boundingBox(),saveBox=await page.locator('#sheetForm [type=submit]').boundingBox();
     assert.ok(nameBox.y+nameBox.height<dateBox.y&&dateBox.y+dateBox.height<saveBox.y);assert.ok(saveBox.y+saveBox.height<=500);assert.ok(dateBox.x+dateBox.width<=width);
   }
   await page.locator('#sheetForm [type=submit]').tap();await page.setViewportSize({width,height});
 }
 const id=await page.evaluate(()=>state.workbench.tasks[0].id);
 await hold(page.locator(`[data-wb-row="${id}"]`));assert.equal(await page.locator('[data-wb-move$=":urgent"]').count(),0);await page.locator('[data-wb-move$=":important"]').tap();
 assert.equal(await page.locator(`[data-wb-group$=":important"] [data-wb-row="${id}"]`).count(),1);
 await hold(page.locator(`[data-wb-row="${id}"]`));await page.locator('[data-wb-edit]').tap();await page.locator('[name=name]').fill('编辑后的任务');await page.locator('[name=dueDate]').fill('2026-11-25');await page.locator('#sheetForm [type=submit]').tap();
 await page.locator(`[data-wb-detail="${id}"]`).tap();await page.locator('[data-wb-today]').tap();
 assert.equal(await page.evaluate(()=>state.dailyTasks.filter(t=>t.workbenchTaskId).length),1);
 await page.locator(`[data-wb-complete="${id}"]`).tap();assert.equal(await page.evaluate(()=>state.coins),1050);await page.locator('[data-contextual-undo]').tap();assert.equal(await page.evaluate(()=>state.coins),1000);
 await page.locator('[data-nav=today]').tap();await page.locator('[data-complete-daily-task]').tap();await page.waitForTimeout(250);await page.locator('[data-nav=workbench]').tap();assert.equal(await page.locator('[data-wb-row]').count(),2);
 await page.locator('[data-wb-history]').tap();assert.equal(await page.locator('[data-wb-row]').count(),1);
 await page.locator('[data-wb-history]').tap();
 await page.locator('[data-wb-project-new]').tap();await page.locator('[name=name]').fill('接收项目');await page.locator('#sheetForm [type=submit]').tap();const receiver=await page.evaluate(()=>state.workbench.projects[1].id);
 await hold(page.locator(`[data-wb-filter="${project}"]`));await page.locator('[data-wb-project-delete]').tap();await page.locator(`[data-wb-project-choice="${receiver}"]`).tap();assert.match(await page.locator('#confirmMessage').innerText(),/3 项任务/);await page.locator('#confirmCancelBtn').tap();await page.locator('#closeSheetBtn').tap();assert.equal(await page.evaluate(()=>state.workbench.projects[0].status),'active');
 await hold(page.locator(`[data-wb-filter="${project}"]`));await page.locator('[data-wb-project-delete]').tap();await page.locator(`[data-wb-project-choice="${receiver}"]`).tap();await page.locator('#confirmAcceptBtn').tap();assert.equal(await page.evaluate(()=>state.workbench.tasks.every(t=>t.projectId===state.workbench.projects[1].id)),true);
 await page.evaluate(()=>{wbMutate(d=>d.tasks.push({...d.tasks[1],id:'old-unassigned',groupId:undefined,projectId:null,executionIds:[]}));render();});await page.locator('[data-wb-assign]').tap();await page.locator(`[data-wb-project-choice="${receiver}"]`).tap();assert.equal(await page.locator('[data-wb-assign]').count(),0);
 await hold(page.locator('[data-wb-row="old-unassigned"]'));await page.locator('[data-wb-delete]').tap();await page.locator('#confirmAcceptBtn').tap();assert.equal(await page.locator('[data-wb-row="old-unassigned"]').count(),0);
 await page.locator('[data-wb-add-group$=":important"]').tap();await page.locator('[name=name]').fill('保留的第四项');await page.locator('#sheetForm [type=submit]').tap();
 const out=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'workbench-'+width+'.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);await page.locator('[data-nav=workbench]').tap();assert.equal(await page.locator('[data-wb-row]').count(),3);assert.equal(await page.evaluate(()=>state.coins),1050);
 await page.evaluate(()=>switchView('review'));assert.equal(await page.locator('[data-view=workbench]').isVisible(),true);
 await page.locator('[data-nav=stats]').tap();assert.equal(await page.evaluate(()=>state.dailyReviews['2026-11-01'].dailyScore),8);
 await page.evaluate(()=>{saveDayModes(dateKey(),dateKey(),'sprint');saveSprintRange(10,22);switchView('workbench');render();});
 const second=await page.evaluate(()=>state.workbench.tasks[1].id);await page.locator(`[data-wb-detail="${second}"]`).tap();await page.locator('[data-wb-today]').tap();await page.locator('[name=hour]').selectOption('11');await page.locator('#sheetForm [type=submit]').tap();
 assert.equal(await page.evaluate(()=>state.dailyTasks.filter(t=>t.sprintWindow&&t.workbenchTaskId).length),1);
 await page.locator(`[data-wb-detail="${second}"]`).tap();await page.locator('[data-wb-cancel]').tap();assert.equal(await page.evaluate(()=>wbEffectiveStatus(state.workbench.tasks[1])),'todo');
 if(width===390){
   await page.locator(`[data-wb-filter="${receiver}"]`).tap();await page.locator('[data-wb-group-new]').tap();await page.locator('[name=name]').fill('剪辑中');await page.locator('#sheetForm [type=submit]').tap();
   const groupId=await page.evaluate(()=>state.workbench.projects[1].groups.at(-1).id);
   await hold(page.locator(`[data-wb-group-title="${groupId}"]`));await page.locator('[data-wb-group-rename]').tap();await page.locator('[name=name]').fill('待发布');await page.locator('#sheetForm [type=submit]').tap();
   await hold(page.locator(`[data-wb-group-title="${groupId}"]`));await page.locator('[data-wb-group-order="-1"]').tap();assert.equal(await page.evaluate(()=>state.workbench.projects[1].groups.at(-2).name),'待发布');
   await page.locator(`[data-wb-add-group="${groupId}"]`).tap();await page.locator('[name=name]').fill('自定义分组任务');await page.locator('#sheetForm [type=submit]').tap();
   const custom=await page.evaluate(()=>state.workbench.tasks.at(-1).id);
   await hold(page.locator(`[data-wb-row="${custom}"]`));assert.equal(await page.locator('[data-wb-move]').count(),3);await page.locator('#closeSheetBtn').tap();
   await hold(page.locator(`[data-wb-group-title="${groupId}"]`));await page.locator('[data-wb-group-delete]').tap();await page.locator('[data-wb-group-target]').first().tap();assert.equal(await page.locator(`[data-wb-row="${custom}"]`).count(),1);
   await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);await page.locator('[data-nav=workbench]').tap();assert.equal(await page.evaluate(()=>state.workbench.tasks.at(-1).id),custom);
   await page.evaluate(()=>{const p=state.workbench.projects[1].id;saveWorkbenchProject({id:p,name:'很长的项目名称 mixed project name '.repeat(5)});for(let i=0;i<120;i++)saveWorkbenchTask({name:'批量任务 '+i,projectId:p});render();});
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
