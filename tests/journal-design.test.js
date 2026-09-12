const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Today removes repeated counts and keeps task, habit and memo action hooks',()=>{
  const today=read('index.html').split('data-view="today"')[1].split('data-view="calendar"')[0];
  assert.match(today,/<h1>今天<\/h1>/);
  assert.doesNotMatch(today,/id="(?:todayTaskCount|habitCount|homeMemoCount)"/);
  for(const action of ['data-open-task','data-open-habit','data-open-memo']) assert.ok(today.includes(action));
});
test('Review journal retains data fields but removes repeated prompts and score endpoints',()=>{
  const review=read('index.html').split('data-view="review"')[1].split('data-view="rewards"')[0];
  for(const label of ['做得好','需要改进','今日评分','明日重点']) assert.ok(review.includes(label));
  assert.doesNotMatch(review,/今天做得最好的事情是什么|今天最大的失误是什么|id="reviewHistoryCount"/);
  for(const id of ['reviewBest','reviewMistake','reviewDailyScore','reviewPriority']) assert.ok(review.includes(`id="${id}"`));
});
test('Journal history preserves missing score and uses a distinct tomorrow preview',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/review-row-next/);
  assert.match(ui,/score === null \? "missing"/);
  assert.match(ui,/function journalDateLabel/);
  assert.doesNotMatch(read('js/storage.js'),/showToast\("复盘已保存"/);
});
