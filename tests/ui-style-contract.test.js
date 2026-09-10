const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const productionCss = fs.readFileSync(path.join(ROOT, "css/qonto-system.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const feedbackSource = fs.readFileSync(path.join(ROOT, "js/ui/feedback.js"), "utf8");
const economySource = fs.readFileSync(path.join(ROOT, "js/economy.js"), "utf8");
const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
const sheetSource = fs.readFileSync(path.join(ROOT, "js/ui/sheets.js"), "utf8");
const timePickerSource = fs.readFileSync(path.join(ROOT, "js/ui/time-picker.js"), "utf8");
const statsSource = fs.readFileSync(path.join(ROOT, "js/stats.js"), "utf8");

test("Today 紧凑布局删除冗余说明，导航空间只作用于当前首页", () => {
  assert.doesNotMatch(uiSource, /今天只放一件最重要的事|剩余习惯已安排，请在今日任务中完成/);
  assert.match(uiSource, /已全部安排/);
  const balance = indexHtml.match(/<div class="home-coin-balance"[\s\S]*?<\/div>/)[0];
  assert.match(balance, /当前金币/);
  assert.doesNotMatch(balance, /<span>金币<\/span>/);
  assert.match(productionCss, /\.screen:has\(> \.today-page.active\)\s*\{[^}]*var\(--nav-height\)[^}]*safe-area-inset-bottom/);
});

test("Today 完成按钮复用语义绿色，并保留移动端点击尺寸", () => {
  const completion = productionCss.match(/\.today-task-section \.swipe-action\[data-complete-task\]\s*\{[^}]*\}/)[0];
  assert.match(completion, /width:\s*48px/);
  assert.match(completion, /height:\s*48px/);
  assert.match(completion, /background:\s*var\(--color-success-soft\)/);
  assert.match(completion, /color:\s*var\(--color-success\)/);
  const failure = productionCss.match(/\.today-task-section \.swipe-action\[data-fail-task\]\s*\{[^}]*\}/)[0];
  assert.match(failure, /background:\s*transparent/);
  assert.match(failure, /color:\s*var\(--color-text-secondary\)/);
});

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
  assert.match(memoSource, /status: "pending"/);
  assert.match(uiSource, /\[data-habit-card\], \[data-memo-card\]/);
  assert.match(uiSource, /drag\.sourceType === "MEMO"[\s\S]*?scheduleMemoAsTask/);
  assert.match(productionCss, /#homeMemoList\.memo-template-grid/);
});

test("任务可直接完成，不再有计时操作或小时奖励表单", () => {
  const taskSource = fs.readFileSync(path.join(ROOT, "js/tasks.js"), "utf8");
  const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
  const sheetSource = fs.readFileSync(path.join(ROOT, "js/ui/sheets.js"), "utf8");
  assert.match(taskSource, /source: "HABIT"/);
  assert.match(taskSource, /status: "pending"/);
  assert.match(taskSource, /actualStartTime: null/);
  assert.doesNotMatch(taskSource, /durationSeconds \/ 3600|function taskDurationPayload/);
  assert.match(uiSource, /data-complete-task/);
  assert.doesNotMatch(uiSource, /data-start-task|data-stop-task|已进行|等待开始|预计 1 小时|金币\/小时|setInterval/);
  assert.match(sheetSource, /type="radio" name="coins"/);
  assert.doesNotMatch(sheetSource, /金币\/小时|每小时金币/);
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
  assert.match(uiSource, /taskTimelineSlotAt\(touch\.clientX, touch\.clientY\)/);
  assert.match(uiSource, /return scheduleHabitAsTask\(drag\.habitId, new Date\(\), scheduledSlotStart\)/);
  assert.match(uiSource, /return rescheduleTask\(drag\.sourceId, scheduledSlotStart\)/);
  assert.match(uiSource, /Habit drag entered dragging state but touch coordinates are not updating\./);
  assert.match(uiSource, /window\.addEventListener\("pagehide", clearHabitDrag\)/);
  assert.match(productionCss, /html\.habit-dragging,[\s\S]*?overflow:\s*hidden;/);
  assert.match(productionCss, /body\.habit-dragging \.habit-template-chip\.habit-drag-source[\s\S]*?touch-action:\s*none;/);
});

