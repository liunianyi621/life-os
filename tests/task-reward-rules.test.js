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
    fixedRewardRulesSince: "2026-07-14",
    coins,
    streak: 0,
    lastCompletedDate: null,
    settledThroughDate: "2026-07-15",
    tasks,
    completions: {},
    taskResults: {},
    habits: [],
    scheduledHabitIdsByDate: {},
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

function createRuntime(state, clock = null) {
  const storage = new Map([["minimal-discipline-v1", JSON.stringify(state)]]);
  let uuid = 0;
  const context = {
    console,
    Date: clock ? class extends Date {
      constructor(...args) { super(...(args.length ? args : [clock.now])); }
      static now() { return new Date(clock.now).getTime(); }
    } : FixedDate,
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
  ["js/storage.js", "js/tasks.js", "js/habits.js", "js/economy.js", "js/settlement.js", "js/stats-data.js", "js/stats.js", "js/ui/time-picker.js", "js/memos.js"].forEach(file => {
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

for (const [hour, minute, occupied, expected] of [
  [16,53,[16],['16:00','17:00','18:00']],
  [16,53,[],['17:00','18:00','19:00']],
  [16,53,[16,17],['16:00','17:00','18:00']],
  [23,40,[23],['23:00','明天 00:00','明天 01:00']]
]) test(`三槽总量：${hour}:${minute}，占用 ${occupied}`, () => {
  const {context} = createRuntime(emptyState(occupied.map((h,i) => task({id:'t'+i,timeStart:`${h}:00`,timeEnd:`${h+1}:00`}))));
  const timeline = value(context,`hourlyTaskTimeline(state.tasks,new Date(2026,6,16,${hour},${minute}))`);
  assert.deepEqual(Array.from(timeline.upcoming,slot => slot.label),expected);
  assert.equal(timeline.earlier.length + timeline.upcoming.length,3);
});

test('当前小时结算后窗口前移，确认态不会额外占一个小时槽', () => {
  const {context} = createRuntime(emptyState([task({timeStart:'16:00',timeEnd:'17:00'})]));
  value(context,"state.history.push({id:'settled',taskId:'task-1',type:'task_completed'})");
  assert.deepEqual(Array.from(value(context,'hourlyTaskTimeline(state.tasks,new Date(2026,6,16,16,53)).upcoming'),slot=>slot.label),['17:00','18:00','19:00']);
});

test('同一小时的多个任务只占一槽，非整点手动排期不增加新槽', () => {
  const {context} = createRuntime(emptyState([
    task({id:'a',timeStart:'16:00',timeEnd:'17:00'}),
    task({id:'b',timeStart:'16:30',timeEnd:'17:30'})
  ]));
  const timeline=value(context,'hourlyTaskTimeline(state.tasks,new Date(2026,6,16,16,53))');
  assert.equal(timeline.upcoming.length,3);
  assert.equal(timeline.upcoming[0].tasks.length,2);
  assert.equal(value(context,'state.tasks[1].timeStart'),'16:30');
});

for (const source of ['MANUAL','HABIT','MEMO']) test(`重新排期只改计划字段：${source}`, () => {
  const initial = emptyState([task({timeStart:'16:00',timeEnd:'17:00'})]);
  Object.assign(initial.tasks[0],{source,originId:'origin',sourceHabitScheduledDate:DAY});
  const {context,storage} = createRuntime(initial);
  value(context,'renderTasks = () => {}; globalThis.before = JSON.stringify(state)');
  assert.equal(value(context,"rescheduleTask('task-1',new Date(2026,6,16,18))"),true);
  const previous = JSON.parse(value(context,'before'));
  const after = JSON.parse(value(context,'JSON.stringify(state)'));
  const changed = ['date','scheduledStart','scheduledEnd','timeStart','timeEnd','time'];
  for (const key of changed) { delete previous.tasks[0][key]; delete after.tasks[0][key]; }
  assert.deepEqual(after,previous);
  const reloaded = createRuntime(JSON.parse(storage.get('minimal-discipline-v1')));
  assert.equal(value(reloaded.context,'state.tasks[0].timeStart'),'18:00');
  assert.equal(value(reloaded.context,'state.history.length'),0);
});

test('排期保存失败恢复旧任务；已结算任务拒绝拖动', () => {
  const {context} = createRuntime(emptyState([task({timeStart:'16:00',timeEnd:'17:00'})]));
  value(context,"renderTasks = () => {}; globalThis.before = JSON.stringify(state); saveState = () => {throw new Error('quota')}");
  assert.equal(value(context,"rescheduleTask('task-1',new Date(2026,6,16,18))"),false);
  assert.equal(value(context,'JSON.stringify(state)'),value(context,'before'));
  value(context,"state.tasks[0].status = 'completed'");
  assert.equal(value(context,"rescheduleTask('task-1',new Date(2026,6,16,18))"),false);
});

test('旧任务重新排到次日仍可见，创建日期和习惯责任日期不变', () => {
  const initial = emptyState([task()]);
  initial.tasks[0].createdAt = '2026-07-15T12:00:00Z';
  const {context} = createRuntime(initial);
  value(context,'renderTasks = () => {}');
  assert.equal(value(context,"rescheduleTask('task-1',new Date(2026,6,17,0))"),true);
  assert.equal(value(context,'state.tasks[0].date'),'2026-07-17');
  assert.equal(value(context,'state.tasks[0].timeStart'),'00:00');
  assert.equal(value(context,'state.tasks[0].timeEnd'),'01:00');
  assert.equal(value(context,'todayTasks().length'),1);
  assert.equal(value(context,'state.tasks[0].createdDate'),DAY);
});

test('缺少独立责任日期的旧 Habit 任务跨日排期不改变习惯责任日', () => {
  const initial=emptyState([task()]);
  Object.assign(initial.tasks[0],{source:'HABIT',originId:'h'});
  const {context}=createRuntime(initial);
  value(context,'renderTasks=()=>{}');
  assert.equal(value(context,"rescheduleTask('task-1',new Date(2026,6,17,0))"),true);
  assert.equal(value(context,'taskSettlementDay(state.tasks[0])'),DAY);
  assert.equal(value(context,'dateKey(taskScheduledStartDate(state.tasks[0]))'),'2026-07-17');
  assert.equal(value(context,'state.history.length'),0);
});

for (const reward of [5, 10, 20]) {
  test(`固定奖励 ${reward}：直接完成、主动失败、跨天补扣和重载均只结算一次`, () => {
    const make = () => task({ id: 'fixed', coins: reward, reward, hourlyReward: 99 });
    const completed = createRuntime(emptyState([make()]));
    value(completed.context, "completeTask('fixed'); completeTask('fixed')");
    assert.equal(value(completed.context, 'state.coins'), 1000 + reward);
    assert.equal(value(completed.context, 'state.history.length'), 1);
    const failed = createRuntime(emptyState([make()]));
    value(failed.context, "failTask('fixed'); failTask('fixed')");
    assert.equal(value(failed.context, 'state.coins'), 1000 - reward * 10);
    assert.equal(value(failed.context, 'state.history.length'), 1);
    const overdue = make();
    overdue.date = overdue.createdDate = '2026-07-15';
    const settled = createRuntime(emptyState([overdue]));
    value(settled.context, 'runAutomaticChecks({showToast:false}); runAutomaticChecks({showToast:false})');
    assert.equal(value(settled.context, 'state.coins'), 1000 - reward * 10);
    const reloaded = createRuntime(JSON.parse(settled.storage.get('minimal-discipline-v1')));
    value(reloaded.context, 'runAutomaticChecks({showToast:false})');
    assert.equal(value(reloaded.context, 'state.coins'), 1000 - reward * 10);
    assert.equal(value(reloaded.context, 'state.history.length'), 1);
  });
}

test('离线多日逐日补扣，已完成日期和习惯创建前日期不扣，重载不重复', () => {
  const initial = emptyState();
  initial.settledThroughDate = '2026-07-13';
  initial.habits = [{id:'daily',name:'阅读',createdDate:'2026-07-14'}, {id:'new',name:'新习惯',createdDate:DAY}];
  initial.habitCompletions = {'2026-07-14':{daily:true}};
  const clock = {now:'2026-07-18T12:00:00Z'};
  const runtime = createRuntime(initial, clock);
  value(runtime.context, 'runAutomaticChecks({showToast:false})');
  // daily: 15,16,17; new: 16,17.
  assert.equal(value(runtime.context, 'state.coins'), 750);
  assert.equal(value(runtime.context, 'state.history.length'), 5);
  const reloaded = createRuntime(JSON.parse(runtime.storage.get('minimal-discipline-v1')), clock);
  value(reloaded.context, 'runAutomaticChecks({showToast:false})');
  assert.equal(value(reloaded.context, 'state.coins'), 750);
  assert.equal(value(reloaded.context, 'state.history.length'), 5);
});

test('首次启用不追罚旧模板时期，次日补结算启用日', () => {
  const initial = emptyState();
  delete initial.fixedRewardRulesSince;
  initial.settledThroughDate = '2026-01-01';
  initial.habits = [{id:'daily',name:'阅读',createdDate:'2026-01-01'}];
  const clock = {now:FIXED_NOW};
  const runtime = createRuntime(initial, clock);
  value(runtime.context, 'runAutomaticChecks({showToast:false})');
  assert.equal(value(runtime.context, 'state.coins'), 1000);
  assert.equal(value(runtime.context, 'state.fixedRewardRulesSince'), DAY);
  clock.now = '2026-07-17T12:00:00Z';
  value(runtime.context, 'runAutomaticChecks({showToast:false})');
  assert.equal(value(runtime.context, 'state.coins'), 950);
  assert.equal(value(runtime.context, 'state.history.length'), 1);
});

test('习惯及其拖入任务共享每日处罚，不产生任务加习惯双重扣款', () => {
  const initial = emptyState();
  initial.habits = [{id:'daily',name:'阅读',coins:20,createdDate:DAY}];
  const clock = {now:FIXED_NOW};
  const runtime = createRuntime(initial, clock);
  value(runtime.context, "scheduleHabitAsTask('daily', new Date())");
  clock.now = '2026-07-17T12:00:00Z';
  value(runtime.context, 'runAutomaticChecks({showToast:false}); runAutomaticChecks({showToast:false})');
  assert.equal(value(runtime.context, 'state.coins'), 950);
  assert.equal(value(runtime.context, 'state.history.length'), 1);
  assert.equal(value(runtime.context, 'state.history[0].type'), 'habit_failed');
  assert.equal(value(runtime.context, 'state.tasks[0].status'), 'failed');
});

test('结算保存失败恢复余额和日期游标，重试只扣一次', () => {
  const initial = emptyState();
  initial.settledThroughDate = '2026-07-14';
  initial.habits = [{id:'daily',name:'阅读',createdDate:'2026-07-15'}];
  const runtime = createRuntime(initial);
  value(runtime.context, "originalSave = saveState; saveState = () => { throw new Error('storage full'); }; runAutomaticChecks({showToast:false})");
  assert.equal(value(runtime.context, 'state.coins'), 1000);
  assert.equal(value(runtime.context, 'state.history.length'), 0);
  assert.equal(value(runtime.context, 'state.settledThroughDate'), '2026-07-14');
  value(runtime.context, 'saveState = originalSave; runAutomaticChecks({showToast:false}); runAutomaticChecks({showToast:false})');
  assert.equal(value(runtime.context, 'state.coins'), 950);
  assert.equal(value(runtime.context, 'state.history.length'), 1);
});

test('完成保存失败不消耗 Memo，也不奖励金币', () => {
  const initial = emptyState();
  initial.memos = [{id:'memo',text:'买书',completed:false}];
  const runtime = createRuntime(initial);
  value(runtime.context, "scheduleMemoAsTask('memo', new Date()); originalSave = saveState; saveState = () => { throw new Error('storage full'); }; completeTask(state.tasks[0].id)");
  assert.equal(value(runtime.context, 'state.coins'), 1000);
  assert.equal(value(runtime.context, 'state.memos.length'), 1);
  assert.equal(value(runtime.context, 'state.tasks[0].status'), 'pending');
  value(runtime.context, 'saveState = originalSave; completeTask(state.tasks[0].id)');
  assert.equal(value(runtime.context, 'state.coins'), 1005);
  assert.equal(value(runtime.context, 'state.memos.length'), 0);
});

test('习惯主动失败及撤回复用同一每日记录，次日不会再扣前一天', () => {
  const initial = emptyState();
  initial.habits = [{id:'daily',name:'阅读',createdDate:DAY}];
  const clock = {now:FIXED_NOW};
  const {context} = createRuntime(initial, clock);
  value(context, "scheduleHabitAsTask('daily'); failTask(state.tasks[0].id); failTask(state.tasks[0].id)");
  assert.equal(value(context, 'state.coins'), 950);
  value(context, 'undoLastAction()');
  assert.equal(value(context, 'state.coins'), 1000);
  assert.equal(value(context, 'state.tasks[0].status'), 'pending');
  value(context, 'completeTask(state.tasks[0].id)');
  assert.equal(value(context, 'state.coins'), 1005);
  clock.now = '2026-07-17T12:00:00Z';
  value(context, 'runAutomaticChecks({showToast:false})');
  assert.equal(value(context, 'state.coins'), 1005);
});

test('仅有旧任务关联的已完成习惯仍被识别，旧金币历史原样保留', () => {
  const initial = emptyState();
  initial.settledThroughDate = '2026-07-14';
  initial.habits = [{id:'daily',name:'阅读',createdDate:'2026-07-15'}];
  initial.tasks = [{...task({id:'old',date:'2026-07-15',status:'completed'}),sourceHabitId:'daily',sourceHabitScheduledDate:'2026-07-15'}];
  initial.history = [{id:'old-event',taskId:'old',type:'task_completed',date:'2026-07-15',coinDelta:0.14,coins:0.14}];
  const {context} = createRuntime(initial);
  const before = value(context, 'JSON.stringify(state.history)');
  value(context, 'runAutomaticChecks({showToast:false})');
  assert.equal(value(context, 'state.coins'), 1000);
  assert.equal(value(context, 'JSON.stringify(state.history)'), before);
  assert.equal(value(context, "habitCompletedOnDate('daily', '2026-07-16')"), false);
});

test('创建时间按本地日期判断，午夜前后的新习惯不提前扣款', () => {
  const initial = emptyState();
  initial.fixedRewardRulesSince = '2026-07-15';
  initial.settledThroughDate = '2026-07-14';
  initial.habits = [{id:'late',name:'午夜习惯',createdAt:new Date(2026,6,16,0,15).toISOString()}];
  const {context} = createRuntime(initial);
  value(context, 'runAutomaticChecks({showToast:false})');
  assert.equal(value(context, 'state.coins'), 1000);
  assert.equal(value(context, "habitActiveOnDate(state.habits[0], '2026-07-15')"), false);
});

test('新任务只接受固定选项，习惯来源编辑也不能改成其他金额', () => {
  const initial = emptyState();
  initial.tasks = [{...task({id:'habit-task'}),source:'HABIT',originId:'h'}];
  const {context} = createRuntime(initial);
  value(context, "closeSheet=()=>{}; editingId=null; saveTask({name:'invalid',coins:7}); editingId='habit-task'; saveTask({name:'阅读',coins:20})");
  assert.equal(value(context, 'state.tasks[0].reward'), 5);
  assert.equal(value(context, 'state.tasks[1].reward'), 5);
  assert.equal(value(context, 'state.tasks[1].actualStartTime'), null);
});

test("旧运行任务刷新后直接按固定金额完成，不再按 46 分钟折算", () => {
  const initial = emptyState([task({ status: "running", timeStart: "20:00", timeEnd: "21:00", startTime: DAY + "T19:17:00Z" })]);
  const { context } = createRuntime(initial, { now: DAY + "T20:03:00Z" });
  assert.equal(value(context, "taskUsesTimer(state.tasks[0])"), false);
  value(context, "completeTask('task-1')");
  assert.equal(value(context, "state.coins"), 1020);
  assert.equal(value(context, "state.history[0].durationSeconds"), 0);
  value(context, "undoLastAction()");
  assert.equal(value(context, "state.coins"), 1000);
  assert.equal(value(context, "state.tasks[0].status"), "running");
  assert.equal(value(context, "taskStatusToday(state.tasks[0])"), "pending");
});

test("新旧任务主动失败均按固定金额十倍扣除，撤回保留旧计时字段", () => {
  for (const status of ["waiting", "running", "paused"]) {
    const { context } = createRuntime(emptyState([task({ status, timeStart: "11:00", timeEnd: "12:00", startTime: FIXED_NOW })]));
    value(context, "failTask('task-1')");
    assert.equal(value(context, "state.coins"), 800);
    assert.equal(value(context, "state.history[0].durationSeconds"), 0);
    value(context, "undoLastAction()");
    assert.equal(value(context, "state.tasks[0].status"), status);
    assert.equal(value(context, "state.tasks[0].startTime"), FIXED_NOW);
    assert.equal(value(context, "state.coins"), 1000);
  }
});

test("最多三个小时槽，更晚的已有任务进入其他安排", () => {
  const { context } = createRuntime(emptyState([task({ timeStart: "23:00", timeEnd: "00:00" })]));
  const timeline = value(context, `hourlyTaskTimeline(state.tasks, new Date(2026, 6, 16, 19, 36))`);
  assert.deepEqual(Array.from(timeline.upcoming, slot => slot.label), ["20:00", "21:00", "22:00"]);
  assert.equal(timeline.upcoming.filter(slot => !slot.tasks.length).length, 3);
  assert.equal(timeline.other[0].id, "task-1");
});

test("任务默认奖励为 5，失败统一按奖励乘以 10", () => {
  const { context } = createRuntime(emptyState());

  assert.equal(value(context, "DEFAULT_TASK_REWARD"), 5);
  assert.equal(value(context, "INCOMPLETE_PENALTY_MULTIPLIER"), 10);
  assert.equal(value(context, "TASK_FAILURE_MULTIPLIER"), 10);
  assert.equal(value(context, "getIncompletePenalty(1.5)"), 15);
  assert.equal(value(context, "getIncompletePenalty(0)"), 0);
  assert.equal(value(context, "taskRewardInputValue(null)"), 5);
  assert.equal(value(context, "taskRewardAmount({})"), 5);
  assert.equal(value(context, "taskRewardAmount({ coins: 0, reward: 0, hourlyReward: 0 })"), 0);
  assert.equal(value(context, "taskFailurePenalty({ coins: 0, reward: 0, hourlyReward: 0 })"), 0);
  assert.equal(value(context, "taskFailurePenalty({})"), 50);
  assert.equal(value(context, "taskFailurePenalty({ coins: 30 })"), 300);
  assert.equal(value(context, "taskFailurePenalty({ coins: 1.5 })"), 15);
  assert.equal(value(context, "taskFailurePenalty({ coins: 20, durationMinutes: 180 })"), 200);
  assert.equal(value(context, "taskFailurePenalty({ coins: 20, date: '2026-07-15', timeStart: '23:30', timeEnd: '00:30' })"), 200);

  const sheetSource = fs.readFileSync(path.join(ROOT, "js/ui/sheets.js"), "utf8");
  assert.match(sheetSource, /type="radio" name="coins"/);
  assert.doesNotMatch(sheetSource, /金币\/小时/);
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

test("旧计时任务改为固定奖励，失败不读取实际时长", () => {
  const completedRuntime = createRuntime(emptyState([task({
    id: "timed-complete",
    status: "running",
    timeStart: "11:00",
    timeEnd: "12:00",
    startTime: "2026-07-16T11:30:00.000Z"
  })]));
  value(completedRuntime.context, `finishTask("timed-complete")`);
  assert.equal(value(completedRuntime.context, "state.coins"), 1020);
  assert.equal(value(completedRuntime.context, "state.history[0].earnedCoins"), 20);
  assert.equal(value(completedRuntime.context, "state.history[0].durationSeconds"), 0);

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

test("跨日自动失败与主动失败使用同一 helper 和实际历史金额", () => {
  const { context } = createRuntime(emptyState([task({
    id: "timeout-task",
    date: "2026-07-15",
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
  assert.equal(value(context, "state.history[0].reason"), "day_end");
  assert.equal(value(context, "state.taskAutoFailures['2026-07-15']['timeout-task']"), value(context, "state.history[0].id"));
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

test("每日习惯未完成补扣固定 50，完成固定奖励 5", () => {
  const initial = emptyState();
  initial.settledThroughDate = "2026-07-14";
  initial.habits = [{ id: "h", name: "阅读", coins: 20, createdDate: "2026-07-15" }];
  const { context } = createRuntime(initial);
  value(context, "runAutomaticChecks()");
  assert.equal(value(context, "state.coins"), 950);
  value(context, "completeHabit('h'); completeHabit('h')");
  assert.equal(value(context, "state.coins"), 955);
  assert.equal(value(context, "state.history.filter(h => h.type === 'habit_completed').length"), 1);
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

test("习惯拖入时间始终向前安排到下一个完整整点的一小时", () => {
  const { context } = createRuntime(emptyState([], 2000));
  const cases = [
    { now: "new Date(2026, 6, 16, 13, 18)", startHour: 14, endHour: 15, day: DAY },
    { now: "new Date(2026, 6, 16, 13, 59)", startHour: 14, endHour: 15, day: DAY },
    { now: "new Date(2026, 6, 16, 14, 0)", startHour: 15, endHour: 16, day: DAY },
    { now: "new Date(2026, 6, 16, 23, 20)", startHour: 0, endHour: 1, day: "2026-07-17" }
  ];

  cases.forEach(item => {
    const range = value(context, `getNextFullHourRange(${item.now})`);
    assert.equal(range.start.getHours(), item.startHour);
    assert.equal(range.start.getMinutes(), 0);
    assert.equal(range.end.getHours(), item.endHour);
    assert.equal(range.end.getMinutes(), 0);
    assert.equal(value(context, `dateKey(getNextFullHourRange(${item.now}).start)`), item.day);
  });
});

test("未来时间轴始终从下一个整点生成三个槽并正确跨午夜", () => {
  const { context } = createRuntime(emptyState([], 2000));
  const daytime = value(context, `futureHourlySlots(new Date(2026, 6, 16, 19, 36))
    .map(slot => ({ label: slot.label, start: slot.start.getHours(), end: slot.end.getHours() }))`);
  assert.deepEqual(JSON.parse(JSON.stringify(daytime)), [
    { label: "20:00", start: 20, end: 21 },
    { label: "21:00", start: 21, end: 22 },
    { label: "22:00", start: 22, end: 23 }
  ]);

  const exactHour = value(context, `futureHourlySlots(new Date(2026, 6, 16, 14, 0)).map(slot => slot.start.getHours())`);
  assert.deepEqual(JSON.parse(JSON.stringify(exactHour)), [15, 16, 17]);

  const overnight = value(context, `futureHourlySlots(new Date(2026, 6, 16, 22, 30))
    .map(slot => ({ label: slot.label, day: dateKey(slot.start), hour: slot.start.getHours() }))`);
  assert.deepEqual(JSON.parse(JSON.stringify(overnight)), [
    { label: "23:00", day: DAY, hour: 23 },
    { label: "明天 00:00", day: "2026-07-17", hour: 0 },
    { label: "明天 01:00", day: "2026-07-17", hour: 1 }
  ]);
});

test("时间轴只显示开始时间并把过时任务与未来任务分开", () => {
  const state = emptyState([
    task({ id: "past", name: "较早任务", status: "waiting", timeStart: "11:00", timeEnd: "12:00" }),
    task({ id: "slot-a", name: "看书", status: "waiting", timeStart: "15:00", timeEnd: "16:00" }),
    task({ id: "slot-b", name: "整理照片", status: "waiting", timeStart: "15:00", timeEnd: "16:00" })
  ], 2000);
  const { context } = createRuntime(state);
  const timeline = value(context, `hourlyTaskTimeline(state.tasks, new Date(2026, 6, 16, 12, 30), 4)`);

  assert.equal(timeline.earlier.length, 0);
  assert.equal(timeline.upcoming[0].label, "11:00");
  assert.equal(timeline.upcoming.some(slot => slot.label.includes("15:00 - 16:00")), false);
  assert.deepEqual(JSON.parse(JSON.stringify(timeline.other.map(item => item.name))), ["看书", "整理照片"]);
  assert.equal(timeline.upcoming.length, 3);
});

test("习惯和备忘录都能保存到用户指定的整点槽且保持 WAITING", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-slot", name: "看书", coins: 10, createdDate: DAY }];
  state.memos = [{ id: "memo-slot", text: "买转换插头", completed: false, createdAt: FIXED_NOW }];
  const { context } = createRuntime(state);

  const habitTask = value(context, `scheduleHabitAsTask(
    "habit-slot",
    new Date(2026, 6, 16, 12, 30),
    new Date(2026, 6, 16, 15, 0)
  )`);
  const memoTask = value(context, `scheduleMemoAsTask(
    "memo-slot",
    new Date(2026, 6, 16, 12, 35),
    new Date(2026, 6, 16, 16, 0)
  )`);

  assert.equal(habitTask.timeStart, "15:00");
  assert.equal(habitTask.timeEnd, "16:00");
  assert.equal(habitTask.status, "pending");
  assert.equal(habitTask.startedAt, null);
  assert.equal(habitTask.actualStartTime, null);
  assert.equal(habitTask.actualEndTime, null);
  assert.equal(value(context, `undoTaskAnchor({type: 'habit_task_scheduled', taskId: '${habitTask.id}'})`), null);
  assert.equal(memoTask.timeStart, "16:00");
  assert.equal(memoTask.timeEnd, "17:00");
  assert.equal(memoTask.status, "pending");
  assert.equal(memoTask.startedAt, null);
  assert.equal(memoTask.actualStartTime, null);
  assert.equal(memoTask.actualEndTime, null);
  assert.equal(value(context, `undoTaskAnchor({type: 'memo_task_scheduled', taskId: '${memoTask.id}'})`), null);
  assert.equal(value(context, "state.history.length"), 0);
});

test("明确 WAITING 的任务超过计划结束时间也不会自动失败", () => {
  const waiting = task({ id: "waiting-late", status: "waiting", timeStart: "10:00", timeEnd: "11:00" });
  const { context } = createRuntime(emptyState([waiting], 2000));

  assert.equal(value(context, `taskPastEndTime(state.tasks[0], new Date(2026, 6, 16, 16, 0))`), false);
  value(context, `runPendingSettlements({ now: new Date(2026, 6, 16, 16, 0) })`);
  assert.equal(value(context, "state.tasks[0].status"), "waiting");
  assert.equal(value(context, "taskStatusToday(state.tasks[0])"), "pending");
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "state.coins"), 2000);
});

test("习惯拖入后创建下一个整点的等待任务，当天隐藏且不改变习惯和金币", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-book", name: "看书", coins: 10, createdDate: DAY }];
  const { context } = createRuntime(state);

  const created = value(context, `scheduleHabitAsTask("habit-book", new Date(2026, 6, 16, 15, 24))`);

  assert.equal(created.name, "看书");
  assert.equal(created.status, "pending");
  assert.equal(created.source, "HABIT");
  assert.equal(created.originId, "habit-book");
  assert.equal(created.estimateDurationMinutes, undefined);
  assert.equal(created.startedAt, null);
  assert.equal(created.actualStartTime, null);
  assert.equal(created.timerStartedAt, null);
  assert.equal(created.startTime, null);
  assert.equal(created.isRunning, false);
  assert.equal(created.elapsedSeconds, 0);
  assert.equal(created.timeStart, "16:00");
  assert.equal(created.timeEnd, "17:00");
  assert.equal(created.time, "16:00");
  assert.equal(new Date(created.scheduledStart).getHours(), 16);
  assert.equal(new Date(created.scheduledEnd).getHours(), 17);
  assert.equal(created.lifecycleEvents.length, 1);
  assert.equal(created.lifecycleEvents[0].type, "TASK_SCHEDULED");
  assert.equal(created.lifecycleEvents[0].scheduledStart, created.scheduledStart);
  assert.equal(created.lifecycleEvents[0].scheduledEnd, created.scheduledEnd);
  assert.equal(value(context, "taskStatusToday(state.tasks[0])"), "pending");
  assert.equal(value(context, "taskUsesTimer(state.tasks[0])"), false);
  assert.equal(created.coins, 5);
  assert.equal(created.hourlyReward, undefined);
  assert.equal(created.reward, 5);
  assert.equal(created.sourceHabitId, "habit-book");
  assert.equal(value(context, `habitScheduledAsTaskOnDate("habit-book", "${DAY}")`), true);
  assert.deepEqual(JSON.parse(JSON.stringify(value(context, "visibleHabitsToday().map(habit => habit.id)"))), []);
  assert.equal(value(context, "state.habitCompletions['2026-07-16']?.['habit-book'] || false"), false);
  assert.equal(value(context, "state.history.length"), 0);
  assert.equal(value(context, "state.coins"), 2000);
  assert.equal(value(context, "lastUndoData.type"), "habit_task_scheduled");
  assert.match(value(context, "lastUndoOptions.message"), /已安排/);

  value(context, "undoLastAction()");
  assert.equal(value(context, "state.tasks.length"), 0);
  assert.equal(value(context, `habitScheduledAsTaskOnDate("habit-book", "${DAY}")`), false);
  assert.deepEqual(JSON.parse(JSON.stringify(value(context, "visibleHabitsToday().map(habit => habit.id)"))), ["habit-book"]);
  assert.equal(value(context, "state.habits.length"), 1);
  assert.equal(value(context, "state.coins"), 2000);
});

test("习惯拖入后无需开始，直接完成且同一天只奖励一次", () => {
  const initial = emptyState([], 2000);
  initial.habits = [{ id: "h", name: "阅读", coins: 20, createdDate: DAY }];
  const { context } = createRuntime(initial);
  const id = value(context, "scheduleHabitAsTask('h').id");
  assert.equal(value(context, "startTask('" + id + "')"), false);
  assert.equal(value(context, "state.tasks[0].actualStartTime"), null);
  value(context, "completeTask('" + id + "'); completeTask('" + id + "'); completeHabit('h')");
  assert.equal(value(context, "state.coins"), 2005);
  assert.equal(value(context, "habitCompletedToday('h')"), true);
  assert.equal(value(context, "state.history.length"), 1);
  value(context, "undoLastAction()");
  assert.equal(value(context, "habitCompletedToday('h')"), false);
  assert.equal(value(context, "state.coins"), 2000);
});

test("习惯任务超过计划结束时间仍保持等待，不会自动开始或累计时长", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-book", name: "看书", coins: 10, createdDate: DAY }];
  const { context } = createRuntime(state);

  value(context, `scheduleHabitAsTask("habit-book", new Date(2026, 6, 16, 10, 0))`);
  value(context, `runPendingSettlements({ now: new Date("2026-07-16T13:30:00.000Z") })`);

  const waiting = value(context, "state.tasks[0]");
  assert.equal(waiting.status, "pending");
  assert.equal(waiting.startedAt, null);
  assert.equal(waiting.actualStartTime, null);
  assert.equal(waiting.timerStartedAt, null);
  assert.equal(waiting.isRunning, false);
  assert.equal(waiting.timeStart, "11:00");
  assert.equal(waiting.timeEnd, "12:00");
  assert.equal(value(context, "typeof taskElapsedSeconds"), "undefined");
  assert.deepEqual(JSON.parse(JSON.stringify(waiting.lifecycleEvents.map(event => event.type))), ["TASK_SCHEDULED"]);
  assert.equal(value(context, "state.history.length"), 0);
});

test("跨午夜习惯任务保存次日日期，但当天隐藏标记仍可撤回", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-night", name: "夜间阅读", coins: 10, createdDate: DAY }];
  const { context } = createRuntime(state);

  const created = value(context, `scheduleHabitAsTask("habit-night", new Date(2026, 6, 16, 23, 20))`);
  assert.equal(created.date, "2026-07-17");
  assert.equal(created.createdDate, "2026-07-17");
  assert.equal(created.sourceHabitScheduledDate, DAY);
  assert.equal(created.timeStart, "00:00");
  assert.equal(created.timeEnd, "01:00");
  assert.equal(value(context, `habitScheduledAsTaskOnDate("habit-night", "${DAY}")`), true);
  assert.equal(value(context, `habitScheduledAsTaskOnDate("habit-night", "2026-07-17")`), false);

  value(context, "undoLastAction()");
  assert.equal(value(context, "state.tasks.length"), 0);
  assert.equal(value(context, `habitScheduledAsTaskOnDate("habit-night", "${DAY}")`), false);
});

test("手动有时间任务保持用户设置的时间并使用统一 WAITING 状态", () => {
  const { context } = createRuntime(emptyState([], 2000));

  const created = value(context, `closeSheet = () => {}; saveTask({
    name: "手动任务",
    coins: 20,
    reward: 20,
    hourlyReward: 20,
    timeStart: "13:25",
    timeEnd: "14:10",
    time: "13:25"
  })`);

  assert.equal(created.source, "MANUAL");
  assert.equal(created.status, "pending");
  assert.equal(created.timeStart, "13:25");
  assert.equal(created.timeEnd, "14:10");
  assert.equal(created.startedAt, null);
  assert.equal(value(context, "taskStatusToday(state.tasks[0])"), "pending");
});

test("旧 pending 有时间任务读取为 WAITING，旧运行和完成状态保持兼容", () => {
  const pending = task({ id: "manual-pending", status: "pending", timeStart: "13:25", timeEnd: "14:10" });
  const running = task({ id: "manual-running", status: "running", timeStart: "10:00", timeEnd: "11:00", startTime: FIXED_NOW });
  const completed = task({ id: "manual-completed", status: "completed", timeStart: "09:00", timeEnd: "10:00" });
  const { context } = createRuntime(emptyState([pending, running, completed], 2000));

  assert.equal(value(context, "taskStatusToday(state.tasks[0])"), "pending");
  assert.equal(value(context, "taskStatusToday(state.tasks[1])"), "pending");
  assert.equal(value(context, "taskStatusToday(state.tasks[2])"), "completed");
});

test("旧备忘录拖入后创建 MEMO 来源的下一个整点 WAITING 任务", () => {
  const state = emptyState([], 2000);
  state.memos = [{ id: "memo-1", text: "牙刷充电", completed: false, createdAt: FIXED_NOW }];
  const { context, storage } = createRuntime(state);

  const created = value(context, `scheduleMemoAsTask("memo-1", new Date(2026, 6, 16, 13, 18))`);
  assert.equal(created.source, "MEMO");
  assert.equal(created.originId, "memo-1");
  assert.equal(created.sourceMemoId, "memo-1");
  assert.equal(created.status, "pending");
  assert.equal(created.timeStart, "14:00");
  assert.equal(created.timeEnd, "15:00");
  assert.equal(created.startedAt, null);
  assert.equal(created.actualStartTime, null);
  assert.equal(created.timerStartedAt, null);
  assert.equal(created.isRunning, false);
  assert.equal(created.elapsedSeconds, 0);
  assert.equal(created.reward, 5);
  assert.equal(created.lifecycleEvents[0].type, "TASK_SCHEDULED");
  assert.equal(created.lifecycleEvents[0].source, "MEMO");
  assert.equal(value(context, `state.memos[0].status`), "SCHEDULED");
  assert.equal(value(context, `state.memos[0].linkedTaskId`), created.id);
  const persisted = JSON.parse(storage.get("minimal-discipline-v1"));
  assert.equal(persisted.memos[0].status, "SCHEDULED");
  assert.equal(persisted.memos[0].linkedTaskId, created.id);
  assert.equal(value(context, `scheduleMemoAsTask("memo-1", new Date(2026, 6, 16, 13, 20))`), null);
  assert.equal(value(context, "state.coins"), 2000);
  assert.equal(value(context, "state.history.length"), 0);
});

test("MEMO 任务保存失败时不会隐藏或删除原备忘录", () => {
  const state = emptyState([], 2000);
  state.memos = [{ id: "memo-save-fail", text: "action5 内存", completed: false, createdAt: FIXED_NOW }];
  const { context } = createRuntime(state);

  const result = value(context, `(() => {
    const originalSaveState = saveState;
    saveState = () => { throw new Error("save failed"); };
    const created = scheduleMemoAsTask("memo-save-fail", new Date(2026, 6, 16, 13, 18));
    saveState = originalSaveState;
    return created;
  })()`);

  assert.equal(result, null);
  assert.equal(value(context, "state.tasks.length"), 0);
  assert.equal(value(context, "state.memos.length"), 1);
  assert.equal(value(context, `memoStatus(state.memos[0])`), "ACTIVE");
  assert.equal(value(context, "state.memos[0].linkedTaskId"), undefined);
});

test("撤回或删除未完成 MEMO 任务会恢复原备忘录", () => {
  const state = emptyState([], 2000);
  state.memos = [{ id: "memo-undo", text: "买转换插头", completed: false, createdAt: FIXED_NOW }];
  const { context } = createRuntime(state);

  value(context, `scheduleMemoAsTask("memo-undo", new Date(2026, 6, 16, 13, 18))`);
  value(context, "undoLastAction()");
  assert.equal(value(context, "state.tasks.length"), 0);
  assert.equal(value(context, `memoStatus(state.memos[0])`), "ACTIVE");
  assert.equal(value(context, "state.memos[0].linkedTaskId"), null);

  value(context, `scheduleMemoAsTask("memo-undo", new Date(2026, 6, 16, 13, 18))`);
  value(context, "closeSheet = () => {}; deleteTask(state.tasks[0].id)");
  assert.equal(value(context, "state.tasks.length"), 0);
  assert.equal(value(context, `memoStatus(state.memos[0])`), "ACTIVE");
});

test("MEMO 任务失败后恢复备忘录，撤回失败后重新关联", () => {
  const state = emptyState([], 2000);
  state.memos = [{ id: "memo-fail", text: "整理签证材料", completed: false, createdAt: FIXED_NOW }];
  const { context } = createRuntime(state);

  const taskId = value(context, `scheduleMemoAsTask("memo-fail", new Date(2026, 6, 16, 10, 0)).id`);
  value(context, `failTask("${taskId}")`);
  assert.equal(value(context, "state.coins"), 1950);
  assert.equal(value(context, `memoStatus(state.memos[0])`), "ACTIVE");
  assert.equal(value(context, "state.memos[0].linkedTaskId"), null);

  value(context, "undoLastAction()");
  assert.equal(value(context, "state.coins"), 2000);
  assert.equal(value(context, `memoStatus(state.memos[0])`), "SCHEDULED");
  assert.equal(value(context, "state.memos[0].linkedTaskId"), taskId);
  assert.equal(value(context, "state.tasks[0].status"), "pending");
});

test("MEMO 任务完成后永久删除备忘录，删除已完成任务不会恢复", () => {
  const state = emptyState([], 2000);
  state.memos = [{ id: "memo-done", text: "给 Raphael 回消息", completed: false, createdAt: FIXED_NOW }];
  const { context } = createRuntime(state);

  const taskId = value(context, `scheduleMemoAsTask("memo-done", new Date(2026, 6, 16, 10, 0)).id`);
  value(context, `startTask("${taskId}")`);
  value(context, `state.tasks[0].startedAt = "2026-07-16T11:00:00.000Z";
    state.tasks[0].actualStartTime = "2026-07-16T11:00:00.000Z";
    state.tasks[0].timerStartedAt = "2026-07-16T11:00:00.000Z";
    state.tasks[0].startTime = "2026-07-16T11:00:00.000Z";
    finishTask("${taskId}")`);
  assert.equal(value(context, "state.memos.length"), 0);
  assert.equal(value(context, "state.tasks[0].status"), "completed");
  assert.equal(value(context, "state.coins"), 2005);

  value(context, "pendingUndo = null; closeSheet = () => {}; deleteTask(state.tasks[0].id)");
  assert.equal(value(context, "state.tasks.length"), 0);
  assert.equal(value(context, "state.memos.length"), 0);
});

test("旧 in_progress 和 startTime 任务继续识别为运行中", () => {
  const legacy = task({
    id: "legacy-running",
    status: "in_progress",
    startTime: `${DAY}T09:30:00.000Z`
  });
  legacy.timeStart = "09:00";
  legacy.timeEnd = "10:00";
  const { context } = createRuntime(emptyState([legacy], 2000));

  assert.equal(value(context, "taskStatusToday(state.tasks[0])"), "pending");
  assert.equal(value(context, "taskRunningStartTime(state.tasks[0])"), `${DAY}T09:30:00.000Z`);
});

test("旧任务的 timerStartedAt 和 isRunning 仍可识别为运行中", () => {
  const legacy = task({ id: "legacy-timer-running" });
  legacy.timerStartedAt = `${DAY}T09:45:00.000Z`;
  legacy.isRunning = true;
  const { context } = createRuntime(emptyState([legacy], 2000));

  assert.equal(value(context, "taskStatusToday(state.tasks[0])"), "pending");
  assert.equal(value(context, "taskRunningStartTime(state.tasks[0])"), `${DAY}T09:45:00.000Z`);
});

test("当天安排状态按本地日期持久化，同一习惯第二天自然恢复", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-book", name: "看书", coins: 10, createdDate: DAY }];
  const { context, storage } = createRuntime(state);

  value(context, `scheduleHabitAsTask("habit-book", new Date(2026, 6, 16, 15, 24))`);
  const persisted = JSON.parse(storage.get("minimal-discipline-v1"));
  assert.deepEqual(persisted.scheduledHabitIdsByDate[DAY], ["habit-book"]);
  assert.equal(persisted.tasks[0].status, "pending");
  assert.equal(persisted.tasks[0].startedAt, null);
  assert.equal(persisted.tasks[0].actualStartTime, null);
  assert.equal(persisted.tasks[0].timerStartedAt, null);
  assert.equal(persisted.tasks[0].isRunning, false);
  assert.equal(persisted.tasks[0].elapsedSeconds, 0);
  const reloaded = createRuntime(persisted);
  assert.equal(value(reloaded.context, "taskStatusToday(state.tasks[0])"), "pending");
  assert.equal(value(reloaded.context, "taskUsesTimer(state.tasks[0])"), false);
  assert.equal(value(context, `habitScheduledAsTaskOnDate("habit-book", "2026-07-17")`), false);
  assert.deepEqual(JSON.parse(JSON.stringify(value(context, `state.habits.filter(habit => !habitScheduledAsTaskOnDate(habit.id, "2026-07-17")).map(habit => habit.id)`))), ["habit-book"]);
  assert.equal(value(context, `scheduleHabitAsTask("habit-book", new Date(2026, 6, 16, 16, 24))`), null);
  assert.equal(value(context, "state.tasks.length"), 1);
});

test("删除未完成的来源任务会恢复当天习惯，终态来源任务不会恢复", () => {
  const activeState = emptyState([], 2000);
  activeState.habits = [{ id: "habit-active", name: "看书", coins: 10, createdDate: DAY }];
  const activeRuntime = createRuntime(activeState);
  value(activeRuntime.context, "closeSheet = () => {}; scheduleHabitAsTask('habit-active', new Date(2026, 6, 16, 15, 24)); deleteTask(state.tasks[0].id)");
  assert.equal(value(activeRuntime.context, `habitScheduledAsTaskOnDate("habit-active", "${DAY}")`), false);

  const completedState = emptyState([{
    id: "source-completed",
    name: "看书",
    date: DAY,
    createdDate: DAY,
    status: "completed",
    sourceHabitId: "habit-completed"
  }], 2000);
  completedState.habits = [{ id: "habit-completed", name: "看书", coins: 10, createdDate: DAY }];
  completedState.scheduledHabitIdsByDate = { [DAY]: ["habit-completed"] };
  const completedRuntime = createRuntime(completedState);
  value(completedRuntime.context, "closeSheet = () => {}; deleteTask('source-completed')");
  assert.equal(value(completedRuntime.context, `habitScheduledAsTaskOnDate("habit-completed", "${DAY}")`), true);
});

test("没有有效奖励的习惯模板回落到今日任务默认奖励", () => {
  const state = emptyState([], 2000);
  state.habits = [{ id: "habit-no-reward", name: "整理桌面", coins: null, createdDate: DAY }];
  const { context } = createRuntime(state);

  const created = value(context, `scheduleHabitAsTask("habit-no-reward", new Date(2026, 6, 16, 15, 24))`);
  assert.equal(created.coins, 5);
  assert.equal(created.hourlyReward, undefined);
  assert.equal(created.reward, 5);
});

test("习惯旧奖励配置保留但新结算固定为 5", () => {
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
  assert.equal(created.coins, 5);
  assert.equal(created.hourlyReward, undefined);
  assert.equal(created.reward, 5);
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
