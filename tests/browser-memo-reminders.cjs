const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
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
      await page.clock.install({time:new Date('2026-09-13T10:30:00Z')});
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.addStyleTag({content:'* {animation:none !important;transition:none !important}'});
      await page.evaluate(()=>{
        state=cloneEmptyState();state.coins=100;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
        state.memos=['旅行装/手机防水壳','中东/东欧旅游计划','清action','filthy baby调色'].map((text,i)=>({id:'m'+i,text,createdAt:'2026-09-12T10:00:0'+(4-i)+'Z'}));
        saveState();render();
      });
      assert.equal(await page.locator('#homeMemoList [data-toggle-memo]').count(),height < 900 ? 2 : 3);
      assert.equal(await page.locator('[data-memo-card], [data-arrange-memo]').count(),0);
      assert.equal(await page.evaluate(()=>habitDragTargetFromEvent({target:document.querySelector('#homeMemoList .memo-reminder-text')})),null);
      await page.evaluate(()=>{openArrangementSheet('MEMO','m0');dropTaskMaterial({sourceType:'MEMO',memoId:'m0'},new Date());});
      assert.equal(await page.locator('#sheetBackdrop').isVisible(),false);
      assert.equal(await page.evaluate(()=>state.tasks.length),0);
      await page.locator('#homeMemoList [data-toggle-memo="m0"]').tap();
      await page.clock.runFor(200);
      assert.equal(await page.locator('#homeMemoList [data-toggle-memo="m0"]').count(),0);
      assert.equal(await page.evaluate(()=>state.coins),100);
      assert.equal(await page.evaluate(()=>state.history.length),0);
      await page.locator('[data-contextual-undo]').tap();
      assert.equal(await page.locator('#homeMemoList [data-toggle-memo]').first().getAttribute('data-toggle-memo'),'m0');
      await page.locator('.memo-heading-button').tap();
      await page.clock.runFor(250);
      assert.equal(await page.locator('#memoList [data-toggle-memo]').count(),4);
      assert.equal(await page.locator('#memoForm').isVisible(),false);
      await page.screenshot({path:path.join(evidence,'memo-list-'+width+'.png')});
      await page.locator('#memoList [data-toggle-memo="m0"]').tap();
      await page.clock.runFor(3800);
      assert.equal(await page.locator('[data-contextual-undo]').count(),0);
      await page.locator('#memoBackdrop [data-add-memo]').tap();
      await page.locator('#memoInput').fill('新提醒');
      await page.locator('#memoInput').press('Enter');
      assert.equal(await page.locator('#memoList .memo-reminder-text').first().innerText(),'新提醒');
      await page.locator('#memoList .memo-reminder-text').first().tap();
      await page.locator('#memoInput').fill('编辑后的提醒');
      await page.setViewportSize({width,height:400});
      await page.locator('#saveMemoBtn').tap();
      assert.equal(await page.locator('#memoList .memo-reminder-text').first().innerText(),'编辑后的提醒');
      await page.setViewportSize({width,height});
      await page.locator('#memoList .memo-reminder-text').first().tap();
      await page.locator('#memoEditDelete').tap();
      await page.locator('#confirmCancelBtn').tap();
      assert.equal(await page.evaluate(()=>state.memos.length),5);
      await page.locator('#memoEditDelete').tap();
      await page.locator('#confirmAcceptBtn').tap();
      assert.equal(await page.evaluate(()=>state.memos.length),4);
      await page.reload();
      assert.equal(await page.locator('#homeMemoList [data-toggle-memo="m0"]').count(),0);
      assert.equal(await page.evaluate(()=>state.memos.find(m=>m.id==='m0').status),'COMPLETED');
      assert.equal(await page.evaluate(()=>state.tasks.length),0);
      assert.equal(await page.evaluate(()=>state.coins),100);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.addStyleTag({content:'* {animation:none !important;transition:none !important}'});
      await page.screenshot({path:path.join(evidence,'memo-home-'+width+'.png'),fullPage:true});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({width,homeTick:true,fullListTick:true,undo:true,persistence:true,addEditDelete:true,coinsUnchanged:true,errors}));
      await context.close();
    }
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
