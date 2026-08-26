# OtoClaw — Project Plan

> An **open-source, fully local, autonomous agent platform**. Multi-model brain,
> sub-agent orchestration, its own terminal and a *real* native app, a browser
> extension, a live animated mascot, and a human-like planning/judgment loop.
> No cloud, no lock-in, source open.

- **Status:** v0 — Plan & Roadmap
- **Last updated:** 2026-08-26
- **Name:** OtoClaw
- **Mascot reference:** `assets/otoclaw-mascot-states.png`
- **Deep technical spec:** [`ARCHITECTURE.md`](ARCHITECTURE.md) — engineering-level detail
  (package tree, daemon protocol, provider/agent interfaces, permission rules, sub-agent
  bus, skill format, mascot state machine, extension internals, security, testing, and a
  phase-by-phase task breakdown).

---

## 1. What we are building — the pillars

OtoClaw's edge is not a single feature; it is these capabilities combined in one
**local, open** system:

1. **Multi-model brain** — OpenRouter, Anthropic, OpenAI, Google Gemini, NVIDIA NIM
   and local LLMs behind one interface. Models can debate each other and pick the
   best answer (a "model council").
2. **Sub-agent orchestration** — the main agent autonomously spawns sub-agents;
   these research on Google and across websites, run in parallel, and merge results.
3. **Manual & Auto modes** — in Manual you approve every step; in Auto the agent runs
   freely without asking. Per-tool permission policies (allow / ask / deny).
4. **Terminal + native app** — a bespoke terminal and a *real* native desktop app
   built with **Flutter — no Chromium**. A live animated mascot reacts while it works.
5. **Deep integrations** — Blender modeling, Unity game dev, GitHub, YouTube, and a
   custom Google browser extension that operates Gmail/Calendar and tests the sites
   it builds.
6. **Codes with design skills** — we load **10–15 design skills** into OtoClaw; the
   agent uses them while coding UI to produce polished, non-templated interfaces.
7. **Self-extending (auto skill acquisition)** — if a needed skill is missing, OtoClaw
   finds it online, downloads and installs it after user approval — without blocking.
8. **Sees your screen** — screen reading / vision so it can look at what you see and
   reason about it.
9. **Human-like judgment** — a planning + self-critique loop that can tell good from
   bad with a "human eye" and act on that taste.
10. **Asks you questions (with buttons)** — OtoClaw can ask you back, and it does so
    through button-based prompts, not free-text guessing.

---

## 2. Autonomous workflow — how OtoClaw runs a job

By default the agent drives a full, human-like pipeline end-to-end:

```
Task intake → Planning → Split work to the right places →
Auto-create sub-agents & brief them on exactly what to do →
Coding → Testing → Debugging → (self-review) → Deliver
```

- **Task intake** — understand the request; ask a clarifying question (button-based,
  see §8) only when genuinely blocked.
- **Planning** — break the goal into concrete steps.
- **Routing** — assign each step to the right place (a tool, an integration, a sub-agent).
- **Sub-agent creation** — spawn sub-agents automatically and hand each a precise brief.
- **Coding → Testing → Debugging** — implement, run it, find and fix the failures.
- **Self-review** — evaluate the result before delivering (see §3).

### Human-like judgment (taste loop)

We build a **human-like thinking structure**: OtoClaw should distinguish what it likes
from what it doesn't — inspect the result with a "human eye" and say plainly *"this is
great"* or *"this is bad,"* then act on that verdict (redo, refine, or ship). This taste
loop sits on top of the coding pipeline and is what turns "working" output into "good"
output. It pairs directly with the design skills in §9.

---

## 3. Mascot & animation system

OtoClaw ships with a bespoke mascot: a **cube-headed robot** — a cream/white rounded
cube head, two glowing vertical-bar eyes, a small antenna, and dark stubby arms and legs
(see `assets/otoclaw-mascot-states.png`).

**Hard requirement:** the mascot animates with **smooth, video-like motion** — real
fluid animation, **not** a swap of static images. The mascot appears in **both the
terminal and the native app**, and plays the state that matches what the agent is doing.
For example, while it is reasoning it plays the **Thinking** animation.

### The ten states

| # | State | Plays when | Motion |
| --- | --- | --- | --- |
| 1 | **Thinking** | reasoning / planning | thought bubble with pulsing "…", gentle idle sway |
| 2 | **Coding** | writing code | typing on a laptop, code streaming on screen |
| 3 | **Analyzing** | reading / analyzing | moving magnifying glass, "?" bubble |
| 4 | **Planning** | task planning | checklist items ticking one by one |
| 5 | **Building structure** | scaffolding / architecture | node/flow diagram drawing & connecting |
| 6 | **Working in terminal** | running shell / terminal | green terminal text scrolling |
| 7 | **Using a tool** | tool call | wrench / holding a glowing pulsing cube |
| 8 | **Waiting for permission** | manual approval / install approval | shield glowing, expectant pose |
| 9 | **Task complete** | success | big green check pop with sparkle |
| 10 | **Presenting result** | delivering final answer | speech bubble, steaming coffee mug |

