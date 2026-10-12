// The retired hourly workflow is covered by legacy unit tests; this suite exercises its daily-habit replacement.
require('./fixtures/daily-habit-browser.cjs')('order').catch(error=>{
  console.error(error);
  process.exitCode=1;
});
