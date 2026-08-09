const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const TODAY = "2026-07-16";
const YESTERDAY = "2026-07-15";
const FIXED_NOW = "2026-07-16T12:00:00.000Z";

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [FIXED_NOW]));
  }

  static now() {
    return new Date(FIXED_NOW).getTime();
  }
}

function createState(overrides = {}) {
  return {
    pastCoinHistoryScaleMigrationVersion: 1,
    coins: 2000,
    streak: 0,
    lastCompletedDate: null,
    settledThroughDate: YESTERDAY,
    tasks: [],
    completions: {},
    taskResults: {},
    habits: [],
    habitCompletions: {},
    habitFailures: {},
    taskAutoFailures: {},
    badHabits: [],
    calendarEvents: [],
    notes: [],
    memos: [],
    rewards: [],
    achievements: [],
    priorityTaskByDate: {},
    nextStep: { taskId: null, updatedAt: null },
    dailyReviews: {},
    reviewRewards: {},
    history: [],
    totals: {
      completedTasks: 0,
      coinsSpent: 0,
      coinsPenalty: 0,
      taskDurationSeconds: 0,
      earnedTaskCoins: 0
    },
    ...overrides
  };
}

function timedTask(overrides = {}) {
  return {
    id: overrides.id || "task-1",
    name: overrides.name || "测试任务",
    coins: overrides.coins ?? 20,
    hourlyReward: overrides.hourlyReward ?? overrides.coins ?? 20,
    reward: overrides.reward ?? overrides.coins ?? 20,
    date: overrides.date || TODAY,
    createdDate: overrides.createdDate || overrides.date || TODAY,
    createdAt: `${overrides.date || TODAY}T08:00:00.000Z`,
    updatedAt: `${overrides.date || TODAY}T08:00:00.000Z`,
    status: overrides.status || "pending",
    timeStart: overrides.timeStart || "09:00",
    timeEnd: overrides.timeEnd || "10:00",
    time: overrides.time || overrides.timeStart || "09:00",
    startTime: overrides.startTime || null,
    endTime: overrides.endTime || null,
    durationMinutes: overrides.durationMinutes ?? null,
    durationSeconds: overrides.durationSeconds ?? null,
    earnedCoins: overrides.earnedCoins ?? null,
    failedAt: overrides.failedAt || null
  };
}

function createRuntime(initialState) {
  const storage = new Map([["minimal-discipline-v1", JSON.stringify(initialState)]]);
  let uuid = 0;
  const context = {
    console,
    Date: FixedDate,
    Intl,
    JSON,
    Math,
    Map,
    Set,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    localStorage: {
      get length() { return storage.size; },
      key(index) { return [...storage.keys()][index] || null; },
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    window: { setTimeout, clearTimeout },
    document: {},
    crypto: { randomUUID: () => `settlement-test-${uuid += 1}` },
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  const files = [
    "js/storage.js",
    "js/tasks.js",
    "js/habits.js",
    "js/economy.js",
    "js/ui/time-picker.js"
  ];
  if (fs.existsSync(path.join(ROOT, "js/settlement.js"))) files.push("js/settlement.js");
  files.forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  });
  vm.runInContext(`
    els = { toast: { classList: { add() {}, remove() {} }, textContent: "" } };
    updatePrimaryReadouts = () => {};
    scheduleRender = () => {};
    render = () => {};
    showToast = () => {};
    showUndoToast = undoData => { pendingUndo = { ...undoData }; };
  `, context);
  return { context, storage };
}

function value(context, expression) {
  return vm.runInContext(expression, context);
}

function countHistory(context, type) {
  return value(context, `state.history.filter(item => item.type === "${type}").length`);
}

test("今日任务超时按任务奖励乘以 10 自动失败", () => {
  const { context } = createRuntime(createState({ tasks: [timedTask({ coins: 20 })] }));
  const result = value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);

  assert.equal(result.count, 1);
  assert.equal(result.totalPenalty, 200);
  assert.equal(value(context, "state.coins"), 1800);
  assert.equal(value(context, "state.history[0].coinDelta"), -200);
});

