require('./fixtures/daily-habit-browser.cjs')('daily-tasks').catch(error => {
  console.error(error); process.exitCode = 1;
});
