# Subagent Task Management

This document covers how OpenCode handles subagent (child session) lifecycle, how to monitor and cancel running tasks from both CLI and app UI surfaces, and how the automatic recovery mechanisms work.

## Background

When the main agent spawns a subagent via the `task` tool, a child session is created and runs independently. Prior to this feature, a stuck or hung subagent would leave the main agent waiting indefinitely with no way to intervene. This feature adds:

- A **Tasks tab** in the Ctrl+X status panel showing all running child sessions
- A **cancel button** per task with graceful escalation
- An **automatic watchdog** that detects and recovers stuck subagents
- An **execution timeout** that bounds maximum task duration
- **Parent notification** on all terminal outcomes so the main agent always unblocks

---

## Monitoring Running Tasks

OpenCode now has two UX surfaces. Use the one that matches your environment:

### CLI / TUI (terminal)

- Press **Ctrl+X K** (leader + `k`) or run **`/tasks`**
- This opens the **Running tasks** dialog
- Use **Up/Down** to select a running child session
- Press **Enter** to open that subagent session
- **Ctrl+X Down / Left / Right** child-navigation only cycles through **active (non-idle)** child sessions

### App UI (status popover)

- Open the status popover and click the **Tasks** tab
- Each running subagent appears as a row showing:
  - The task title (or truncated session ID if no title yet)
  - Status badge: **Running**, **Retrying**, or **Idle**
  - A stop button to cancel the task

Tasks disappear from both lists once they reach an idle/terminal state.

---

## Cancelling a Subagent Task

### CLI / TUI (terminal)

- Open running tasks: **Ctrl+X K** or **`/tasks`**
- Select a task with **Up/Down**
- Press **Ctrl+D** once to arm cancellation, then **Ctrl+D** again to confirm
- Press **Ctrl+Shift+D** once to arm **cancel all**, then **Ctrl+Shift+D** again to confirm cancelling all running tasks

### App UI (status popover)

- Click the **stop icon** next to any task in the Tasks tab

Both paths trigger a **soft cancel** with graceful escalation:

1. **Graceful stop requested** — the subagent is asked to stop after its current operation
2. **Grace period (30 s)** — the system waits up to 30 seconds for the subagent to finish cleanly
3. **Force cancel** — if the subagent is still running after the grace period, it is forcibly interrupted

The main agent receives a notification of type `cancelled` or `interrupted` once the process completes, and continues execution.

---

## Automatic Recovery (Watchdog + Timeouts)

You do not need to manually cancel stuck tasks — the system does it automatically.

### Execution Timeout

Every child session has a maximum wall-clock execution limit of **5 minutes** (300,000 ms). If a subagent has not completed within this window, it is interrupted with state `timeout`. The main agent receives a `<task_error>` block and a suggested action of `retry`.

### Stale Heartbeat Watchdog

A background watchdog runs every **15 seconds** and checks the last-seen heartbeat timestamp for each running subagent. If no heartbeat has been recorded for more than **120 seconds**, the subagent is treated as stuck and is force-cancelled.

Heartbeats are recorded once at the start of each agent reasoning loop. This means:

- Normal, responsive agents update the heartbeat on every round-trip
- An unresponsive agent (e.g. blocked on network I/O) will trigger the watchdog after ~2 minutes of silence

> **Known limitation:** A single tool call that runs longer than 120 seconds (e.g. a bash command, a large file write) can trigger false stale detection, because the heartbeat is not updated mid-tool-call. If you expect long-running tools, increase `staleHeartbeatTimeoutMs` in your `opencode.json`.

### Default Timeout Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `executionTimeoutMs` | 300,000 (5 min) | Max wall-clock time for a child session |
| `staleHeartbeatTimeoutMs` | 120,000 (2 min) | Silence threshold triggering watchdog cancel |
| `watchdogIntervalMs` | 15,000 (15 s) | How often the watchdog checks heartbeats |
| `softCancelGraceMs` | 30,000 (30 s) | Grace period before force cancel on user cancel |

To override, add a `taskTimeout` block to your `opencode.json`:

