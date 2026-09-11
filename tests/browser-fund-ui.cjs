const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
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
  let browser;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
    for(const [width,height] of [[390,844],[393,852],[430,932]]) {
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(()=>{
        state=cloneEmptyState();state.fixedRewardRulesSince=dateKey();state.settledThroughDate=yesterdayKey();state.coins=150.79;
        state.rewards=[
          {id:'antarctic',name:'南极基金',totalCoins:50000,currentCoins:0,amountPerDeposit:100},
          {id:'world',name:'环球旅行',totalCoins:100000,currentCoins:0,amountPerDeposit:100},
          {id:'east',name:'中东基金',totalCoins:10000,currentCoins:9000,amountPerDeposit:100}
        ];saveState();render();
      });
      await page.locator('[data-nav="rewards"]').click();
      await page.waitForTimeout(350);
      assert.equal(await page.locator('#rewardList .q-row-tile').count(),0);
      assert.deepEqual(await page.locator('.fund-percentage').allTextContents(),['0%','0%','90%']);
      const layout=await page.evaluate(()=>({
        balanceHeight:document.querySelector('.balance-strip').getBoundingClientRect().height,
        listBottom:document.querySelector('#rewardList').getBoundingClientRect().bottom,
        navTop:document.querySelector('.bottom-nav').getBoundingClientRect().top,
        overflow:document.documentElement.scrollWidth>innerWidth
      }));
      assert.ok(layout.balanceHeight<100);assert.ok(layout.listBottom<layout.navTop);assert.equal(layout.overflow,false);
      const evidence=path.join(root,'outputs/life-rpg/test-evidence');fs.mkdirSync(evidence,{recursive:true});
      await page.screenshot({path:path.join(evidence,`fund-${width}.png`),fullPage:true});
      await page.locator('[data-deposit-fund="antarctic"]').click();
      assert.equal(await page.evaluate(()=>state.coins),50.79);
      assert.equal(await page.evaluate(()=>state.rewards[0].currentCoins),100);
      await page.locator('[data-contextual-undo]').focus();await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>state.coins),150.79);
      assert.equal(await page.evaluate(()=>state.rewards[0].currentCoins),0);
      await page.waitForTimeout(850);
      assert.equal(await page.locator('#rewardCoins').innerText(),'150.79');
      await page.locator('.q-rewards-page header [data-open-reward]').click();
      await page.locator('#sheetForm [name="name"]').fill('新的目标');
      await page.locator('#sheetForm [name="totalCoins"]').fill('1000');
      await page.locator('#sheetForm [name="amountPerDeposit"]').fill('10');
      await page.locator('#sheetForm [type="submit"]').click();
      assert.equal(await page.evaluate(()=>state.rewards.length),4);
      await page.evaluate(()=>{
        state.rewards=state.rewards.slice(0,3);
        state.rewards[0].name='一个很长的基金名称，需要完整阅读而不是被图标挤掉';
        state.rewards[0].totalCoins=999999999;
        state.rewards[2].currentCoins=10000;render();
      });
      assert.equal(await page.locator('.fund-completed .fund-goal-status').innerText(),'已达成');
      assert.equal(await page.locator('.fund-completed [data-deposit-fund]').count(),0);
      assert.ok(await page.locator('.fund-completed button').isDisabled());
      assert.ok(await page.locator('.fund-heading h3').first().evaluate(el=>el.scrollHeight<=el.clientHeight && el.scrollWidth<=el.clientWidth));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.waitForTimeout(4000);
      await page.screenshot({path:path.join(evidence,`fund-long-completed-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({width,height,layout,create:true,deposit:true,undo:true,states:[0,90,100],errors}));
      await context.close();
    }
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