test("今日任务跨日仍按原任务奖励乘以 10 自动失败", () => {
  const task = timedTask({ id: "cross-day", date: YESTERDAY, coins: 30 });
  const { context } = createRuntime(createState({ tasks: [task] }));
  const result = value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);

  assert.equal(result.count, 1);
  assert.equal(result.totalPenalty, 300);
  assert.equal(value(context, "state.history[0].date"), YESTERDAY);
  assert.equal(value(context, "state.history[0].coinDelta"), -300);
});

test("同一个超时任务连续检查三次只扣一次", () => {
  const { context } = createRuntime(createState({ tasks: [timedTask()] }));

  value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);
  value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);
  value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);

  assert.equal(countHistory(context, "task_failed"), 1);
  assert.equal(value(context, "state.coins"), 1800);
});

test("启动、切换页面、刷新后的重复检查不会重复结算", () => {
  const first = createRuntime(createState({ tasks: [timedTask()] }));
  value(first.context, "runAutomaticChecks({ showToast: false })");
  value(first.context, "runAutomaticChecks({ showToast: false })");

  const persisted = JSON.parse(first.storage.get("minimal-discipline-v1"));
  const refreshed = createRuntime(persisted);
  value(refreshed.context, "runAutomaticChecks({ showToast: false })");

  assert.equal(countHistory(refreshed.context, "task_failed"), 1);
  assert.equal(value(refreshed.context, "state.coins"), 1800);
});

test("习惯未完成按自身奖励乘以 10 自动扣除", () => {
  const state = createState({
    habits: [{ id: "habit-1", name: "收拾屋子", coins: 10, createdDate: "2026-07-14" }]
  });
  const { context } = createRuntime(state);
  const result = value(context, `settleMissedHabits("${YESTERDAY}")`);

  assert.equal(result.count, 1);
  assert.equal(result.totalPenalty, 100);
  assert.equal(value(context, "state.history[0].coinDelta"), -100);
});

test("同一个习惯同一天重复检查只扣一次", () => {
  const state = createState({
    habits: [{ id: "habit-1", name: "看书", coins: 10, createdDate: "2026-07-14" }]
  });
  const { context } = createRuntime(state);

  value(context, `settleMissedHabits("${YESTERDAY}")`);
  value(context, `settleMissedHabits("${YESTERDAY}")`);
  value(context, `settleMissedHabits("${YESTERDAY}")`);

  assert.equal(countHistory(context, "habit_failed"), 1);
  assert.equal(value(context, "state.coins"), 1900);
});

test("重点事项跨日未完成固定扣除 500 且重复扫描只结算一次", () => {
  const state = createState({
    priorityTaskByDate: {
      [YESTERDAY]: {
        date: YESTERDAY,
        title: "整理作品",
        status: "pending",
        settledPenalty: false
      }
    }
  });
  const { context } = createRuntime(state);

  value(context, `settleMissedPriorityTasks(new Date("${FIXED_NOW}"))`);
  value(context, `settleMissedPriorityTasks(new Date("${FIXED_NOW}"))`);

  assert.equal(countHistory(context, "priority_task_penalty"), 1);
  assert.equal(value(context, "state.history[0].coinDelta"), -500);
  assert.equal(value(context, "state.coins"), 1500);
});

test("已完成任务即使超过结束时间也不会自动失败", () => {
  const completed = timedTask({ id: "completed-task", status: "completed" });
  const state = createState({
    tasks: [completed],
    taskResults: { [TODAY]: { "completed-task": "completed" } }
  });
  const { context } = createRuntime(state);

  assert.equal(value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}")).count`), 0);
  assert.equal(value(context, "state.coins"), 2000);
});

