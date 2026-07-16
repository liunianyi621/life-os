const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const DAY = "2026-07-16";
const FIXED_NOW = "2026-07-16T12:00:00.000Z";

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [FIXED_NOW]));
  }

  static now() {
    return new Date(FIXED_NOW).getTime();
  }
}

function emptyState(tasks = [], coins = 1000) {
  return {
    pastCoinHistoryScaleMigrationVersion: 1,
    coins,
    streak: 0,
    lastCompletedDate: null,
    settledThroughDate: "2026-07-15",
    tasks,
    completions: {},
    taskResults: {},
    habits: [],
    habitCompletions: {},
    habitFailures: {},
    taskAutoFailures: {},
    badHabits: [],
    notes: [],
    memos: [],
    rewards: [],
    achievements: [],
    priorityTaskByDate: {},
    nextStep: { taskId: null, updatedAt: null },
    dailyReviews: {},
    reviewRewards: {},
    noBadHabitBonuses: {},
    noBadHabitBonusCheckedThroughDate: "2026-07-15",
    history: [],
    totals: {
      completedTasks: 0,
      coinsSpent: 0,
      coinsPenalty: 0,
      taskDurationSeconds: 0,
      earnedTaskCoins: 0
    }
  };
}

function task(overrides = {}) {
  return {
    id: overrides.id || "task-1",
    name: overrides.name || "测试任务",
    coins: overrides.coins ?? 20,
    hourlyReward: overrides.hourlyReward ?? overrides.coins ?? 20,
    reward: overrides.reward ?? overrides.coins ?? 20,
    date: overrides.date || DAY,
    createdDate: overrides.createdDate || overrides.date || DAY,
    createdAt: `${DAY}T08:00:00.000Z`,
    updatedAt: `${DAY}T08:00:00.000Z`,
    status: overrides.status || "pending",
    timeStart: overrides.timeStart || "",
    timeEnd: overrides.timeEnd || "",
    time: overrides.time || overrides.timeStart || "",
    startTime: overrides.startTime || null,
    endTime: overrides.endTime || null,
    durationMinutes: overrides.durationMinutes ?? null,
    durationSeconds: overrides.durationSeconds ?? null,
    earnedCoins: overrides.earnedCoins ?? null,
    failedAt: overrides.failedAt || null
  };
}

function createRuntime(state) {
  const storage = new Map([["minimal-discipline-v1", JSON.stringify(state)]]);
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
    crypto: { randomUUID: () => "test-id" },
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  ["js/storage.js", "js/tasks.js", "js/habits.js", "js/economy.js", "js/stats.js", "js/ui/time-picker.js"].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  });
  vm.runInContext(`
    els = {
      toast: { classList: { add() {}, remove() {} }, textContent: "" },
      dayDetailBackdrop: { classList: { contains() { return true; } } },
      dayDetailContent: {}
    };
    updatePrimaryReadouts = () => {};
    prepareActionCard = () => {};
    showCoinFeedback = () => {};
    scheduleRender = () => {};
    render = () => {};
    showToast = message => { globalThis.lastToast = message; };
    showUndoToast = (undoData, options) => {
      pendingUndo = { ...undoData };
      globalThis.lastUndoData = JSON.parse(JSON.stringify(undoData));
      globalThis.lastUndoOptions = JSON.parse(JSON.stringify(options));
    };
  `, context);
  return { context, storage };
}

function value(context, expression) {
  return vm.runInContext(expression, context);
}

test("任务默认奖励为 20，失败统一按奖励乘以 10", () => {
  const { context } = createRuntime(emptyState());

  assert.equal(value(context, "DEFAULT_TASK_REWARD"), 20);
  assert.equal(value(context, "TASK_FAILURE_MULTIPLIER"), 10);
  assert.equal(value(context, "taskRewardInputValue(null)"), 20);
  assert.equal(value(context, "taskRewardAmount({})"), 20);
  assert.equal(value(context, "taskFailurePenalty({})"), 200);
  assert.equal(value(context, "taskFailurePenalty({ coins: 30 })"), 300);
  assert.equal(value(context, "taskFailurePenalty({ coins: 1.5 })"), 15);
  assert.equal(value(context, "taskFailurePenalty({ coins: 20, durationMinutes: 180 })"), 200);
  assert.equal(value(context, "taskFailurePenalty({ coins: 20, date: '2026-07-15', timeStart: '23:30', timeEnd: '00:30' })"), 200);

  const sheetSource = fs.readFileSync(path.join(ROOT, "js/ui/sheets.js"), "utf8");
  assert.match(sheetSource, /placeholder="默认 20"/);
  assert.match(sheetSource, /有时间任务默认 20 金币\/小时/);
});

