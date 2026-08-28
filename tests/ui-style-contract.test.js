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

test("习惯模板使用可换行 Chip、局部拖拽保护和统一安排入口", () => {
  const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
  const taskSource = fs.readFileSync(path.join(ROOT, "js/tasks.js"), "utf8");
  const habitRenderSource = uiSource.match(/function renderHabits\(\)\s*\{[\s\S]*?\n    \}\n\n    function taskMetaHtml/)?.[0] || "";
  assert.match(indexHtml, /class="today-section today-task-section"[^>]*data-habit-task-drop-zone/);
  assert.match(indexHtml, /class="habit-template-grid"[^>]*id="habitList"/);
  assert.match(uiSource, /function beginHabitTouchDrag\(/);
  assert.match(uiSource, /function beginHabitPointerDrag\(/);
  assert.match(uiSource, /scheduleHabitAsTask\(drag\.habitId/);
  assert.match(sheetSource, /data-schedule-habit/);
  assert.match(taskSource, /function scheduleHabitAsTask\(habitId, startTime/);
  assert.match(habitRenderSource, /habit-template-chip/);
  assert.match(habitRenderSource, /visibleHabitsToday\(\)/);
  assert.doesNotMatch(habitRenderSource, /data-complete-habit/);
  assert.doesNotMatch(habitRenderSource, /data-schedule-habit/);
  assert.doesNotMatch(habitRenderSource, /habit-template-chip__tile/);
  assert.doesNotMatch(habitRenderSource, /金币/);
  assert.match(taskSource, /sourceHabitId:\s*habit\.id/);
  assert.match(taskSource, /markHabitScheduledAsTask\(habit\.id, habitScheduleDate\)/);
  assert.match(productionCss, /\.today-task-section\.habit-drop-active/);
  assert.match(productionCss, /\.habit-drag-preview/);
  assert.match(productionCss, /\.habit-template-chip[\s\S]*?-webkit-user-select:\s*none;/);
  assert.match(productionCss, /\.habit-template-chip[\s\S]*?-webkit-touch-callout:\s*none;/);
  assert.match(productionCss, /#habitList\.habit-template-grid,[\s\S]*?flex-wrap:\s*wrap;/);
});

test("备忘录 Chip 复用拖拽通道并分流到 MEMO 任务入口", () => {
  const memoSource = fs.readFileSync(path.join(ROOT, "js/memos.js"), "utf8");
  const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
  assert.match(indexHtml, /class="memo-template-grid" id="homeMemoList"/);
  assert.match(memoSource, /class="habit-template-chip memo-template-chip"/);
  assert.match(memoSource, /data-memo-card=/);
  assert.match(memoSource, /source: "MEMO"/);
  assert.match(memoSource, /originId: memo\.id/);
  assert.match(memoSource, /status: TASK_STATUS\.WAITING/);
  assert.match(uiSource, /\[data-habit-card\], \[data-memo-card\]/);
  assert.match(uiSource, /drag\.sourceType === "MEMO"[\s\S]*?scheduleMemoAsTask/);
  assert.match(productionCss, /#homeMemoList\.memo-template-grid/);
});

test("习惯生成任务使用 WAITING 到 RUNNING 的显式状态机", () => {
  const taskSource = fs.readFileSync(path.join(ROOT, "js/tasks.js"), "utf8");
  const economySource = fs.readFileSync(path.join(ROOT, "js/economy.js"), "utf8");
  const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");

  assert.match(taskSource, /const TASK_STATUS = Object\.freeze\([\s\S]*?WAITING: "waiting"[\s\S]*?PAUSED: "paused"/);
  assert.match(taskSource, /function scheduleHabitAsTask[\s\S]*?status: TASK_STATUS\.WAITING/);
  assert.match(taskSource, /function getNextFullHourRange[\s\S]*?setMinutes\(0, 0, 0\)[\s\S]*?setHours\(start\.getHours\(\) \+ 1\)/);
  assert.match(taskSource, /scheduledStart,[\s\S]*?scheduledEnd,[\s\S]*?timeStart,[\s\S]*?timeEnd/);
  assert.match(taskSource, /estimateDurationMinutes: 60/);
  assert.match(taskSource, /source: "HABIT"/);
  assert.match(taskSource, /originId: habit\.id/);
  assert.match(taskSource, /startedAt: null/);
  assert.match(taskSource, /actualStartTime: null/);
  assert.match(taskSource, /timerStartedAt: null/);
  assert.match(taskSource, /isRunning: false/);
  assert.match(taskSource, /elapsedSeconds: 0/);
  const scheduleSource = taskSource.slice(
    taskSource.indexOf("function scheduleHabitAsTask"),
    taskSource.indexOf("function todayTasks")
  );
  assert.doesNotMatch(scheduleSource, /status: "in_progress"/);
  assert.doesNotMatch(scheduleSource, /startTask\s*\(/);
  assert.match(economySource, /function startTask[\s\S]*?status: TASK_STATUS\.RUNNING/);
  assert.match(economySource, /function startTask[\s\S]*?startedAt,[\s\S]*?actualStartTime: startedAt[\s\S]*?timerStartedAt: actionAt/);
  assert.match(economySource, /TASK_LIFECYCLE_EVENT\.STARTED/);
  assert.match(uiSource, /等待开始/);
  assert.match(uiSource, /data-task-elapsed/);
  assert.match(uiSource, /class="q-row-tile[^"]*task-start-tile"[\s\S]*?data-start-task/);
  const actionSource = uiSource.slice(
    uiSource.indexOf("function taskActionsHtml"),
    uiSource.indexOf("function taskTileHtml")
  );
  const tileSource = uiSource.slice(
    uiSource.indexOf("function taskTileHtml"),
    uiSource.indexOf("function stopTaskElapsedTicker")
  );
  assert.match(actionSource, /if \(status === TASK_STATUS\.WAITING\) return failAction/);
  assert.equal((tileSource.match(/data-start-task/g) || []).length, 1);
  assert.match(tileSource, /aria-label="开始任务"/);
  assert.doesNotMatch(tileSource, />开始</);
  assert.match(taskSource, /source: taskData\.source \|\| "MANUAL"[\s\S]*?status: TASK_STATUS\.WAITING/);
});

test("iOS 习惯拖拽使用独立 Touch Events 状态机并与 Pointer 通道隔离", () => {
  const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
  assert.match(uiSource, /HABIT_TOUCH_LISTENER_OPTIONS\s*=\s*\{ passive: false, capture: true \}/);
  assert.match(uiSource, /document\.addEventListener\("touchstart", beginHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS\)/);
  assert.match(uiSource, /document\.addEventListener\("touchmove", moveHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS\)/);
  assert.match(uiSource, /document\.addEventListener\("touchend", endHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS\)/);
  assert.match(uiSource, /document\.addEventListener\("touchcancel", cancelHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS\)/);
  assert.match(uiSource, /document\.removeEventListener\("touchmove", moveHabitTouchDrag, HABIT_TOUCH_LISTENER_OPTIONS\)/);
  assert.match(uiSource, /if \(habitTouchListenersInstalled\) return;/);
  assert.match(uiSource, /habitTouchListenersInstalled = false;[\s\S]*?document\.removeEventListener\("touchmove"/);
  assert.match(uiSource, /phase:\s*"pressing"/);
  assert.match(uiSource, /drag\.phase\s*=\s*"dragging"/);
  assert.match(uiSource, /drag\.phase\s*=\s*"scrolling"/);
  assert.match(uiSource, /touchWithIdentifier\(event\.touches, drag\.touchIdentifier\)/);
  assert.match(uiSource, /touchWithIdentifier\(event\.changedTouches, drag\.touchIdentifier\)/);
  assert.match(uiSource, /if \(event\.pointerType === "touch"\) return;/);
  assert.match(uiSource, /if \(activeHabitDrag\?\.inputMode === "touch"\) return;/);
  assert.match(uiSource, /drag\.card\.setPointerCapture\?\.\(drag\.pointerId\)/);
  assert.match(uiSource, /document\.addEventListener\("pointermove", moveHabitPointerDrag, \{ passive: false \}\)/);
  assert.match(uiSource, /if \(event\.cancelable\) event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?holdHabitDragScroll\(drag\)/);
  assert.match(uiSource, /positionHabitDragPreview\(drag, touch\.clientX, touch\.clientY\)/);
  assert.match(uiSource, /lock\.scrollTarget\.scrollTop = lock\.scrollTop/);
  assert.match(uiSource, /restoreHabitDragScroll\(drag\)/);
  assert.match(uiSource, /pointInsideElement\(habitTaskDropZone\(\), touch\.clientX, touch\.clientY\)/);
  assert.match(uiSource, /else scheduleHabitAsTask\(drag\.habitId, new Date\(\)\)/);
  assert.match(uiSource, /Habit drag entered dragging state but touch coordinates are not updating\./);
  assert.match(uiSource, /window\.addEventListener\("pagehide", clearHabitDrag\)/);
  assert.match(productionCss, /html\.habit-dragging,[\s\S]*?overflow:\s*hidden;/);
  assert.match(productionCss, /body\.habit-dragging \.habit-template-chip\.habit-drag-source[\s\S]*?touch-action:\s*none;/);
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
