import { Schema } from "effect"

import { SessionID } from "./schema"

export const TaskAttemptRecord = Schema.Struct({
  sessionID: SessionID,
  startedAt: Schema.Number,
  lastHeartbeatAt: Schema.optional(Schema.Number),
  endedAt: Schema.optional(Schema.Number),
  terminalState: Schema.optional(Schema.String),
  terminalReason: Schema.optional(Schema.String),
  watchdogFiredAt: Schema.optional(Schema.Number),
  parentUnblockedAt: Schema.optional(Schema.Number),
})

export type TaskAttemptRecord = Schema.Schema.Type<typeof TaskAttemptRecord>

export type TaskTelemetryLog = TaskAttemptRecord[]

export const createAttemptRecord = (sessionID: SessionID, startedAt: number): TaskAttemptRecord => ({
  sessionID,
  startedAt,
})

export const recordHeartbeat = (record: TaskAttemptRecord, now: number): TaskAttemptRecord => ({
  ...record,
  lastHeartbeatAt: now,
})

export const recordTerminal = (
  record: TaskAttemptRecord,
  terminalState: string,
  terminalReason: string,
  now: number,
): TaskAttemptRecord => ({
  ...record,
  endedAt: now,
  terminalState,
  terminalReason,
})

export const recordWatchdogFired = (record: TaskAttemptRecord, now: number): TaskAttemptRecord => ({
  ...record,
  watchdogFiredAt: now,
})

export const recordParentUnblocked = (record: TaskAttemptRecord, now: number): TaskAttemptRecord => ({
  ...record,
  parentUnblockedAt: now,
})

export * as TaskTelemetry from "./task-telemetry"
