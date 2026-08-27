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
    calendarEvents: [],
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

test("calendar events remain standalone and migrate legacy fields to the compact category model", () => {
  const state = emptyState();
  state.calendarEvents = [{
    id: "calendar-trip",
    title: "苏格兰自驾",
    startDate: "2026-07-20",
    endDate: "2026-07-24",
    allDay: true,
    category: "travel",
    createdAt: "2026-07-16T08:00:00.000Z"
  }];
  const { context } = createRuntime(state);

  const middleDayEvents = vm.runInContext("calendarEventsForDate('2026-07-22')", context);
  assert.equal(middleDayEvents.length, 1);
  assert.equal(middleDayEvents[0].title, "苏格兰自驾");
  assert.equal(middleDayEvents[0].category, "normal");
  const indexedDays = vm.runInContext(`(() => {
    const index = calendarEventsForDates(['2026-07-19', '2026-07-20', '2026-07-22', '2026-07-25']);
    return Array.from(index.entries()).map(([day, events]) => [day, events.map(event => event.id)]);
  })()`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(indexedDays)), [
    ["2026-07-19", []],
    ["2026-07-20", ["calendar-trip"]],
    ["2026-07-22", ["calendar-trip"]],
    ["2026-07-25", []]
  ]);
  const refreshedIndex = vm.runInContext(`(() => {
    state.calendarEvents = [...state.calendarEvents, normalizeCalendarEvent({
      id: 'calendar-new',
      title: '新增计划',
      startDate: '2026-07-22',
      endDate: '2026-07-22'
    })];
    return calendarEventsForDates(['2026-07-22']).get('2026-07-22').map(event => event.id);
  })()`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(refreshedIndex)), ["calendar-trip", "calendar-new"]);
  assert.equal(vm.runInContext("state.history.length", context), 0);
  assert.equal(vm.runInContext("state.coins", context), 1000);

  const normalized = vm.runInContext(`normalizeCalendarEvent({
    id: 'calendar-range',
    title: '整理作品集',
    startDate: '2026-08-10',
    endDate: '2026-08-01',
    allDay: false,
    startTime: '09:30',
    endTime: '11:00',
    note: '旧备注',
    category: 'work'
  })`, context);
  assert.equal(normalized.startDate, "2026-08-10");
  assert.equal(normalized.endDate, "2026-08-10");
  assert.equal(normalized.category, "normal");
  assert.equal(Object.hasOwn(normalized, "startTime"), false);
  assert.equal(Object.hasOwn(normalized, "note"), false);

  const legacyImportant = vm.runInContext(`normalizeCalendarEvent({
    id: 'legacy-important',
    title: '拍摄',
    startDate: '2026-08-10',
    endDate: '2026-08-10',
    color: '#b49a9c'
  })`, context);
  assert.equal(legacyImportant.category, "important");
});

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
  ["js/storage.js", "js/tasks.js", "js/habits.js", "js/economy.js", "js/settlement.js", "js/stats-data.js", "js/stats.js", "js/ui/time-picker.js"].forEach(file => {
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
    showInfoToast = (lines, duration, icon) => {
      globalThis.lastInfoToast = { lines, duration, icon };
    };
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

test("习惯模板不再产生完成奖励或每日未完成处罚", () => {
  const state = emptyState([], 1000);
  state.settledThroughDate = "2026-07-14";
  state.habits = [{ id: "habit-template", name: "看书", coins: 10, createdDate: "2026-07-15" }];
  const { context } = createRuntime(state);

  assert.equal(value(context, `settleMissedHabits("2026-07-15").count`), 0);
  assert.equal(value(context, "runAutomaticChecks()"), false);
  assert.equal(value(context, "state.coins"), 1000);
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "state.habitCompletions['2026-07-16']?.['habit-template'] || false"), false);
});

test("自动检查不再生成无坏习惯奖励", () => {
  const state = emptyState([], 1000);
  const { context } = createRuntime(state);

  assert.equal(value(context, "runAutomaticChecks()"), false);
  assert.equal(value(context, "state.coins"), 1000);
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "typeof settleNoBadHabitBonuses"), "undefined");
});