test("已完成习惯不会产生未完成处罚", () => {
  const state = createState({
    settledThroughDate: "2026-07-14",
    habits: [{ id: "completed-habit", name: "看书", coins: 10, createdDate: "2026-07-14" }],
    habitCompletions: { [YESTERDAY]: { "completed-habit": true } }
  });
  const { context } = createRuntime(state);

  assert.equal(value(context, "runAutomaticChecks({ showToast: false })"), true);
  assert.equal(countHistory(context, "habit_failed"), 0);
  assert.equal(value(context, "state.coins"), 2000);
});

test("撤回自动任务失败后，既有失败标记阻止被动重复结算", () => {
  const { context } = createRuntime(createState({ tasks: [timedTask()] }));
  value(context, "runAutomaticChecks()");
  value(context, "undoLastAction()");

  assert.equal(value(context, "state.coins"), 2000);
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "runAutomaticChecks({ showToast: false })"), false);
  assert.equal(value(context, "state.coins"), 2000);
});

test("旧历史缺少辅助失败映射时仍能证明任务已结算", () => {
  const state = createState({
    tasks: [timedTask({ id: "legacy-task" })],
    history: [{
      id: "legacy-task-failure",
      type: "task_failed",
      taskId: "legacy-task",
      date: TODAY,
      timestamp: `${TODAY}T10:01:00.000Z`,
      coinDelta: -200,
      coins: 200,
      reason: "timeout"
    }]
  });
  const { context } = createRuntime(state);

  assert.equal(value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}")).count`), 0);
  assert.equal(countHistory(context, "task_failed"), 1);
  assert.equal(value(context, "state.coins"), 2000);
});

test("旧任务、习惯和重点事项历史共同进入统一结算索引", () => {
  const state = createState({
    settledThroughDate: "2026-07-14",
    tasks: [timedTask({ id: "legacy-task" })],
    habits: [{ id: "legacy-habit", name: "旧习惯", coins: 10, createdDate: "2026-07-14" }],
    priorityTaskByDate: {
      [YESTERDAY]: {
        date: YESTERDAY,
        title: "旧重点事项",
        status: "pending",
        settledPenalty: false
      }
    },
    history: [
      { id: "old-task", type: "task_failed", taskId: "legacy-task", date: TODAY, coinDelta: -200 },
      { id: "old-habit", type: "habit_failed", habitId: "legacy-habit", date: YESTERDAY, coinDelta: -100 },
      { id: "old-priority", type: "priority_task_penalty", date: YESTERDAY, coinDelta: -500 }
    ]
  });
  const { context } = createRuntime(state);
  const result = value(context, `runPendingSettlements({ now: new Date("${FIXED_NOW}") })`);

  assert.equal(result.taskFailures.count, 0);
  assert.equal(result.habitFailures.count, 0);
  assert.equal(result.priorityFailures.count, 0);
  assert.equal(result.changed, true);
  assert.equal(value(context, "state.history.length"), 3);
  assert.equal(value(context, "state.coins"), 2000);
});

test("重点事项自动失败撤回后恢复 pending，下一次检查沿用现有规则重新结算", () => {
  const state = createState({
    priorityTaskByDate: {
      [YESTERDAY]: {
        date: YESTERDAY,
        title: "昨日重点",
        status: "pending",
        settledPenalty: false
      }
    }
  });
  const { context } = createRuntime(state);

  value(context, "runAutomaticChecks()");
  value(context, "undoLastAction()");
  assert.equal(value(context, `state.priorityTaskByDate["${YESTERDAY}"].status`), "pending");
  assert.equal(value(context, "state.coins"), 2000);

  assert.equal(value(context, "runAutomaticChecks({ showToast: false })"), true);
  assert.equal(countHistory(context, "priority_task_penalty"), 1);
  assert.equal(value(context, "state.coins"), 1500);
});

test("结算日期使用本地日期组件而不是 UTC 截断", () => {
  const { context } = createRuntime(createState());

  assert.equal(value(context, "dateKey(new Date(2026, 6, 16, 23, 30))"), TODAY);
  assert.equal(value(context, `shiftDateKey("${TODAY}", -1)`), YESTERDAY);
});
