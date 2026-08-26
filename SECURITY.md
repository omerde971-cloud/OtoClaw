# Security

OtoClaw is local-first, but Auto mode runs real commands and touches real
credentials — "local" does not mean "unguarded". This document summarizes the
security model; the authoritative source is
[`ARCHITECTURE.md`](ARCHITECTURE.md) §18.

## Security model

- **Loopback + token daemon.** The daemon binds `127.0.0.1` only — it is never
  reachable from the network. Clients authenticate with a token read from
  `daemon.json`, which is written `chmod 0600`.
- **Secrets live in the OS keychain**, never on disk in plaintext and never in
  `config.json`. Secrets are redacted before being written to logs.
- **Sandboxed execution in Auto mode.** Shell/tool execution is constrained:
  working-directory jail, no `sudo`, scrubbed environment, and optionally a
  container or limited-user sandbox (`sandbox.auto`). `sandboxRequired` is a
  hard invariant enforced by the permission engine
  (`packages/permission/src/engine.ts`) whenever `mode === "auto"` — it is
  never toggled off by policy or config.
- **Danger-matcher.** Destructive/exfiltration command patterns are
  hard-blocked even in Auto mode and escalate to a button-based confirmation
  question instead of running silently
  (`packages/permission/src/danger-matcher.ts`).
- **Skill/MCP installation is approval-gated**, source-verified, and
  sandbox-first (`ARCHITECTURE.md` §11) — nothing installs itself without the
  user confirming.
- **The browser extension** talks to the daemon only via native messaging, is
  origin-locked, and performs API-less automation strictly as the
  already-logged-in user — it does not hold or forward separate credentials.
- **Screen vision** is local-only, permission-gated per use, and ephemeral —
  captures are not persisted beyond the request that needed them.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability
while this repository is not yet public — use GitHub Security Advisories
(`Security` → `Report a vulnerability`) on this repo once available, or:

> **[PLACEHOLDER: a real security-contact address/process must be added here
> before this project accepts outside security reports.]**

Until that contact is in place, treat any suspected vulnerability as
unreported and do not disclose it publicly.

When reporting, include:

- The affected package/component (e.g. `packages/permission`,
  `packages/daemon`, `apps/extension`).
- Steps to reproduce, and the security property that's violated (e.g.
  "danger-matcher pattern bypassed", "secret written to plaintext log").
- Whether the issue requires Auto mode, a specific permission policy, or
  local network access to trigger.

We will acknowledge reports and coordinate a fix and disclosure timeline
before any public write-up.
