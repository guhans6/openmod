# Draft: Subagent Task Cancellation and Recovery

## Requirements (confirmed)
- Need a fix for stuck subagent execution where the main agent waits indefinitely.
- Users should be able to see running subagent tasks.
- Users should be able to cancel subagent tasks.
- Main agent should be notified when subagent cancellation/failure happens and recover (retry/restart flow) instead of hanging.
- Solution should minimize token waste from subagent management overhead.
- Work may involve both `opencode` and `oh-my-openagent` open-source repos.
- User wants confidence that post-fix normal usage does not significantly increase RAM/resource consumption.

## Technical Decisions
- None yet (pending architecture and scope decisions).

## Research Findings
- Launched parallel codebase exploration to map:
  - subagent task lifecycle (create/track/await/notify)
  - current task visibility UX and keybindings
  - token/performance monitoring and polling hot paths

## Open Questions
- Which repo is the source of truth for task orchestration/state handling (`opencode`, `oh-my-openagent`, or both)?
- Should cancellation be UI-only, CLI-only, or both?
- Should cancellation trigger auto-retry, manual retry prompt, or both?
- What timeout/watchdog behavior is desired?
- What level of backward compatibility is required?

## Scope Boundaries
- INCLUDE: Stuck-task prevention + task visibility + cancellation + main-agent recovery handling.
- EXCLUDE: Not defined yet.