test("今日任务使用轻量整点时间轴并将拖放命中细化到具体槽位", () => {
  const taskSource = fs.readFileSync(path.join(ROOT, "js/tasks.js"), "utf8");
  const sheetSource = fs.readFileSync(path.join(ROOT, "js/ui/sheets.js"), "utf8");
  const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
  assert.match(taskSource, /function futureHourlySlots\([\s\S]*?getNextFullHourRange/);
  assert.match(taskSource, /function hourlyTaskTimeline\(/);
  assert.match(uiSource, /data-task-timeline-slot/);
  assert.match(uiSource, /taskListSection\("其他安排"/);
  assert.match(uiSource, /taskTimelineSectionHtml\("", timeline.upcoming/);
  assert.match(uiSource, /hourlyTaskTimeline\(activeTasks\)/);
  assert.match(taskSource, /Array\.from\(\{ length: 3 \}/);
  assert.doesNotMatch(uiSource.slice(uiSource.indexOf("function renderTasks"), uiSource.indexOf("function calendarGridDays")), /taskTimeRangeLabel/);
  assert.match(sheetSource, /data-task-quick-schedule/);
  assert.match(sheetSource, /data-task-custom-time/);
  assert.match(sheetSource, /scheduledStart/);
  assert.match(sheetSource, /displayedTimeParts = parseTimeValue/);
  assert.match(productionCss, /\.task-hour-slot\s*\{[\s\S]*?grid-template-columns:\s*68px minmax\(0, 1fr\)/);
  assert.match(productionCss, /\.task-hour-slot__drop-hint/);
});

test("撤回提示使用统一的原位置确认态和顶部小胶囊", () => {
  assert.match(indexHtml, /<div class="contextual-undo-host" id="toast"/);
  assert.match(feedbackSource, /const UNDO_WINDOW_MS = 3500;/);
  assert.match(feedbackSource, /const UndoController = \(\(\) =>/);
  assert.match(economySource, /UndoController\.show\(\{/);
  assert.match(uiSource, /UndoController\.taskPresentation\(task\.id\)/);
  assert.match(uiSource, /data-contextual-undo aria-label="撤回上一步操作"/);
  assert.doesNotMatch(indexHtml, /class="snackbar"/);
  assert.doesNotMatch(productionCss, /\.snackbar(?:\s|\.|\{|-)/);
  assert.doesNotMatch(feedbackSource, /function renderSnackbar\(/);
});

test("顶部撤回胶囊不占底部空间且透明宿主不拦截页面操作", () => {
  assert.match(productionCss, /\.contextual-undo-host\s*\{[\s\S]*?top:\s*var\(--contextual-undo-top/);
  assert.match(productionCss, /\.contextual-undo-host\s*\{[\s\S]*?max-width:\s*45vw;/);
  assert.match(productionCss, /\.contextual-undo-host\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(productionCss, /\.contextual-undo-capsule\s*\{[\s\S]*?min-height:\s*40px;/);
  assert.match(productionCss, /\.contextual-undo-capsule\s*\{[\s\S]*?pointer-events:\s*auto;/);
  assert.match(feedbackSource, /balanceRect\.top \+ Math\.max\(0, \(balanceRect\.height - 40\) \/ 2\)/);
  assert.doesNotMatch(feedbackSource, /--snackbar-bottom/);
  assert.doesNotMatch(productionCss, /\.contextual-undo-host\s*\{[^}]*bottom:/);
});

test("原位置撤回在切页时延续剩余时间并转移到全局胶囊", () => {
  assert.match(feedbackSource, /function moveToGlobal\(\)/);
  assert.match(feedbackSource, /function onViewChange\(view\)/);
  assert.match(feedbackSource, /current\.remaining = Math\.max\(0, current\.expiresAt - Date\.now\(\)\)/);
  assert.match(feedbackSource, /current\.mode = "global"/);
  assert.match(feedbackSource, /current\.expiresAt = Date\.now\(\) \+ current\.remaining/);
  assert.match(feedbackSource, /schedule\(current\.remaining\);\s*refreshAnchor\(\);\s*renderGlobal\(\);/);
  assert.match(feedbackSource, /UndoController\.onContextUnavailable\(\)/);
  assert.match(feedbackSource, /if \(modalOpen\)[\s\S]*?UndoController\.pause\(\)[\s\S]*?UndoController\.resume\(\)/);
  assert.match(feedbackSource, /function pause\(\)/);
  assert.match(feedbackSource, /function resume\(\)/);
  assert.match(uiSource, /UndoController\.performUndo\(\)/);
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

test("每日复盘保持紧凑且复用主底栏，不再显示返回", () => {
  assert.match(productionCss, /--review-viewport-height:\s*100dvh;/);
  assert.doesNotMatch(productionCss, /body\.review-editing \.bottom-nav\s*\{\s*display:\s*none;/);
  assert.match(productionCss, /\.review-keyboard-form > \.review-keyboard-form__body\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(productionCss, /\.review-question textarea\s*\{[\s\S]*?max-height:\s*88px;[\s\S]*?overflow-y:\s*auto;[\s\S]*?resize:\s*none;/);
  assert.match(feedbackSource, /setProperty\("--review-viewport-height"/);
  assert.match(feedbackSource, /classList\.toggle\("review-editing", view === "review"\)/);
  assert.doesNotMatch(indexHtml, /review-exit-button/);
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
