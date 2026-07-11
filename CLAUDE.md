# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Package Does

`skrun` is a zero-dependency Node.js CLI that manages AI agent
skills (folders containing `SKILL.md`) across Claude Code, GitHub Copilot, OpenCode, Cursor, and any
agent that reads `SKILL.md` files. It imports skills from git repos or local folders into a
global store (`~/.config/skrun/skills/`), then installs a chosen subset into a project — symlink
or copy — fanned out across whichever agent directories (`.claude`, `.github`, `.opencode`, `.agents`) are
detected, with optional TTL auto-expiry.

## Commands

```bash
# Run without installing
node bin/skrun.js <command>
npm start -- <command>     # equivalent, via the "start" script

# Testing
npm test                                    # node:test, all suites in test/*.test.js
node --test test/install.test.js            # single suite
node --test --experimental-test-coverage test/*.test.js   # with coverage

# Local install (symlinks the repo so `skrun` is on PATH)
npm link
npm unlink -g skrun

# Release (bumps version, see package.json scripts)
npm run release:patch | release:minor | release:major
npm run release:beta | release:beta-bump
npm run publish:dry-run
npm run publish:registry | publish:beta
```

There is no build step, lint script, or typecheck script — plain ESM, run directly by Node.
`prepublishOnly` runs `npm test` before every publish.

## Architecture

### Command Flow

```
bin/skrun.js               shebang entry → src/cli.js run(argv)
  → parseArgs             hand-rolled: positionals + --key=val / --flag
  → ensureConfig()         creates ~/.config/skrun/{skills,registry.json} if missing
  → opportunistic purge    best-effort skrun.purgeExpired() before every command except `purge`
  → dispatch to src/commands/<command>.js (dynamic import per command)
```

Errors thrown by a command handler are caught centrally in `run()`, logged via
`logger.js` (`logError`), printed to stderr, and set `process.exitCode = 1`.

### Package Layout

| Path | Responsibility |
|---|---|
| `bin/skrun.js` | Shebang entry point, imports and calls `src/cli.js` |
| `src/cli.js` | Arg parsing, usage text, command router, top-level error handling |
| `src/config.js` | Resolves `configDir`/`skillsDir`/`registryPath` (XDG-aware), `ensureConfig()` |
| `src/registry.js` | Load/save `registry.json` (installs + history), atomic writes |
| `src/targets.js` | Detects `.claude`/`.github`/`.opencode`/`.agents` in cwd, resolves install targets |
| `src/fsutil.js` | Recursive copy, symlink-or-copy fallback, guarded force-remove |
| `src/tui.js` | Zero-dep raw-mode arrow-key multi-select for `skrun import` |
| `src/skills.js` | Scans the store for `SKILL.md` folders, reads/writes per-skill `skrun.json` tags |
| `src/ttl.js` | Computes TTL expiry, registers the recurring purge scheduler (cron/`schtasks`) |
| `src/logger.js` | Writes to `~/.config/skrun/skrun.log` |
| `src/commands/` | One file per subcommand: `import`, `install`, `uninstall`, `sync`, `list`, `tag`, `purge`, `logs`, `history` |
| `test/*.test.js` | `node:test` suites, one per module, plus `functional.test.js` for end-to-end flows |

### Core Data

- **Global store**: `~/.config/skrun/skills/<skill-id>/` — folder name is the unique skill ID.
- **Per-skill tags**: `<skill-id>/skrun.json` → `{ "tags": ["backend", "testing"] }`.
- **Registry**: `~/.config/skrun/registry.json` → `{ installs: [{skill, projectPath, installedPath, type, ttlExpiresAt}], history: [{action, skill, timestamp, projectPath}] }`.
- **Config root**: `SKRUN_CONFIG_DIR` env var, else `$XDG_CONFIG_HOME/skrun`, else `~/.config/skrun`.

### TTL Auto-Purge

Installing with `--ttl` registers one idempotent recurring scheduler entry (`crontab` on
macOS/Linux, `schtasks` on Windows) that runs `skrun purge` every 15 minutes. `cli.js` also runs
purge opportunistically on every invocation (best-effort, swallows errors) as a second
safety net. When no TTL installs remain, the scheduler entry is removed.

## Conventions

- **Plain JavaScript, ESM** (`"type": "module"`), zero runtime dependencies. Allowed core
  modules only: `fs`, `path`, `os`, `child_process`, `readline`.
- **No shell interpolation**: `git` is invoked via `execFileSync` with an args array, never
  `execSync` with a string — avoids command injection from untrusted repo URLs (see
  `CHANGELOG.md` 0.2.0 for the incident this fixed).
- **Symlink by default, `--copy` for independent snapshots.** On Windows symlink `EPERM`,
  `fsutil.linkOrCopy` falls back to copy and warns rather than failing.
- **No repo caching**: `skrun import` clones to a temp dir and force-removes it in a `finally`,
  every time.
- **No merge/diff in `sync`**: copy-type installs are fully overwritten from the store, per
  spec (`specs/PLAN0.md`).
- **`forceRemove` safety guard**: refuses to delete paths fewer than 3 levels deep (e.g.
  `/home`, `/Users/name`) to prevent accidental broad deletions.
- **Tests use `node:test`** with temp dirs and a `SKRUN_CONFIG_DIR` env override so tests never
  touch the real `~/.config/skrun`. Test files are colocated under `test/`, one per module.
- **Source of truth**: `specs/PLAN0.md` for design decisions and rationale; `README.md` for
  user-facing command reference; `CHANGELOG.md` for what shipped and why.
