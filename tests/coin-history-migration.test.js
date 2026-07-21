const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "minimal-discipline-v1";
const BACKUP_KEY = `${STORAGE_KEY}-backup-before-past-coin-scale-v1`;

function oldState() {
  return {
    coins: 39.8,
    streak: 3,
    tasks: [
      {
        id: "completed-task",
        name: "已完成任务",
        status: "completed",
        coins: 2,
        hourlyReward: 2,
        earnedCoins: 1.17,
        durationSeconds: 2106
      },
      { id: "pending-task", name: "未完成任务", status: "pending", coins: 5, hourlyReward: 5 },
      { id: "running-task", name: "进行中任务", status: "running", coins: 2, earnedCoins: null }
    ],
    completions: {},
    taskResults: {},
    habits: [{ id: "habit-1", name: "好习惯", coins: 2 }],
    habitCompletions: {},
    habitFailures: {},
    taskAutoFailures: {},
    badHabits: [{ id: "bad-1", name: "坏习惯", penalty: 5 }],
    notes: [],
    memos: [],
    rewards: [{
      id: "fund-1",
      name: "旅行基金",
      totalCoins: 1000,
      amountPerDeposit: 100,
      currentCoins: 150,
      completedAt: null,
      achievementId: null
    }],
    achievements: [{
      id: "achievement-1",
      type: "fund_completed",
      rewardId: "old-fund",
      name: "旧基金",
      totalCoins: 500,
      completedAt: "2026-06-01T10:00:00.000Z",
      date: "2026-06-01"
    }],
    priorityTaskByDate: {},
    nextStep: { taskId: null, updatedAt: null },
    dailyReviews: {},
    reviewRewards: { "2026-06-30": "review-history" },
    noBadHabitBonuses: {},
    history: [
      {
        id: "task-history",
        type: "task_completed",
        taskId: "completed-task",
        coins: 1.17,
        earnedCoins: 1.17,
        coinDelta: 1.17,
        date: "2026-07-01",
        affectsBehaviorScore: true,
        source: "behavior",
        category: "habit_performance",
        entityType: "task"
      },
      {
        id: "habit-history",
        type: "habit_completed",
        habitId: "habit-1",
        coins: 2,
        coinDelta: 2,
        date: "2026-07-01",
        affectsBehaviorScore: true,
        source: "behavior",
        category: "habit_performance",
        entityType: "habit"
      },
      {
        id: "failure-history",
        type: "task_failed",
        taskId: "failed-task",
        coins: 10,
        coinDelta: -10,
        date: "2026-07-02",
        affectsBehaviorScore: true,
        source: "behavior",
        category: "habit_performance",
        entityType: "task"
      },
      {
        id: "review-history",
        type: "review_reward",
        coins: 2,
        coinDelta: 2,
        date: "2026-06-30",
        affectsBehaviorScore: true,
        source: "behavior",
        category: "habit_performance",
        entityType: "review"
      },
      {
        id: "fund-history",
        type: "fund_deposit",
        rewardId: "fund-1",
        amount: 50,
        coinDelta: -50,
        currentCoinsBefore: 100,
        currentCoinsAfter: 150,
        totalCoins: 1000,
        date: "2026-07-02",
        affectsBehaviorScore: false,
        source: "rewards",
        category: "reward_spending",
        entityType: "reward_fund"
      }
    ],
    totals: {
      completedTasks: 1,
      coinsSpent: 50,
      coinsPenalty: 10,
      taskDurationSeconds: 2106,
      earnedTaskCoins: 1.17
    }
  };
}

function createRuntime(initialState = oldState()) {
  const storage = new Map([[STORAGE_KEY, JSON.stringify(initialState)]]);
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
      get length() { return storage.size; },
      key(index) { return [...storage.keys()][index] || null; },
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
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
  return { context, storage };
}

function value(context, expression) {
  return vm.runInContext(expression, context);
}