### How we render smooth motion

- **Native app (Flutter):** use a vector/rig animation format (Rive or Lottie) so each
  state is a true animated clip, GPU-smooth. State changes cross-fade.
- **Terminal:** terminals can't play video natively. Approach: use an image-capable
  terminal protocol (Kitty / iTerm2 inline images, or sixel) to play a compact animated
  loop; fall back to a crafted pixel/ASCII animation where the terminal lacks image
  support. Either way the motion must read as fluid, not a slideshow.

---

## 4. Design layer — an agent that codes *with taste*

OtoClaw does not just write working code; it writes **beautiful** code. We install
**10–15 design skills** (frontend aesthetics, typography & layout, motion, design
systems, data viz, brand kit, and more). When the agent codes a UI, it loads the
relevant skill first, then codes under its guidance.

- **Architecture placement:** design skills are packaged as **tools/MCP entries**. The
  agent detects the task type, loads the right skill, and produces.
- **User-controllable:** users can add or remove their own skills.
- **Ties into §7:** if a required design skill isn't installed, the acquisition flow can
  fetch it.

---

## 5. Skill acquisition — self-extending, non-blocking

When a task needs a skill that OtoClaw doesn't have:

1. It **searches the internet** for that skill.
2. It **prepares to download & install** it — but **asks the user for approval first**
   (button-based prompt, see §8). Installing third-party code is a sensitive action.
3. **It does not sit idle waiting.** While the approval is pending, OtoClaw keeps doing
   the other work it can do **in the background**, and applies the new skill once the
   user approves.

This makes the agent self-extending without ever installing unknown code silently.

---

## 6. Screen reading & vision

