const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const economySource = fs.readFileSync(path.join(ROOT, "js/economy.js"), "utf8");
const feedbackSource = fs.readFileSync(path.join(ROOT, "js/ui/feedback.js"), "utf8");
const uiSource = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
const productionCss = fs.readFileSync(path.join(ROOT, "css/qonto-system.css"), "utf8");

test("任务完成、失败和两种拖入任务都优先建立任务原位置 anchor", () => {
  assert.match(economySource, /new Set\(\["task_completed", "task_failed", "habit_task_scheduled", "memo_task_scheduled"\]\)/);
  assert.match(economySource, /return task \? \{ kind: "task", id: task\.id, task: \{ \.\.\.task \} \} : null/);
  assert.match(uiSource, /activeTasks\.push\(undoAnchor\.task\)/);
  assert.match(uiSource, /class="task-contextual-undo-row/);
  assert.match(uiSource, /task-contextual-undo-row__action/);
});

test("撤回控制器统一清理计时器且全局胶囊始终只有一个", () => {
  assert.match(feedbackSource, /let current = null;/);
  assert.match(feedbackSource, /function clearTimers\(\)[\s\S]*?clearTimeout\(expiryTimer\)[\s\S]*?clearTimeout\(exitTimer\)/);
  assert.match(feedbackSource, /els\.toast\.textContent = "";/);
  assert.match(feedbackSource, /els\.toast\.append\(capsule\)/);
  assert.match(feedbackSource, /window\.setTimeout\(expire, duration\)/);
});

test("撤回展示只调用既有 undoLastAction，不承载金币或历史回滚", () => {
  assert.match(economySource, /undo:\s*undoLastAction/);
  assert.doesNotMatch(feedbackSource, /state\.coins|state\.history|SettlementService|recordCoinEvent/);
  assert.match(feedbackSource, /message: "撤回失败，请重试"/);
});

test("旧底部横向 Toast 样式与定位已经移除", () => {
  assert.doesNotMatch(productionCss, /\.snackbar(?:\s|\.|\{|-)/);
  assert.doesNotMatch(feedbackSource, /syncSnackbarPosition|hideSnackbar|renderSnackbar/);
  assert.doesNotMatch(productionCss, /--snackbar-bottom/);
  assert.match(productionCss, /\.task-contextual-undo-row\.is-exiting\s*\{[\s\S]*?opacity:\s*0;/);
});
