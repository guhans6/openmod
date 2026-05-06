import { InstanceState } from "@/effect/instance-state"
import { Runner } from "@/effect/runner"
import { Clock, Duration, Effect, Latch, Layer, Schedule, Scope, Context } from "effect"
import * as Session from "./session"
import { MessageV2 } from "./message-v2"
import { SessionID } from "./schema"
import { SessionStatus } from "./status"
import { DEFAULT_TASK_TIMEOUT_CONFIG } from "@/config/task-timeout"

export interface Interface {
  readonly assertNotBusy: (sessionID: SessionID) => Effect.Effect<void>
  readonly cancel: (sessionID: SessionID) => Effect.Effect<void>
  readonly softCancel: (sessionID: SessionID) => Effect.Effect<void>
  readonly heartbeat: (sessionID: SessionID) => Effect.Effect<void>
  readonly ensureRunning: (
    sessionID: SessionID,
    onInterrupt: Effect.Effect<MessageV2.WithParts>,
    work: Effect.Effect<MessageV2.WithParts>,
  ) => Effect.Effect<MessageV2.WithParts>
  readonly startShell: (
    sessionID: SessionID,
    onInterrupt: Effect.Effect<MessageV2.WithParts>,
    work: Effect.Effect<MessageV2.WithParts>,
    ready?: Latch.Latch,
  ) => Effect.Effect<MessageV2.WithParts>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionRunState") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const status = yield* SessionStatus.Service

    const state = yield* InstanceState.make(
      Effect.fn("SessionRunState.state")(function* () {
        const scope = yield* Scope.Scope
        const runners = new Map<SessionID, Runner.Runner<MessageV2.WithParts>>()
        const heartbeats = new Map<SessionID, number>()
        yield* Effect.addFinalizer(
          Effect.fnUntraced(function* () {
            yield* Effect.forEach(runners.values(), (runner) => runner.cancel, {
              concurrency: "unbounded",
              discard: true,
            })
            runners.clear()
            heartbeats.clear()
          }),
        )

        // Stale-task watchdog: cancel sessions whose heartbeat has gone stale
        const staleMs = DEFAULT_TASK_TIMEOUT_CONFIG.staleHeartbeatTimeoutMs ?? 120_000
        const intervalMs = DEFAULT_TASK_TIMEOUT_CONFIG.watchdogIntervalMs ?? 15_000
        yield* Effect.forkScoped(
          Effect.repeat(
            Effect.gen(function* () {
              const now = yield* Clock.currentTimeMillis
              for (const [sessionID, lastBeat] of heartbeats) {
                if (now - lastBeat > staleMs) {
                  const existing = runners.get(sessionID)
                  if (existing?.busy) {
                    yield* existing.cancel
                    heartbeats.delete(sessionID)
                  }
                }
              }
            }),
            Schedule.spaced(intervalMs),
          ),
        )

        return { runners, heartbeats, scope }
      }),
    )

    const runner = Effect.fn("SessionRunState.runner")(function* (
      sessionID: SessionID,
      onInterrupt: Effect.Effect<MessageV2.WithParts>,
    ) {
      const data = yield* InstanceState.get(state)
      const existing = data.runners.get(sessionID)
      if (existing) return existing
      const next = Runner.make<MessageV2.WithParts>(data.scope, {
        onIdle: Effect.gen(function* () {
          data.runners.delete(sessionID)
          data.heartbeats.delete(sessionID)
          yield* status.set(sessionID, { type: "idle" })
        }),
        onBusy: status.set(sessionID, { type: "busy" }),
        onInterrupt,
        busy: () => {
          throw new Session.BusyError(sessionID)
        },
      })
      data.runners.set(sessionID, next)
      return next
    })

    const assertNotBusy = Effect.fn("SessionRunState.assertNotBusy")(function* (sessionID: SessionID) {
      const data = yield* InstanceState.get(state)
      const existing = data.runners.get(sessionID)
      if (existing?.busy) throw new Session.BusyError(sessionID)
    })

    const cancel = Effect.fn("SessionRunState.cancel")(function* (sessionID: SessionID) {
      const data = yield* InstanceState.get(state)
      const existing = data.runners.get(sessionID)
      if (!existing || !existing.busy) {
        yield* status.set(sessionID, { type: "idle" })
        return
      }
      yield* existing.cancel
    })

    const softCancel = Effect.fn("SessionRunState.softCancel")(function* (sessionID: SessionID) {
      const data = yield* InstanceState.get(state)
      const existing = data.runners.get(sessionID)
      if (!existing || !existing.busy) {
        yield* status.set(sessionID, { type: "idle" })
        return
      }
      // Request graceful interruption first.
      yield* existing.cancel
      const graceMs = DEFAULT_TASK_TIMEOUT_CONFIG.softCancelGraceMs ?? 30_000
      const deadline = (yield* Clock.currentTimeMillis) + graceMs
      while (data.runners.get(sessionID)?.busy) {
        const now = yield* Clock.currentTimeMillis
        if (now >= deadline) break
        yield* Effect.sleep(Duration.millis(500))
      }
      const latest = data.runners.get(sessionID)
      if (latest?.busy) yield* latest.cancel
    })

    const heartbeat = Effect.fn("SessionRunState.heartbeat")(function* (sessionID: SessionID) {
      const data = yield* InstanceState.get(state)
      const now = yield* Clock.currentTimeMillis
      data.heartbeats.set(sessionID, now)
    })

    const ensureRunning = Effect.fn("SessionRunState.ensureRunning")(function* (
      sessionID: SessionID,
      onInterrupt: Effect.Effect<MessageV2.WithParts>,
      work: Effect.Effect<MessageV2.WithParts>,
    ) {
      return yield* (yield* runner(sessionID, onInterrupt)).ensureRunning(work)
    })

    const startShell = Effect.fn("SessionRunState.startShell")(function* (
      sessionID: SessionID,
      onInterrupt: Effect.Effect<MessageV2.WithParts>,
      work: Effect.Effect<MessageV2.WithParts>,
      ready?: Latch.Latch,
    ) {
      return yield* (yield* runner(sessionID, onInterrupt)).startShell(work, ready)
    })

    return Service.of({ assertNotBusy, cancel, softCancel, heartbeat, ensureRunning, startShell })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(SessionStatus.defaultLayer))

export * as SessionRunState from "./run-state"
