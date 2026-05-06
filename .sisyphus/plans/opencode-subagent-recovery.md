# OpenCode Subagent Stuck-Task Recovery & Task Control Plan

## TL;DR

> **Quick Summary**: Implement a resilient background-task lifecycle in OpenCode core (first) so subagent hangs never block parent execution indefinitely, users can see/cancel/recover tasks from the existing Ctrl+X panel, and supervision remains event-driven/token-efficient.
>
> **Deliverables**:
> - Deterministic task lifecycle/state transitions with timeout/watchdog recovery
> - User cancellation UX (soft cancel default + escalation path)
> - Parent-session notification/recovery flow on cancel/fail/timeout
> - Core-first rollout in OpenCode, then integration alignment for Oh-My-OpenAgent
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 implementation waves + final verification wave
> **Critical Path**: T1 -> T4 -> T7 -> T10 -> T12 -> F1-F4

---

## Context

### Original Request
Fix the major stuck-subagent issue where main agent can wait forever, provide UX to view/cancel tasks, ensure parent recovers on cancellation/failure, keep token efficiency high, and validate usability/performance of self-built OpenCode.

### Interview Summary
**Key Discussions**:
- Default stuck policy: **auto-recover first** (bounded automatic recovery + notification)
- Default user cancellation: **soft cancel first**
- Rollout priority: **OpenCode core first**
- Wave-1 UX surface: **enhance existing Ctrl+X task panel**
- Repos confirmed:
  - `https://github.com/anomalyco/opencode`
  - `https://github.com/code-yeongyu/oh-my-openagent`

**Research Findings**:
- Event-driven supervision and bounded watchdogs are lower-token than frequent polling.
- OMO already has background manager/cancel/retry patterns that can inform core design.
- OpenCode lifecycle has blocking points where prompt/session waits can hang without robust timeout + recovery signaling.

### Metis Review
Metis call was aborted due the same subagent-stuck risk being planned against. Gaps were self-resolved conservatively by adding stricter guardrails:
- Explicit anti-scope-creep boundaries
- Deterministic timeout/cancellation semantics
- Clear acceptance criteria for parent unblocking behavior
- Token-budget guardrails for supervision logic

---

## Work Objectives

### Core Objective
Guarantee that every spawned subagent task eventually transitions to a terminal state (`completed | failed | cancelled | interrupted`) with parent-agent unblocking and clear operator visibility/control.

### Concrete Deliverables
- Task lifecycle hardening in OpenCode core
- Ctrl+X panel enhancements for running-task visibility + cancellation controls
- Parent notification + recovery workflow for non-success terminal states
- Token-efficient supervision policy and telemetry
- OMO compatibility/update wave aligned to core behavior

### Definition of Done
- [ ] No indefinite parent wait on hung child task in controlled fault tests
- [ ] User can list and cancel running tasks in Ctrl+X panel
- [ ] Parent receives explicit signal on cancel/fail/timeout and resumes flow safely
- [ ] Supervision overhead stays within defined token budget targets
- [ ] Self-built OpenCode runs equivalently for normal usage (dev/prod caveats documented)

### Must Have
- Bounded timeout + stale watchdog for task execution
- Soft cancel default + escalation path
- Event-driven parent notification on all terminal task outcomes
- Crash-safe task state persistence/reconciliation

### Must NOT Have (Guardrails)
- No aggressive high-frequency parent polling loops for status
- No silent task disappearance without terminal state + reason
- No UI-only “cancel” action that does not propagate to runtime/session abort path
- No broad architecture rewrite outside task lifecycle/cancellation/recovery scope

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - all verification is agent-executed with evidence artifacts.

### Test Decision
- **Infrastructure exists**: YES (project test infra already present)
- **Automated tests**: YES (Tests-after)
- **Framework**: project-native test runner(s) in each repo

### QA Policy
Each task includes explicit QA scenarios (happy + failure) with evidence in:
`.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`

- **Core/API validation**: Bash + test commands + targeted fault injection
- **CLI/TUI validation**: interactive_bash/tmux path for Ctrl+X task UX checks
- **Session/behavior assertions**: command output + structured logs + state snapshots

Token-efficiency verification:
- Compare baseline vs patched supervision behavior under synthetic load
- Confirm no unbounded status-query amplification from parent agent

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (OpenCode foundation - can start immediately):
├── T1: Lifecycle state contract + transition table
├── T2: Timeout policy config + defaults wiring
├── T3: Ctrl+X data model extension for task metadata
├── T4: Parent notification contract for terminal task states
└── T5: Evidence/telemetry schema for stuck-task diagnostics

