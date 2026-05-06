import { Schema } from "effect"

import { SessionID } from "./schema"
import type { TaskTerminalState } from "./task-lifecycle"

export const suggestAction = (state: TaskTerminalState): "continue" | "retry" | "investigate" => {
  if (state === "completed" || state === "cancelled") return "continue"
  if (state === "timeout" || state === "interrupted") return "retry"
  return "investigate"
}

export const TaskTerminalNotification = Schema.Struct({
  sessionID: SessionID,
  parentSessionID: SessionID,
  state: Schema.Union(
    [
      Schema.Literal("completed"),
      Schema.Literal("failed"),
      Schema.Literal("cancelled"),
      Schema.Literal("interrupted"),
      Schema.Literal("timeout"),
    ],
  ),
  reason: Schema.String,
  suggestedAction: Schema.Union(
    [Schema.Literal("continue"), Schema.Literal("retry"), Schema.Literal("investigate")],
  ),
  timestamp: Schema.Number,
})

export type TaskTerminalNotification = Schema.Schema.Type<typeof TaskTerminalNotification>

export const formatNotificationMessage = (n: TaskTerminalNotification): string =>
  `[Task ${n.sessionID}] Terminal: ${n.state} — ${n.reason}. Suggested: ${n.suggestedAction}.`

export * as TaskNotification from "./task-notification"
