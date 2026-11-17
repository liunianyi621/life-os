# Workbench compatibility

Restore point: `lifeos-pre-workbench-20261117`, commit
`40d577d6f516926173f9ebfe245998d33377ac6a`.

## Storage

No storage keys are removed or renamed. The optional `state.workbench` object
contains `version: 1`, `projects`, and `tasks`. It is created only on the first
successful workbench action, not during initialization. No historical migration
or coin conversion is run by this feature. Existing review and tomorrow-plan
records remain untouched; Review has no navigation or visible form.

Tasks have stable IDs, project ID (or null), priority, status, optional due date,
timestamps, and execution IDs. Projects are soft archived/deleted. Deleting a
nonempty project requires a receiving project and confirmation of its task count.
New tasks require a project; old null project IDs remain until the user explicitly
assigns them through the legacy assignment entry. No automatic assignment runs.

Visible groups are read-only mappings: high becomes urgent, normal/low become
important, waiting status becomes waiting. Old priority/state values remain in
storage. Group moves do not change execution IDs or coins. New/edit forms contain
only name and optional due date, with project/group inferred from the add entry.

## Execution

Each Today execution references its workbench task via `workbenchTaskId`;
`executionIds` holds the reverse link. At most one execution per task/date is
allowed, including canceled and settled executions. Canceled, unsettled
executions reuse their ID when scheduled again. Occupied sprint hours are not
overwritten. No Workbench completion creates a separate coin event.

Pending Today executions complete through `completeDailyTask`, including its
existing coin history, dedupe, deadline and Undo behavior. Workbench derives the
completed state from that execution, so Today Undo also reopens Workbench.
Unscheduled tasks complete without coins and use the shared Undo capsule.
Expired executions must be reversed through the existing failure Undo before
they can complete on the same day. Ordinary Workbench deletion never removes
settled execution history.

Restoring a completed Workbench task to pending is distinct from coin Undo:
settled execution records are preserved, and cannot be scheduled again for the
same date or generate another reward. The editor explicitly explains this.
An explicit list of reopened execution IDs keeps this decision auditable.

## Safety

Workbench writes use the existing exclusive editor lock and raw-version check.
Failed writes restore in-memory state and report an error. Invalid versions,
broken references and duplicate date links block saving rather than resetting
the new collections. The complete backup includes these fields and validates
the links; old backups may omit the Workbench object. Normal import remains an
explicitly confirmed whole-backup restore with its existing before-import copy.

Git is a code restore point, not a backup of iPhone data. Any code rollback must
retain unknown additive Workbench fields and linked executions; never clear
localStorage or force-overwrite user data. Desktop isolated browser tests do
not verify the real iPhone PWA's local data or native keyboard behavior.
