const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+'/'))return res.writeHead(403).end();
 fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const safari=process.env.LIFEOS_BROWSER==='webkit';
  browser=await (safari?webkit:chromium).launch({executablePath:safari?process.env.WEBKIT_PATH:process.env.CHROMIUM_PATH,
    ...(process.env.LIFEOS_TEST_PROXY?{proxy:{server:process.env.LIFEOS_TEST_PROXY,bypass:'127.0.0.1,localhost'}}:{})});
  const url=process.env.LIFEOS_TEST_URL||'http://127.0.0.1:'+server.address().port;
  for(const [width,height] of [[390,844],[393,852],[430,932]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai',locale:'zh-CN'});
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+08:00'));
   await page.goto(url);await page.waitForFunction(()=>LifeOSPersistence.writable);
   await page.addStyleTag({content:'*{animation:none!important;transition:none!important}'});
   assert.equal(await page.locator('#todayModeBar button').count(),3);
   assert.equal(await page.locator('[data-open-day-mode],.mode-options').count(),0);
   assert.deepEqual(await page.locator('#todayModeBar svg').evaluateAll(nodes=>nodes.map(n=>n.dataset.lucide)),['coffee','sun','clock']);
   for(const button of await page.locator('#todayModeBar button').all())assert.ok((await button.boundingBox()).height>=44);
   await page.locator('[data-select-day-mode=vacation]').tap();
   assert.match(await page.locator('#confirmTitle').innerText(),/明天/);await page.locator('#confirmCancelBtn').tap();
   assert.equal(await page.evaluate(()=>dayMode()),'normal');assert.equal(await page.evaluate(()=>state.coins),0);
   await page.locator('[data-select-day-mode=vacation]').tap();await page.locator('#confirmAcceptBtn').tap();
   assert.equal(await page.evaluate(()=>dayMode()),'normal');assert.equal(await page.evaluate(()=>dayMode('2026-11-17')),'vacation');
   assert.equal(await page.locator('[data-select-day-mode=normal]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-select-day-mode=vacation]').tap();await page.locator('#confirmAcceptBtn').tap();
   assert.equal(await page.evaluate(()=>dayMode('2026-11-17')),'normal');
   await page.locator('[data-select-day-mode=sprint]').tap();assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
   await page.locator('[data-select-day-mode=normal]').tap();
   const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
   await page.screenshot({path:path.join(evidence,`today-mode-ui-${safari?'webkit':'chrome'}-${width}.png`),fullPage:true});
   const icons=await page.locator('.bottom-nav svg').evaluateAll(nodes=>nodes.map(n=>({name:n.dataset.lucide,width:n.getBoundingClientRect().width,stroke:getComputedStyle(n).strokeWidth})));
   assert.deepEqual(icons.map(i=>i.name),['list-checks','list-todo','target','chart-no-axes-column']);
   assert.equal(new Set(icons.map(i=>i.width)).size,1);assert.equal(new Set(icons.map(i=>i.stroke)).size,1);
   assert.ok((await page.locator('.bottom-nav').boundingBox()).height<=70);
   for(const button of await page.locator('.bottom-nav button').all())assert.ok((await button.boundingBox()).height>=44);
   await page.locator('[data-nav=goals]').tap();
   const open=async name=>{
    await page.locator('[data-open-goal]').tap();
    assert.equal(await page.locator('#sheetForm [name=kind],#sheetForm [name=category],#sheetForm [name=description],#sheetForm [type=radio],#goalMilestones').count(),0);
    await page.locator('#sheetForm [name=name]').fill(name);await page.locator('#sheetForm [name=deadline]').fill('2026-11-22');
    await page.locator('#sheetForm [name=penalty]').fill('一周不刷短视频');
   };
   await open('完成摄影作品集');
   assert.equal(await page.locator('[data-goal-numeric]').isVisible(),false);
   await page.locator('#sheetForm button[type=submit]').tap();await page.waitForFunction(()=>state.longTermGoals?.length===1);
   const completion=await page.evaluate(()=>state.longTermGoals[0].id);
   assert.equal(await page.locator(`[data-goal-card="${completion}"] progress`).count(),0);
   await open('体重达到 55 kg');await page.locator('[data-toggle-goal-numeric]').tap();
   for(const [name,value] of Object.entries({start:'60',target:'55',current:'57.2',unit:'kg'}))await page.locator(`#sheetForm [name=${name}]`).fill(value);
   // Reuse the existing keyboard-aware viewport behavior, with a simulated reduced viewport.
   await page.setViewportSize({width,height:480});await page.locator('#sheetForm [name=current]').focus();
   await page.evaluate(()=>{syncSheetViewport();ensureFocusedFormFieldVisible();});await page.waitForTimeout(450);
   const keyboard=await page.evaluate(()=>{
    const input=document.querySelector('#sheetForm [name=current]').getBoundingClientRect(),footer=document.querySelector('#sheetForm .keyboard-form-sheet__footer').getBoundingClientRect();
    const body=document.querySelector('#sheetForm .keyboard-form-sheet__body'),rect=body.getBoundingClientRect();
    return {inputBottom:input.bottom,footerTop:footer.top,footerBottom:footer.bottom,height:innerHeight,bodyTop:rect.top,bodyBottom:rect.bottom,scroll:body.scrollTop,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,active:document.activeElement?.name};
   });
   await page.screenshot({path:path.join(evidence,`goal-keyboard-${safari?'webkit':'chrome'}-${width}.png`)});
   assert.ok(keyboard.inputBottom<=keyboard.footerTop+1,JSON.stringify(keyboard));assert.ok(keyboard.footerBottom<=keyboard.height+1,JSON.stringify(keyboard));
   await page.setViewportSize({width,height});await page.locator('#sheetForm button[type=submit]').tap();await page.waitForFunction(()=>state.longTermGoals.length===2);
   const numeric=await page.evaluate(()=>state.longTermGoals.find(g=>g.kind==='numeric').id),card=page.locator(`[data-goal-card="${numeric}"]`);
   assert.match(await card.innerText(),/剩余 6 天/);assert.match(await card.innerText(),/已完成约 56%/);
   assert.ok(Math.abs(await card.locator('progress').evaluate(el=>el.value)-.56)<.000001);
   assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
   assert.notEqual(await card.locator('.goal-card-action').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
   await page.screenshot({path:path.join(evidence,`goals-white-ui-${safari?'webkit':'chrome'}-${width}.png`),fullPage:true});
   await page.evaluate(id=>{const g=state.longTermGoals.find(g=>g.id===id);g.category='旧分类';g.description='旧描述完整保留';g.extraMetadata={retained:true};saveState();},numeric);
   await card.locator('[data-goal-edit]').tap();assert.equal(await page.locator('#sheetForm [name=current]').inputValue(),'57.2');
   await page.locator('#sheetForm [name=current]').fill('55');await page.locator('#sheetForm button[type=submit]').tap();
   await page.waitForFunction(id=>state.longTermGoals.find(g=>g.id===id).current===55,numeric);
   assert.deepEqual(await page.evaluate(id=>{const g=state.longTermGoals.find(g=>g.id===id);return [g.category,g.description,g.extraMetadata.retained];},numeric),['旧分类','旧描述完整保留',true]);
   const legacy=await page.evaluate(()=>saveGoal({name:'原有里程碑目标',kind:'milestones',milestones:[{id:'stable-m',name:'原来的行动',done:false}],deadline:'2026-11-22',reward:200,penalty:'原约定',category:'保留分类',description:'保留原描述'}));
   await page.evaluate(id=>editGoal(id),legacy);
   assert.equal(await page.locator('#sheetForm [name=kind],#goalMilestones,[data-toggle-goal-numeric]').count(),0);
   await page.locator('#sheetForm [name=penalty]').fill('更新后的约定\n第二行仍然保留');await page.locator('#sheetForm button[type=submit]').tap();
   await page.waitForFunction(id=>state.longTermGoals.find(g=>g.id===id).penalty==='更新后的约定\n第二行仍然保留',legacy);
   await page.evaluate(id=>editGoal(id),legacy);assert.equal(await page.locator('#sheetForm [name=penalty]').inputValue(),'更新后的约定\n第二行仍然保留');
   await page.locator('#sheetForm button[type=submit]').tap();
   assert.deepEqual(await page.evaluate(id=>{const g=state.longTermGoals.find(g=>g.id===id);return {kind:g.kind,milestones:g.milestones,category:g.category,description:g.description};},legacy),
    {kind:'milestones',milestones:[{id:'stable-m',name:'原来的行动',done:false}],category:'保留分类',description:'保留原描述'});
   await page.locator(`[data-goal-card="${completion}"] [data-goal-settle]`).tap();await page.locator('#confirmAcceptBtn').tap();
   await page.waitForFunction(()=>state.coins===500);await page.evaluate(id=>settleGoal(id),completion);assert.equal(await page.evaluate(()=>state.coins),500);
   await card.locator('[data-goal-detail]').tap();await page.locator('#sheetForm [data-goal-settle]').tap();await page.locator('#confirmAcceptBtn').tap();
   await page.waitForFunction(()=>state.coins===1000);await page.locator('#sheetForm button[type=submit]').tap();
   await page.locator('[data-goal-filter=ended]').tap();assert.equal(await page.locator('[data-goal-card]').count(),2);
   await page.locator('[data-goal-filter=active]').tap();
   const long=await page.evaluate(()=>saveGoal({name:'长期目标 VeryLongGoalNameWithoutAnyBreaks'.repeat(4),kind:'numeric',start:0,current:500000000000,target:1000000000000,unit:'公里',deadline:'2026-11-22',reward:500.79,penalty:'这是需要完整保留并自然换行的较长失败约定'.repeat(3),milestones:[]}));
   await page.evaluate(()=>renderGoals());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator(`[data-goal-card="${long}"] progress`).evaluate(el=>el.value),.5);
   await page.clock.setFixedTime(new Date('2026-11-23T10:00:00+08:00'));await page.evaluate(async()=>{await refreshGoals();await refreshGoals();});
   assert.equal(await page.evaluate(id=>state.longTermGoals.find(g=>g.id===id).log.filter(l=>l.action==='failed').length,legacy),1);
   assert.equal(await page.evaluate(()=>state.coins),1000);
   await page.reload();await page.waitForFunction(()=>LifeOSPersistence.writable);
   assert.equal(await page.evaluate(()=>state.longTermGoals.length),4);assert.equal(await page.evaluate(()=>state.coins),1000);
   assert.equal(await page.evaluate(()=>state.history.filter(e=>e.type==='goal_reward').length),2);
   assert.equal(await page.evaluate(id=>state.longTermGoals.find(g=>g.id===id).milestones[0].id,legacy),'stable-m');
   assert.deepEqual(errors,[]);console.log(JSON.stringify({width,whiteCards:true,optionalNumeric:true,legacyFields:true,rewardOnce:true,expiryOnce:true,keyboardSimulation:true,icons:true,reload:true}));
   await context.close();
  }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
