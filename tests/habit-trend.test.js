const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createState(history) {
  return {
    pastCoinHistoryScaleMigrationVersion: 1,
    coins: 0,
    streak: 0,
    settledThroughDate: localDateKey(),
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
    clearTimeout,
    els: { habitTrendChart: { innerHTML: "" } },
    escapeHtml: value => String(value),
    escapeAttr: value => String(value)
  };
  vm.createContext(context);
  [
    "js/storage.js",
    "js/tasks.js",
    "js/habits.js",
    "js/economy.js",
    "js/settlement.js",
    "js/stats-data.js",
    "js/stats.js"
  ].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  });
  return context;
}

function trendFixture() {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  return [
    { id: "legacy-habit", type: "habit_completed", coins: 10, date: localDateKey(today), habitId: "habit-1" },
    {
      id: "legacy-task",
      type: "task_completed",
      coins: 20,
      date: localDateKey(today),
      taskId: "task-1",
      durationSeconds: 1800
    },
    { id: "legacy-bad", type: "bad_habit", coins: 2, date: localDateKey(yesterday), habitId: "bad-1" }
  ];
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

test("最近一周、一月和一年都生成完整趋势 series，并兼容旧历史", () => {
  const context = createRuntime(trendFixture());
  [
    ["week", 7],
    ["month", 30],
    ["year", 365]
  ].forEach(([range, expectedLength]) => {
    const result = vm.runInContext(`(() => {
      const rows = buildStatsRows("${range}");
      return { rows, series: buildHabitTrendSeries(rows) };
    })()`, context);
    const plain = JSON.parse(JSON.stringify(result));
    assert.equal(plain.rows.length, expectedLength);
    assert.equal(plain.series.labels.length, expectedLength);
    assert.equal(plain.series.completedSeries.length, expectedLength);
    assert.equal(plain.series.failureSeries.length, expectedLength);
    assert.equal(plain.series.focusSeries.length, expectedLength);
    assert.equal(plain.series.completedSeries.at(-1), 2);
    assert.equal(plain.series.focusSeries.at(-1), 30);
    assert.equal(plain.series.failureSeries.at(-2), 1);
  });
});

test("趋势图为每一天生成完成、负向和专注三组柱", () => {
  const context = createRuntime(trendFixture());
  vm.runInContext(`renderHabitTrend(buildStatsRows("week"))`, context);
  const html = context.els.habitTrendChart.innerHTML;
  assert.equal(countMatches(html, /stats-trend-chart__day/g), 7);
  assert.equal(countMatches(html, /stats-trend-chart__bar--completed/g), 7);
  assert.equal(countMatches(html, /stats-trend-chart__bar--failure/g), 7);
  assert.equal(countMatches(html, /stats-trend-chart__bar--focus/g), 7);
  assert.doesNotMatch(html, /stats-trend-chart__empty/);
  assert.match(html, /height: 100\.0%;/);
});

test("只有一天有数据仍绘制，完全无数据时显示空状态", () => {
  const populated = createRuntime([
    { id: "one-day", type: "habit_completed", coins: 10, date: localDateKey(), habitId: "habit-1" }
  ]);
  vm.runInContext(`renderHabitTrend(buildStatsRows("week"))`, populated);
  assert.match(populated.els.habitTrendChart.innerHTML, /stats-trend-chart__bar--completed/);
  assert.doesNotMatch(populated.els.habitTrendChart.innerHTML, /该周期暂无记录/);

  const empty = createRuntime([]);
  vm.runInContext(`renderHabitTrend(buildStatsRows("week"))`, empty);
  assert.match(empty.els.habitTrendChart.innerHTML, /该周期暂无记录/);
  assert.doesNotMatch(empty.els.habitTrendChart.innerHTML, /stats-trend-chart__bar-group/);
});

test("切换周期会替换图表内容，不会叠加旧节点", () => {
  const context = createRuntime(trendFixture());
  [
    ["week", 7],
    ["month", 30],
    ["year", 365],
    ["week", 7]
  ].forEach(([range, expectedDays]) => {
    vm.runInContext(`renderHabitTrend(buildStatsRows("${range}"))`, context);
    assert.equal(countMatches(context.els.habitTrendChart.innerHTML, /stats-trend-chart__day/g), expectedDays);
    assert.equal(countMatches(context.els.habitTrendChart.innerHTML, /habit-bar-chart stats-trend-chart/g), 1);
  });
});
