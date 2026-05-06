import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { createMemo, createSignal } from "solid-js"
import { useKeybind } from "../context/keybind"
import { useTheme } from "../context/theme"
import { useSDK } from "../context/sdk"
import { Spinner } from "./spinner"
import { useToast } from "../ui/toast"
import { errorMessage } from "@/util/error"

export function DialogTaskList() {
  const dialog = useDialog()
  const route = useRoute()
  const sync = useSync()
  const keybind = useKeybind()
  const { theme } = useTheme()
  const sdk = useSDK()
  const toast = useToast()
  const [pendingCancel, setPendingCancel] = createSignal<string>()
  const [pendingCancelAll, setPendingCancelAll] = createSignal(false)

  const runningTasks = createMemo(() =>
    sync.data.session
      .filter((session) => !!session.parentID)
      .filter((session) => {
        const status = sync.data.session_status[session.id]
        return !!status && status.type !== "idle"
      })
      .toSorted((a, b) => b.time.updated - a.time.updated),
  )

  const options = createMemo(() =>
    runningTasks().map((session) => {
      const status = sync.data.session_status[session.id]
      const isBusy = status?.type === "busy"
      const isRetry = status?.type === "retry"
      const state = isBusy ? "running" : isRetry ? "retrying" : "idle"
      const parent = session.parentID ? sync.session.get(session.parentID) : undefined
      const title = session.title?.trim() || session.id.slice(0, 8)
      return {
        title,
        value: session.id,
        category: state,
        description: parent?.title ? `Parent: ${parent.title}` : session.parentID ? `Parent: ${session.parentID.slice(0, 8)}` : undefined,
        footer: pendingCancel() === session.id ? `Press ${keybind.print("task_cancel")} again to confirm` : undefined,
        bg: pendingCancel() === session.id ? theme.error : undefined,
        gutter: isBusy ? () => <Spinner /> : undefined,
      }
    }),
  )

  return (
    <DialogSelect
      title="Running tasks"
      placeholder="Filter tasks..."
      options={options()}
      renderFilter={options().length > 8}
      onMove={() => {
        setPendingCancel(undefined)
        setPendingCancelAll(false)
      }}
      onSelect={(option) => {
        route.navigate({ type: "session", sessionID: option.value })
        dialog.clear()
      }}
      keybind={[
        {
          keybind: keybind.all.task_cancel?.[0],
          title: "cancel",
          side: "right",
          onTrigger: async (option) => {
            if (pendingCancel() !== option.value) {
              setPendingCancel(option.value)
              return
            }
            setPendingCancel(undefined)
            const result = await sdk.client.session.abort({ sessionID: option.value })
            if (result.error) {
              toast.show({
                variant: "error",
                title: "Failed to cancel task",
                message: errorMessage(result.error),
              })
              return
            }
            toast.show({
              variant: "success",
              message: "Task cancel requested",
            })
            await sync.session.refresh()
          },
        },
        {
          keybind: keybind.all.task_cancel_all?.[0],
          title: pendingCancelAll()
            ? `confirm cancel all (${runningTasks().length})`
            : `cancel all (${runningTasks().length})`,
          side: "right",
          disabled: runningTasks().length === 0,
          onTrigger: async () => {
            if (!pendingCancelAll()) {
              setPendingCancel(undefined)
              setPendingCancelAll(true)
              return
            }
            setPendingCancelAll(false)
            const tasks = [...runningTasks()]
            const settled = await Promise.all(
              tasks.map((item) => sdk.client.session.abort({ sessionID: item.id })),
            )
            const failed = settled.filter((result) => result.error)
            if (failed.length > 0) {
              const first = failed[0]
              toast.show({
                variant: "error",
                title: "Failed to cancel all tasks",
                message: errorMessage(first.error),
              })
              await sync.session.refresh()
              return
            }
            toast.show({
              variant: "success",
              message: `Cancel requested for ${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
            })
            await sync.session.refresh()
          },
        },
      ]}
    />
  )
}
