const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)] || 'application/json');
    res.end(data);
  });
});
(async () => {
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    for (const [width, height] of [[390,844],[393,852],[430,932]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(() => {
        state = cloneEmptyState(); state.fixedRewardRulesSince = dateKey(); state.settledThroughDate = yesterdayKey();
        for (let i = 0; i < 365; i++) {
          const day = shiftDateKey(dateKey(), -i);
          state.dailyReviews[day] = i % 6 ? {dailyScore:1 + i % 10} : {};
        }
        saveState(); render();
      });
      await page.locator('[data-nav="stats"]').click();
      const chart = page.locator('#dailyScoreTrendChart');
      const evidence = path.join(root, 'outputs/life-rpg/test-evidence'); fs.mkdirSync(evidence, {recursive:true});
      const heights = [];
      for (const [range, count] of [['week',7],['month',30],['year',12]]) {
        await page.locator(`[data-stats-range="${range}"]`).click();
        await chart.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
        assert.equal(await chart.locator('[data-score-trend-point]').count(), count);
        assert.equal(await chart.locator('.daily-score-bar').count(), 0);
        const layout = await chart.evaluate(el => {
          const bounds = el.getBoundingClientRect();
          const labels = [...el.querySelectorAll('.daily-score-axis span')].filter(el => el.textContent);
          return {width:bounds.width,height:bounds.height,overflow:el.scrollWidth > el.clientWidth,
            pageOverflow:document.documentElement.scrollWidth > innerWidth,
            labelsFit:labels.every(el => {const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return b.left>=bounds.left && b.right<=bounds.right;}),
            count:labels.length};
        });
        assert.equal(layout.overflow, false); assert.equal(layout.pageOverflow, false); assert.equal(layout.labelsFit, true);
        assert.ok(layout.count <= (range === 'week' ? 7 : 5)); heights.push(layout.height);
        const point = chart.locator('.daily-score-point:not(.unscored)').first();
        await point.tap();
        assert.ok(await chart.locator('.daily-score-tooltip').isVisible());
        if (range === 'year') assert.match(await chart.locator('.daily-score-tooltip').innerText(), /月平均评分.*天/s);
        await chart.screenshot({path:path.join(evidence,`score-${range}-${width}.png`)});
        console.log(JSON.stringify({width,range,layout}));
      }
      assert.ok(Math.max(...heights)-Math.min(...heights)<=2);
      for (const kind of ['empty','single','sparse']) {
        await page.evaluate(kind => {
          state.dailyReviews = {};
          if (kind !== 'empty') state.dailyReviews[dateKey()] = {dailyScore:7};
          if (kind === 'sparse') state.dailyReviews[shiftDateKey(dateKey(), -60)] = {dailyScore:4};
          selectedDailyScoreTrendKey = null; currentStatsRange = 'year'; renderStatsVisuals();
        }, kind);
        assert.equal(await chart.locator('.daily-score-dot').count(), kind === 'empty' ? 0 : kind === 'single' ? 1 : 2);
        assert.equal(await chart.locator('polyline').count(), 0);
        await chart.screenshot({path:path.join(evidence,`score-${kind}-${width}.png`)});
      }
      await page.evaluate(() => {state.dailyReviews[dateKey()].dailyScore=9;renderStatsVisuals();});
      assert.match(await chart.locator('.daily-score-summary').innerText(), /平均 6.5/);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
