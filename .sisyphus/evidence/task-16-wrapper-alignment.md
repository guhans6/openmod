# T16: OMO Wrapper Alignment — background_output / background_cancel

## Analysis Date: 2026-05-05

## background_cancel wrapper

File: `src/tools/background-task/create-background-cancel.ts`

### Cancel Policy Compliance

The wrapper calls `manager.cancelTask(task.id, { source: "background_cancel", abortSession: task.status === "running" })`.

`BackgroundManager.cancelTask()` calls `abortWithTimeout(client, sessionID)` which:
1. Calls `client.session.abort({ sessionID })` — this triggers core's `softCancel()` path
2. Core's `softCancel()` polls for 500ms intervals up to `softCancelGraceMs` (30s)
3. If not stopped within grace period, force-cancels via `cancel()`

**Result**: wrapper already implements soft→force escalation policy via core's `softCancel`. No changes needed.

### Terminal Reason Surfacing

`task-status-format.ts` formats `"interrupt"` status with:
> "Interrupted: The task was interrupted by a prompt error. The session may contain partial results."

This covers the timeout case (which OMO maps to `"interrupt"`). The message is accurate.

## background_output wrapper

File: `src/tools/background-task/create-background-output.ts`

The output tool reads task result from `BackgroundManager.getTask()`. Terminal state is surfaced via:
- `task.status` field (shows `"interrupt"`, `"error"`, `"cancelled"`, `"completed"`)
- `task.error` field (shows reason string from stale-task watchdog)
- Attempt history via `task.attempts[]`

For core timeout specifically: the `<task_error>` block appended by `task.ts` appears in the session messages, which `background_output(full_session=true)` will surface.

## Verdict: ALIGNED — wrappers correctly surface all terminal states
