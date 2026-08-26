# OtoClaw — Architecture & Engineering Spec

Deep technical companion to [`OTOCLAW_PLAN.md`](OTOCLAW_PLAN.md). This document is the
"how," at the level a developer can start building from. Everything here is **local-first**
and **open-source**.

- **Last updated:** 2026-08-26
- **Core runtime:** TypeScript on **Bun**
- **Clients:** Terminal (Ink) · Native app (Flutter) · Browser extension (MV3)
- **Transport:** JSON-RPC 2.0 over a local WebSocket
- **Integration model:** everything is an **MCP** tool/server where possible

---

## Table of contents

1. System overview
2. Repository & package layout
3. The daemon & its protocol (JSON-RPC methods + event stream)
4. Configuration & storage
5. Provider layer (multi-model)
6. The agent loop (intake → plan → route → code → test → debug)
7. Tool system (built-in tools)
8. Permission engine
9. Sub-agent orchestration
10. Judgment / taste loop
11. Skill system & auto-acquisition
12. MCP host
13. Mascot state machine & rendering
14. Browser extension ("OtoClaw Bridge")
15. Screen vision
16. Interactive questions (button prompts)
17. Slash commands (full reference)
18. Security model
19. Testing & CI
20. Observability & errors
21. Phase-by-phase task breakdown
22. Glossary

---

## 1. System overview

```
                         ┌──────────────────────────────────────┐
   Terminal (Ink) ─────► │                                      │
   Native app (Flutter) ►│   OtoClaw Daemon  (Bun, localhost)   │
   Browser extension ───►│   JSON-RPC 2.0 over WebSocket        │
                         │                                      │
                         │   ┌────────────┐   ┌──────────────┐  │
                         │   │ Agent core │   │ Provider hub │──┼──► OpenRouter / Anthropic
                         │   │ (pipeline) │   └──────────────┘  │    OpenAI / Gemini / NIM
                         │   ├────────────┤   ┌──────────────┐  │    Ollama / llama.cpp
                         │   │ Permission │   │ MCP host     │──┼──► Blender / Unity / GitHub
                         │   ├────────────┤   ├──────────────┤  │    design skills / …
                         │   │ Sub-agents │   │ Built-in     │  │
                         │   ├────────────┤   │ tools        │  │
                         │   │ Judgment   │   └──────────────┘  │
                         │   ├────────────┤                     │
                         │   │ Skills +   │   ┌──────────────┐  │
                         │   │ acquirer   │   │ Session store│──┼──► ~/.otoclaw (SQLite + files)
                         │   └────────────┘   └──────────────┘  │
                         └──────────────────────────────────────┘
```

**One brain, many faces.** The daemon owns all state and logic. Clients are thin: they
render, capture input, and stream events. This is why terminal and app never diverge.

---

## 2. Repository & package layout

Monorepo with **Bun workspaces**. Packages are small and single-purpose.

```
otoclaw/
├── package.json                # workspaces root
├── bunfig.toml
├── tsconfig.base.json
├── packages/
│   ├── shared/                 # types + protocol schema, imported everywhere
│   │   ├── src/protocol.ts     # JSON-RPC method & event types
│   │   ├── src/config.ts       # config schema (zod)
│   │   └── src/domain.ts       # Task, Session, Message, ToolCall, Verdict…
│   ├── providers/              # model provider adapters
│   │   ├── src/types.ts        # Provider interface
│   │   ├── src/openai-compat.ts# OpenRouter / NIM / Ollama / LM Studio / OpenAI
│   │   ├── src/anthropic.ts
│   │   ├── src/gemini.ts
│   │   └── src/registry.ts
│   ├── tools/                  # built-in tools (fs, shell, web, git, vision…)
│   │   └── src/*.ts
│   ├── mcp/                    # MCP client host + server hosting
│   ├── skills/                 # skill loader + acquirer + registry
│   ├── agent/                  # the pipeline: planner, router, executor, judge
│   │   ├── src/loop.ts
│   │   ├── src/planner.ts
│   │   ├── src/subagents.ts
│   │   └── src/judge.ts
│   ├── permission/             # permission engine + policy rules
│   ├── vision/                 # screen capture + vision calls
│   ├── daemon/                 # WS server, session store, wiring
│   │   ├── src/server.ts
│   │   ├── src/store.ts        # SQLite (bun:sqlite)
│   │   └── src/main.ts         # entrypoint
│   └── cli/                    # Ink TUI, slash commands, setup wizard, terminal mascot
│       └── src/*.tsx
├── apps/
│   ├── desktop/                # Flutter app (Dart) — sidecar-launches the daemon
│   └── extension/              # MV3 extension + native messaging host
├── skills/                     # bundled design skills (10–15)
├── docs/
└── scripts/                    # build, package (bun compile), installers
```

