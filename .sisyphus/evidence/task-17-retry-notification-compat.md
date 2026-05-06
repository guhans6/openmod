# T17: OMO Retry/Notification Compatibility

## Analysis Date: 2026-05-05

## Retry Boundedness

File: `src/features/background-agent/fallback-retry-handler.ts`

Retry is bounded by `fallbackChain.length` and `task.attemptCount`:
```typescript
const canRetry =
  shouldRetryError(errorInfo) &&
  fallbackChain &&
  fallbackChain.length > 0 &&
  hasMoreFallbacks(fallbackChain, task.attemptCount ?? 0)
```

`hasMoreFallbacks(chain, count)` returns false when `count >= chain.length`. The fallback chain is set at task launch time and never grows. **No unbounded retry loops exist.**

## Notification Deduplication

File: `src/features/background-agent/background-task-notification-template.ts`

Notifications are sent:
1. Once per task terminal event (via `notifyParentSession`)
2. Once for "all complete" summary when last task finishes

The `buildBackgroundTaskNotificationText` function produces one notification per call. The manager calls it exactly once per terminal transition. **No duplicate spam.**

## Core Timeout → OMO Notification Path

When core times out a task:
1. Session → idle → OMO idle event handler fires
2. `tryCompleteTask()` called → task marked `"interrupt"` with stale error message
3. `notifyParentSession()` called once with `statusText: "INTERRUPTED"`
4. Parent receives single `<system-reminder>` block with ACTION REQUIRED guidance

The notification template's `"INTERRUPTED"` path already covers core timeout. The `suggestAction` from our `task-notification.ts` (`"retry"` for timeout/interrupted) aligns with OMO's `"ACTION REQUIRED"` guidance.

## Verdict: COMPATIBLE — retry bounded, notifications deduplicated, core timeout maps correctly
