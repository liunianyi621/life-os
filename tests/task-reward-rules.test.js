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
    crypto: { randomUUID: () => `test-id-${uuid += 1}` },
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
  assert.equal(value(context, "INCOMPLETE_PENALTY_MULTIPLIER"), 10);
  assert.equal(value(context, "TASK_FAILURE_MULTIPLIER"), 10);
  assert.equal(value(context, "getIncompletePenalty(1.5)"), 15);
  assert.equal(value(context, "getIncompletePenalty(0)"), 0);
  assert.equal(value(context, "taskRewardInputValue(null)"), 20);
  assert.equal(value(context, "taskRewardAmount({})"), 20);
  assert.equal(value(context, "taskRewardAmount({ coins: 0, reward: 0, hourlyReward: 0 })"), 0);
  assert.equal(value(context, "taskFailurePenalty({ coins: 0, reward: 0, hourlyReward: 0 })"), 0);
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
  assert.equal(value(failedRuntime.context, "state.history[0].rewardAmount"), 20);
  assert.equal(value(failedRuntime.context, "state.history[0].penaltyMultiplier"), 10);
  assert.equal(value(failedRuntime.context, "state.history[0].penaltyAmount"), 200);
  assert.equal(value(failedRuntime.context, "state.history[0].source"), "behavior");
  assert.equal(value(failedRuntime.context, "lastUndoData.amount"), 200);

  value(failedRuntime.context, `state.tasks[0].coins = 30; state.tasks[0].reward = 30; state.tasks[0].hourlyReward = 30; pendingUndo.amount = 1; undoLastAction()`);
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
  assert.equal(value(context, "state.history[0].rewardAmount"), 30);
  assert.equal(value(context, "state.history[0].penaltyMultiplier"), 10);
  assert.equal(value(context, "state.history[0].reason"), "timeout");
  assert.equal(value(context, "state.taskAutoFailures['2026-07-16']['timeout-task']"), value(context, "state.history[0].id"));
  const repeated = value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);
  assert.equal(repeated.count, 0);
  assert.equal(value(context, "state.coins"), 700);
});

test("跨日计时任务仍按原任务奖励乘以 10，并且只结算一次", () => {
  const previousDay = "2026-07-15";
  const { context } = createRuntime(emptyState([task({
    id: "cross-day-timeout",
    date: previousDay,
    createdDate: previousDay,
    coins: 30,
    timeStart: "20:00",
    timeEnd: "21:00"
  })]));

  const result = value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);
  assert.equal(result.count, 1);
  assert.equal(result.totalPenalty, 300);
  assert.equal(value(context, "state.history[0].date"), previousDay);
  assert.equal(value(context, "state.history[0].coinDelta"), -300);
  assert.equal(value(context, `state.taskResults["${previousDay}"]["cross-day-timeout"]`), "failed");
  assert.equal(value(context, `state.taskAutoFailures["${previousDay}"]["cross-day-timeout"]`), value(context, "state.history[0].id"));

  const repeated = value(context, `settleTimedTaskTimeouts(new Date("${FIXED_NOW}"))`);
  assert.equal(repeated.count, 0);
  assert.equal(value(context, "state.coins"), 700);
});

test("习惯完成使用自身奖励，未完成统一按奖励乘以 10", () => {
  const completedState = emptyState([], 1000);
  completedState.habits = [{ id: "habit-complete", name: "收拾屋子", coins: 10, createdDate: "2026-07-15" }];
  const completedRuntime = createRuntime(completedState);
  value(completedRuntime.context, `completeHabit("habit-complete")`);
  assert.equal(value(completedRuntime.context, "state.coins"), 1010);
  assert.equal(value(completedRuntime.context, "state.history[0].coinDelta"), 10);

  const missedState = emptyState([], 1000);
  missedState.habits = [{ id: "habit-missed", name: "收拾屋子", coins: 10, createdDate: "2026-07-14" }];
  const missedRuntime = createRuntime(missedState);
  const missed = value(missedRuntime.context, `settleMissedHabits("2026-07-15")`);
  assert.equal(missed.count, 1);
  assert.equal(missed.totalPenalty, 100);
  assert.equal(value(missedRuntime.context, "state.coins"), 900);
  assert.equal(value(missedRuntime.context, "state.history[0].coinDelta"), -100);
  assert.equal(value(missedRuntime.context, "state.history[0].rewardAmount"), 10);
  assert.equal(value(missedRuntime.context, "state.history[0].penaltyMultiplier"), 10);
  assert.equal(value(missedRuntime.context, "state.history[0].penaltyAmount"), 100);
  assert.equal(value(missedRuntime.context, "state.history[0].habitId"), "habit-missed");
  assert.equal(value(missedRuntime.context, "state.history[0].source"), "behavior");
  assert.equal(value(missedRuntime.context, `settleMissedHabits("2026-07-15").count`), 0);
  assert.equal(value(missedRuntime.context, "state.coins"), 900);

  const twentyState = emptyState([], 1000);
  twentyState.habits = [{ id: "habit-twenty", name: "看书", coins: 20, createdDate: "2026-07-14" }];
  const twentyRuntime = createRuntime(twentyState);
  value(twentyRuntime.context, `settleMissedHabits("2026-07-15")`);
  assert.equal(value(twentyRuntime.context, "state.coins"), 800);
  assert.equal(value(twentyRuntime.context, "state.history[0].coinDelta"), -200);
});