**Dependency direction:** `shared` ← everything; `agent` depends on `providers`, `tools`,
`mcp`, `skills`, `permission`, `vision`; `daemon` wires them and exposes the protocol;
`cli` and the apps only speak the protocol.

---

## 3. The daemon & its protocol

The daemon is the single source of truth. It listens on `ws://127.0.0.1:<port>` (port
written to `~/.otoclaw/daemon.json` with a random auth token). All clients authenticate
with the token on connect; remote connections are refused (loopback only).

### 3.1 Transport

- **JSON-RPC 2.0.** Client→daemon **requests** get responses; daemon→client **notifications**
  form the event stream (streaming tokens, tool events, mascot state, questions).
- One WebSocket per client; multiple clients can attach to the same session (e.g. terminal
  and app showing the same run).

### 3.2 Request methods (client → daemon)

| Method | Params | Returns |
| --- | --- | --- |
| `session.create` | `{cwd, mode}` | `{sessionId}` |
| `session.list` / `session.get` | `{}` / `{sessionId}` | session summaries |
| `message.send` | `{sessionId, text, attachments?}` | `{messageId}` (streams via events) |
| `run.cancel` | `{sessionId}` | `{ok}` |
| `mode.set` | `{sessionId, mode:"manual"\|"auto"}` | `{ok}` |
| `permission.respond` | `{requestId, decision:"allow"\|"deny"\|"always"\|"never"}` | `{ok}` |
| `question.respond` | `{questionId, optionId, freeText?}` | `{ok}` |
| `model.set` | `{sessionId, model}` | `{ok}` |
| `model.list` | `{}` | available models per provider |
| `skill.list` / `skill.install` | … | skill registry ops |
| `config.get` / `config.set` | … | config |
| `provider.addKey` | `{provider, key}` | stores in OS keychain |

### 3.3 Event notifications (daemon → client)

| Event | Payload | Meaning |
| --- | --- | --- |
| `stream.delta` | `{sessionId, text}` | streaming assistant tokens |
| `pipeline.stage` | `{stage:"intake"\|"plan"\|"route"\|"code"\|"test"\|"debug"\|"review", detail}` | pipeline progress |
| `tool.start` / `tool.end` | `{toolCallId, name, args, result?}` | tool execution |
| `subagent.spawn` / `subagent.update` / `subagent.done` | `{agentId, role, brief, status}` | orchestration |
| `permission.request` | `{requestId, tool, args, risk}` | manual-mode gate |
| `question.ask` | `QuestionSpec` (see §16) | button prompt to the user |
| `mascot.state` | `{state, since}` | drives the animation (see §13) |
| `judge.verdict` | `{target, score, label:"good"\|"bad", notes}` | taste-loop output |
| `cost.update` | `{tokensIn, tokensOut, usd}` | running cost |
| `error` | `{code, message, recoverable}` | surfaced failure |

> **Design note:** the mascot is driven entirely by `mascot.state` events, so terminal and
> app show identical states with zero client-side logic.

---

## 4. Configuration & storage

Everything local, under `~/.otoclaw/`:

```
~/.otoclaw/
├── config.json          # non-secret settings (zod-validated)
├── daemon.json          # runtime: port + auth token (0600)
├── sessions.db          # SQLite: sessions, messages, tool calls, verdicts
├── skills/              # installed skills (bundled + acquired)
├── logs/                # rotating logs
└── cache/               # web fetch cache, vision frames (ephemeral)
```

Secrets (API keys) are **never** in `config.json` — they live in the **OS keychain**
(keytar): Windows Credential Manager / macOS Keychain / libsecret.

**Annotated config (`config.json`):**

