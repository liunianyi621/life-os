const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function runtime() {
  const storage = new Map();
  const context = vm.createContext({ console, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }});
  for (const file of ['js/storage.js', 'js/backup.js']) vm.runInContext(source(file), context);
  const run = code => vm.runInContext(code, context);
  run(`state.fixedRewardRulesSince = dateKey(); state.settledThroughDate = yesterdayKey();
    state.coins = 125; state.habits = [{id:'h',name:'看书'}];
    state.memos = [{id:'m',text:'买书',status:'ACTIVE'}];
    state.dailyReviews[dateKey()] = {best:'保留正文',mistake:'',priority:'明天',dailyScore:7};
    state.history = [{id:'history',type:'habit_completed',habitId:'h',date:dateKey(),coinDelta:5}];
    state.habitCompletions[dateKey()] = {h:'history'}; saveState(); state = loadState(); saveState();`);
  return {context, storage, run};
}

test('Today 将行动放在素材前；完成后不强制新建', () => {
  const html = source('index.html');
  assert.ok(html.indexOf('id="priorityTaskCard"') < html.indexOf('id="todayTaskList"'));
  assert.ok(html.indexOf('id="todayTaskList"') < html.indexOf('id="habitList"'));
  assert.ok(html.indexOf('id="habitList"') < html.indexOf('id="homeMemoList"'));
  assert.doesNotMatch(source('js/economy.js'), /promptNextStepAfterCompletion|setTimeout\(\(\) => openTaskSheet/);
});

test('Backup 完整保留业务状态、历史和迁移标记，刷新不重做迁移', () => {
  const {run, context} = runtime();
  const before = run('JSON.stringify(state)');
  run('const backup = createLifeOSBackup(); state.coins = 999; restoreLifeOSBackup(backup)');
  assert.equal(run('JSON.stringify(state)'), before);
  assert.equal(run('JSON.stringify(loadState())'), before);
  assert.equal(run('state.pastCoinHistoryScaleMigrationVersion'), 1);
  assert.equal(run('state.history[0].coinDelta'), 5);
  assert.equal(run('JSON.parse(localStorage.getItem(LIFEOS_BEFORE_IMPORT_KEY)).coins'), 999);
});

for (const mutation of [
  'backup.version = 2', 'delete backup.data.history', 'backup.data.coins = "bad"',
  'delete backup.data.fixedRewardRulesSince', 'backup.data.pastCoinHistoryScaleMigrationVersion = 0',
  'backup.data.habits.push(backup.data.habits[0])', 'backup.data.tasks = {}',
  'backup.data.totals.coinsSpent = "bad"', 'backup.data.dailyReviews[dateKey()].dailyScore = 99',
  'backup.data.habitFailures = []', 'backup.data.scheduledHabitIdsByDate[dateKey()] = {}'
]) test(`错误备份不覆盖内存或持久化数据: ${mutation}`, () => {
  const {run,storage} = runtime();
  const before = run('JSON.stringify(state)');
  const stored = [...storage.entries()];
  run('const backup = createLifeOSBackup()');
  run(mutation);
  assert.throws(() => run('restoreLifeOSBackup(backup)'));
  assert.equal(run('JSON.stringify(state)'), before);
  assert.deepEqual([...storage.entries()], stored);
});

test('导入存储失败不改变原数据', () => {
  const {run,context,storage} = runtime();
  const before = run('JSON.stringify(state)');
  run('const backup = createLifeOSBackup(); backup.data.coins = 1');
  const saved = storage.get('minimal-discipline-v1');
  context.localStorage.setItem = (key,value) => {
    if (key === 'minimal-discipline-v1') throw new Error('quota');
    storage.set(key,value);
  };
  assert.throws(() => run('restoreLifeOSBackup(backup)'));
  assert.equal(run('JSON.stringify(state)'), before);
  assert.equal(storage.get('minimal-discipline-v1'), saved);
});

test('备份兼容没有 ID 的旧金币历史，原样保留记录', () => {
  const {run} = runtime();
  run(`state.history.push({type:'legacy',coins:10,date:'2020-01-01'});
    const backup = createLifeOSBackup(); restoreLifeOSBackup(backup);`);
  assert.equal(run('state.history[1].coins'),10);
  assert.equal(run('state.history[1].id'),undefined);
});
