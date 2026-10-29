const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).routes;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const redirect = routes.find(route => route.status === 307 && new RegExp('^' + route.src + '$').test(pathname));
  if (redirect) return res.writeHead(redirect.status, redirect.headers).end();
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const useWebkit = process.env.LIFEOS_BROWSER === 'webkit';
    browser = await (useWebkit ? webkit : chromium).launch({
      executablePath: useWebkit ? process.env.WEBKIT_PATH : process.env.CHROMIUM_PATH
    });
    const base = process.env.LIFEOS_TEST_URL || `http://127.0.0.1:${server.address().port}`;
    for (const [width, height] of [[390, 844], [393, 852], [430, 932]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, timezoneId: 'Europe/London' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-29T10:30:00Z'));
      await page.goto(base);
      await page.evaluate(() => {
        state = cloneEmptyState();
        state.fixedRewardRulesSince = dateKey();
        state.settledThroughDate = yesterdayKey();
        state.calendarEvents = [
          { id: 'single', title: '拍摄', startDate: '2026-09-15', endDate: '2026-09-15', category: 'normal' },
          { id: 'trip', title: '历史跨月旅行计划', startDate: '2026-09-28', endDate: '2026-10-04', category: 'important' },
          { id: 'year', title: '跨年', startDate: '2026-12-30', endDate: '2027-01-03', category: 'normal' }
        ].map(normalizeCalendarEvent);
        saveState(); render();
      });
      const original = await page.evaluate(() => JSON.stringify(state.calendarEvents));
      const ledger = await page.evaluate(() => JSON.stringify({ coins: state.coins, history: state.history }));
      assert.deepEqual(await page.locator('.bottom-nav [data-nav]').evaluateAll(nodes => nodes.map(node => [node.dataset.nav, node.innerText.trim()])),
        [['today', '今天'], ['review', '复盘'], ['rewards', '奖励'], ['stats', '统计']]);
      assert.equal(await page.locator('[data-view="calendar"], [data-calendar-day], [data-calendar-event], [data-calendar-add-selected]').count(), 0);
      const boxes = await page.locator('.bottom-nav [data-nav]').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(), style = getComputedStyle(node);
        return { width: box.width, height: box.height, align: style.alignItems, justify: style.justifyContent };
      }));
      assert.ok(boxes.every(box => box.width >= 44 && box.height >= 44 && Math.abs(box.width - boxes[0].width) < 1
        && box.align === 'center' && box.justify === 'center'));
      for (const view of ['review', 'rewards', 'stats', 'today']) {
        await page.locator(`[data-nav="${view}"]`).click();
        assert.equal(await page.locator('.view.active').getAttribute('data-view'), view);
      }
      for (const invoke of ['switchView("calendar")', 'openCalendarEventSheet("trip")', 'openCalendarEventActionSheet("trip")']) {
        await page.evaluate(invoke);
        assert.equal(await page.locator('.view.active').getAttribute('data-view'), 'today');
        assert.equal(await page.locator('#sheetBackdrop').isVisible(), false);
        assert.equal(await page.locator('.nav-button.active').getAttribute('data-nav'), 'today');
      }
      const backup = await page.evaluate(() => createLifeOSBackup());
      assert.equal(JSON.stringify(backup.data.calendarEvents), original);
      // Old version-1 backups predate Settings, Focus and Daily Tasks.
      delete backup.data.settings; delete backup.data.currentFocus; delete backup.data.dailyTasks;
      await page.evaluate(backup => restoreLifeOSBackup(backup), backup);
      for (const suffix of ['/#calendar', '/?view=calendar', '/calendar', '/calendar/', '/calendar.html', '/calendar/2026-09']) {
        await page.goto(base.replace(/\/$/, '') + suffix);
        assert.equal(await page.locator('.view.active').getAttribute('data-view'), 'today');
        assert.equal(await page.evaluate(() => JSON.stringify(state.calendarEvents)), original);
        assert.equal(await page.evaluate(() => JSON.stringify({ coins: state.coins, history: state.history })), ledger);
      }
      await page.reload();
      assert.equal(await page.locator('.nav-button.active').getAttribute('data-nav'), 'today');
      assert.equal(await page.evaluate(() => JSON.stringify(createLifeOSBackup().data.calendarEvents)), original);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const nav = await page.locator('.bottom-nav').boundingBox();
      assert.ok(nav.y >= 0 && nav.y + nav.height <= height);
      assert.deepEqual(errors, []);
      const evidence = path.join(root, 'outputs/life-rpg/test-evidence');
      fs.mkdirSync(evidence, { recursive: true });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(evidence, `four-tabs-${useWebkit ? 'webkit' : 'chrome'}-${width}.png`) });
      console.log(JSON.stringify({ width, height, fourTabs: true, oldRoutes: true, calendarDataPreserved: true, oldBackup: true }));
      await context.close();
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