test("无时间任务完成获得设置金额，主动失败记录并撤回实际处罚", () => {
  const completedRuntime = createRuntime(emptyState([task({ id: "complete-task" })]));
  value(completedRuntime.context, `completeTask("complete-task")`);
  assert.equal(value(completedRuntime.context, "state.coins"), 1020);
  assert.equal(value(completedRuntime.context, "state.history[0].coinDelta"), 20);

  const failedRuntime = createRuntime(emptyState([task({ id: "fail-task" })]));
  value(failedRuntime.context, `failTask("fail-task")`);
  assert.equal(value(failedRuntime.context, "state.coins"), 800);
  assert.equal(value(failedRuntime.context, "state.history[0].coinDelta"), -200);
  assert.equal(value(failedRuntime.context, "state.history[0].coins"), 200);
  assert.equal(value(failedRuntime.context, "lastUndoData.amount"), 200);

  value(failedRuntime.context, `state.tasks[0].coins = 30; state.tasks[0].reward = 30; state.tasks[0].hourlyReward = 30; undoLastAction()`);
  assert.equal(value(failedRuntime.context, "state.coins"), 1000);
  assert.equal(value(failedRuntime.context, "state.history.length"), 0);
});

test("计时任务半小时按每小时奖励结算，失败不读取实际时长", () => {
  const completedRuntime = createRuntime(emptyState([task({
    id: "timed-complete",
    status: "running",
    timeStart: "11:00",
    timeEnd: "12:00",
    startTime: "2026-07-16T11:30:00.000Z"
  })]));
  value(completedRuntime.context, `finishTask("timed-complete")`);
  assert.equal(value(completedRuntime.context, "state.coins"), 1010);
  assert.equal(value(completedRuntime.context, "state.history[0].earnedCoins"), 10);
  assert.equal(value(completedRuntime.context, "state.history[0].durationSeconds"), 1800);

  const failedRuntime = createRuntime(emptyState([task({
    id: "timed-fail",
    timeStart: "09:00",
    timeEnd: "12:00",
    durationMinutes: 180
  })]));
  value(failedRuntime.context, `failTask("timed-fail")`);
  assert.equal(value(failedRuntime.context, "state.coins"), 800);
  assert.equal(value(failedRuntime.context, "state.history[0].coinDelta"), -200);
});

test("结束时间自动失败与主动失败使用同一 helper 和实际历史金额", () => {
  const { context } = createRuntime(emptyState([task({
    id: "timeout-task",
    coins: 30,
    timeStart: "09:00",
    timeEnd: "10:00"
  })]));
  const result = value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);

  assert.equal(result.count, 1);
  assert.equal(result.totalPenalty, 300);
  assert.equal(value(context, "state.coins"), 700);
  assert.equal(value(context, "state.history[0].coinDelta"), -300);
  assert.equal(value(context, "state.history[0].coins"), 300);
  assert.equal(value(context, "state.history[0].reason"), "timeout");
  assert.equal(value(context, "state.taskAutoFailures['2026-07-16']['timeout-task']"), value(context, "state.history[0].id"));
});

test("日详情删除失败记录按历史实际金额返还", async () => {
  const { context } = createRuntime(emptyState([task({ id: "delete-failure" })]));
  value(context, `failTask("delete-failure")`);
  const historyId = value(context, "state.history[0].id");
  value(context, `
    state.tasks[0].coins = 30;
    state.tasks[0].reward = 30;
    state.tasks[0].hourlyReward = 30;
    askForConfirmation = async () => true;
    refreshAfterDayRecordCorrection = () => {};
  `);

  await value(context, `deleteHistoryDayRecord("${historyId}")`);

  assert.equal(value(context, "state.coins"), 1000);
  assert.equal(value(context, "state.history.some(item => item.id === '" + historyId + "')"), false);
  assert.equal(value(context, "state.history[0].type"), "day_record_correction");
  assert.equal(value(context, "state.history[0].coinDelta"), 200);
  assert.equal(value(context, "lastUndoData.correctionDelta"), 200);
});

test("迁移标记存在时，新任务的 20 和 200 不会再次乘以 10", () => {
  const { context, storage } = createRuntime(emptyState([task({ id: "new-failure" })]));
  value(context, `failTask("new-failure")`);
  value(context, "saveState()");

  const persisted = JSON.parse(storage.get("minimal-discipline-v1"));
  const reloaded = createRuntime(persisted);
  assert.equal(value(reloaded.context, "state.pastCoinHistoryScaleMigrationVersion"), 1);
  assert.equal(value(reloaded.context, "state.coins"), 800);
  assert.equal(value(reloaded.context, "state.history[0].coinDelta"), -200);
  assert.equal(value(reloaded.context, "state.history[0].coins"), 200);
});