test("日详情删除失败记录按历史实际金额返还", async () => {
  const { context } = createRuntime(emptyState([task({
    id: "delete-failure",
    timeStart: "9:00 AM",
    timeEnd: "10:00 AM"
  })]));
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
  assert.equal(value(context, "Boolean(state.taskAutoFailures['2026-07-16']['delete-failure'])"), true);
  assert.equal(value(context, "settleTimedTaskTimeouts(new Date('2026-07-16T23:00:00.000Z')).count"), 0);
});

test("当天时间线按真实时间倒序并兼容任务、习惯和奖励流水", () => {
  const state = emptyState([], 1000);
  state.history = [
    {
      id: "task-event",
      type: "task_completed",
      taskId: "task-legacy",
      name: "剪辑视频",
      coins: 20,
      timestamp: "2026-07-16T10:25:00.000Z"
    },
    {
      id: "habit-event",
      type: "habit_completed",
      habitId: "habit-legacy",
      name: "收拾房间",
      coins: 10,
      date: DAY,
      timestamp: "2026-07-16T22:36:00.000Z"
    },
    {
      id: "fund-event",
      type: "fund_deposit",
      rewardId: "fund-legacy",
      name: "中东基金",
      amount: 100,
      date: DAY,
      timestamp: "2026-07-16T17:42:00.000Z"
    }
  ];
  const { context } = createRuntime(state);
  const records = value(context, `dayTimelineRecords("${DAY}").map(record => ({
    key: record.key,
    title: record.title,
    amount: record.amount,
    canCorrect: record.canCorrect
  }))`);

  assert.deepEqual(JSON.parse(JSON.stringify(records)), [
    { key: "habit-event", title: "完成习惯「收拾房间」", amount: 10, canCorrect: true },
    { key: "fund-event", title: "已注入「中东基金」", amount: -100, canCorrect: true },
    { key: "task-event", title: "完成任务「剪辑视频」", amount: 20, canCorrect: true }
  ]);
});

test("当天纠正旧习惯失败历史后保留既有结算标记", async () => {
  const state = emptyState([], 900);
  state.habits = [{ id: "habit-corrected", name: "看书", coins: 10, createdDate: DAY }];
  state.history = [{
    id: "legacy-habit-failure",
    type: "habit_failed",
    habitId: "habit-corrected",
    name: "看书",
    date: DAY,
    timestamp: `${DAY}T08:00:00.000Z`,
    coins: 100,
    coinDelta: -100
  }];
  state.habitFailures[DAY] = { "habit-corrected": "legacy-habit-failure" };
  const { context } = createRuntime(state);
  const historyId = value(context, "state.history[0].id");
  value(context, `askForConfirmation = async () => true; refreshAfterDayRecordCorrection = () => {};`);

  await value(context, `deleteHistoryDayRecord("${historyId}")`);

  assert.equal(value(context, `Boolean(state.habitFailures["${DAY}"]["habit-corrected"])`), true);
  assert.equal(value(context, `settleMissedHabits("${DAY}").count`), 0);
  assert.equal(value(context, "state.coins"), 1000);
});

