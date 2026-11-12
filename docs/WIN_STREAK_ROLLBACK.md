# Daily Win + Streak experiment

## Rollback release
The experiment has been withdrawn. WIN_STREAK_RELEASE_ENABLED is false and
overrides even previously persisted enabled=true values. No storage mutation is
needed to enforce rollback. The experimental UI script and all visible entry
points are no longer loaded; Today and Funds markup/styles match the stable tag.
The compatibility validator remains loaded so experiment-period backups can be
validated and restored. syncWinStreak and experimental mutation handlers return
without changes. All existing winStreak data is retained exactly, not deleted,
finalized, or recalculated. New normal task/habit/fund/review records keep using
the original business handlers. Reload and PWA resume cannot re-enable the UI.
The old settings switch instructions below describe the archived experimental
release only; the withdrawn release intentionally exposes no experiment switch.

## Verified recovery point (2026-11-12)
- Stable production SHA: 7e54068b9b13fea20d6813d38bee9d9125e844d7
- Annotated tag: lifeos-pre-win-streak-20261112
- Remote backup branch: backup/pre-win-streak-20261112
- Both remote refs verified before feature branch development.

## Device data backup FIRST
Data lives in this device/browser's localStorage, not Git or Vercel.
On the existing iPhone/PWA: Statistics > Settings > Data and Backup > Export Backup.
Keep the JSON outside the app. Repeat export before any code rollback.
Do not clear storage, reset the app or import an old backup over newer data.
We cannot export the user's real device data from the development browser.

## One-switch rollback (preferred)
Statistics > Settings > Daily Win experiment: OFF.
Today removes the battle card; Rewards opens the original funds UI.
Coins, completions, focus and funds retain their original handlers.
Experiment records remain stored. Closed intervals are excluded from scoring;
re-enabling does not count completions during OFF intervals.

## Incremental schema
Optional state.winStreak, version 1:
enabled, windows [{start,end}], ignored completion IDs from disabled mode,
days keyed by local date.
Each day keeps choice {type,id,name}, locked, rest, zone, receipts [{key,id}],
outcome, evaluatedAt, finalized, notified.
Receipts reference existing completion history, not a second coin ledger.
Undo removes the effective receipt; summaries are recomputed, never incremented.
Old backups missing this field remain accepted. New backups include it.
No old day is invented. Only days opened while enabled or planned rest days exist.
No physical database migration or old coin scaling is introduced.

## Edge rules
- Focus start or must-win completion locks selection permanently for that day,
  even after Undo. No retroactive choice of an already completed item.
- Habit/task identity survives renaming. Deletion after lock does not substitute
  another item. A replaced Priority title after lock invalidates its must-win result.
- Rest may only be planned for tomorrow before that local day starts.
- Unentered days are non-participation; rest/non-participation pause streak.
- A pending current day does not clear streak until it ends in failure.
- Date identity is the persisted local key, not UTC; timezone is recorded on entry.
- History corrections recompute outcomes from remaining effective receipts.
- Disabling pauses evaluation; re-enabling reconciles existing records without
  importing completions from disabled intervals.

## Code rollback (only for deployment failure)
Keep current production and export current device data including winStreak first.
Fetch the tag, create a new rollback branch from it, deploy a preview, verify the
current backup and normal pages, then promote the verified deployment.
Do NOT reset --hard, force push, clear localStorage or restore an old data snapshot.
The stable reader preserves unknown top-level fields via its existing state spread,
but stable code cannot display experimental results. Retain the fresh JSON backup
to preserve experiment data independently and restore it when experiment code returns.
Use the feature switch rather than old code when ongoing experiment-data validation
is needed. Never operate an old-data import as a code rollback.
