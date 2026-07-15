const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const DAY = "2026-07-04";
const ROOT = path.resolve(__dirname, "..");

function createState(history) {
  return {
    pastCoinHistoryScaleMigrationVersion: 1,
    coins: 0,
    streak: 0,
    lastCompletedDate: null,
    settledThroughDate: "2026-07-03",
    tasks: [],
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
    noBadHabitBonusCheckedThroughDate: null,
    history,
    totals: {
      completedTasks: 0,
      coinsSpent: 0,
      coinsPenalty: 0,
      taskDurationSeconds: 0,
      earnedTaskCoins: 0
    }
  };
}

function createRuntime(history) {
  const storage = new Map([["minimal-discipline-v1", JSON.stringify(createState(history))]]);
  const context = {
    console,
    Date,
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
      get length() {
        return storage.size;
      },
      key(index) {
        return [...storage.keys()][index] || null;
      },
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      }
    },
    window: {},
    document: {},
    crypto: { randomUUID: () => "test-id" },
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  ["js/storage.js", "js/tasks.js", "js/habits.js", "js/economy.js", "js/stats.js"].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  });
  return context;
}

function dayRow(context) {
  return vm.runInContext(`buildMonthlyHeatRows("2026-07").find(row => row.key === "${DAY}")`, context);
}

function classify(context, id) {
  return vm.runInContext(`(() => {
    const item = state.history.find(entry => entry.id === "${id}");
    return {
      reward: isRewardPageEvent(item),
      behavior: isHabitPerformanceTransaction(item),
      source: item.source,
      category: item.category,
      action: item.action,
      entityType: item.entityType,
      affectsBehaviorScore: item.affectsBehaviorScore
    };
  })()`, context);
}

test("旧奖励和基金记录即使缺少 source，也不会进入行为表现", () => {
  const context = createRuntime([
    { id: "legacy-reward", type: "legacy_wallet_change", coinDelta: -30, date: DAY, rewardId: "reward-1" },
    { id: "legacy-fund", type: "legacy_wallet_change", coinDelta: -50, date: DAY, fundId: "fund-1" }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(classify(context, "legacy-reward"))), {
    reward: true,
    behavior: false,
    source: "rewards",
    category: "reward_spending",
    action: "legacy_wallet_change",
    entityType: "reward_fund",
    affectsBehaviorScore: false
  });
  assert.equal(classify(context, "legacy-fund").behavior, false);
  assert.equal(dayRow(context).behaviorNet, 0);
});

test("来源不明的旧负数记录默认不进入行为表现", () => {
  const context = createRuntime([
    { id: "legacy-unknown", type: "legacy_adjustment", coinDelta: -14, date: DAY },
    { id: "legacy-task-looking", type: "task_failed", coinDelta: -14, date: DAY }
  ]);

  assert.equal(classify(context, "legacy-unknown").behavior, false);
  assert.equal(classify(context, "legacy-task-looking").behavior, false);
  assert.equal(dayRow(context).behaviorNet, 0);
});

test("明确的任务失败和坏习惯仍会进入行为表现", () => {
  const context = createRuntime([
    { id: "task-failed", type: "task_failed", coins: 10, date: DAY, taskId: "task-1" },
    { id: "bad-habit", type: "bad_habit", coins: 2, date: DAY, habitId: "bad-1" }
  ]);
  const row = dayRow(context);

  assert.equal(classify(context, "task-failed").behavior, true);
  assert.equal(classify(context, "bad-habit").behavior, true);
  assert.equal(row.behaviorNet, -12);
  assert.equal(row.failed, 1);
  assert.equal(row.badHabits, 1);
});

test("奖励消费不会把正向习惯日变成红色", () => {
  const context = createRuntime([
    { id: "habit-1", type: "habit_completed", coins: 2, date: DAY, habitId: "habit-1" },
    { id: "habit-2", type: "habit_completed", coins: 2, date: DAY, habitId: "habit-2" },
    { id: "habit-3", type: "habit_completed", coins: 2, date: DAY, habitId: "habit-3" },
    { id: "reward-spend", type: "reward_redeemed", cost: 74, date: DAY, rewardId: "reward-1" }
  ]);
  const row = dayRow(context);

  assert.equal(row.net, -68);
  assert.equal(row.behaviorNet, 6);
  assert.equal(row.completed, 3);
  assert.equal(row.badHabits, 0);
});

test("匿名化后的 7 月 4 日真实行为记录仍应得到 -8", () => {
  const context = createRuntime([
    { id: "habit-1", type: "habit_completed", coins: 2, date: DAY, habitId: "habit-1" },
    { id: "habit-2", type: "habit_completed", coins: 2, date: DAY, habitId: "habit-2" },
    { id: "habit-3", type: "habit_completed", coins: 2, date: DAY, habitId: "habit-3" },
    { id: "habit-failed", type: "habit_failed", coins: 10, date: DAY, habitId: "habit-4" },
    { id: "bad-1", type: "bad_habit", coins: 2, date: DAY, habitId: "bad-1" },
    { id: "bad-2", type: "bad_habit", coins: 2, date: DAY, habitId: "bad-1" },
    { id: "reward-1", type: "reward_redeemed", cost: 10, date: DAY, rewardId: "reward-1" },
    { id: "reward-2", type: "reward_redeemed", cost: 50, date: DAY, rewardId: "reward-2" }
  ]);
  const row = dayRow(context);

  assert.equal(row.net, -68);
  assert.equal(row.behaviorNet, -8);
  assert.equal(row.behaviorEarned, 6);
  assert.equal(row.behaviorDeducted, 14);
});
