const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const TODAY = "2026-08-24";
const TOMORROW = "2026-08-25";
const FIXED_NOW = "2026-08-24T12:00:00.000Z";

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
    coins: 398,
    streak: 0,
    lastCompletedDate: null,
    settledThroughDate: "2026-08-23",
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

function createRuntime(initialState = createState(), { withStats = false } = {}) {
  const storage = new Map([["minimal-discipline-v1", JSON.stringify(initialState)]]);
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
    window: { location: { hostname: "localhost" } },
    document: {},
    crypto: { randomUUID: () => "test-id" },
    showToast() {},
    showReviewSavedStatus() {},
    renderDailyReview() {},
    renderDailyScoreTrend() {},
    closeSheet() {},
    askForConfirmation: async () => true,
    escapeHtml: value => String(value),
    escapeAttr: value => String(value),
    formatNumber: value => String(value),
    els: { dailyScoreTrendChart: { innerHTML: "" } }
  };
  vm.createContext(context);
  ["js/storage.js", ...(withStats ? ["js/stats-data.js", "js/stats.js"] : [])].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  });
  return { context, storage };
}

function value(context, expression) {
  return vm.runInContext(expression, context);
}

test("保存当天复盘会用本地次日索引创建唯一重点，且不产生金币事件", () => {
  const { context } = createRuntime();
  value(context, `saveDailyReview({
    best: "完成剪辑",
    mistake: "开始太晚",
    priority: "剪完 Raphael 视频",
    dailyScore: 7
  }, "${TODAY}")`);

  assert.equal(value(context, `state.priorityTaskByDate["${TOMORROW}"].title`), "剪完 Raphael 视频");
  assert.equal(value(context, `state.priorityTaskByDate["${TOMORROW}"].source`), "daily_review");
  assert.equal(value(context, `state.priorityTaskByDate["${TOMORROW}"].sourceReviewDate`), TODAY);
  assert.equal(value(context, `state.dailyReviews["${TODAY}"].dailyScore`), 7);
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "state.coins"), 398);

  value(context, `saveDailyReview({ best: "完成剪辑", priority: "发布 Raphael 视频", dailyScore: 8 }, "${TODAY}")`);
  assert.equal(value(context, `Object.keys(state.priorityTaskByDate).length`), 1);
  assert.equal(value(context, `state.priorityTaskByDate["${TOMORROW}"].title`), "发布 Raphael 视频");
});

test("复盘读取已有明日重点，清空时只删除尚未结算且由该复盘生成的记录", () => {
  const state = createState({
    priorityTaskByDate: {
      [TOMORROW]: {
        date: TOMORROW,
        title: "已有明日重点",
        status: "pending",
        source: "daily_review",
        sourceReviewDate: TODAY
      }
    },
    dailyReviews: {
      [TODAY]: { date: TODAY, best: "完成工作", mistake: "", priority: "旧文字", dailyScore: 6 }
    }
  });
  const { context } = createRuntime(state);

  assert.equal(value(context, `reviewPriorityInputValue("${TODAY}")`), "已有明日重点");
  value(context, `saveDailyReview({ best: "完成工作", priority: "", dailyScore: 6 }, "${TODAY}")`);
  assert.equal(value(context, `state.priorityTaskByDate["${TOMORROW}"]`), undefined);
});

test("历史复盘不能静默改写或删除已结算重点", () => {
  const state = createState({
    priorityTaskByDate: {
      [TODAY]: {
        date: TODAY,
        title: "已经完成的重点",
        status: "done",
        rewardHistoryId: "priority-reward",
        source: "daily_review",
        sourceReviewDate: "2026-08-23"
      }
    },
    dailyReviews: {
      "2026-08-23": { date: "2026-08-23", best: "完成", mistake: "", priority: "已经完成的重点" }
    },
    history: [{ id: "priority-reward", type: "priority_task_reward", date: TODAY, coinDelta: 100 }]
  });
  const { context } = createRuntime(state);

  value(context, `saveDailyReview({ best: "更新复盘", priority: "改写后的文字", dailyScore: 9 }, "2026-08-23")`);
  assert.equal(value(context, `state.dailyReviews["2026-08-23"].priority`), "改写后的文字");
  assert.equal(value(context, `state.priorityTaskByDate["${TODAY}"].title`), "已经完成的重点");
  assert.equal(value(context, `state.dailyReviews["2026-08-23"].dailyScore`), 9);
});

test("评分只接受 1 到 10 的整数，旧复盘保持未评分", () => {
  const { context } = createRuntime(createState({
    dailyReviews: {
      "2026-08-20": { date: "2026-08-20", best: "旧记录", mistake: "", priority: "" }
    }
  }));

  assert.equal(value(context, "normalizeDailyScore(1)"), 1);
  assert.equal(value(context, "normalizeDailyScore(10)"), 10);
  assert.equal(value(context, "normalizeDailyScore(1.5)"), null);
  assert.equal(value(context, "normalizeDailyScore(0)"), null);
  assert.equal(value(context, "normalizeDailyScore(11)"), null);
  assert.equal(value(context, `dailyReviewForDate("2026-08-20").dailyScore`), null);
});

