# Self-Build Runbook: OpenCode (Personal Fork)

> **Purpose**: Run a self-built OpenCode as your daily driver with the subagent recovery patches applied.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Bun  | 1.3+    |
| Node | 20+     |
| macOS / Linux | arm64 or x64 |

---

## 1. Install & Build

```bash
# Clone your fork
git clone https://github.com/<your-fork>/opencode.git
cd opencode

# Install dependencies
bun install

# Build a standalone binary (single-file executable)
./packages/opencode/script/build.ts --single
```

The binary lands at:
```
packages/opencode/dist/opencode-<platform>/bin/opencode
# e.g. packages/opencode/dist/opencode-darwin-arm64/bin/opencode
```

---

## 2. Run Modes

### Development (hot-reload, no build step)
```bash
bun dev                  # TUI in packages/opencode/
bun dev <directory>      # TUI in any directory
bun dev serve            # Headless API server (port 4096)
bun dev web              # Server + web UI
```

### Production (built binary)
```bash
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode serve
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode web
```

### `openmod` — your patched build, separate from release `opencode`

After building, create a symlink named `openmod` that points to your patched binary.
This lives alongside the release `opencode` with zero conflict:

```bash
# Run once from inside your fork directory
ln -sf "$(pwd)/packages/opencode/dist/opencode-darwin-arm64/bin/opencode" \
       /usr/local/bin/openmod
```

Then use it exactly like `opencode`, just with a different name:

```bash
openmod                  # TUI in current directory
openmod serve            # Headless API server
openmod web              # Server + web UI
openmod <directory>      # TUI in any directory
```

The release `opencode` (installed via npm/curl) is completely untouched.
Both can run at the same time on different ports if needed.

> **After every rebuild** the symlink auto-points to the new binary — no re-linking needed.

---

## 3. Update & Rebuild

```bash
git pull origin main
bun install              # picks up any new deps
./packages/opencode/script/build.ts --single
```

---

## 4. Rollback

```bash
git stash                # or git checkout <last-good-sha>
./packages/opencode/script/build.ts --single
```

---

## 5. RAM & Performance Caveats

| Mode | Typical RSS | Notes |
|------|-------------|-------|
| `bun dev` (dev server) | ~200–350 MB | Bun JIT + hot-reload overhead; **not** representative of production |
| Built binary (`--single`) | ~120–200 MB | Bun bytecode bundle; closest to upstream release |
| Upstream `opencode-ai` npm | ~120–200 MB | Same Bun runtime; functionally equivalent |

**Key caveats:**
- `bun dev` is **not** a production build. It runs source TypeScript directly with Bun's JIT, which uses more RAM and CPU than the compiled binary.
- The `--single` binary is a Bun bytecode bundle — startup is fast (~200ms) and memory is comparable to the published npm package.
- **No guaranteed identical performance** between `bun dev` and the built binary. For benchmarking or profiling, always use the built binary.
- The subagent recovery patches (watchdog fiber, softCancel, timeout guard) add a constant ~1–2 MB RSS overhead per active session — negligible in practice.

---

## 6. Performance Equivalence Checklist

Run this after each rebuild to confirm no regression:

```bash
# 1. Startup time
time ./packages/opencode/dist/opencode-darwin-arm64/bin/opencode --version

# 2. Memory baseline (idle server)
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode serve &
SERVER_PID=$!
sleep 3
ps -o rss= -p $SERVER_PID | awk '{printf "RSS: %d MB\n", $1/1024}'
kill $SERVER_PID

# 3. Test suite
cd packages/opencode && bun test 2>&1 | tail -5
```

**Thresholds (fail if exceeded):**
- Startup: < 500ms
- Idle RSS: < 300 MB
- Test suite: 0 failures

---

## 7. Subagent Recovery Feature Flags

The new watchdog/timeout behavior is always-on. Config lives in:
```
packages/opencode/src/config/task-timeout.ts
```

To tune timeouts without rebuilding, set env vars (future work — currently hardcoded defaults):
- `executionTimeoutMs`: 300,000 ms (5 min)
- `staleHeartbeatTimeoutMs`: 120,000 ms (2 min)
- `softCancelGraceMs`: 30,000 ms (30 sec)
- `watchdogIntervalMs`: 15,000 ms (15 sec)