```jsonc
{
  "defaultModel": "openrouter/anthropic/claude-sonnet",
  "mode": "manual",                 // "manual" | "auto"
  "providers": {
    "openrouter": { "enabled": true, "baseUrl": "https://openrouter.ai/api/v1" },
    "ollama":     { "enabled": true, "baseUrl": "http://localhost:11434/v1" }
  },
  "permissions": {                   // see §8
    "fs.read":  "allow",
    "fs.write": "ask",
    "shell":    "ask",
    "web.fetch":"allow"
  },
  "sandbox": { "auto": true },       // sandbox tool exec in Auto mode
  "council": { "enabled": false, "voters": 3, "judge": "openai/gpt-…" },
  "mascot":  { "enabled": true, "format": "rive" },
  "skills":  { "autoAcquire": true, "sources": ["registry", "github"] }
}
```

---

## 5. Provider layer

A thin, uniform interface normalizes every backend to the same shape: streaming text +
tool-calling. OpenAI-compatible endpoints share one adapter.

```ts
// packages/providers/src/types.ts
export interface ChatRequest {
  model: string;
  messages: Message[];
  tools?: ToolSchema[];
  temperature?: number;
  signal?: AbortSignal;
}
export interface ChatChunk {
  delta?: string;                 // streamed text
  toolCall?: { id: string; name: string; argsDelta: string };
  usage?: { in: number; out: number };
  done?: boolean;
}
export interface Provider {
  id: string;                     // "anthropic" | "openai-compat" | "gemini"
  listModels(): Promise<ModelInfo[]>;
  chat(req: ChatRequest): AsyncIterable<ChatChunk>;   // always streaming
  capabilities(model: string): { tools: boolean; vision: boolean; ctx: number };
}
```

**Coverage:**

| Adapter | Backends | Notes |
| --- | --- | --- |
| `openai-compat` | OpenRouter, NVIDIA NIM, Ollama, LM Studio, OpenAI | one code path; per-backend `baseUrl` |
| `anthropic` | Anthropic | native tool-use + streaming |
| `gemini` | Google Gemini | maps function-calling to the common `ToolSchema` |
| `cli-delegate` | local `claude` / `codex` | spawns the CLI, treats it as a sub-agent/tool |

The **registry** resolves a `"provider/model"` string, picks the adapter, and injects the
keychain key. Vision-capable models are flagged so §15 can route screen frames correctly.

---

## 6. The agent loop

The pipeline is explicit, observable (`pipeline.stage` events), and the same in both modes;
modes only change *whether it pauses for permission*.

```
intake ─► plan ─► route ─► [execute steps] ─► review ─► deliver
                              │  each step:
                              │   • model turn (may request tools)
                              │   • tool exec (permission-gated)
                              │   • may spawn sub-agents
                              └── code → test → debug sub-cycle
```

**Executor pseudocode:**

```ts
async function runTask(session, userText) {
  emit("pipeline.stage", { stage: "intake" });
  const intake = await intake(session, userText);      // may ask a button question (§16)

  emit("pipeline.stage", { stage: "plan" });
  const plan = await planner(session, intake);         // ordered steps + acceptance checks

  for (const step of plan.steps) {
    emit("pipeline.stage", { stage: "route" });
    const route = router(step);                        // tool? sub-agent? integration?

    if (route.kind === "subagent") { await orchestrate(step, route); continue; }

    // model ⇄ tool loop for this step
    let turn = startTurn(session, step);
    while (true) {
      const chunk = await nextModelChunk(turn);        // streams stream.delta
      if (chunk.toolCall) {
        await requirePermission(chunk.toolCall);       // manual: gate; auto: policy
        const result = await runTool(chunk.toolCall);  // tool.start / tool.end
        feedToolResult(turn, result);
        continue;
      }
      if (chunk.done) break;
    }

    // code → test → debug for code steps
    if (step.kind === "code") await codeTestDebug(step);
  }

  emit("pipeline.stage", { stage: "review" });
  const verdict = await judge(session, plan);          // §10 taste loop
  if (verdict.label === "bad") return runRepair(session, plan, verdict);

  emit("pipeline.stage", { stage: "deliver" });
}
```

**Context management:** rolling window with automatic summarization of older turns; large
tool outputs are stored in the session DB and referenced by handle rather than re-inlined.

**Cancellation:** every model/tool call receives the session `AbortSignal`; `run.cancel`
aborts cleanly and unwinds sub-agents.

---

## 7. Tool system

