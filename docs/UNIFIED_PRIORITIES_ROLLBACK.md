# Unified Priorities Recovery

## Code Checkpoint

- Annotated remote tag: `lifeos-pre-unified-priorities-20261113`
- Commit: `ae31f561da8dedeeec90d3a4076caa79d1a199d1`
- Production branch: `main`

Git preserves code, not device data. Export the current device's full backup in
Settings > Data and Backup before reverting or importing anything. Never reset
localStorage or replace current device data with a pre-upgrade snapshot.

## Additive Compatibility

- `unifiedPriorities.version = 1` records the activation local date and an ID-based
  import map. Old `priorityTaskByDate` / `priorityPlans` remain intact. Imported
  pending items include their original snapshot; settled historical amounts are
  not changed. Old obligations before activation retain their original rules.
- The existing `dailyTasks` container is the canonical unified list. New/active
  items have `ruleVersion: 2`, reward 50 and penalty 200. Previously configured
  amounts are retained in `previousEconomy` when an active item is upgraded.
- `reviewPlanKey` associates a review row's stable ID with its next-day task.
  Deleted tasks are tombstones, preventing re-import. Manual edits and terminal
  settlements are not overwritten by review synchronization.
- Reviews and drafts add `priorityEntries` (unlimited ID/text rows). Legacy good
  text, mistake text, priority fields, scores and all transaction history remain.
- Backup schema 1 accepts both legacy and new records, including the import map.

## Safe Code Rollback

Create a recovery branch from the tag and apply targeted UI reversions in a new
commit; never force-push, reset production data, or blindly redeploy the old tag
against upgraded storage. The tagged build predates `ruleVersion: 2` validation,
so it must retain the new task validator, import-map settlement exclusions and
unlimited-review compatibility when rolling back the UI. Otherwise new tasks can
become unreadable or archived obligations can be charged twice.

All experiment-period tasks, reviews, transactions and funds must stay in the
current backup/state. Validate a recovery build using a copy of the current
backup before publishing it. No automatic data downgrade is provided.
