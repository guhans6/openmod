import { Schema } from "effect"

export const Info = Schema.Struct({
  executionTimeoutMs: Schema.optional(Schema.Number),
  staleHeartbeatTimeoutMs: Schema.optional(Schema.Number),
  softCancelGraceMs: Schema.optional(Schema.Number),
  watchdogIntervalMs: Schema.optional(Schema.Number),
})

export type TaskTimeoutConfig = Schema.Schema.Type<typeof Info>

export const DEFAULT_TASK_TIMEOUT_CONFIG: TaskTimeoutConfig = {
  executionTimeoutMs: 300_000,
  staleHeartbeatTimeoutMs: 120_000,
  softCancelGraceMs: 30_000,
  watchdogIntervalMs: 15_000,
}

export function validateTaskTimeoutConfig(cfg: TaskTimeoutConfig): void {
  const next = { ...DEFAULT_TASK_TIMEOUT_CONFIG, ...cfg }
  const executionTimeoutMs = next.executionTimeoutMs ?? 300_000
  const staleHeartbeatTimeoutMs = next.staleHeartbeatTimeoutMs ?? 120_000
  const softCancelGraceMs = next.softCancelGraceMs ?? 30_000
  const watchdogIntervalMs = next.watchdogIntervalMs ?? 15_000

  if (
    !Number.isFinite(executionTimeoutMs) ||
    !Number.isFinite(staleHeartbeatTimeoutMs) ||
    !Number.isFinite(softCancelGraceMs) ||
    !Number.isFinite(watchdogIntervalMs) ||
    executionTimeoutMs <= 0 ||
    staleHeartbeatTimeoutMs <= 0 ||
    softCancelGraceMs <= 0 ||
    watchdogIntervalMs <= 0
  ) {
    throw new Error("invalid task timeout config")
  }

  if (softCancelGraceMs >= executionTimeoutMs) {
    throw new Error("softCancelGraceMs must be less than executionTimeoutMs")
  }
}

export * as TaskTimeoutConfig from "./task-timeout"
