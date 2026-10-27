const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
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
    const safari = process.env.LIFEOS_BROWSER === 'webkit';
    browser = await (safari ? webkit : chromium).launch({ executablePath: safari ? process.env.WEBKIT_PATH : process.env.CHROMIUM_PATH });
    const sizes = process.env.LIFEOS_BASELINE ? [[393, 852]] : process.env.LIFEOS_TEST_VIEWPORTS ? JSON.parse(process.env.LIFEOS_TEST_VIEWPORTS) : [[390, 844], [393, 852], [430, 932], [375, 667], [320, 568]];
    for (const [width, height] of sizes) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-28T12:00:00+08:00'));
      const cdp = safari ? null : await context.newCDPSession(page);
      await page.goto(process.env.LIFEOS_TEST_URL || 'http://127.0.0.1:' + server.address().port);
      await page.addStyleTag({ content: '* {animation:none !important;transition:none !important}' });
      // Supply notch/Home Indicator insets to the same CSS variables used by the real device env() values.
      await page.addStyleTag({ content: `#dayDetailBackdrop {--day-detail-safe-top:${width === 320 ? 20 : 59}px;--day-detail-safe-bottom:${width === 320 ? 0 : 34}px}` });
      await page.evaluate(() => document.addEventListener('touchstart', event => {
        const touch = event.touches[0]; window.dayDetailLastTouch = { x: touch.clientX, y: touch.clientY, target: event.target.outerHTML };
      }, { passive: true }));
      for (const count of process.env.LIFEOS_BASELINE ? [36] : [0, 1, 4, 10, 36]) {
        await page.evaluate(count => {
          state = cloneEmptyState(); state.fixedRewardRulesSince = dateKey(); state.settledThroughDate = yesterdayKey();
          state.history = Array.from({ length: count }, (_, i) => ({
            id: 'record-' + i, type: i % 3 ? 'habit_completed' : 'habit_failed', habitId: 'habit-' + i,
            name: '当天习惯记录 ' + i, coins: i % 3 ? 5 : 50, coinDelta: i % 3 ? 5 : -50,
            date: '2026-10-27', timestamp: new Date(Date.parse('2026-10-27T09:00:00+08:00') + i * 60000).toISOString(),
            source: 'behavior', category: 'habit_performance', affectsBehaviorScore: true
          }));
          switchView('stats', { scrollTop: 0 }); render(); window.scrollTo(0, 150);
          window.scrollBeforeDayDetail = scrollY;
          window.historyBeforeDayDetail = JSON.stringify(state.history);
          openDayDetail('2026-10-27');
        }, count);
        await page.waitForTimeout(200);
        const geometry = () => page.evaluate(() => {
          const sheet = document.querySelector('.day-detail-sheet');
          const list = sheet.querySelector('.day-timeline-list');
          const rect = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
          return { sheet: rect(sheet), header: rect(sheet.querySelector('.sheet-header')), summary: rect(sheet.querySelector('.detail-summary-grid')),
            close: rect(document.getElementById('closeDayDetailBtn')), scrollY,
            contentOverflow: getComputedStyle(els.dayDetailContent).overflowY,
            list: list ? { ...rect(list), clientHeight: list.clientHeight, scrollHeight: list.scrollHeight, scrollTop: list.scrollTop, overflow: getComputedStyle(list).overflowY } : null,
            metrics: [...sheet.querySelectorAll('.detail-metric')].map(el => el.innerText),
            viewport: { width: innerWidth, height: innerHeight, scale: visualViewport.scale }, lastTouch: window.dayDetailLastTouch,
            safeTop: parseFloat(getComputedStyle(els.dayDetailBackdrop).paddingTop), safeBottom: parseFloat(getComputedStyle(els.dayDetailBackdrop).paddingBottom) };
        });
        const before = await geometry();
        if (process.env.LIFEOS_BASELINE) {
          await page.evaluate(() => { document.querySelector('.day-timeline-list').scrollTop = 100000; });
          console.log(JSON.stringify({ baseline: true, width, height, before, after: await geometry() }));
          continue;
        }
        assert.ok(before.sheet.top >= before.safeTop - 1 && before.sheet.bottom <= height - before.safeBottom + 1, JSON.stringify(before));
        assert.ok(before.close.top >= before.sheet.top && before.close.bottom <= before.sheet.bottom);
        assert.equal(before.contentOverflow, 'hidden');
        assert.equal(await page.locator('body.modal-open').count(), 1);
        assert.equal(await page.locator('.day-timeline-row').count(), count);
        if (count) {
          assert.equal(before.list.overflow, 'auto'); assert.ok(before.list.clientHeight > 0);
          assert.ok(before.list.bottom <= before.sheet.bottom);
          if (before.list.scrollHeight > before.list.clientHeight + 1) {
            if (cdp) {
              const bounds = await page.locator('.day-timeline-list').boundingBox();
              const x = bounds.x + bounds.width / 2, startY = bounds.y + bounds.height / 2;
              const distance = Math.min(170, bounds.height / 2 - 12);
              for (let i = 0; i < 50; i++) {
                try {
                  await cdp.send('Input.synthesizeScrollGesture', { x, y: startY, yDistance: -distance, speed: 800, gestureSourceType: 'touch' });
                } catch (error) { console.error(JSON.stringify({width,height,count,bounds,layout:await cdp.send('Page.getLayoutMetrics')})); throw error; }
                await page.waitForTimeout(35);
                const end = await page.locator('.day-timeline-list').evaluate(el => el.scrollTop >= el.scrollHeight - el.clientHeight - 2);
                if (end) break;
              }
              try {
                await page.waitForFunction(() => { const el = document.querySelector('.day-timeline-list'); return el.scrollTop >= el.scrollHeight - el.clientHeight - 2; }, null, { timeout: 3000 });
              } catch (error) {
                console.error(JSON.stringify({ width, height, count, before, after: await geometry(), hit: await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML, { x, y: startY }) }));
                throw error;
              }
              assert.equal(await page.locator('#sheetBackdrop').isVisible(), false);
            }
            // WebKit automation cannot synthesize native iPhone touch scrolling; verify its scroll container directly.
            if (safari) await page.locator('.day-timeline-list').evaluate(el => { el.scrollTop = el.scrollHeight; });
            const last = await page.locator('.day-timeline-row').last().boundingBox();
            const after = await geometry();
            assert.ok(after.list.scrollTop > 0); assert.ok(last.y + last.height <= after.list.bottom + 1);
            assert.equal(after.header.top, before.header.top); assert.equal(after.summary.top, before.summary.top);
            assert.deepEqual(after.metrics, before.metrics); assert.equal(after.close.top, before.close.top);
            if (count === 36) {
              await page.locator('.day-timeline-row').last().tap();
              assert.equal(await page.locator('#sheetBackdrop').isVisible(), true);
              await page.locator('#closeSheetBtn').tap();
              assert.equal(await page.locator('body.modal-open').count(), 1);
              assert.equal(await page.locator('#dayDetailBackdrop').isVisible(), true);
            }
            if (cdp) {
              await page.waitForTimeout(100);
              const bounds = await page.locator('.day-timeline-list').boundingBox();
              await cdp.send('Input.synthesizeScrollGesture', { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
                yDistance: Math.min(100, bounds.height / 2 - 12), speed: 800, gestureSourceType: 'touch' });
              await page.waitForFunction(top => document.querySelector('.day-timeline-list').scrollTop < top, after.list.scrollTop, { timeout: 3000 });
            }
            await page.locator('.day-timeline-list').evaluate(el => { el.scrollTop = 0; });
            assert.equal((await geometry()).list.scrollTop, 0);
          } else {
            const last = await page.locator('.day-timeline-row').last().boundingBox();
            assert.ok(Math.abs(last.y + last.height - before.list.bottom) < 2, 'Short lists must not stretch into blank space');
          }
        } else assert.ok(before.sheet.height < height * 0.8, 'Empty day should remain content-sized');
        // A touch on the fixed summary must not scroll the background or the whole dialog.
        if (cdp) {
          const box = await page.locator('.detail-summary-grid').boundingBox(), x = box.x + 20, y = box.y + 20;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 60 }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
        assert.equal(await page.evaluate(() => scrollY), await page.evaluate(() => window.scrollBeforeDayDetail));
        assert.equal(await page.evaluate(() => JSON.stringify(state.history)), await page.evaluate(() => window.historyBeforeDayDetail));
        await page.locator('#closeDayDetailBtn').tap(); assert.equal(await page.locator('body.modal-open').count(), 0);
        assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).overflowY), 'hidden');
        console.log(JSON.stringify({ width, height, count, visibleHeight: before.sheet.height, scrollHeight: before.list?.scrollHeight, clientHeight: before.list?.clientHeight, passed: true }));
      }
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