Wave 2 (OpenCode runtime hardening - after Wave 1):
├── T6: Prompt/session bounded timeout guards
├── T7: Stale watchdog + forced interrupt path
├── T8: Cancellation path hardening (soft->escalate)
├── T9: Persistence/reconciliation for orphan/stale tasks
└── T10: Parent recovery behavior (resume/retry decision flow)

Wave 3 (OpenCode UX + validation - after Wave 2):
├── T11: Ctrl+X UI controls (list/cancel/status/retry affordance)
├── T12: End-to-end integration tests for stuck/cancel/recover
├── T13: Token overhead benchmark + guardrail test suite
└── T14: Build/self-host runbook and performance equivalence notes

Wave 4 (OMO compatibility integration - after Wave 3):
├── T15: Align OMO BackgroundManager with new core semantics
├── T16: Align OMO tool wrappers (task/output/cancel) with terminal guarantees
├── T17: OMO notification/retry logic compatibility and regression tests
└── T18: Cross-repo interoperability validation matrix

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA execution (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 -> T4 -> T7 -> T10 -> T12 -> T18 -> F1-F4
Parallel Speedup: ~65% vs sequential
Max Concurrent: 5 tasks
```

### Dependency Matrix (FULL)

- **T1**: Blocked By: None | Blocks: T6, T8, T10
- **T2**: Blocked By: None | Blocks: T6, T7, T13
- **T3**: Blocked By: None | Blocks: T11
- **T4**: Blocked By: None | Blocks: T10, T11
- **T5**: Blocked By: None | Blocks: T12, T13
- **T6**: Blocked By: T1, T2 | Blocks: T7, T12
- **T7**: Blocked By: T2, T6 | Blocks: T10, T12
- **T8**: Blocked By: T1 | Blocks: T11, T12
- **T9**: Blocked By: T1, T5 | Blocks: T12, T18
- **T10**: Blocked By: T1, T4, T7 | Blocks: T12, T16
- **T11**: Blocked By: T3, T4, T8 | Blocks: T12
- **T12**: Blocked By: T5, T6, T7, T8, T9, T10, T11 | Blocks: T13, T15, T18
- **T13**: Blocked By: T2, T5, T12 | Blocks: T18
- **T14**: Blocked By: T12 | Blocks: T18
- **T15**: Blocked By: T12 | Blocks: T16, T17
- **T16**: Blocked By: T10, T15 | Blocks: T17, T18
- **T17**: Blocked By: T15, T16 | Blocks: T18
- **T18**: Blocked By: T9, T12, T13, T14, T16, T17 | Blocks: FINAL

### Agent Dispatch Summary

- **Wave 1**: 5 tasks — quick/unspecified-high (schema/contracts/telemetry)
- **Wave 2**: 5 tasks — deep/unspecified-high (runtime lifecycle hardening)
- **Wave 3**: 4 tasks — visual-engineering + deep (UX + validation)
- **Wave 4**: 4 tasks — unspecified-high/deep (integration compatibility)
- **FINAL**: 4 tasks — oracle + deep + unspecified-high

---

## TODOs

- [x] 0. Provider/model preflight gate (blocker before subagents)

  **What to do**:
  - Audit configured agent/category models against `opencode models github-copilot` output.
  - Replace unavailable model IDs in `~/.config/opencode/oh-my-openagent.json` with available equivalents.
  - Define deterministic fallback chains for all critical agents (`prometheus`, `metis`, `momus`, `oracle`, `sisyphus`, `sisyphus-junior`) and categories (`deep`, `quick`, `unspecified-high`, `visual-engineering`).
  - Add startup preflight check that fails fast with actionable error if any configured provider/model is unavailable.

  **Must NOT do**:
  - Do not run subagent-dependent workflows until preflight passes.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Pre-Wave gate
  - **Blocks**: T1-T18 and high-accuracy subagent review
  - **Blocked By**: None

  **References**:
  - `~/.config/opencode/oh-my-openagent.json` - agent/category model mappings.
  - `~/.config/opencode/opencode.json` - active default model/provider setup.
  - `opencode models github-copilot` - authoritative list of available Copilot models.

  **Acceptance Criteria**:
  - [ ] No configured agent/category points to unavailable model ID.
  - [ ] Each critical agent has at least one valid fallback model.
  - [ ] Subagent invocation smoke test no longer shows "Provider not found".

  **QA Scenarios**:
  ```
  Scenario: Config-model compatibility validation
    Tool: Bash
    Steps:
      1. Enumerate all model IDs from oh-my-openagent config.
      2. Compare against `opencode models github-copilot` output.
    Expected Result: zero invalid model references.
    Evidence: .sisyphus/evidence/task-0-model-compatibility.txt

  Scenario: Subagent smoke test after remap
    Tool: Bash
    Steps:
      1. Run a minimal subagent invocation test.
      2. Observe provider/model resolution and completion.
    Expected Result: no "Provider not found" popup/error.
    Evidence: .sisyphus/evidence/task-0-subagent-smoke.txt
  ```

- [x] 1. Define canonical task lifecycle states and transitions

  **What to do**:
  - Introduce/standardize terminal and non-terminal states for child tasks.
  - Add explicit transition guards so every running task must reach terminal state.
  - Document transition reasons (`timeout`, `cancel`, `error`, `completed`, `interrupt`).

  **Must NOT do**:
  - Do not leave implicit/undocumented transitions.

  **Recommended Agent Profile**:
  - **Category**: `quick` (contract-level changes)
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (T2, T3, T4, T5)
  - **Blocks**: T6, T8, T10
  - **Blocked By**: None

  **References**:
  - `packages/opencode/src/tool/task.ts` - task entry semantics.
  - `packages/opencode/src/session/status.ts` - session status model.
  - `packages/opencode/src/session/run-state.ts` - cancellation/running state logic.

  **Acceptance Criteria**:
  - [ ] Transition table exists in code/docs and is enforced in runtime checks.
  - [ ] Invalid transition attempts are rejected with actionable reason.

  **QA Scenarios**:
  ```
  Scenario: Valid transition flow
    Tool: Bash
    Steps:
      1. Run lifecycle test suite for status transitions.
      2. Trigger normal child completion flow.
      3. Assert state order includes running -> completed.
    Expected Result: PASS and terminal state recorded.
    Evidence: .sisyphus/evidence/task-1-valid-transition.txt

  Scenario: Invalid transition blocked
    Tool: Bash
    Steps:
      1. Trigger synthetic invalid transition (e.g., completed -> running).
      2. Assert runtime returns transition error code/message.
    Expected Result: Transition denied, no state corruption.
    Evidence: .sisyphus/evidence/task-1-invalid-transition-error.txt
  ```

- [x] 2. Add timeout configuration and safe defaults

  **What to do**:
  - Add configurable execution timeout/stale timeout/session-gone timeout.
  - Set conservative defaults for auto-recover-first strategy.
  - Wire config loading and validation in core runtime.

  **Must NOT do**:
  - Do not hardcode magic numbers without config exposure.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T7, T13
  - **Blocked By**: None

  **References**:
  - `src/config/schema/background-task.ts` (OMO) - proven config shape.
  - `src/features/background-agent/manager.ts` (OMO) - timeout handling patterns.

  **Acceptance Criteria**:
  - [ ] Config schema includes timeout-related keys with defaults.
  - [ ] Invalid timeout values fail fast with clear error.

  **QA Scenarios**:
  ```
  Scenario: Defaults load correctly
    Tool: Bash
    Steps:
      1. Start app with no timeout overrides.
      2. Query effective config endpoint/log dump.
    Expected Result: Default timeout values present.
    Evidence: .sisyphus/evidence/task-2-default-timeouts.txt

  Scenario: Invalid timeout rejected
    Tool: Bash
    Steps:
      1. Set staleTimeoutMs to invalid value (e.g., -1).
      2. Start process.
    Expected Result: Startup/config validation failure with precise key.
    Evidence: .sisyphus/evidence/task-2-invalid-timeout-error.txt
  ```

- [x] 3. Extend Ctrl+X task data model for lifecycle diagnostics

  **What to do**:
  - Add fields: `startedAt`, `lastHeartbeatAt`, `terminalReason`, `canCancel`, `canForceCancel`.
  - Ensure model supports deterministic display of stuck/running/cancelling states.

  **Must NOT do**:
  - Do not couple UI model directly to internal mutable runtime objects.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T11
  - **Blocked By**: None

  **References**:
  - `packages/app/src/context/global-sync/bootstrap.ts` - global store shape.
  - `packages/app/src/context/global-sync/types.ts` - session/task typing.

  **Acceptance Criteria**:
  - [ ] Model includes required lifecycle diagnostics fields.
  - [ ] Backward-compatible for tasks lacking new fields.

  **QA Scenarios**:
  ```
  Scenario: Running task shows live diagnostics fields
    Tool: Bash
    Steps:
      1. Start a long-running child task.
      2. Inspect Ctrl+X data payload/state snapshot.
    Expected Result: heartbeat + startedAt populated.
    Evidence: .sisyphus/evidence/task-3-running-diagnostics.json

  Scenario: Terminal task displays reason
    Tool: Bash
    Steps:
      1. Force timeout/cancel a task.
      2. Inspect state snapshot.
    Expected Result: terminalReason set (timeout/cancel/etc).
    Evidence: .sisyphus/evidence/task-3-terminal-reason.json
  ```

- [x] 4. Implement parent notification contract for all terminal outcomes

  **What to do**:
  - Ensure parent session receives explicit event for completed/failed/cancelled/interrupted.
  - Include task ID + status + reason + suggested next action.

  **Must NOT do**:
  - Do not rely on implicit file presence/polling alone.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T10, T11
  - **Blocked By**: None

  **References**:
  - `packages/function/src/api.ts` - sync/event publish path.
  - `src/features/background-agent/background-task-notification-template.ts` (OMO) - notification payload pattern.
  - `src/hooks/session-notification.ts` (OMO) - parent session reminder injection.

  **Acceptance Criteria**:
  - [ ] Terminal events emitted exactly once per task attempt.
  - [ ] Parent visible notification includes status and reason.

  **QA Scenarios**:
  ```
  Scenario: Parent notified on child completion
    Tool: Bash
    Steps:
      1. Launch child task that succeeds.
      2. Inspect parent session events/messages.
    Expected Result: One terminal notification with completed status.
    Evidence: .sisyphus/evidence/task-4-parent-complete.txt

  Scenario: Parent notified on cancellation
    Tool: Bash
    Steps:
      1. Launch child task.
      2. Cancel it.
      3. Inspect parent session events/messages.
    Expected Result: One terminal notification with cancelled status + reason.
    Evidence: .sisyphus/evidence/task-4-parent-cancel.txt
  ```

- [x] 5. Add telemetry/evidence schema for stuck-task diagnostics

  **What to do**:
  - Define structured fields for attempt timeline, heartbeat deltas, timeout triggers.
  - Ensure logs can explain “why parent unblocked”.

  **Must NOT do**:
  - Do not emit verbose token-heavy logs per minor tick.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T9, T12, T13
  - **Blocked By**: None

  **References**:
  - `packages/core/src/effect/observability.ts` - observability structure.
  - `packages/core/src/effect/logger.ts` - context annotation patterns.

  **Acceptance Criteria**:
  - [ ] Task timeline fields exist and are queryable.
  - [ ] Timeout/cancel events include deterministic reason codes.

  **QA Scenarios**:
  ```
  Scenario: Telemetry captured for success path
    Tool: Bash
    Steps:
      1. Execute normal child task.
      2. Export telemetry/log snapshot.
    Expected Result: Includes attempt start/end and terminal status.
    Evidence: .sisyphus/evidence/task-5-success-telemetry.json

  Scenario: Telemetry captured for timeout path
    Tool: Bash
    Steps:
      1. Run synthetic hung task.
      2. Wait for watchdog timeout.
      3. Export telemetry.
    Expected Result: Includes timeout trigger + parent-unblocked marker.
    Evidence: .sisyphus/evidence/task-5-timeout-telemetry.json
  ```

- [x] 6. Add bounded timeout guards in prompt/session execution path

  **What to do**:
  - Wrap major blocking calls in bounded timeout with clear fallback path.
  - On timeout, transition task to terminal state and emit parent notification.

  **Must NOT do**:
  - Do not swallow timeout errors without state transition.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: T7, T12
  - **Blocked By**: T1, T2

  **References**:
  - `packages/opencode/src/tool/task.ts` - parent wait point.
  - `packages/opencode/src/session/prompt.ts` - prompt execution path.
  - `packages/opencode/src/session/session.ts` - session lifecycle integration.

  **Acceptance Criteria**:
  - [ ] Hanging prompt path times out into deterministic terminal state.
  - [ ] Parent receives timeout notification and resumes flow.

  **QA Scenarios**:
  ```
  Scenario: Normal prompt remains unaffected
    Tool: Bash
    Steps:
      1. Execute normal child task.
      2. Confirm completion within timeout budget.
    Expected Result: completed status, no false timeout.
    Evidence: .sisyphus/evidence/task-6-normal-timeout-guard.txt

  Scenario: Hung prompt times out and unblocks parent
    Tool: Bash
    Steps:
      1. Trigger simulated hanging prompt/session.
      2. Wait for timeout threshold.
      3. Verify parent progression.
    Expected Result: child terminal=timeout, parent continues.
    Evidence: .sisyphus/evidence/task-6-hang-timeout-recovery.txt
  ```

- [x] 7. Implement stale-task watchdog and forced interrupt path

  **What to do**:
  - Add stale detector using low-frequency checks + heartbeat timestamps.
  - On stale breach, issue interrupt/cancel escalation and mark terminal reason.

  **Must NOT do**:
  - Do not run high-frequency polling loops that consume tokens/resources.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: T10, T12
  - **Blocked By**: T2, T6

  **References**:
  - `src/features/background-agent/task-poller.ts` (OMO) - polling cadence pattern.
  - `src/features/background-agent/manager.ts` (OMO) - stale/session-gone timeout handling.
  - `packages/opencode/src/session/run-state.ts` - interrupt/cancel primitives.

  **Acceptance Criteria**:
  - [ ] Stale running task is auto-interrupted within configured bound.
  - [ ] Task state includes reason=`stale_timeout` and parent notification emitted.

  **QA Scenarios**:
  ```
  Scenario: Watchdog ignores healthy running task
    Tool: Bash
    Steps:
      1. Start long-running but active task with heartbeat updates.
      2. Run past one watchdog interval.
    Expected Result: task remains running (no false interrupt).
    Evidence: .sisyphus/evidence/task-7-healthy-watchdog.txt

  Scenario: Watchdog interrupts stale task
    Tool: Bash
    Steps:
      1. Start task and freeze heartbeat updates.
      2. Wait for staleTimeoutMs.
      3. Inspect terminal state and parent events.
    Expected Result: interrupted/cancelled terminal state + parent unblocked.
    Evidence: .sisyphus/evidence/task-7-stale-interrupt.txt
  ```

- [x] 8. Harden cancellation path (soft cancel default, escalation path)

  **What to do**:
  - Implement soft cancel as default action.
  - If soft cancel does not complete within grace timeout, expose/trigger force cancel.
  - Ensure runtime/session abort linkage is reliable.

  **Must NOT do**:
  - Do not mark task cancelled without confirming cancellation path execution.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T9)
  - **Blocks**: T11, T12
  - **Blocked By**: T1

  **References**:
  - `src/tools/background-task/create-background-cancel.ts` (OMO) - cancel API behavior.
  - `src/features/background-agent/manager.ts` (OMO) - cancelTask options/flow.
  - `packages/opencode/src/session/run-state.ts` - cancellation semantics.

  **Acceptance Criteria**:
  - [ ] Soft cancel transitions running task to terminal `cancelled` in bounded time.
  - [ ] Escalation path available after grace period expiry.

  **QA Scenarios**:
  ```
  Scenario: Soft cancel succeeds
    Tool: Bash
    Steps:
      1. Launch cancellable running task.
      2. Invoke cancel action once.
    Expected Result: terminal=cancelled before force threshold.
    Evidence: .sisyphus/evidence/task-8-soft-cancel.txt

  Scenario: Soft cancel stalls then force cancel works
    Tool: Bash
    Steps:
      1. Launch non-responsive task.
      2. Invoke soft cancel and wait grace period.
      3. Trigger force cancel.
    Expected Result: final terminal state set; no orphan running status.
    Evidence: .sisyphus/evidence/task-8-force-cancel.txt
  ```

- [x] 9. Add crash-safe task persistence and orphan reconciliation

  **What to do**:
  - Persist in-flight task state; reconcile on startup.
  - Detect orphaned `running` tasks and transition via recovery policy.

  **Must NOT do**:
  - Do not restore stale `running` tasks without reconciliation decision.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T8)
  - **Blocks**: T12, T18
  - **Blocked By**: T1, T5

  **References**:
  - `.opencode/background-tasks.json` (OMO pattern) - persistence model.
  - `src/features/background-agent/store.ts` (OMO) - task storage lifecycle.

  **Acceptance Criteria**:
  - [ ] Restart reconciliation resolves orphan tasks to deterministic states.
  - [ ] No orphan task remains indefinitely `running` after recovery window.

  **QA Scenarios**:
  ```
  Scenario: Clean restart preserves completed/cancelled history
    Tool: Bash
    Steps:
      1. Run tasks to terminal states.
      2. Restart process.
      3. Inspect reloaded task store.
    Expected Result: terminal histories preserved accurately.
    Evidence: .sisyphus/evidence/task-9-restart-history.json

  Scenario: Orphan running task reconciled on boot
    Tool: Bash
    Steps:
      1. Simulate crash with task marked running.
      2. Restart process.
      3. Observe reconciliation transition.
    Expected Result: task transitions to interrupted/failed/cancelled with reason.
    Evidence: .sisyphus/evidence/task-9-orphan-reconcile.json
  ```

- [x] 10. Implement parent recovery behavior after child terminal events

  **What to do**:
  - Define parent action on child `cancelled/timeout/error` (continue, retry prompt, or explicit warning).
  - Ensure parent does not hang waiting for missing completion signal.

  **Must NOT do**:
  - Do not auto-retry endlessly without attempt limits.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: T12, T16
  - **Blocked By**: T1, T4, T7

  **References**:
  - `packages/opencode/src/tool/task.ts` - parent-side task tool behavior.
  - `src/features/background-agent/background-task-notification-template.ts` (OMO) - actionable parent alerts.
  - `src/tools/background-task/create-background-output.ts` (OMO) - status/await semantics.

  **Acceptance Criteria**:
  - [ ] Parent always receives deterministic post-child path for all terminal outcomes.
  - [ ] No terminal child outcome leaves parent in blocked waiting state.

  **QA Scenarios**:
  ```
  Scenario: Parent continues after child timeout
    Tool: Bash
    Steps:
      1. Trigger child timeout.
      2. Observe parent session next step.
    Expected Result: parent resumes with timeout notice (no dead wait).
    Evidence: .sisyphus/evidence/task-10-parent-timeout-recovery.txt

  Scenario: Parent handles child cancel gracefully
    Tool: Bash
    Steps:
      1. Cancel active child task.
      2. Observe parent follow-up behavior.
    Expected Result: parent emits clear issue message and remains operable.
    Evidence: .sisyphus/evidence/task-10-parent-cancel-recovery.txt
  ```

- [x] 11. Enhance Ctrl+X task panel with running-task controls

  **What to do**:
  - Add task list fields/status badges.
  - Add cancel action (soft default) and conditional force cancel action.
  - Expose retry/start-again affordance where appropriate.

  **Must NOT do**:
  - Do not introduce separate task manager screen in Wave-1.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: T12
  - **Blocked By**: T3, T4, T8

  **References**:
  - `packages/app/src/context/global-sync/bootstrap.ts`
  - `packages/app/src/context/global-sync/types.ts`
  - Existing Ctrl+X task panel rendering files in app UI package.

  **Acceptance Criteria**:
  - [ ] User can see live running tasks with key metadata.
  - [ ] User can trigger cancel and observe state transition in panel.

  **QA Scenarios**:
  ```
  Scenario: Ctrl+X displays active tasks with statuses
    Tool: interactive_bash
    Steps:
      1. Launch app and create multiple background tasks.
      2. Open Ctrl+X panel.
      3. Validate task rows/status badges.
    Expected Result: all active tasks visible with accurate status.
    Evidence: .sisyphus/evidence/task-11-ctrlx-status.txt

  Scenario: Cancel from Ctrl+X updates runtime + UI
    Tool: interactive_bash
    Steps:
      1. Open Ctrl+X panel on running task.
      2. Trigger cancel action.
      3. Observe runtime terminal event + UI transition.
    Expected Result: state becomes cancelled (or force path shown if stalled).
    Evidence: .sisyphus/evidence/task-11-ctrlx-cancel.txt
  ```

- [x] 12. Build end-to-end stuck/cancel/recover integration test suite

  **What to do**:
  - Create integration scenarios spanning dispatch -> run -> cancel/timeout -> parent recovery.
  - Include failure-injection cases for hung child simulation.

  **Must NOT do**:
  - Do not rely solely on unit tests for lifecycle correctness.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: T13, T14, T15, T18
  - **Blocked By**: T5, T6, T7, T8, T9, T10, T11

  **References**:
  - Task lifecycle files from T1-T11.
  - Existing integration test framework in OpenCode repo.

  **Acceptance Criteria**:
  - [ ] E2E suite reproduces old stuck scenario and passes with new behavior.
  - [ ] Parent unblocking verified in all failure terminals.

  **QA Scenarios**:
  ```
  Scenario: E2E normal child completion
    Tool: Bash
    Steps:
      1. Run integration suite case: child success.
      2. Assert parent receives completion and continues.
    Expected Result: PASS.
    Evidence: .sisyphus/evidence/task-12-e2e-success.txt

  Scenario: E2E hung child recovers
    Tool: Bash
    Steps:
      1. Run integration case with injected child hang.
      2. Assert timeout/watchdog and parent unblocking.
    Expected Result: PASS with terminal reason + recovery path.
    Evidence: .sisyphus/evidence/task-12-e2e-hang-recovery.txt
  ```

- [x] 13. Add token-overhead benchmark and supervision guardrails

  **What to do**:
  - Add benchmark comparing supervision overhead baseline vs patched flow.
  - Enforce max supervision event/query budget per task lifecycle.

  **Must NOT do**:
  - Do not introduce per-message parent polling loops.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T14)
  - **Blocks**: T18
  - **Blocked By**: T2, T5, T12

  **References**:
  - `src/features/background-agent/task-poller.ts` (OMO) - cadence inputs.
  - `src/features/background-agent/manager.ts` (OMO) - event lifecycle counts.

  **Acceptance Criteria**:
  - [ ] Benchmark output shows bounded supervision cost under load.
  - [ ] Guardrails fail CI if supervision overhead regresses past threshold.

  **QA Scenarios**:
  ```
  Scenario: Benchmark passes under nominal load
    Tool: Bash
    Steps:
      1. Run token/supervision benchmark suite.
      2. Collect report artifact.
    Expected Result: overhead within configured budget.
    Evidence: .sisyphus/evidence/task-13-benchmark-nominal.json

  Scenario: Regression guardrail triggers on synthetic high polling
    Tool: Bash
    Steps:
      1. Enable synthetic high-frequency supervision mode.
      2. Run guardrail check.
    Expected Result: guardrail test fails with clear threshold violation.
    Evidence: .sisyphus/evidence/task-13-guardrail-regression.txt
  ```

- [x] 14. Create self-build runbook and performance equivalence checks

  **What to do**:
  - Document how to run self-built OpenCode as daily driver.
  - Add lightweight performance checklist (dev vs prod build caveats).

  **Must NOT do**:
  - Do not claim guaranteed identical performance across debug/dev configs.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T13)
  - **Blocks**: T18
  - **Blocked By**: T12

  **References**:
  - Build/run docs in OpenCode repo.
  - Runtime config docs for logging/instrumentation toggles.

  **Acceptance Criteria**:
  - [ ] Runbook covers install/build/run/update rollback basics.
  - [ ] Includes RAM/performance caveats for dev vs production build.

  **QA Scenarios**:
  ```
  Scenario: Self-built binary/command usable for normal workflow
    Tool: Bash
    Steps:
      1. Follow runbook from clean environment.
      2. Launch tool and execute basic workflow.
    Expected Result: workflow completes successfully.
    Evidence: .sisyphus/evidence/task-14-self-build-smoke.txt

  Scenario: Perf checklist executed and recorded
    Tool: Bash
    Steps:
      1. Run documented perf checklist.
      2. Capture baseline metrics output.
    Expected Result: checklist complete with comparable metrics captured.
    Evidence: .sisyphus/evidence/task-14-perf-checklist.json
  ```

- [x] 15. Align OMO BackgroundManager with OpenCode core terminal guarantees

  **What to do**:
  - Update OMO manager assumptions to consume new core lifecycle semantics.
  - Remove duplicate/conflicting state transitions where core now authoritative.

  **Must NOT do**:
  - Do not fork state semantics between OpenCode and OMO.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T16, T17
  - **Blocked By**: T12

  **References**:
  - `src/features/background-agent/manager.ts` (OMO)
  - OpenCode core task lifecycle modules from T1-T10

  **Acceptance Criteria**:
  - [ ] OMO manager composes with core terminal-state guarantees without drift.
  - [ ] No duplicate watchdog/cancel loops fighting core behavior.

  **QA Scenarios**:
  ```
  Scenario: OMO manager handles core timeout terminal events
    Tool: Bash
    Steps:
      1. Trigger core timeout event via integration harness.
      2. Verify OMO manager updates correctly.
    Expected Result: consistent terminal status propagation.
    Evidence: .sisyphus/evidence/task-15-omo-core-timeout.txt

  Scenario: No state drift between core and OMO
    Tool: Bash
    Steps:
      1. Run mixed event sequence (success/cancel/timeout).
      2. Compare core vs OMO task state snapshots.
    Expected Result: state equivalence maintained.
    Evidence: .sisyphus/evidence/task-15-state-equivalence.json
  ```

- [x] 16. Align OMO task/output/cancel wrappers with new core contracts

  **What to do**:
  - Update `background_task`, `background_output`, `background_cancel` wrapper behavior.
  - Ensure wrapper semantics surface parent-unblocking and terminal reasons consistently.

  **Must NOT do**:
  - Do not keep legacy wrapper behavior that can mask terminal states.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: T17, T18
  - **Blocked By**: T10, T15

  **References**:
  - `src/tools/background-task/create-background-task.ts`
  - `src/tools/background-task/create-background-output.ts`
  - `src/tools/background-task/create-background-cancel.ts`

  **Acceptance Criteria**:
  - [ ] Wrappers reflect core terminal semantics in outputs/errors.
  - [ ] Cancellation wrapper behavior matches soft->force policy.

  **QA Scenarios**:
  ```
  Scenario: Wrapper output on terminal timeout is explicit
    Tool: Bash
    Steps:
      1. Execute wrapper flow with induced timeout.
      2. Inspect output payload.
    Expected Result: terminal reason/status exposed clearly.
    Evidence: .sisyphus/evidence/task-16-wrapper-timeout-output.txt

  Scenario: Wrapper cancel path supports soft then force
    Tool: Bash
    Steps:
      1. Call cancel wrapper on responsive and unresponsive tasks.
      2. Observe behavior across grace threshold.
    Expected Result: policy-compliant cancel behavior.
    Evidence: .sisyphus/evidence/task-16-wrapper-cancel-policy.txt
  ```

- [x] 17. Validate OMO retry/notification compatibility with new core behavior

  **What to do**:
  - Reconcile retry triggers and parent notification templates with core terminal reasons.
  - Ensure no duplicate/redundant reminders flood parent context.

  **Must NOT do**:
  - Do not keep unbounded retry loops.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: T18
  - **Blocked By**: T15, T16

  **References**:
  - `src/features/background-agent/fallback-retry-handler.ts`
  - `src/features/background-agent/background-task-notification-template.ts`
  - `src/hooks/session-notification.ts`

  **Acceptance Criteria**:
  - [ ] Retry behavior bounded and policy-aligned.
  - [ ] Parent receives one actionable terminal notification per attempt.

  **QA Scenarios**:
  ```
  Scenario: Retry bounded for retryable errors
    Tool: Bash
    Steps:
      1. Inject retryable model error.
      2. Observe retry attempts and final terminal state.
    Expected Result: retries capped; final status deterministic.
    Evidence: .sisyphus/evidence/task-17-bounded-retry.txt

  Scenario: Notification deduplication
    Tool: Bash
    Steps:
      1. Trigger failure with retry chain.
      2. Inspect parent notifications.
    Expected Result: no duplicate spam; actionable summary present.
    Evidence: .sisyphus/evidence/task-17-notification-dedup.txt
  ```

- [x] 18. Run cross-repo interoperability validation matrix

  **What to do**:
  - Validate OpenCode core + OMO extension scenarios across success/cancel/timeout/error.
  - Confirm identical terminal semantics and parent recovery across integration boundaries.

  **Must NOT do**:
  - Do not ship without cross-repo matrix completion.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 final
  - **Blocks**: Final verification wave
  - **Blocked By**: T9, T12, T13, T14, T16, T17

  **References**:
  - OpenCode and OMO lifecycle/task wrapper modules from T1-T17.

  **Acceptance Criteria**:
  - [ ] Matrix passes for all terminal scenarios.
  - [ ] No indefinite parent waits observed in any integration scenario.

  **QA Scenarios**:
  ```
  Scenario: Cross-repo success/cancel/timeout matrix pass
    Tool: Bash
    Steps:
      1. Run matrix suite across both repos/integration harness.
      2. Inspect per-scenario verdicts.
    Expected Result: all scenarios pass with expected terminal semantics.
    Evidence: .sisyphus/evidence/task-18-matrix-pass.json

  Scenario: Anti-regression for original stuck condition
    Tool: Bash
    Steps:
      1. Replay original stuck reproduction scenario.
      2. Verify parent unblocks and reports issue.
    Expected Result: no indefinite wait; deterministic recovery.
    Evidence: .sisyphus/evidence/task-18-stuck-regression.txt
  ```

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in parallel. ALL must approve. Present consolidated results and get explicit user okay.

- [x] F1. **Plan Compliance Audit** — `oracle`
  - Verify each Must Have exists and each Must NOT Have is absent.
  - Validate task evidence files under `.sisyphus/evidence/`.
  - Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  - Run type/lint/tests; scan for unsafe bypasses and dead code.
  - Output: `Build | Lint | Tests | Issues | VERDICT`

- [x] F3. **Real QA Scenario Execution** — `unspecified-high`
  - Execute all task QA scenarios and collect final evidence bundle.
  - Output: `Scenarios [N/N] | Integration | Edge Cases | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  - Compare implemented diff vs plan task-by-task; flag creep or omissions.
  - Output: `Tasks [N/N compliant] | Contamination | Unaccounted | VERDICT`

---

## Commit Strategy

- Commit by wave to keep rollback clean.
- Conventional commits with scope tied to lifecycle area:
  - `fix(task-lifecycle): enforce bounded subagent terminal states`
  - `feat(task-ui): add ctrl+x task controls and cancellation actions`
  - `chore(compat): align omo background-task semantics with core`

---

## Success Criteria

### Verification Commands
```bash
# OpenCode
[repo-test-command]         # Expected: all tests pass
[repo-typecheck-command]    # Expected: no type errors

# OMO integration
[omo-test-command]          # Expected: integration tests pass

# Fault injection suite
[stuck-task-sim-command]    # Expected: parent unblocks to terminal state within timeout
```

### Final Checklist
- [ ] All Must Have items implemented
- [ ] All Must NOT Have violations absent
- [ ] Parent never remains indefinitely blocked during hung-task scenarios
- [ ] Cancellation from Ctrl+X transitions task to terminal state with parent notification
- [ ] Token overhead guardrail checks pass