test("新复盘可保存 1 分和 10 分，历史编辑能更新评分", async () => {
  const { context } = createRuntime();
  value(context, `saveDailyReview({ best: "低分日", dailyScore: 1 }, "2026-08-23")`);
  value(context, `saveDailyReview({ best: "满分日", dailyScore: 10 }, "${TODAY}")`);
  assert.equal(value(context, `state.dailyReviews["2026-08-23"].dailyScore`), 1);
  assert.equal(value(context, `state.dailyReviews["${TODAY}"].dailyScore`), 10);

  await value(context, `saveEditedDailyReview({
    date: "2026-08-23",
    best: "评分已更新",
    mistake: "",
    priority: "",
    dailyScore: 8
  }, "2026-08-23")`);
  assert.equal(value(context, `state.dailyReviews["2026-08-23"].dailyScore`), 8);
});

test("评分趋势按日保留缺失值，按月忽略未评分并固定 10 分上限", () => {
  const reviews = {
    "2026-08-18": { date: "2026-08-18", dailyScore: 1 },
    "2026-08-20": { date: "2026-08-20", dailyScore: 10 },
    "2026-08-21": { date: "2026-08-21" },
    "2026-07-02": { date: "2026-07-02", dailyScore: 6 },
    "2026-07-14": { date: "2026-07-14", dailyScore: 9 }
  };
  const { context } = createRuntime(createState({ dailyReviews: reviews }), { withStats: true });

  const week = JSON.parse(JSON.stringify(value(context, `buildDailyScoreTrend("week", state.dailyReviews, new Date("${FIXED_NOW}"))`)));
  assert.equal(week.rows.length, 7);
  assert.equal(week.rows.find(row => row.key === "2026-08-18").score, 1);
  assert.equal(week.rows.find(row => row.key === "2026-08-19").score, null);
  assert.equal(week.average, 5.5);
  assert.equal(week.ratedCount, 2);
  assert.equal(week.maxScore, 10);

  const month = JSON.parse(JSON.stringify(value(context, `buildDailyScoreTrend("month", state.dailyReviews, new Date("${FIXED_NOW}"))`)));
  assert.equal(month.rows.length, 30);
  assert.equal(month.ratedCount, 2);

  const year = JSON.parse(JSON.stringify(value(context, `buildDailyScoreTrend("year", state.dailyReviews, new Date("${FIXED_NOW}"))`)));
  assert.equal(year.rows.length, 12);
  assert.equal(year.rows.find(row => row.key === "2026-07").score, 7.5);
  assert.equal(year.rows.find(row => row.key === "2026-06").score, null);
  assert.equal(year.ratedCount, 4);

  value(context, `renderDailyScoreTrend(buildDailyScoreTrend("week", state.dailyReviews, new Date("${FIXED_NOW}")))`);
  assert.match(context.els.dailyScoreTrendChart.innerHTML, /每日评分趋势/);
  assert.match(context.els.dailyScoreTrendChart.innerHTML, /平均评分：5\.5/);
  assert.match(context.els.dailyScoreTrendChart.innerHTML, /daily-score-reference--ten/);
  assert.match(context.els.dailyScoreTrendChart.innerHTML, /height: 100\.0%;/);
  assert.doesNotMatch(context.els.dailyScoreTrendChart.innerHTML, /完成|坏习惯|专注/);
});

test("统计页只挂载每日评分趋势，不再挂载旧习惯趋势模块", () => {
  assert.match(indexHtml, /<h2>每日评分趋势<\/h2>/);
  assert.match(indexHtml, /id="dailyScoreTrendChart"/);
  assert.doesNotMatch(indexHtml, /id="habitTrendChart"/);
  assert.doesNotMatch(indexHtml, /<h2>习惯趋势<\/h2>/);
});

test("保存评分后会立即刷新已挂载的评分图", () => {
  const { context } = createRuntime(createState(), { withStats: true });
  value(context, `saveDailyReview({ best: "完成", dailyScore: 9 }, "${TODAY}")`);
  assert.match(context.els.dailyScoreTrendChart.innerHTML, /平均评分：9\.0/);
  assert.match(context.els.dailyScoreTrendChart.innerHTML, /已评分：1 天/);
});

test("本地日期 helper 跨夏令时边界仍写入正确次日", () => {
  const { context } = createRuntime();
  assert.equal(value(context, `shiftDateKey("2026-03-29", 1)`), "2026-03-30");
  assert.equal(value(context, `normalizePriorityDateKey("2026-08-25")`), "2026-08-25");
});