Tools are typed, permission-tagged units. Built-ins for Phase 1–2:

| Tool | Signature (args) | Permission key | Notes |
| --- | --- | --- | --- |
| `fs.read` | `{path, range?}` | `fs.read` | reads within project by default |
| `fs.write` | `{path, content}` | `fs.write` | shows a diff before applying |
| `fs.edit` | `{path, find, replace}` | `fs.write` | exact-match patch |
| `shell.run` | `{cmd, cwd?, timeout?}` | `shell` | sandbox in Auto mode (§18) |
| `web.search` | `{query}` | `web.fetch` | used by researcher sub-agents |
| `web.fetch` | `{url}` | `web.fetch` | cached in `~/.otoclaw/cache` |
| `git.*` | `{…}` | `shell` | status/diff/commit (opt-in) |
| `vision.screen` | `{region?}` | `vision` | screen capture → model (§15) |
| `ask.question` | `QuestionSpec` | — | button prompt to user (§16) |

Tool results are structured `{ ok, value, error? }`. Each tool declares a JSON schema so any
provider's function-calling can target it.

---

## 8. Permission engine

Central gate between the agent and every side-effecting tool.

- **Policy resolution order:** session override → project `.otoclaw/policy.json` → global
  `config.json` → tool default.
- **Values:** `allow` (run silently), `ask` (prompt, Manual), `deny` (block), plus session
  learnings `always` / `never` (from a prior prompt).
- **Auto mode:** `ask` is auto-resolved by an **allow-list + danger-matcher**. Dangerous
  patterns (`rm -rf`, disk formatting, credential exfiltration, network to unknown hosts,
  `sudo`, mass deletes) are hard-blocked and escalate to a button question even in Auto.

```jsonc
// .otoclaw/policy.json (per project)
{
  "shell": "ask",
  "shell.allow": ["npm *", "bun *", "git status", "git diff", "vercel *"],
  "shell.deny":  ["rm -rf *", "* | sh", "curl * | *"],
  "fs.write": "allow",
  "web.fetch": "allow"
}
```

A `permission.request` event carries a **risk score** so clients can style the prompt
(and the mascot switches to **Waiting for permission**, state 8).

---

## 9. Sub-agent orchestration

The orchestrator spawns sub-agents, briefs each precisely, runs them concurrently, and
merges results.

- **Roles (initial):** `researcher` (web search/fetch), `coder`, `tester`, `reviewer`.
- **Brief:** a structured task `{goal, inputs, constraints, acceptance, budget}` — not a
  vague prompt. Auto-generated by the planner/router.
