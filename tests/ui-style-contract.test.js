const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const productionCss = fs.readFileSync(path.join(ROOT, "css/qonto-system.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const feedbackSource = fs.readFileSync(path.join(ROOT, "js/ui/feedback.js"), "utf8");
const economySource = fs.readFileSync(path.join(ROOT, "js/economy.js"), "utf8");
const sheetSource = fs.readFileSync(path.join(ROOT, "js/ui/sheets.js"), "utf8");
const timePickerSource = fs.readFileSync(path.join(ROOT, "js/ui/time-picker.js"), "utf8");
const statsSource = fs.readFileSync(path.join(ROOT, "js/stats.js"), "utf8");

test("生产样式覆盖全部热力图状态 class", () => {
  [
    "net-0",
    "net-1",
    "net-2",
    "net-3",
    "net-4",
    "bad-1",
    "bad-2",
    "bad-3",
    "empty"
  ].forEach(className => {
    assert.match(
      productionCss,
      new RegExp(`\\.calendar-heatmap \\.calendar-day\\.${className.replace("-", "\\-")}(?:\\s|,|\\{)`),
      `missing production heatmap style for ${className}`
    );
  });
});

test("MiniCal 使用独立的 Qonto 蓝和重要红色变量", () => {
  assert.match(productionCss, /\.planning-calendar\s*\{[\s\S]*--calendar-normal-marker:\s*#2f80ed;/);
  assert.match(productionCss, /\.planning-calendar\s*\{[\s\S]*--calendar-important-marker:\s*#e05252;/);
  assert.match(productionCss, /\.calendar-event-range\s*\{[\s\S]*background:\s*var\(--calendar-normal-soft\);/);
  assert.match(productionCss, /\.calendar-event-range\.calendar-event-important\s*\{[\s\S]*background:\s*var\(--calendar-important-soft\);/);
});

test("日历日期格直接复用新建计划 Sheet，计划条保持独立编辑入口", () => {
  const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
  assert.match(uiSource, /function openCalendarDateForCreate\(day\)/);
  assert.match(uiSource, /openCalendarEventSheet\(null, \{ date: selectedCalendarDate \}\)/);
  assert.match(uiSource, /class="calendar-day-cell[^\n]*data-calendar-day="\$\{escapeAttr\(day\)\}"/);
  assert.match(uiSource, /class="calendar-day-number" type="button" data-calendar-day="\$\{escapeAttr\(day\)\}"/);
  assert.match(uiSource, /calendarDayAccessibilityLabel\(day, events\.length\)/);
  assert.match(uiSource, /if \(calendarEventButton\)[\s\S]*openCalendarEventSheet\(calendarEventButton\.dataset\.calendarEvent\)/);
  assert.match(uiSource, /data-calendar-more="\$\{escapeAttr\(day\)\}"/);
  assert.match(uiSource, /let suppressCalendarDateTap = false;/);
  assert.match(uiSource, /Math\.hypot\(deltaX, deltaY\) > 12/);
  assert.doesNotMatch(productionCss, /\.calendar-day-tap-target\s*\{/);
  const calendarDayEventsRule = productionCss.match(/\.calendar-day-events\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(calendarDayEventsRule, /pointer-events\s*:/);
  assert.doesNotMatch(calendarDayEventsRule, /z-index\s*:/);
});

test("撤回提示使用单一紧凑 Snackbar 组件", () => {
  assert.match(indexHtml, /<div class="snackbar" id="toast"/);
  assert.match(feedbackSource, /function renderSnackbar\(/);
  assert.match(economySource, /renderSnackbar\(\{ \.\.\.presentation, actionLabel: undoLabel \}\)/);
  assert.doesNotMatch(economySource, /separatorEl\.textContent\s*=\s*"·"/);
  assert.doesNotMatch(economySource, /className\s*=\s*"toast-message-stacked"/);
});

test("Snackbar 保持 60px 高、白色背景并位于 sheet 下层", () => {
  assert.match(productionCss, /\.snackbar\s*\{[\s\S]*?z-index:\s*90;/);
  assert.match(productionCss, /\.snackbar\s*\{[\s\S]*?height:\s*60px;/);
  assert.match(productionCss, /\.snackbar\s*\{[\s\S]*?background:\s*#ffffff;/);
  assert.match(productionCss, /\.snackbar-action\s*\{[\s\S]*?border:\s*0;/);
  assert.match(feedbackSource, /nav\.getBoundingClientRect\(\)/);
});

test("习惯趋势柱组拥有确定宽度且三种 series 使用独立样式", () => {
  assert.match(productionCss, /\.stats-trend-chart__bar-group\s*\{[\s\S]*?width:\s*min\(22px, 100%\);/);
  assert.match(productionCss, /\.stats-trend-chart__bar\s*\{[\s\S]*?min-width:\s*1px;/);
  assert.match(productionCss, /\.stats-trend-chart__bar--completed\s*\{\s*background:\s*#75a889;/);
  assert.match(productionCss, /\.stats-trend-chart__bar--failure\s*\{\s*background:\s*#c98b82;/);
  assert.match(productionCss, /\.stats-trend-chart__bar--focus\s*\{\s*background:\s*#858e9d;/);
});

test("所有动态输入 Sheet 共用 Keyboard Form，任务时间选择保持折叠", () => {
  assert.match(sheetSource, /class="task-sheet-fields"/);
  assert.match(sheetSource, /function keyboardFormSheetHtml\(/);
  assert.match(sheetSource, /openSheet\(\{ position: "top", kind: "task", keyboardForm: true \}\)/);
  ["priority", "calendar-event", "habit", "note", "reward", "review-edit"].forEach(kind => {
    assert.match(sheetSource, new RegExp(`kind: "${kind}", keyboardForm: true`));
  });
  assert.match(sheetSource, /data-toggle-time-picker aria-expanded="false"/);
  assert.match(timePickerSource, /picker\.classList\.toggle\("expanded", shouldExpand\)/);
  assert.match(productionCss, /\.keyboard-form-sheet\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);/);
  assert.match(productionCss, /\.keyboard-form-sheet__form\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto;/);
  assert.match(productionCss, /\.keyboard-form-sheet__body\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(productionCss, /\.sheet-actions\s*\{[\s\S]*?position:\s*static;/);
  assert.doesNotMatch(productionCss, /\.sheet-actions\s*\{[\s\S]*?position:\s*sticky;/);
  assert.match(productionCss, /\.time-picker-panel\s*\{[\s\S]*?display:\s*none;/);
  assert.match(productionCss, /body\.keyboard-open \.keyboard-form-sheet\s*\{[\s\S]*?height:\s*calc\(var\(--app-visible-height\) - 16px\);/);
});

test("当天详情以可点击时间线为主体并复用现有历史纠错入口", () => {
  assert.match(statsSource, /function dayTimelineRecords\(/);
  assert.match(statsSource, /class="day-timeline-row"[^>]*data-open-day-record/);
  assert.match(statsSource, /data-correct-day-record=/);
  assert.match(statsSource, /\$\{dayTimelineHtml\(day\)\}/);
  assert.match(productionCss, /\.day-timeline-row\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(economySource, /title:\s*"撤销这条记录？"/);
  assert.match(economySource, /confirmText:\s*"撤销记录"/);
});