OtoClaw can **read your screen** — capture what's on your display and reason about it
(read a UI, spot an error dialog, compare a design to the running app, follow along with
what you're looking at). This feeds the human-like judgment loop (§2) and the browser
testing flow (§7).

---

## 7. Browser extension — "OtoClaw Bridge"

A custom **MV3 browser extension** that lets the agent operate a real, logged-in browser.

- **API-less Google automation:** through the extension, OtoClaw operates **Gmail,
  Calendar and other Google services automatically without their APIs** — by driving the
  real signed-in session in the browser (read mail, create events, etc.).
- **Site building & testing:** open the site OtoClaw just coded, click through it, fill
  forms, and verify it works.
- **Its own on-screen mouse:** when the agent acts in the extension it has **its own
  mouse cursor** and clicks around with it. The cursor is **orange and slightly larger**
  than normal, so you can always see what the agent is doing.
- **Screenshots + screen reading** (§6) close the loop: act → look → judge → act again.

> Note: API-less automation is powerful but more fragile than official APIs (page changes
> can break selectors). We keep official OAuth as a fallback path where reliability
> matters.

---

## 8. Interactive questions — OtoClaw asks *you* (with buttons)

OtoClaw can ask the user questions, and it always asks through **button-based prompts**
(pick an option), not free-text it has to guess at.

**Worked example — "deploy to production on Vercel":**
When you say *"OtoClaw, deploy this to production on Vercel,"* it should **ask first**,
with buttons:

> **How should I deploy?**  → **[ Web ]**  **[ CLI ]**

and then proceed with the chosen path. In **Auto mode the terminal/CLI path is used**
(no manual web clicking). This "ask with buttons, then act" pattern is the standard way
OtoClaw resolves any decision it can't safely assume.

---

## 9. Architecture — one brain, many clients

The core is a **locally-running daemon** (Bun / TypeScript). The terminal, the native
app, and the browser extension are all **clients** of this daemon, talking over
localhost via **WebSocket / JSON-RPC**. One engine, zero code duplication.

```
        CLIENTS
  ┌───────────────┬───────────────┬────────────────────┐
  │ Terminal (CLI)│  Native App   │ Browser Extension  │
  │ Ink TUI +     │ Flutter +     │ OtoClaw Bridge     │
  │ mascot        │ mascot (Rive) │ (MV3, orange mouse)│
  └───────┬───────┴───────┬───────┴─────────┬──────────┘
          │        localhost · WS / JSON-RPC │
          ▼                                  ▼
  ┌──────────────────────── OtoClaw Daemon (CORE) ───────────────────────┐
  │  Task pipeline (intake→plan→route→subagents→code→test→debug) ·       │
  │  Judgment/taste loop · Permission engine · Session manager ·         │
  │  Sub-agent orchestrator · Skill acquirer · Screen/vision · Context   │
  └──────────────┬───────────────────────────────┬──────────────────────┘
                 ▼                                ▼
      PROVIDER LAYER                    TOOL / INTEGRATION BUS (MCP)
   OpenAI-compatible adapter →       fs · shell · git · web · vision ·
   OpenRouter, NIM, Ollama,          Blender · Unity · GitHub · YouTube ·
   LM Studio; + Anthropic, Gemini    Google-via-extension · design skills
```

**Key decision:** model every integration as an **MCP** tool/server. Adding a capability
becomes "plug in a new box," not "change the core."

---

## 10. Operating modes — you stay in control

| Mode | Default | Behavior |
| --- | --- | --- |
| **Manual** | safe | Agent pauses before every tool call and asks for approval. Shows what it will do first. |
| **Auto** | fast | Agent runs end-to-end without asking. Per-tool allow/ask/deny lists. Optional sandbox. Uses the CLI path for actions like Vercel deploy. |

Even in Auto mode, OtoClaw may still ask a **button-based question** (§8) when a decision
is genuinely ambiguous or irreversible — but it never blocks idly (§5).

---

## 11. Model providers — multi-model from day one

API keys are stored **locally, encrypted in the OS keychain**. Because most providers are
OpenAI-compatible, a single adapter covers many.

| Provider | Kind |
| --- | --- |
| OpenRouter | OpenAI-compatible |
| Anthropic | dedicated adapter |
| OpenAI | native format |
| Google Gemini | dedicated adapter |
| NVIDIA NIM | OpenAI-compatible |
| Ollama | local LLM |
| llama.cpp / LM Studio | local LLM |
| Claude Code / Codex CLI | local delegate |

**Model council:** a task is sent to N models, they critique each other, and a judge model
picks the best output — or auto-route by task type + cost. If `claude` or `codex` CLI is
installed, heavy coding work can be delegated to them.

---

## 12. Website & distribution

- OtoClaw has **its own website**, and the app is **downloaded from that site**.
- **The website itself will be built with OtoClaw** (dogfooding — the agent codes its own
  download site).
- Distribution: Bun single-binary + npm global for the CLI; Flutter native installers for
  the desktop app, all offered from the site.

---

## 13. Roadmap — build in phases

The scope is large. The discipline is finishing a solid core **before** integrations.
Each phase lists what it **delivers** and what is explicitly **out of scope**.

### Phase 0 — Foundations
- **Delivers:** Bun-workspaces monorepo, shared types, config schema, daemon skeleton,
  WS protocol, provider interface.
- **NOT in this phase:** no real model calls, no UI, no tools — only skeleton & contracts.

### Phase 1 — Terminal + Agent core  ⭐ FIRST TARGET / MVP
- **Delivers:** setup wizard, API key storage, multi-model, the autonomous pipeline
  (intake→plan→route→code→test→debug) for a single agent, file/shell/code tools, manual &
  auto modes, permission engine, streaming, button-based questions, slash commands
  (`/model`, `/mode`, `/help`, `/cost`, `/clear`), a first mascot animation in the terminal.
- **NOT in this phase:** no sub-agents, no GUI, no browser extension, no screen reading,
  no skill acquisition, no Blender/Unity, no model council.

### Phase 2 — Sub-agents, judgment & self-extension
- **Delivers:** role-based sub-agent spawning (researcher / coder / test) with auto-briefing,
  web research, **human-like judgment/taste loop**, **skill acquisition** (find→approve→
  install, non-blocking), design skills online, model council/debate, MCP client host.
- **NOT in this phase:** still no native app and no browser extension — all terminal.
  Google/Blender/Unity in Phase 5.

### Phase 3 — Native Flutter app + full mascot
- **Delivers:** app that launches the daemon as a sidecar; **all 10 mascot states as smooth
  Rive/Lottie animations**, terminal widget (xterm.dart), permission dialogs, model/cost/
  agent panels, button-based question UI.
- **NOT in this phase:** no new agent capability — the GUI is the face of the existing core.
  Installers in Phase 6.

### Phase 4 — Browser extension (OtoClaw Bridge) + screen vision
- **Delivers:** MV3 extension + native messaging, **API-less Google automation** (Gmail/
  Calendar via the real session), site building & testing, **its own orange, larger mouse
  cursor**, **screen reading / vision**.
- **NOT in this phase:** no reliance on official Google APIs here — those stay a fallback.

### Phase 5 — Big integrations
- **Delivers:** Blender (MCP), Unity (MCP), GitHub, YouTube, and official Google OAuth as a
  reliability fallback; local CLI delegation.
- **NOT in this phase:** no writing every integration from scratch — connect ready-made MCP
  servers wherever possible.

### Phase 6 — Website, packaging & open-source launch
- **Delivers:** **the OtoClaw download website (built with OtoClaw)**, install scripts
  (Bun single binary + npm global), Flutter native installers, plugin system, security
  review, license, docs, community.
- **NOT in v1 scope:** no mobile app, no hosting/cloud sync, no team/multi-user features.

### Experimental / future — Robotic embodiment
- **Idea:** if physical **robot hands/arms** are connected, OtoClaw can control them.
- **Status:** **out of v1 scope — we cannot test it yet** because we don't have the hardware.
  Designed as a future MCP "actuator" tool so it can slot in later without core changes.

---

## 14. Technology stack — decided choices

| Layer | Choice | Why |
| --- | --- | --- |
| Core / daemon | TypeScript · Bun | Best AI/MCP ecosystem, fast iteration, single-binary compile. |
| Terminal UI | Ink (React-for-CLI) | Rich, component-based TUI; ideal for streaming + live state + mascot. |
| Protocol | JSON-RPC / WebSocket | localhost; all clients share the same core. |
| Native app | Flutter · xterm.dart | Truly native, Skia rendering — **no Chromium**. |
| Mascot animation | Rive / Lottie (app), inline-image protocol / pixel anim (terminal) | Smooth, video-like motion across both surfaces. |
| Integration bus | MCP (Model Context Protocol) | Blender/Unity/GitHub/skills — one uniform tool interface. |
| Design layer | 10–15 design skills | Loaded while coding UI → polished, non-templated interfaces. |
| Skill acquisition | web fetch + approval-gated installer | Self-extending without silent third-party code. |
| Screen vision | OS screen capture + a vision-capable model | "See the screen" and reason about it. |
| Browser | MV3 extension (API-less Google) + Playwright | Real signed-in session + headless automation; orange virtual cursor. |
| Local LLM | Ollama · llama.cpp · LM Studio | OpenAI-compatible; single adapter. |
| Secrets | OS keychain (keytar) | API keys local & encrypted — nothing to the cloud. |

---

## 15. Risks & firm decisions

- ⚠️ **Scope is huge.** → Strict phasing. Don't build integrations before the core; keep
  the MVP (Phase 1) small and solid.
- ⚠️ **Auto-mode safety.** Unapproved arbitrary shell = danger. → Tool allow-lists,
  optional sandbox, locks on dangerous command patterns.
- ⚠️ **Skill acquisition = running unknown code.** → Always approval-gated (§5), sandbox
  the install, prefer signed/known sources.
- ⚠️ **API-less Google automation is fragile.** Page changes break selectors. → Keep
  official OAuth as a fallback; add self-healing selectors.
- ⚠️ **Smooth mascot in the terminal is non-trivial.** → Use image-capable terminal
  protocols with a crafted pixel/ASCII fallback; never ship a slideshow.
- ✅ **Everything as MCP.** Big win: lowers integration cost; ready-made servers exist for
  Blender/Unity.
- ✅ **"No Chromium" satisfied.** Flutter renders itself with Skia (Tauri would use WebView2/
  Chromium on Windows).
- 🔬 **Robot hands = experimental.** Untestable without hardware; kept as a future actuator
  MCP tool, out of v1.

---

## 16. Next steps — starting Phase 0 + Phase 1

1. **Monorepo skeleton:** Bun workspaces — `core / providers / tools / cli / shared / daemon`.
2. **Provider interface + first 2 adapters:** OpenAI-compatible (OpenRouter/NIM/Ollama) and
   Anthropic.
3. **Autonomous pipeline (single agent):** intake→plan→route→code→test→debug, with file
   read/write + shell tools.
4. **Permission engine + manual/auto switch**, button-based question prompt, and
   `/model · /mode · /help` slash commands.
5. **Setup wizard:** pick provider → API key → default model → mode.
6. **First terminal mascot loop** (Thinking + Coding states) to prove the animation pipeline.

### Open questions to resolve

- License preference? (MIT / Apache-2.0.)
- First target OS: Windows-first, or cross-platform from the start?
- "Model council/debate" in the MVP, or Phase 2? (Recommendation: Phase 2.)
- Sandbox in Auto mode: mandatory or optional?
- Mascot animation format: **Rive** (interactive, tiny, state-machine driven — recommended)
  vs **Lottie** (After-Effects export, easier to source)?

---

*OtoClaw · open-source autonomous agent · plan document · 2026-08-26*
