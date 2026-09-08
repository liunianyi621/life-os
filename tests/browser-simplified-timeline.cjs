const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', type[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    for (const width of [375, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/London' });
      const page = await context.newPage();
      const imageDir = path.join(root, 'outputs/life-rpg/test-evidence');
      fs.mkdirSync(imageDir, { recursive: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.clock.setFixedTime(new Date('2026-09-08T18:36:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(() => {
        state = cloneEmptyState();
        state.pastCoinHistoryScaleMigrationVersion = 1;
        state.settledThroughDate = dateKey();
        state.habits = [{ id: 'test-habit', name: 'Duolingo', coins: 10, createdDate: dateKey() }];
        state.memos = [{ id: 'test-memo', text: '买转换插头', completed: false, createdAt: new Date().toISOString() }];
        saveState();
        render();
      });
      const slots = page.locator('[data-task-timeline-slot]');
      assert.equal(await slots.count(), 3);
      assert.deepEqual(await slots.locator('time').allTextContents(), ['20:00', '21:00', '22:00']);

      const cdp = await context.newCDPSession(page);
      for (const [selector, source] of [['[data-habit-card="test-habit"]', 'HABIT'], ['[data-memo-card="test-memo"]', 'MEMO']]) {
        const chip = page.locator(selector);
        await chip.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.waitForTimeout(200);
        const from = await chip.boundingBox();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2 }] });
        await page.waitForTimeout(450);
        assert.equal(await slots.count(), 3, 'dragging must not expand empty slots');
        assert.equal(await page.locator('.habit-drag-preview').count(), 1, JSON.stringify(await page.evaluate(() => ({ phase: activeHabitDrag?.phase, y: scrollY }))));
        const before = await page.evaluate(() => ({ scroll: scrollY, preview: document.querySelector('.habit-drag-preview').style.transform }));
        const to = await slots.nth(source === 'HABIT' ? 1 : 0).boundingBox();
        assert.ok(to.y >= 0 && to.y + to.height / 2 < 844, 'drop target visible');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to.x + to.width / 2, y: to.y + to.height / 2 }] });
        const after = await page.evaluate(() => ({ scroll: scrollY, preview: document.querySelector('.habit-drag-preview').style.transform }));
        assert.equal(after.scroll, before.scroll);
        assert.notEqual(after.preview, before.preview);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const task = await page.evaluate(source => state.tasks.find(task => task.source === source), source);
        assert.equal(task.status, 'waiting');
        assert.equal(task.actualStartTime, null);
        assert.equal(task.actualEndTime, null);
        assert.equal(task.isRunning, false);
        assert.equal(task.elapsedSeconds, 0);
        const row = page.locator(`[data-task-card="${task.id}"]`);
        assert.match(await row.innerText(), /等待开始/);
        assert.doesNotMatch(await row.innerText(), /已安排|撤回/);
        assert.equal(await row.locator('[data-start-task]').count(), 1);
        assert.equal(await row.locator('.inline-card-actions [data-start-task]').count(), 0);
        assert.equal(await page.locator('.task-contextual-undo-row').count(), 0);
        assert.equal(await page.locator('#toast [data-contextual-undo]').count(), 1);
        await page.screenshot({ path: path.join(imageDir, `waiting-${source}-${width}.png`), fullPage: true });
        console.log(JSON.stringify({ width, source, before, after, status: task.status }));
        if (source === 'MEMO') {
          await page.locator('#toast [data-contextual-undo]').click();
          assert.equal(await page.locator('[data-memo-card="test-memo"]').count(), 1);
        }
      }

      await page.reload();
      let running = await page.evaluate(() => state.tasks.find(task => task.source === 'HABIT'));
      assert.equal(running.status, 'waiting');
      await page.clock.setFixedTime(new Date('2026-09-08T19:17:00Z'));
      await page.locator(`[data-start-task="${running.id}"]`).click();
      running = await page.evaluate(() => state.tasks.find(task => task.source === 'HABIT'));
      assert.equal(running.actualStartTime, '2026-09-08T19:17:00.000Z');
      await page.reload();
      const row = page.locator(`[data-task-card="${running.id}"]`);
      assert.match(await row.innerText(), /开始于 20:17/);
      assert.doesNotMatch(await row.innerText(), /已进行|等待开始|\d\d:\d\d:\d\d/);
      await page.evaluate(() => {
        window.testWrites = 0;
        window.testMutations = 0;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (...args) { window.testWrites++; return original.apply(this, args); };
        new MutationObserver(records => { window.testMutations += records.length; }).observe(document.querySelector('[data-habit-task-drop-zone]'), { subtree: true, childList: true, characterData: true });
      });
      await page.waitForTimeout(3100);
      assert.deepEqual(await page.evaluate(() => [window.testWrites, window.testMutations]), [0, 0]);
      assert.equal(await page.evaluate(() => state.tasks.find(task => task.source === 'HABIT').elapsedSeconds), 0);
      await page.screenshot({ path: path.join(imageDir, `timeline-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, runningRestored: true, idleWrites: 0, idleTaskMutations: 0, consoleErrors: errors }));
      await context.close();
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
