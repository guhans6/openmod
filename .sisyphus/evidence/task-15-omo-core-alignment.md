# T15: OMO BackgroundManager — Core Terminal Guarantee Alignment

## Analysis Date: 2026-05-05

## Finding: No Code Changes Required

### Core Terminal Flow (post-patch)

When OpenCode core times out a subagent session:
1. `prompt.ts` `loop()` wrapper catches `TimeoutError` from `Effect.timeout`
2. Publishes `Session.Event.Error` to bus with `{ sessionID, error: "execution_timeout" }`
3. `run-state.ts` sets session status to `{ type: "idle" }` (via `cancel()` path)
4. `task.ts` appends `<task_error>` block to task output

### OMO Handling of Core Timeout

OMO's `BackgroundManager` handles this correctly via two paths:

**Path 1: Idle event** (`session-idle-event-handler.ts`)
- Core emits `session.idle` bus event when status → idle
- OMO subscribes to this event and calls `tryCompleteTask()`
- Task transitions to `"completed"` or `"interrupt"` based on result content

**Path 2: Stability detection** (`task-poller.ts`)
- Polls every 3s; if message count stable for 10s → marks complete
- Fallback if idle event missed

### State Mapping

| Core terminal state | Core session status | OMO task status |
|---------------------|--------------------|-----------------| 
| `timeout`           | `idle`             | `interrupt` (stale) or `completed` |
| `cancelled`         | `idle`             | `cancelled` |
| `completed`         | `idle`             | `completed` |
| `failed`            | `idle`             | `error` |
| `interrupted`       | `idle`             | `interrupt` |

### Dead Code Note

`isTerminalSessionStatus()` in `session-status-classifier.ts` checks for `"interrupted"` session status, but OpenCode core never emits `"interrupted"` as a session status (only `"idle"`, `"busy"`, `"retry"`). This is pre-existing dead code, not introduced by our patches.

## Verdict: ALIGNED — no drift between core and OMO
