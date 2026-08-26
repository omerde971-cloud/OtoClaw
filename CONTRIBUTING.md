# Contributing to OtoClaw

## Monorepo layout

OtoClaw is a [Bun workspaces](https://bun.sh/docs/install/workspaces) monorepo:

```
packages/*   TypeScript packages: shared, providers, agent, tools, permission,
             daemon, cli, mcp, google, plugins, skills, vision
apps/*       apps/desktop (Flutter, native app), apps/extension (browser
             extension), apps/website (landing page)
```

Package boundaries and the daemon protocol are defined in
[`ARCHITECTURE.md`](ARCHITECTURE.md) §2–§3. Keep new code inside the existing
package it belongs to; don't introduce a new package unless the feature is
genuinely a new boundary.

## Development workflow

```sh
bun install            # install all workspace dependencies
bun run dev             # start the daemon in dev mode
bun run typecheck       # tsc --noEmit across every workspace package
bun run lint             # biome lint .
bun run format           # biome format --write .
bun test                 # bun test across the workspace
```

Before opening a PR, all four of `typecheck`, `lint`, `test`, and (if you
touched build/install tooling) `bun run build:binary` should be clean.

## Adding a new package

Follow the shape of an existing minimal package, e.g. `packages/vision`:

```
packages/<name>/
  package.json     # name: "@otoclaw/<name>", type: "module", exports, a
                    # "typecheck" script ("tsc --noEmit"), workspace:* deps
  src/
    index.ts        # public exports
  test/
    <name>.test.ts   # bun:test
```

- Add the package's real dependencies to `dependencies`, not `devDependencies`,
  if the daemon/CLI imports it at runtime.
- Wire it into `bun run --filter '*' typecheck` / `build` automatically by
  following the standard `package.json` scripts shown above — no root config
  changes are needed for a new workspace member.
- Secrets: never write API keys/tokens to disk in plaintext or to a config
  file — use the OS keychain pattern described in `ARCHITECTURE.md` §4/§18.

## Commit messages

This repo's history follows a `Phase <N><letter>: <summary>` convention (see
`git log`), tracking the phased roadmap in `ARCHITECTURE.md` §21 /
`OTOCLAW_PLAN.md`. For contributions outside that roadmap, use a short
imperative summary line instead, e.g. `Fix: <bug>` or `Add: <feature>`. Keep
the first line under ~72 characters; use the body for the "why" when it isn't
obvious from the diff.

## Pull requests

1. Branch off `main`.
2. Make your change, keeping it scoped — avoid drive-by refactors unrelated
   to the PR's purpose.
3. Run `bun run typecheck`, `bun run lint`, and `bun test` locally; all must
   pass before requesting review.
4. Open the PR with a clear description of what changed and why. Link the
   relevant `ARCHITECTURE.md` section if you're implementing part of the spec.

See [`SECURITY.md`](SECURITY.md) for how to report a vulnerability instead of
filing a public issue.
