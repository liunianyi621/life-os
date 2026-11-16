# Three Daily Modes

Recovery tag: lifeos-pre-three-modes-20261116
Stable baseline: b32bb78dad0903e418d46e3cfe338256d1676527

## Additive State

dayModes.version=1 contains byDate (local YYYY-MM-DD mode, createdAt, updatedAt),
an append-only change log and lockedThrough (latest observed local date).
Absent schedules mean normal. Only future vacations may be booked/cancelled;
observed dates cannot be rewritten after the device date moves backward.
Current normal/sprint changes are allowed, current vacation is locked.

New vacation habits are separate definitions with modeScope=vacation, unique IDs
and their own reward revisions. Existing habits remain untouched and default to
normal. Normal and sprint share those definitions and daily completion receipts.
No habit records are moved, reset, cloned or retrospectively charged.

## Settlement Boundaries

For each historical obligation date, habit applicability reads that date's mode,
not today's mode. Vacation priorities are retained but exempt from failure. Old
priority and legacy task scanners also respect the vacation boundary. Completed
or failed historical coin events are never rewritten when adding a schedule.

Sprint tasks reuse dailyTasks (ruleVersion=2, reward=50, penalty=200), the existing
daily-task settlement key, Focus reference, coin history and UndoController.
sprintWindow holds start/end timestamps on the creation local day. This release
requires end later than start on the same day; it does not add cross-day events.
Status waiting/running is a display derived from time, not an old timer lifecycle.
The existing deadline wake-up includes starts/ends; startup/resume catches up.

Normal mode retains its original priorities; sprint also retains their manager
so they are not hidden and forgotten. Leaving sprint is blocked while today's
time tasks remain actionable: complete, fail or explicitly delete them first.
An expired task is settled before an edit/delete/mode change can bypass it.
If a failure is reversed after switching to normal, a visible pending-time-task
manager reappears there. It is never silently hidden. Edits require sprint mode.

Failure reversal restores the previous canonical task without a stale settled
key. reversedSprintDeadline persists the exact exempted deadline. Repeated scans
and reopening do not re-charge it; editing to a new deadline re-enables failure.
Completion and failure still share the same effective terminal receipt.
As with existing day-end Undo, reversing a past-day catch-up penalty does not
permit collecting yesterday's reward; the original day stays protected.

Long-term goals retain their independent deadlines (failure never costs coins).
Vacation mode does not rewrite that system. This change only scopes daily work.

## Storage / Backup / Recovery

The exclusive-editor gateway advances to the v3 key/lock/channel, copying exact
v2 bytes once (falling back to v1 for older installs). Previous keys remain
untouched. This prevents already-open v2 builds, which do not know vacation
exemptions, from applying old rules to the mode-era balance. Both old writers
are isolated and archived; old v2 conflict copies stay included in backups.
No new storage engine or recalculation of coin balances is used. Backup schema 1 accepts optional schedules,
habit scopes and sprint windows, rejects invalid data before replacement, and
keeps old backups importable. Undo and refresh do not create a second ledger.

For a UI rollback, retain the v3 storage gateway and mode-aware settlement guards
until all booked vacation days and sprint obligations have been accounted for.
Do not deploy the baseline's unguarded scanners against mode-era data, clear
storage, force-reset Git, or replace current data with an old backup.
