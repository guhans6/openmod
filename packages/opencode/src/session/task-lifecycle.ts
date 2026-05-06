import { Schema } from "effect"

import { SessionID } from "./schema"

export type TaskLifecycleState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "timeout"

export type TaskTerminalState = "completed" | "failed" | "cancelled" | "interrupted" | "timeout"

export type TaskTransitionReason =
  | "user_cancel"
  | "force_cancel"
  | "stale_timeout"
  | "execution_timeout"
  | "error"
  | "completed"
  | "interrupt"

export const VALID_TRANSITIONS: Record<TaskLifecycleState, TaskLifecycleState[]> = {
  pending: ["running"],
  running: ["completed", "failed", "cancelled", "interrupted", "timeout"],
  completed: [],
  failed: [],
  cancelled: [],
  interrupted: [],
  timeout: [],
}

export const isTerminal = (state: TaskLifecycleState): state is TaskTerminalState =>
  state === "completed" ||
  state === "failed" ||
  state === "cancelled" ||
  state === "interrupted" ||
  state === "timeout"

export const assertValidTransition = (
  from: TaskLifecycleState,
  to: TaskLifecycleState,
  reason: TaskTransitionReason,
): void => {
  if (VALID_TRANSITIONS[from].includes(to)) return

  throw new Error(`Invalid task lifecycle transition: ${from} -> ${to} (reason: ${reason})`)
}

export const TaskLifecycleEvent = Schema.Struct({
  sessionID: SessionID,
  state: Schema.Literals(["pending", "running", "completed", "failed", "cancelled", "interrupted", "timeout"]),
  reason: Schema.optional(
    Schema.Literals([
      "user_cancel",
      "force_cancel",
      "stale_timeout",
      "execution_timeout",
      "error",
      "completed",
      "interrupt",
    ]),
  ),
  timestamp: Schema.Number,
})

export type TaskLifecycleEvent = Schema.Schema.Type<typeof TaskLifecycleEvent>

export * as TaskLifecycle from "./task-lifecycle"
