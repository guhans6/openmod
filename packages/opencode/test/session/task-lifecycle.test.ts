import { describe, expect, test } from "bun:test"
import {
  assertValidTransition,
  isTerminal,
  VALID_TRANSITIONS,
  type TaskLifecycleState,
} from "../../src/session/task-lifecycle"
import { suggestAction, formatNotificationMessage } from "../../src/session/task-notification"
import { validateTaskTimeoutConfig, DEFAULT_TASK_TIMEOUT_CONFIG } from "../../src/config/task-timeout"
import {
  createAttemptRecord,
  recordHeartbeat,
  recordTerminal,
  recordWatchdogFired,
  recordParentUnblocked,
} from "../../src/session/task-telemetry"
import { SessionID } from "../../src/session/schema"

const sid = SessionID.make("test-session-01")

describe("task-lifecycle: isTerminal", () => {
  test("terminal states", () => {
    expect(isTerminal("completed")).toBe(true)
    expect(isTerminal("failed")).toBe(true)
    expect(isTerminal("cancelled")).toBe(true)
    expect(isTerminal("interrupted")).toBe(true)
    expect(isTerminal("timeout")).toBe(true)
  })

  test("non-terminal states", () => {
    expect(isTerminal("pending")).toBe(false)
    expect(isTerminal("running")).toBe(false)
  })
})

describe("task-lifecycle: VALID_TRANSITIONS", () => {
  test("pending can only go to running", () => {
    expect(VALID_TRANSITIONS.pending).toEqual(["running"])
  })

  test("running can go to all terminal states", () => {
    const terminals: TaskLifecycleState[] = ["completed", "failed", "cancelled", "interrupted", "timeout"]
    for (const t of terminals) {
      expect(VALID_TRANSITIONS.running).toContain(t)
    }
  })

  test("terminal states have no outgoing transitions", () => {
    const terminals: TaskLifecycleState[] = ["completed", "failed", "cancelled", "interrupted", "timeout"]
    for (const t of terminals) {
      expect(VALID_TRANSITIONS[t]).toEqual([])
    }
  })
})

describe("task-lifecycle: assertValidTransition", () => {
  test("valid: pending -> running", () => {
    expect(() => assertValidTransition("pending", "running", "completed")).not.toThrow()
  })

  test("valid: running -> completed", () => {
    expect(() => assertValidTransition("running", "completed", "completed")).not.toThrow()
  })

  test("valid: running -> timeout", () => {
    expect(() => assertValidTransition("running", "timeout", "execution_timeout")).not.toThrow()
  })

  test("valid: running -> cancelled", () => {
    expect(() => assertValidTransition("running", "cancelled", "user_cancel")).not.toThrow()
  })

  test("invalid: pending -> completed (skips running)", () => {
    expect(() => assertValidTransition("pending", "completed", "completed")).toThrow()
  })

  test("invalid: completed -> running (re-entry)", () => {
    expect(() => assertValidTransition("completed", "running", "completed")).toThrow()
  })

  test("invalid: timeout -> cancelled", () => {
    expect(() => assertValidTransition("timeout", "cancelled", "user_cancel")).toThrow()
  })
})

describe("task-notification: suggestAction", () => {
  test("completed -> continue", () => {
    expect(suggestAction("completed")).toBe("continue")
  })

  test("cancelled -> continue", () => {
    expect(suggestAction("cancelled")).toBe("continue")
  })

  test("timeout -> retry", () => {
    expect(suggestAction("timeout")).toBe("retry")
  })

  test("interrupted -> retry", () => {
    expect(suggestAction("interrupted")).toBe("retry")
  })

  test("failed -> investigate", () => {
    expect(suggestAction("failed")).toBe("investigate")
  })
})

describe("task-notification: formatNotificationMessage", () => {
  test("formats message with all fields", () => {
    const n = {
      sessionID: sid,
      parentSessionID: SessionID.make("parent-01"),
      state: "timeout" as const,
      reason: "execution_timeout",
      suggestedAction: "retry" as const,
      timestamp: 1000,
    }
    const msg = formatNotificationMessage(n)
    expect(msg).toContain(sid)
    expect(msg).toContain("timeout")
    expect(msg).toContain("retry")
  })
})

describe("task-timeout: validateTaskTimeoutConfig", () => {
  test("default config is valid", () => {
    expect(() => validateTaskTimeoutConfig(DEFAULT_TASK_TIMEOUT_CONFIG)).not.toThrow()
  })

  test("rejects zero executionTimeoutMs", () => {
    expect(() => validateTaskTimeoutConfig({ ...DEFAULT_TASK_TIMEOUT_CONFIG, executionTimeoutMs: 0 })).toThrow()
  })

  test("rejects negative staleHeartbeatTimeoutMs", () => {
    expect(() =>
      validateTaskTimeoutConfig({ ...DEFAULT_TASK_TIMEOUT_CONFIG, staleHeartbeatTimeoutMs: -1 }),
    ).toThrow()
  })

  test("rejects softCancelGraceMs >= executionTimeoutMs", () => {
    expect(() =>
      validateTaskTimeoutConfig({
        ...DEFAULT_TASK_TIMEOUT_CONFIG,
        softCancelGraceMs: DEFAULT_TASK_TIMEOUT_CONFIG.executionTimeoutMs,
      }),
    ).toThrow()
  })

  test("accepts custom valid config", () => {
    expect(() =>
      validateTaskTimeoutConfig({
        executionTimeoutMs: 60_000,
        staleHeartbeatTimeoutMs: 30_000,
        softCancelGraceMs: 10_000,
        watchdogIntervalMs: 5_000,
      }),
    ).not.toThrow()
  })
})

describe("task-telemetry: record helpers", () => {
  test("createAttemptRecord sets sessionID and startedAt", () => {
    const r = createAttemptRecord(sid, 1000)
    expect(r.sessionID).toBe(sid)
    expect(r.startedAt).toBe(1000)
    expect(r.endedAt).toBeUndefined()
  })

  test("recordHeartbeat updates lastHeartbeatAt", () => {
    const r = createAttemptRecord(sid, 1000)
    const r2 = recordHeartbeat(r, 2000)
    expect(r2.lastHeartbeatAt).toBe(2000)
    expect(r2.startedAt).toBe(1000)
  })

  test("recordTerminal sets endedAt, state, reason", () => {
    const r = createAttemptRecord(sid, 1000)
    const r2 = recordTerminal(r, "timeout", "execution_timeout", 5000)
    expect(r2.endedAt).toBe(5000)
    expect(r2.terminalState).toBe("timeout")
    expect(r2.terminalReason).toBe("execution_timeout")
  })

  test("recordWatchdogFired sets watchdogFiredAt", () => {
    const r = createAttemptRecord(sid, 1000)
    const r2 = recordWatchdogFired(r, 3000)
    expect(r2.watchdogFiredAt).toBe(3000)
  })

  test("recordParentUnblocked sets parentUnblockedAt", () => {
    const r = createAttemptRecord(sid, 1000)
    const r2 = recordParentUnblocked(r, 6000)
    expect(r2.parentUnblockedAt).toBe(6000)
  })

  test("helpers are pure (do not mutate original)", () => {
    const r = createAttemptRecord(sid, 1000)
    recordHeartbeat(r, 2000)
    expect(r.lastHeartbeatAt).toBeUndefined()
  })
})
