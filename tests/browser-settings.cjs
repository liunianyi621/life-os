const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+'/')) return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{
    if(error)return res.writeHead(404).end();
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)]||'application/json');res.end(data);
  });
});
(async()=>{
  let browser;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
    for(const [width,height] of [[390,844],[393,852],[430,932]]) {
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London',acceptDownloads:true});
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(()=>{state=cloneEmptyState();state.coins=500;state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();saveState();render();});
      assert.equal(await page.locator('[data-nav]').count(),5);
      await page.locator('[data-nav="stats"]').click();
      assert.equal(await page.locator('[data-view="stats"] [data-export-backup], [data-view="stats"] #resetAllBtn').count(),0);
      await page.locator('[data-stats-range="year"]').click();
      const before=await page.evaluate(()=>window.scrollY);
      await page.evaluate(()=>document.querySelector('[data-open-settings]').click());
      await page.locator('[data-settings-back]').click();
      assert.equal(await page.evaluate(()=>currentStatsRange),'year');
      assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-before)<2);
      await page.locator('[data-open-settings]').click();
      assert.equal(await page.locator('.nav-button.active').getAttribute('data-nav'),'stats');
      await page.waitForTimeout(350);
      assert.equal(await page.locator('#settingsTitle').innerText(),'设置');
      const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
      await page.screenshot({path:path.join(evidence,`settings-home-${width}.png`)});
      await page.locator('[data-settings-page="economy"]').click();
      for(const [key,val] of [['defaultTaskReward',20],['habitReward',10],['penaltyMultiplier',5]]) {
        await page.locator(`[data-setting-select="${key}"]`).click();
        await page.locator(`[data-setting-key="${key}"][data-setting-value="${val}"]`).click();
        assert.equal(await page.evaluate(key=>state.settings.economy[key],key),val);
      }
      await page.screenshot({path:path.join(evidence,`settings-economy-${width}.png`)});
      await page.locator('[data-settings-page="priority"]').click();
      for(const [key,val] of [['priorityReward',200],['priorityPenalty',1000]]) {
        await page.locator(`[data-setting-select="${key}"]`).click();
        await page.locator(`[data-setting-key="${key}"][data-setting-value="${val}"]`).click();
      }
      await page.locator('[data-settings-back]').click();await page.locator('[data-settings-back]').click();
      await page.locator('[data-settings-page="settlement"]').click();
      await page.locator('[data-settlement-toggle="autoFailTimedTasks"]').uncheck();
      await page.locator('[data-settlement-toggle="autoFailHabitsDaily"]').uncheck();
      assert.equal(await page.evaluate(()=>taskDeadlineTimer),null);
      await page.screenshot({path:path.join(evidence,`settings-settlement-${width}.png`)});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.reload();
      assert.equal(await page.evaluate(()=>currentSettings().settlement.autoFailTimedTasks),false);
      assert.equal(await page.evaluate(()=>defaultTaskReward()),20);
      await page.locator('[data-open-task]').click();
      assert.equal(await page.locator('#sheetForm [name="coins"]:checked').inputValue(),'20');
      await page.locator('#sheetForm [name="name"]').fill('可以自选奖励');
      await page.locator('#sheetForm [name="coins"][value="10"]').check();
      await page.locator('#sheetForm [type="submit"]').click();
      assert.equal(await page.evaluate(()=>state.tasks[0].reward),10);
      await page.locator('[data-complete-task]').click();await page.waitForTimeout(450);
      assert.equal(await page.evaluate(()=>state.coins),510);
      await page.locator('[data-nav="stats"]').click();await page.locator('[data-open-settings]').click();
      await page.locator('[data-settings-page="data"]').click();
      const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export-backup]').click()]);
      const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      assert.equal(backup.data.settings.economy.defaultTaskReward,20);
      await page.evaluate(()=>{state.coins=999;saveState();});
      await page.locator('#lifeosBackupFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
      await page.locator('#confirmAcceptBtn').click();
      assert.equal(await page.evaluate(()=>state.coins),510);
      assert.equal(await page.evaluate(()=>state.settings.economy.priorityPenalty),1000);
      const beforeInvalid=await page.evaluate(()=>JSON.stringify(state));
      await page.locator('#lifeosBackupFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
      await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeInvalid);
      await page.locator('[data-settings-back]').click();await page.locator('[data-settings-page="advanced"]').click();
      await page.locator('#resetAllBtn').click();
      assert.match(await page.locator('#confirmMessage').innerText(),/永久清除.*建议先导出备份/);
      await page.locator('#confirmCancelBtn').click();assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeInvalid);
      await page.locator('#resetAllBtn').click();await page.locator('#confirmAcceptBtn').click();
      assert.equal(await page.evaluate(()=>state.coins),0);assert.equal(await page.evaluate(()=>state.settings.economy.defaultTaskReward),5);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);console.log(JSON.stringify({width,height,settings:true,backup:true,reset:true,overflow:false,errors}));
      await context.close();
    }
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