test("过去金币金额只迁移一次，未来配置保持原值", () => {
  const { context, storage } = createRuntime();

  assert.equal(value(context, "state.coins"), 398);
  assert.equal(value(context, "state.pastCoinHistoryScaleMigrationVersion"), 1);
  assert.equal(value(context, "state.tasks[0].earnedCoins"), 11.7);
  assert.equal(value(context, "state.tasks[0].coins"), 2);
  assert.equal(value(context, "state.tasks[0].hourlyReward"), 2);
  assert.equal(value(context, "state.tasks[1].coins"), 5);
  assert.equal(value(context, "state.habits[0].coins"), 2);
  assert.equal(value(context, "state.badHabits[0].penalty"), 5);
  assert.equal(value(context, "state.rewards[0].currentCoins"), 1500);
  assert.equal(value(context, "state.rewards[0].totalCoins"), 1000);
  assert.equal(value(context, "state.rewards[0].amountPerDeposit"), 100);
  assert.equal(value(context, "fundCompleted(state.rewards[0])"), false);
  assert.equal(value(context, "state.achievements[0].totalCoins"), 500);
  assert.equal(value(context, "DEFAULT_TASK_REWARD"), 20);
  assert.equal(value(context, "TASK_FAILURE_MULTIPLIER"), 10);
  assert.equal(value(context, "NO_BAD_HABIT_BONUS"), 2);
  assert.equal(value(context, "PRIORITY_TASK_REWARD"), 100);
  assert.equal(value(context, "PRIORITY_TASK_PENALTY"), 500);
  assert.equal(value(context, "state.totals.coinsSpent"), 500);
  assert.equal(value(context, "state.totals.coinsPenalty"), 100);
  assert.equal(value(context, "state.totals.earnedTaskCoins"), 11.7);
  assert.equal(value(context, "state.totals.taskDurationSeconds"), 2106);
  assert.ok(storage.has(BACKUP_KEY));

  const persisted = JSON.parse(storage.get(STORAGE_KEY));
  const reloaded = createRuntime(persisted);
  assert.equal(value(reloaded.context, "state.coins"), 398);
  assert.equal(value(reloaded.context, "state.history.find(item => item.id === 'task-history').coinDelta"), 11.7);
});

test("历史事件金额迁移，但热力图继续使用迁移前行为分值", () => {
  const { context } = createRuntime();
  const row = value(context, "buildMonthlyHeatRows('2026-07').find(item => item.key === '2026-07-01')");

  assert.equal(value(context, "state.history.find(item => item.id === 'task-history').coins"), 11.7);
  assert.equal(value(context, "state.history.find(item => item.id === 'habit-history').coins"), 20);
  assert.equal(value(context, "state.history.find(item => item.id === 'failure-history').coinDelta"), -100);
  assert.equal(value(context, "state.history.find(item => item.id === 'review-history').coins"), 20);
  assert.equal(value(context, "state.history.find(item => item.id === 'fund-history').amount"), 500);
  assert.equal(value(context, "state.history.find(item => item.id === 'fund-history').currentCoinsAfter"), 1500);
  assert.equal(value(context, "state.history.find(item => item.id === 'fund-history').totalCoins"), 1000);
  assert.equal(row.net, 31.7);
  assert.equal(row.behaviorNet, 3.17);
});

test("迁移后新金币事件不会自动乘十", () => {
  const { context } = createRuntime();
  value(context, `recordCoinEvent({
    type: "habit_completed",
    amount: 2,
    date: "2026-07-03",
    history: { habitId: "new-habit", coins: 2 }
  })`);

  assert.equal(value(context, "state.coins"), 400);
  assert.equal(value(context, "state.history[0].coinDelta"), 2);
  assert.equal(value(context, "state.history[0].coins"), 2);
});

test("保存新复盘只保存文本，不产生金币和撤回", () => {
  const { context } = createRuntime();
  value(context, `renderDailyReview = () => {};
    showReviewSavedStatus = () => {};
    showToast = () => {};
    pendingUndo = null;`);
  const beforeCoins = value(context, "state.coins");
  const beforeHistoryCount = value(context, "state.history.length");

  value(context, `saveDailyReview({
    best: "完成迁移测试",
    mistake: "",
    priority: "继续验证"
  }, "2026-07-10")`);

  assert.equal(value(context, "state.coins"), beforeCoins);
  assert.equal(value(context, "state.history.length"), beforeHistoryCount);
  assert.equal(value(context, "state.dailyReviews['2026-07-10'].best"), "完成迁移测试");
  assert.equal(value(context, "state.reviewRewards['2026-07-10']"), undefined);
  assert.equal(value(context, "pendingUndo"), null);
});
