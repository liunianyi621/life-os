# Long-Term Goals and Safe Persistence

Stable production commit: dc64e057f464176cdc14200e027a24e64980284b
Remote annotated recovery tag: lifeos-pre-goals-20261116

The original data-overwrite blocker is addressed by an isolated v2 storage key
and a shared, exclusive editor lock. The legacy key remains untouched. Old
builds cannot write the new key; detected legacy changes are archived as exact
raw conflict copies and included in backup exports/restores, never merged into
the coin balance automatically. Switching editor windows flushes review drafts
and reloads persisted state before enabling editing. Other windows are inert.
Unsupported Web Locks or missing persistence code fail closed, not back to v1.

Implemented locally:
- Optional longTermGoals state, three progress models, inclusive local deadlines.
- Shared editor ownership plus goal transactions, rewards through recordCoinEvent, reversal
  entries and per-goal audit log; five-minute correction window.
- Goal list/filter, editor, detail, milestone edits and priority action linkage.
- Linked milestone progress derives from daily-task completion so Undo retracts it.
- Funds retain their existing view and operations, with entry from Statistics.
- Four tabs: Today / Review / Goals / Statistics. No calendar/streak restoration.
- Optional backup validation for goals; existing state containers remain unchanged.

Verified:
- 330 unit tests passed, including five goal suites; China and UK date tests.
- browser-goals.cjs passed at 390x844, 393x852, 430x932 in Chromium.
- Initial build and diff whitespace checks passed.

Original reproduced blocker: goals used Web Locks, but existing saveState callers did not. An older
open tab can save its stale entire state after another tab settles a goal,
overwriting both the balance and new goal records. Reproduced in an isolated
fixture: 1000 -> goal reward 1500 -> stale-tab task save 1050 (expected 1550),
and the newly created goal disappears. A storage-event listener is not a
transaction and cannot eliminate this race, especially for old open app builds.

Completed verification includes 23 Chromium browser scripts, real multi-page
ownership transfer, rejected stale saves, legacy writes, re-opening, exact
pre-upgrade snapshots, no duplicate rewards, and continued +50 task rewards.
Test data is isolated from real user browsers. Real iPhone hardware was not used.
WebKit passes goal flows and forward ownership transfer/legacy isolation/reload
at three mobile sizes. Reverse background-page activation in the desktop driver
is not reliable, so reverse handoff and first-upgrade checks run in Chromium.

Recovery: tag lifeos-pre-goals-20261116 preserves the original code. Do not simply
redeploy it over v2 data: the original reads v1, not the new canonical database.
For a UI rollback, retain the persistence gateway and v2-compatible loaders.
Export a current backup first. Never clear storage, force-reset Git, or replace
the new database with the old baseline. Legacy conflict copies require explicit
human reconciliation; they are not an extra source of spendable coins.

No device data reset or historical coin recalculation is part of this release.
The three productivity modes are deliberately out of scope.