```json
{
  "taskTimeout": {
    "executionTimeoutMs": 600000,
    "staleHeartbeatTimeoutMs": 180000
  }
}
```

---

## Terminal States and Parent Notifications

When a subagent finishes for any reason, the main agent receives a structured `<task_error>` block (on non-success outcomes) or continues normally (on success). The possible terminal states are:

| State | Trigger | Suggested action for main agent |
|-------|---------|----------------------------------|
| `completed` | Task finished successfully | `continue` — proceed with results |
| `failed` | Unhandled error in child session | `investigate` — check task output |
| `cancelled` | User pressed stop button | `continue` — decide whether to re-run |
| `interrupted` | Interrupt signal received | `retry` — re-run the task |
| `timeout` | Execution or stale heartbeat limit | `retry` — re-run or break into smaller steps |

The main agent sees:

```
<task_error>
Task session <id> terminated: timeout
Reason: execution timeout (300000ms)
Suggested action: retry
</task_error>
```

---

## Running the Modified Build (`openmod`)

This fork includes the subagent recovery changes and is built as a separate binary so it does not overwrite the release `opencode`.

### Build

```bash
cd /path/to/opencode
bun install
cd packages/opencode
bun run build
```

The built CLI artifact is at:

`/path/to/opencode/packages/opencode/dist/index.js`

> If you prefer building from repo root, `bun --cwd packages/opencode run build` is equivalent.

### Creating the `openmod` Command

Add a symlink pointing to your built binary:

```bash
# Replace <path-to-repo> with the absolute path to this repo
ln -sf <path-to-repo>/packages/opencode/dist/index.js /usr/local/bin/openmod
chmod +x /usr/local/bin/openmod
```

Then invoke it with:

```bash
openmod serve
# or
openmod <any opencode subcommand>
```

### Rebuild/Relink Rules (after source changes)

- If you changed TypeScript source in this repo, **rebuild is required**:

```bash
cd /path/to/opencode
cd packages/opencode
bun run build
```

- If your `openmod` symlink already points to the same build output path (`packages/opencode/dist/index.js`), **no re-link is needed**.
- Re-run the `ln -sf ... /usr/local/bin/openmod` command only if the path changed or `openmod` points somewhere else.

### Keeping `openmod` Updated When OpenCode Updates

When upstream OpenCode changes, updating `openmod` is straightforward:

1. Update your fork/local branch (for example `git pull` / rebase / merge from upstream)
2. Re-apply or keep your local patches (if any conflicts)
3. Rebuild `packages/opencode`
4. Re-run `openmod`

Typical flow:

```bash
cd /path/to/opencode
# update your branch from upstream/fork workflow
git fetch --all
git pull

cd packages/opencode
bun install
bun run build

# only needed if symlink target changed
ln -sf /path/to/opencode/packages/opencode/dist/index.js /usr/local/bin/openmod
```

In most updates, you only need **pull + rebuild**. Symlink recreation is usually unnecessary unless repository path/output path changed.

This leaves your production `opencode` installation untouched. Both can run simultaneously on different ports.

### Running Alongside Production opencode

```bash
# Release opencode on default port
opencode serve --port 3000

# Modified version on a separate port
openmod serve --port 4096
```

Point your app dev server at port 4096 to test the modified backend:

```bash
cd packages/app
bun dev -- --port 4444   # set OPENCODE_API_URL=http://localhost:4096 in your env
```

---

## Architecture Notes

- **No polling loops in the main agent** — supervision is handled by the watchdog fiber inside `SessionRunState`. The main agent does not spin on subagent status.
- **Event-driven parent unblocking** — `Session.Event.Error` is published to the child session bus on terminal outcomes; `task.ts` awaits this and returns a structured result to the parent.
- **Cancel is always bounded** — soft cancel has a 30 s grace timeout, so `cancelTask` always resolves within `softCancelGraceMs + watchdogIntervalMs`.
- **Token efficiency** — the watchdog runs every 15 s at most; total supervision events per task are bounded by ~23 (20 watchdog checks + timeout + cancel overhead).
