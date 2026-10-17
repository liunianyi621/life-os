require('./fixtures/daily-habit-browser.cjs')('focus').catch(error => {
  console.error(error); process.exitCode = 1;
});
