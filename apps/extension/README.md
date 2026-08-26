# OtoClaw Bridge (Chrome extension)

An MV3 Chrome extension that lets the OtoClaw daemon drive your real, signed-in Chrome —
Gmail/Calendar automation, DOM automation, and an orange virtual cursor you can watch act
(`src/adapters/google.ts`, `src/content/dom-automation.ts`, `src/content/cursor-overlay.ts`).

Chrome cannot load the TypeScript sources in `src/` directly, and cannot spawn a native
messaging host that is a `.ts` file — both need a real build step first. This doc walks
through building both pieces and wiring them together.

## 1. Build the extension

```
cd apps/extension
bun install
bun run build.ts
```

This bundles `src/background/service-worker.ts` and `src/content/bootstrap.ts` into plain
JS with [`Bun.build()`](./build.ts) and writes a matching `manifest.json`, all into
`apps/extension/dist/`. That `dist/` folder is a complete, loadable extension — the paths
inside `dist/manifest.json` are relative to `dist/` itself, not to `apps/extension/`.

Re-run `bun run build.ts` any time you change the extension's source; it's a clean rebuild
(it wipes and recreates `dist/`) so there's nothing to undo between runs.

## 2. Build the native messaging host

```
cd apps/extension/native-host
bun install
bun run build.ts
```

This compiles `native-host/src/main.ts` into a standalone executable at
`native-host/dist/otoclaw-bridge.exe` via `bun build --compile`. Chrome's native messaging
API spawns the host's `path` directly (no shell, no interpreter lookup), so it has to be a
real `.exe` — it can't point at a `.ts`/`.js` file or a `bun run` command.

## 3. Load the extension into Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `apps/extension/dist/` (the folder from step 1, not
   `apps/extension/` itself).
4. The extension card now shows an **ID** — a 32-character string like
   `abcdefghijklmnopqrstuvwxyzabcdef`. Copy it; you need it in the next step.

## 4. Register the native host with Chrome

Chrome only allows a native messaging host to talk to extension IDs listed in the host
manifest's `allowed_origins` — and the ID is only known once Chrome assigns it in step 3.
Run the install script with the ID you just copied:

```
cd apps/extension
bun run scripts/install-native-host.ts <extensionId>
```

This writes `~/.otoclaw/native-messaging-host-manifest.json` (pointing at the `.exe` from
step 2) and registers it under
`HKCU\Software\Google\Chrome\NativeMessagingHosts\com.otoclaw.bridge` in the Windows
registry — a per-user key, not a system-wide install. Re-run this script (with the new ID)
any time you reload the extension somewhere the ID changes, e.g. a fresh unpacked load in a
different Chrome profile.

Windows only today — the script exits with an error on other platforms.

## 5. Start the OtoClaw daemon

The native host connects to the daemon over `~/.otoclaw/daemon.json` (written by the daemon
on startup) and a local WebSocket. Make sure the daemon is running before the extension
tries to use it — e.g. `otoclaw` or `otoclaw-daemon` (whichever compiled binary or dev
command your checkout uses; see the root `README.md`/`scripts/build-binary.ts`).

## 6. Test it

1. Open `https://mail.google.com` in a signed-in tab. You should see a small orange arrow
   cursor overlay mount on the page (`src/content/cursor-overlay.ts`) — that's the content
   script confirming it loaded.
2. Check `chrome://extensions` → OtoClaw Bridge → **service worker** (Inspect views) for
   background-script console errors if the native connection doesn't come up.
3. Drive an action from the daemon (e.g. a `browser.act` click/type request) and watch the
   orange cursor move and click on the page.

## Rebuilding after changes

Whenever you edit anything under `src/`, re-run `bun run build.ts` and reload the extension
in `chrome://extensions` (the reload icon on its card). Extension IDs for unpacked loads are
stable across reloads on the same machine/profile as long as the path to `dist/` doesn't
move, so step 4 usually doesn't need repeating after a rebuild — only after loading into a
new/different Chrome profile or machine.

If you edit `native-host/src/`, re-run `bun run build.ts` in `native-host/` — the registered
host manifest already points at the resulting `.exe` path, so no re-registration is needed
unless you move the checkout.

## Periodic inbox checks ("check my inbox every 15 minutes")

OtoClaw does not run a built-in cron/watcher for this — the daemon already runs 24/7 and
executes every `message.send` task as "submit and forget" (see `packages/daemon/src/server.ts`'s
`runMessage`: the task keeps running to completion even if nothing is listening), so a
"check my inbox periodically" behavior is just an external scheduler calling `message.send`
on a timer with a task like *"gelen kutumu kontrol et, yeni mailleri özetleyip taslak cevap
hazırla"*. The planner turns that into `browser.act` calls (`gmailReadInbox` then one
`gmailComposeDraft` per new email — see `packages/agent/src/planner.ts`), and whether a
prepared draft is ever actually sent (`gmailSendDraft`) is gated by the permission engine:
in Manual mode it always asks; in Auto mode it follows your `browser` permission policy
(default `ask`; set it to `always` in `.otoclaw/policy.json` or global config if you want
fully autonomous sending).

Use [`scripts/watch-inbox.ps1`](../../scripts/watch-inbox.ps1) as the thing your scheduler
calls — it's a one-shot script that opens the daemon's WebSocket, submits the task, and
exits (the daemon does the actual work in the background):

```powershell
pwsh -File scripts/watch-inbox.ps1 -Cwd "C:\path\to\your\project"
```

To run it every 15 minutes on Windows via Task Scheduler:

1. Open **Task Scheduler** → **Create Task…** (not "Basic Task", so you get the full trigger
   options below).
2. **General** tab: name it e.g. `OtoClaw Inbox Watch`; check **Run whether user is logged on
   or not** if you want it to fire even when locked.
3. **Triggers** tab → **New…** → **Begin the task: On a schedule** → **Repeat task every:**
   `15 minutes`, for a duration of `Indefinitely`.
4. **Actions** tab → **New…** → **Action: Start a program**:
   - **Program/script**: `pwsh.exe` (or `powershell.exe`)
   - **Add arguments**: `-File "C:\path\to\otoclaw\scripts\watch-inbox.ps1" -Cwd "C:\path\to\your\project"`
5. Save. Make sure the OtoClaw daemon (step 5 above) is already running and stays running —
   the task only *queues* the check; it doesn't start the daemon itself.

This is deliberately just an external trigger — no new scheduling system was added to
OtoClaw. Any other scheduler (a Linux `cron` entry calling the same `message.send` RPC, a
`launchd` plist, etc.) works the same way.
