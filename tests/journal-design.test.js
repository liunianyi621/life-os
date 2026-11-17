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
test('Workbench replaces Review UI while review storage stays compatible',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/data-view="review"|data-nav="review"|id="dailyReviewForm"|id="reviewHistoryList"/);
  assert.match(html,/data-view="workbench"/);
  assert.match(read('js/storage.js'),/dailyReviews: saved.dailyReviews/);
});
test('Journal history preserves missing score in compact summary rows',()=>{
  const ui=read('js/ui.js');
  assert.doesNotMatch(ui,/review-row-next/);
  assert.match(ui,/score === null \? "missing"/);
  assert.match(ui,/function journalDateLabel/);
  assert.doesNotMatch(read('js/storage.js'),/showToast\("复盘已保存"/);
});
test('Workbench uses project filters and one task list, without a review form',()=>{
  const html=read('index.html');
  assert.match(html,/id="workbenchFilters"/);assert.match(html,/id="workbenchList"/);
  assert.doesNotMatch(html,/id="reviewDateInput"/);
});