test("当天纠正自动重点事项失败后不会再次跨日扣除", async () => {
  const previousDay = "2026-07-15";
  const state = emptyState([], 2000);
  state.priorityTaskByDate[previousDay] = {
    date: previousDay,
    title: "发布视频",
    status: "pending",
    settledPenalty: false
  };
  const { context } = createRuntime(state);
  value(context, `settleMissedPriorityTasks(new Date("${FIXED_NOW}"))`);
  const historyId = value(context, "state.history[0].id");
  value(context, `askForConfirmation = async () => true; refreshAfterDayRecordCorrection = () => {};`);

  await value(context, `deleteHistoryDayRecord("${historyId}")`);

  assert.equal(value(context, `state.priorityTaskByDate["${previousDay}"].settledPenalty`), true);
  assert.equal(value(context, `settleMissedPriorityTasks(new Date("${FIXED_NOW}")).count`), 0);
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

test("习惯可以直接安排为立即开始的一小时任务且不改变习惯和金币", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-book", name: "看书", coins: 10, createdDate: DAY }];
  const { context } = createRuntime(state);

  const created = value(context, `scheduleHabitAsTask("habit-book", new Date(2026, 6, 16, 15, 24))`);

  assert.equal(created.name, "看书");
  assert.equal(created.timeStart, "15:24");
  assert.equal(created.timeEnd, "16:24");
  assert.equal(created.status, "in_progress");
  assert.equal(Boolean(created.startTime), true);
  assert.equal(created.coins, 10);
  assert.equal(created.hourlyReward, 10);
  assert.equal(created.reward, 10);
  assert.equal(value(context, "state.habitCompletions['2026-07-16']?.['habit-book'] || false"), false);
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "state.coins"), 2000);
  assert.equal(value(context, "lastUndoData.type"), "habit_task_scheduled");

  value(context, "undoLastAction()");
  assert.equal(value(context, "state.tasks.length"), 0);
  assert.equal(value(context, "state.habits.length"), 1);
  assert.equal(value(context, "state.coins"), 2000);
});

test("没有有效奖励的习惯模板回落到今日任务默认奖励", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-no-reward", name: "整理桌面", coins: null, createdDate: DAY }];
  const { context } = createRuntime(state);

  const created = value(context, `scheduleHabitAsTask("habit-no-reward", new Date(2026, 6, 16, 15, 24))`);
  assert.equal(created.coins, 20);
  assert.equal(created.hourlyReward, 20);
  assert.equal(created.reward, 20);
});

test("习惯当前金币配置优先于旧奖励兼容字段", () => {
  const state = emptyState([], 2000);
  state.habits = [{
    id: "habit-current-reward",
    name: "看书",
    coins: 10,
    reward: 15,
    hourlyReward: 20,
    createdDate: DAY
  }];
  const { context } = createRuntime(state);

  const created = value(context, `scheduleHabitAsTask("habit-current-reward", new Date(2026, 6, 16, 15, 24))`);
  assert.equal(created.coins, 10);
  assert.equal(created.hourlyReward, 10);
  assert.equal(created.reward, 10);
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

test("重点事项当天时间线优先显示历史事件里的实际金额", () => {
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
  const record = value(context, `dayTimelineRecords("${DAY}").find(item => item.key === "old-priority-reward")`);

  assert.equal(record.amount, 10);
  assert.notEqual(record.amount, 100);
});

test("旧重点事项启动字段会被清理且不影响原有结算", () => {
  const state = emptyState([], 2000);
  state.priorityStartSettings = {
    weekKey: "2026-07-13",
    emergencyModeSwitchUsed: true,
    emergencyModeSwitchDate: "2026-07-16"
  };
  state.priorityTaskByDate[DAY] = {
    date: DAY,
    title: "旧重点事项",
    status: "pending",
    settledPenalty: false,
    dayMode: "outdoor",
    latestStartTime: "11:30",
    firstAction: "打开项目",
    startedAt: `${DAY}T10:00:00.000Z`,
    startedOnTime: true,
    startChallengeEndTime: `${DAY}T10:10:00.000Z`,
    startChallengeCompleted: true,
    emergencyModeSwitchUsed: true
  };
  const { context } = createRuntime(state);

  assert.equal(value(context, `Object.hasOwn(state, "priorityStartSettings")`), false);
  assert.equal(value(context, `Object.hasOwn(state.priorityTaskByDate["${DAY}"], "dayMode")`), false);
  assert.equal(value(context, `Object.hasOwn(state.priorityTaskByDate["${DAY}"], "startChallengeEndTime")`), false);

  value(context, `completePriorityTask("${DAY}")`);
  assert.equal(value(context, "state.coins"), 2100);
  assert.equal(value(context, `state.priorityTaskByDate["${DAY}"].status`), "done");
});