- **Message bus:** in-process pub/sub keyed by `agentId`; parent aggregates child results,
  handles partial failures (a failed child → `null`, doesn't sink the run).
- **Isolation:** file-mutating sub-agents can run in a **git worktree** so parallel edits
  don't collide; the worktree is discarded if unchanged.
- **Concurrency cap:** `min(cores-2, 8)` by default; excess queued.
- **Budgeting:** each sub-agent gets a token/step budget so a runaway child can't drain the
  session.

```ts
interface SubAgentBrief {
  role: "researcher" | "coder" | "tester" | "reviewer";
  goal: string;
  inputs: Record<string, unknown>;
  constraints: string[];
  acceptance: string[];      // how the parent decides it succeeded
  budget: { tokens: number; steps: number };
}
```

---

## 10. Judgment / taste loop

Turns "working" output into "good" output — the human-eye evaluation.

- **When:** at the `review` stage, and optionally after each significant artifact (a UI, a
  file, a design).
- **How:** a dedicated judge turn scores the artifact against a rubric and returns a
  `Verdict{ score, label:"good"|"bad", notes[] }`. For UI, the rubric pulls criteria from
  the loaded **design skills** (§11) and can use **screen vision** (§15) to look at the
  rendered result.
- **Loop:** `bad` → `runRepair()` with the notes as targeted fixes; re-judge; cap the loop
  (e.g. 2 repair rounds) to avoid thrashing, then surface a button question if still bad.
- **Diversity option:** in council mode, N judges with different lenses (correctness /
  aesthetics / does-it-run) vote; majority decides.

Every verdict is emitted (`judge.verdict`) and stored, so the user sees *why* something was
accepted or redone.

---

## 11. Skill system & auto-acquisition

A **skill** is a packaged instruction set (+ optional assets/tools) the agent loads on
demand — the design skills, and any others.

**Skill format** (folder or single file):

```
skills/frontend-aesthetics/
├── skill.json          # { name, description, triggers[], version, source, tools? }
└── SKILL.md            # the instructions the agent follows
```

**Loading:** the registry indexes `description` + `triggers`; the router loads a skill when
the task matches, then the agent codes under its guidance.

**Auto-acquisition flow (self-extending):**

```
need skill X  ──►  not installed?
     │                   │ yes
     │                   ▼
     │            search sources (registry, GitHub)  ─► candidate found
     │                   │
     │                   ▼
     │            emit question.ask  "Install skill X from <source>?  [Install] [Skip]"
     │                   │
     │   ┌───────────────┴───────────────┐
     │   │ user has NOT answered yet      │  ◄── DOES NOT BLOCK
     │   ▼                                │
     │  keep doing other ready work in    │
     │  the background (other steps/subs) │
     │   └───────────────┬───────────────┘
     │                   ▼ on "Install"
     └─────────►  download → verify → sandbox-install → register → resume the step
```

Key guarantees: **never installs silently** (approval-gated), **never idles** (works other
tasks while waiting), verifies source/signature, installs into a sandbox first.

---

## 12. MCP host

OtoClaw is an **MCP client host**: it connects to external MCP servers and exposes their
tools to the agent through the same tool interface as built-ins.

- **Configured servers:** Blender MCP, Unity MCP, GitHub, YouTube, etc.; plus design skills
  packaged as MCP where useful.
- **Lifecycle:** spawn/attach, health-check, restart on crash; tool schemas fetched on
  demand.
- **Uniformity:** to the agent, an MCP tool and a built-in tool look identical — this is why
  adding integrations rarely touches the core.

---

## 13. Mascot state machine & rendering

The mascot is a **state machine** driven purely by `mascot.state` events from the daemon.

**States & triggers** (see the plan's §3 for the visual list):

| State | Trigger source |
| --- | --- |
| `thinking` | model reasoning / planning stage |
| `coding` | `tool.start` on `fs.write`/`fs.edit`, code steps |
| `analyzing` | reading/searching (`fs.read`, `web.fetch`) |
| `planning` | `pipeline.stage: plan` |
| `building` | `pipeline.stage: route`/scaffolding |
| `terminal` | `tool.start` on `shell.run` |
| `tool` | any other `tool.start` |
| `waiting` | `permission.request` / pending `question.ask` |
| `done` | task success |
| `presenting` | delivering final answer |

**Transitions:** idle→active on stage/tool events; back to `thinking` (idle-sway) between
actions; `done`/`presenting` are terminal for a run. Cross-fade between states.

**Rendering — the "video-like, not slideshow" requirement:**

- **Native app (Flutter):** **Rive** state machine (recommended) — one artboard, inputs map
  1:1 to the states above, GPU-smooth, tiny file, interactive transitions. (Lottie is the
  fallback if we author in After Effects instead.)
- **Terminal:** detect capability and pick the best path:
  1. **Kitty graphics / iTerm2 inline images / sixel** → play a compact animated loop
     (short MP4/GIF frames or a Rive-rendered sprite sheet).
  2. **No image support** → a hand-crafted **pixel/ASCII** animation with real frame
     interpolation (still fluid, never a static swap).
- Assets live in `packages/cli/assets` (terminal) and `apps/desktop/assets` (Rive).

---

## 14. Browser extension — "OtoClaw Bridge"

**Components:**

- **MV3 extension** (content script + background service worker).
- **Native messaging host** — a small local process that bridges the extension to the
  daemon (extensions can't open arbitrary sockets; native messaging is the sanctioned path).

**Capabilities:**

- **API-less Google automation:** operate **Gmail / Calendar / other Google apps** by
  driving the **real signed-in session** — no OAuth, no API keys. The agent reads the DOM,
  clicks, types, and reads results.
- **Site building & testing:** open the site OtoClaw just built, navigate, fill forms, assert
  behavior, capture screenshots.
- **Its own on-screen mouse:** a **virtual cursor rendered by the content script**, **orange
  and slightly larger** than the OS cursor, that visibly moves and clicks so you can watch
  the agent act. (It's a drawn overlay driving synthetic events — the real OS cursor is left
  alone.)
- **Screen reading (§15)** + screenshots close the act→look→judge loop.

**Reliability:** DOM automation is fragile (Google ships UI changes). Mitigations:
resilient/self-healing selectors, retries, and **official OAuth as a fallback path** (Phase 5)
where correctness matters more than "no API."

**Headless variant:** for CI / non-interactive site testing, **Playwright** runs the same
flows without the user's browser.

---

## 15. Screen vision

- **Capture:** OS screen/region capture (native APIs; the extension supplies tab captures).
- **Route:** frames go to a **vision-capable model** (flagged in §5). Used for: reading a UI,
  spotting an error dialog, comparing a design mock to the running app, and feeding the
  taste loop (§10).
- **Privacy:** capture is **local**, ephemeral (`~/.otoclaw/cache`), and gated by permission
  key `vision`; nothing leaves the machine except the explicit model call the user configured.

---

## 16. Interactive questions (button prompts)

OtoClaw asks the user through **structured, button-based** prompts — never silent guessing.

```ts
interface QuestionSpec {
  questionId: string;
  header: string;                 // short chip, e.g. "Deploy target"
  question: string;               // full question
  options: { id: string; label: string; description?: string }[];
  allowFreeText?: boolean;        // "Other"
  multiSelect?: boolean;
}
```

**Canonical example — Vercel production deploy:**

```
question.ask →
  header:   "Deploy target"
  question: "How should I deploy to production on Vercel?"
  options:  [ {id:"web", label:"Web"}, {id:"cli", label:"CLI"} ]
```

- User picks → `question.respond {optionId}` → the agent proceeds on that path.
- **In Auto mode the CLI path is chosen automatically** (terminal-driven), so a hands-off run
  deploys via `vercel` CLI without waiting.
- Clients render this natively: Ink shows a selectable list; the Flutter app shows buttons;
  the mascot switches to **Waiting** (state 8) until answered — but background work continues
  where possible (§11).

---

## 17. Slash commands (full reference)

Typed in the terminal (and mirrored as UI actions in the app).

| Command | Action |
| --- | --- |
| `/model [name]` | show/set the model (`provider/model`) |
| `/mode [manual\|auto]` | show/switch mode |
| `/council [on\|off]` | toggle model debate/voting |
| `/agents` | list running sub-agents + status |
| `/skills [list\|add <x>\|remove <x>]` | manage skills |
| `/mcp [list\|add <server>]` | manage MCP servers |
| `/connect [github\|youtube\|google]` | wire an integration |
| `/permissions` | view/edit the policy |
| `/vision` | capture & attach the screen |
| `/cost` | session token + USD usage |
| `/clear` | clear the conversation/context |
| `/init` | scaffold `.otoclaw/` in the current project |
| `/help` | command help |

---

## 18. Security model

Local-first doesn't mean unguarded — Auto mode runs real commands.

- **Loopback + token:** daemon binds `127.0.0.1` only; clients present the token from
  `daemon.json` (chmod 0600).
- **Secrets in the keychain**, never on disk in plaintext; redacted from logs.
- **Sandboxed exec (Auto):** shell/tool execution constrained (working-dir jail, no `sudo`,
  env scrubbed, optional container/limited-user); toggle via `sandbox.auto`.
- **Danger-matcher:** hard-block destructive/exfil patterns even in Auto; escalate to a
  button question.
- **Skill/MCP install:** approval-gated, source-verified, sandbox-first (§11).
- **Extension:** native-messaging only, origin-locked; API-less automation acts strictly as
  the already-logged-in user.
- **Vision:** local capture, permission-gated, ephemeral.

---

## 19. Testing & CI

- **Unit:** providers (mock streams), permission resolution, planner/router, skill matching.
- **Contract:** golden tests for the JSON-RPC protocol (client/daemon can't drift).
- **Integration:** agent loop against a stub provider; tool exec in a temp sandbox.
- **E2E:** CLI driven headlessly; extension flows via Playwright.
- **CI:** `bun test` + typecheck + lint on push; build the single binary; smoke-run the
  daemon + a scripted session.

---

## 20. Observability & errors

- **Structured logs** (`~/.otoclaw/logs`), rotating, secret-redacted.
- **Event trace:** every run is reconstructable from the `pipeline.stage` / `tool.*` /
  `subagent.*` / `judge.verdict` event stream (stored in `sessions.db`).
- **Errors** are typed `{code, message, recoverable}`; recoverable ones retry with backoff,
  fatal ones surface to the client and stop the run cleanly.
- **Cost meter:** per-turn token accounting → `cost.update`.

---

## 21. Phase-by-phase task breakdown

Rough effort labels: **S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ several weeks (solo).

### Phase 0 — Foundations
- [ ] Monorepo + workspaces + tsconfig + lint/format — **S**
- [ ] `shared`: protocol types, config (zod), domain models — **M**
- [ ] `daemon`: WS server + auth token + session store (SQLite) — **M**
- [ ] Empty provider/tool/agent package skeletons wired — **S**
- **Done when:** a client can connect, create a session, and receive an echo event.

### Phase 1 — Terminal + Agent core (MVP) ⭐
- [ ] `providers`: `openai-compat` + `anthropic`; registry + keychain — **M**
- [ ] `tools`: `fs.read/write/edit`, `shell.run`, `web.fetch` — **M**
- [ ] `agent`: intake→plan→route→execute→review pipeline (single agent) — **L**
- [ ] `permission`: engine + policy files + Auto danger-matcher — **M**
- [ ] `cli`: Ink TUI, streaming, setup wizard, slash commands, button questions — **L**
- [ ] Terminal mascot: **Thinking + Coding** states (prove the pipeline) — **M**
- **Done when:** a usable, multi-model coding agent runs end-to-end in the terminal.

### Phase 2 — Sub-agents, judgment & self-extension
- [ ] `agent/subagents`: roles, briefs, bus, worktree isolation, budgets — **L**
- [ ] Web research (search+fetch) researcher role — **M**
- [ ] `agent/judge`: taste loop + repair rounds — **M**
- [ ] `skills`: loader, registry, matching; design skills bundled — **M**
- [ ] Skill **auto-acquisition** (find→approve→non-blocking→install) — **M**
- [ ] `mcp` client host; connect first external server — **M**
- [ ] Optional: model council/voting — **M**

### Phase 3 — Native Flutter app + full mascot
- [ ] Flutter shell + WS client + sidecar daemon lifecycle — **L**
- [ ] All **10 mascot states** as a Rive state machine — **L**
- [ ] xterm.dart terminal widget, permission dialogs, question buttons — **M**
- [ ] Model / cost / sub-agent panels — **M**

### Phase 4 — Browser extension + screen vision
- [ ] MV3 extension + native messaging host ↔ daemon — **L**
- [ ] **API-less Google automation** (Gmail/Calendar via session) — **L**
- [ ] Site building & testing flows + screenshots — **M**
- [ ] **Orange virtual cursor** overlay + synthetic events — **M**
- [ ] `vision`: screen capture → vision model, wired to taste loop — **M**

### Phase 5 — Big integrations
- [ ] Blender (MCP), Unity (MCP) — **M** each
- [ ] GitHub, YouTube — **M**
- [ ] Official Google OAuth fallback — **M**
- [ ] `cli-delegate` (local claude/codex) — **S**

### Phase 6 — Website, packaging & launch
- [ ] **OtoClaw download site (built with OtoClaw)** — **M**
- [ ] Installers: Bun single binary + npm global; Flutter native installers — **M**
- [ ] Plugin system, security review, license, docs, community — **L**

### Experimental / future — Robotic embodiment
- [ ] Design an **actuator MCP tool** interface (so it slots in later) — **S**
- [ ] Out of v1 — **untestable without hardware.**

---

## 22. Glossary

- **Daemon** — the local Bun process that holds all state/logic; clients attach to it.
- **Client** — terminal, native app, or extension; thin, renders + streams.
- **Pipeline** — intake→plan→route→code→test→debug→review→deliver.
- **Sub-agent** — a spawned worker with a precise brief and a budget.
- **Taste loop** — the judge step that decides good vs bad and triggers repair.
- **Skill** — an on-demand instruction pack (e.g. a design skill); can be auto-acquired.
- **MCP host** — how OtoClaw connects external tool servers uniformly.
- **OtoClaw Bridge** — the browser extension (API-less Google, site testing, orange cursor).

---

*OtoClaw · architecture & engineering spec · 2026-08-26*
