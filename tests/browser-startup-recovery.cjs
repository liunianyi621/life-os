const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../outputs/life-rpg');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+'/'))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
    const url=process.env.LIFEOS_TEST_URL || 'http://127.0.0.1:'+server.address().port;
    for(const [width,height] of [[390,844],[393,852],[430,932]]){
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);
      assert.equal(await page.locator('[data-view="today"]').isVisible(),true);
      await page.evaluate(()=>{
        state=cloneEmptyState();state.coins=1234;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();
        state.memos=[{id:'keep',text:'保留旧提醒'},null];state.tasks=[null];state.habits=[null];saveState();
      });
      await page.reload();
      assert.equal(await page.locator('#homeMemoList [data-toggle-memo="keep"]').count(),1);
      assert.equal(await page.evaluate(()=>state.coins),1234);
      assert.equal(await page.evaluate(()=>state.storageRecovery[0].records.length),3);
      for(const view of ['calendar','review','rewards','stats','today']){
        await page.locator('[data-nav="'+view+'"]').tap();
        assert.equal(await page.locator('[data-view="'+view+'"]').isVisible(),true);
        assert.ok((await page.locator('[data-view="'+view+'"]').innerText()).length>10);
      }
      await page.reload();
      assert.equal(await page.evaluate(()=>state.storageRecovery.length),1);
      assert.deepEqual(errors,[]);
      await page.evaluate(()=>{renderMemoSummary=()=>{throw Error('isolated render fixture')};render();});
      assert.equal(await page.locator('#appRecoveryNotice').isVisible(),true);
      assert.ok((await page.locator('#habitList').innerHTML()).length>0);
      await page.evaluate(()=>localStorage.setItem(STORAGE_KEY,'{broken'));
      await page.reload();
      assert.equal(await page.locator('#appRecoveryNotice').isVisible(),true);
      assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),'{broken');
      await page.evaluate(()=>runAutomaticChecks());
      assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),'{broken');
      assert.deepEqual(errors,[]);
      await context.close();
    }
    const context=await browser.newContext(),page=await context.newPage();
    await page.route('**/js/ui.js*',route=>route.abort());
    await page.goto(url);
    assert.equal(await page.locator('#appRecoveryNotice').isVisible(),true);
    assert.match(await page.locator('#appRecoveryNotice').innerText(),/加载失败/);
    await context.close();
    console.log('Startup recovery: production build, all five views, three mobile viewports, old data, reload, unreadable JSON, isolated render failure and failed script PASS ('+url+')');
  }finally{if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
