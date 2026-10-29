const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Today focuses on daily habits and independent reminders, without a task timeline',()=>{
  const today=read('index.html').split('data-view="today"')[1].split('data-view="calendar"')[0];
  assert.match(today,/<h1>今天<\/h1>/);
  assert.doesNotMatch(today,/id="(?:todayTaskCount|habitCount|homeMemoCount)"/);
  for(const action of ['data-open-habit','data-open-memo','habitProgress']) assert.ok(today.includes(action));
  assert.doesNotMatch(today,/data-open-task|todayTaskList/);
});
test('Review journal retains data fields but removes repeated prompts and score endpoints',()=>{
  const review=read('index.html').split('data-view="review"')[1].split('data-view="rewards"')[0];
  for(const label of ['做得好','需要改进','今日评分','明日重点']) assert.ok(review.includes(label));
  assert.doesNotMatch(review,/今天做得最好的事情是什么|今天最大的失误是什么|id="reviewHistoryCount"/);
  for(const id of ['reviewBest','reviewMistake','reviewDailyScore','reviewPriority']) assert.ok(review.includes(`id="${id}"`));
});
test('Journal history preserves missing score in compact summary rows',()=>{
  const ui=read('js/ui.js');
  assert.doesNotMatch(ui,/review-row-next/);
  assert.match(ui,/score === null \? "missing"/);
  assert.match(ui,/function journalDateLabel/);
  assert.doesNotMatch(read('js/storage.js'),/showToast\("复盘已保存"/);
});
test('Review uses one writing group, separate tomorrow area and existing date control',()=>{
  const html=read('index.html');
  assert.match(html,/class="review-journal-group"/);
  assert.match(html,/review-question review-tomorrow/);
  assert.match(html,/id="reviewDateInput" type="date"/);
  const css=read('css/qonto-system.css');
  assert.match(css,/\.review-journal-group > \.review-question \+ \.review-question/);
  assert.match(css,/body.keyboard-open \.review-journal-group/);
});
