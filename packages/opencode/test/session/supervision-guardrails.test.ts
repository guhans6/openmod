import { describe, expect, test } from "bun:test"
import { DEFAULT_TASK_TIMEOUT_CONFIG } from "../../src/config/task-timeout"

const MAX_WATCHDOG_EVENTS_PER_TASK = 20
const MAX_HEARTBEAT_EVENTS_PER_TASK = 100

describe("supervision overhead guardrails", () => {
  test("watchdog fires at most MAX_WATCHDOG_EVENTS_PER_TASK times in a 5-minute task window", () => {
    const windowMs = DEFAULT_TASK_TIMEOUT_CONFIG.executionTimeoutMs ?? 300_000
    const intervalMs = DEFAULT_TASK_TIMEOUT_CONFIG.watchdogIntervalMs ?? 15_000
    const maxFires = Math.ceil(windowMs / intervalMs)
    expect(maxFires).toBeLessThanOrEqual(MAX_WATCHDOG_EVENTS_PER_TASK)
  })

  test("stale timeout is at least 2x watchdog interval (no false positives)", () => {
    const staleMs = DEFAULT_TASK_TIMEOUT_CONFIG.staleHeartbeatTimeoutMs ?? 120_000
    const intervalMs = DEFAULT_TASK_TIMEOUT_CONFIG.watchdogIntervalMs ?? 15_000
    expect(staleMs).toBeGreaterThanOrEqual(intervalMs * 2)
  })

  test("soft cancel grace is less than execution timeout (bounded escalation)", () => {
    const graceMs = DEFAULT_TASK_TIMEOUT_CONFIG.softCancelGraceMs ?? 30_000
    const execMs = DEFAULT_TASK_TIMEOUT_CONFIG.executionTimeoutMs ?? 300_000
    expect(graceMs).toBeLessThan(execMs)
  })

  test("heartbeat budget: one per runLoop iteration; bounded by minimum LLM round-trip (3s)", () => {
    // Heartbeat fires once at the top of each runLoop iteration (not per tool call).
    // Each iteration requires at least one LLM inference + tool execution round-trip.
    // At a conservative 3 s minimum, the maximum heartbeat count in a 5-minute window
    // equals MAX_HEARTBEAT_EVENTS_PER_TASK exactly — making this a tight, non-trivial bound.
    const execMs = DEFAULT_TASK_TIMEOUT_CONFIG.executionTimeoutMs ?? 300_000
    const minRoundTripMs = 3_000
    const maxHeartbeats = Math.ceil(execMs / minRoundTripMs)
    expect(maxHeartbeats).toBeLessThanOrEqual(MAX_HEARTBEAT_EVENTS_PER_TASK)
  })

  test("no per-message polling: watchdog interval is coarse-grained (>=10s)", () => {
    const intervalMs = DEFAULT_TASK_TIMEOUT_CONFIG.watchdogIntervalMs ?? 15_000
    expect(intervalMs).toBeGreaterThanOrEqual(10_000)
  })

  test("supervision cost model: total events per task lifecycle is bounded", () => {
    const execMs = DEFAULT_TASK_TIMEOUT_CONFIG.executionTimeoutMs ?? 300_000
    const intervalMs = DEFAULT_TASK_TIMEOUT_CONFIG.watchdogIntervalMs ?? 15_000
    const watchdogEvents = Math.ceil(execMs / intervalMs)
    const timeoutEvents = 1
    const cancelEvents = 2
    const totalSupervisionEvents = watchdogEvents + timeoutEvents + cancelEvents
    expect(totalSupervisionEvents).toBeLessThanOrEqual(MAX_WATCHDOG_EVENTS_PER_TASK + 10)
  })
})