test("习惯跨日结算补齐未检查日期，撤回读取历史实际扣除", () => {
  const state = emptyState([], 1000);
  state.settledThroughDate = "2026-07-14";
  state.habits = [{ id: "habit-undo", name: "看书", coins: 10, createdDate: "2026-07-15" }];
  const { context } = createRuntime(state);

  value(context, "runAutomaticChecks()");
  assert.equal(value(context, "state.settledThroughDate"), "2026-07-15");
  assert.equal(value(context, "state.coins"), 900);
  assert.equal(value(context, "state.history[0].coinDelta"), -100);
  value(context, "pendingUndo.habitEntries[0].amount = 1; undoLastAction()");
  assert.equal(value(context, "state.coins"), 1000);
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "runAutomaticChecks()"), false);
  assert.equal(value(context, "state.coins"), 1000);
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

test("重点事项完成和主动失败固定使用 100 / 500，并按历史实际金额撤回", () => {
  const completedState = emptyState([], 2000);
  completedState.priorityTaskByDate[DAY] = {
    date: DAY,
    title: "完成重点事项",
    status: "pending",
    settledPenalty: false
  };
  const completedRuntime = createRuntime(completedState);
  value(completedRuntime.context, `completePriorityTask("${DAY}")`);
  assert.equal(value(completedRuntime.context, "priorityTaskSettlementAmount('done')"), 100);
  assert.equal(value(completedRuntime.context, "state.coins"), 2100);
  assert.equal(value(completedRuntime.context, "state.history[0].coinDelta"), 100);
  assert.equal(value(completedRuntime.context, "lastUndoData.amount"), 100);
  value(completedRuntime.context, "pendingUndo.amount = 999; undoLastAction()");
  assert.equal(value(completedRuntime.context, "state.coins"), 2000);
  assert.equal(value(completedRuntime.context, `state.priorityTaskByDate["${DAY}"].status`), "pending");

  const failedState = emptyState([], 2000);
  failedState.priorityTaskByDate[DAY] = {
    date: DAY,
    title: "未完成重点事项",
    status: "pending",
    settledPenalty: false
  };
  const failedRuntime = createRuntime(failedState);
  value(failedRuntime.context, `failPriorityTask("${DAY}")`);
  assert.equal(value(failedRuntime.context, "priorityTaskSettlementAmount('failed')"), 500);
  assert.equal(value(failedRuntime.context, "state.coins"), 1500);
  assert.equal(value(failedRuntime.context, "state.history[0].coinDelta"), -500);
  assert.equal(value(failedRuntime.context, "state.history[0].rewardAmount"), 100);
  assert.equal(value(failedRuntime.context, "state.history[0].settlementRule"), "fixed_priority_penalty");
  assert.equal(value(failedRuntime.context, "lastUndoData.priorityEntries[0].amount"), 500);
  value(failedRuntime.context, "pendingUndo.priorityEntries[0].amount = 123; undoLastAction()");
  assert.equal(value(failedRuntime.context, "state.coins"), 2000);
  assert.equal(value(failedRuntime.context, `state.priorityTaskByDate["${DAY}"].status`), "pending");
});

test("重点事项跨日自动失败使用同一处罚 helper", () => {
  const previousDay = "2026-07-15";
  const state = emptyState([], 2000);
  state.priorityTaskByDate[previousDay] = {
    date: previousDay,
    title: "昨日重点事项",
    status: "pending",
    settledPenalty: false
  };
  const { context } = createRuntime(state);
  const result = value(context, `settleMissedPriorityTasks(new Date("${FIXED_NOW}"))`);

  assert.equal(result.count, 1);
  assert.equal(result.totalPenalty, 500);
  assert.equal(value(context, "state.coins"), 1500);
  assert.equal(value(context, "state.history[0].coinDelta"), -500);
  assert.equal(value(context, `state.priorityTaskByDate["${previousDay}"].status`), "failed");
});

test("重点事项当天详情优先显示历史事件里的实际金额", () => {
  const state = emptyState([], 2000);
  state.priorityTaskByDate[DAY] = {
    date: DAY,
    title: "旧重点事项",
    status: "done",
    rewardHistoryId: "old-priority-reward"
  };
  state.history = [{
    id: "old-priority-reward",
    type: "priority_task_reward",
    date: DAY,
    name: "旧重点事项",
    coins: 10,
    coinDelta: 10,
    source: "behavior",
    category: "habit_performance",
    entityType: "priority_task",
    affectsBehaviorScore: true
  }];
  const { context } = createRuntime(state);
  value(context, `
    escapeHtml = value => String(value);
    escapeAttr = value => String(value);
    iconActionButtonHtml = () => "";
  `);
  const html = value(context, `priorityTaskDetailHtml("${DAY}")`);

  assert.match(html, /\+10\.00/);
  assert.doesNotMatch(html, /\+100\.00/);
});
