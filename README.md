# skrun

[![npm version](https://img.shields.io/npm/v/%40akaiserg%2Fskrun)](https://www.npmjs.com/package/@akaiserg/skrun)
[![npm license](https://img.shields.io/npm/l/%40akaiserg%2Fskrun)](https://www.npmjs.com/package/@akaiserg/skrun)
[![npm downloads](https://img.shields.io/npm/dm/%40akaiserg%2Fskrun)](https://www.npmjs.com/package/@akaiserg/skrun)
[![GitHub stars](https://img.shields.io/github/stars/akaiserg/skh?style=social)](https://github.com/akaiserg/skh)
[![Node engines](https://img.shields.io/node/v/%40akaiserg%2Fskrun)](https://www.npmjs.com/package/@akaiserg/skrun)

A package manager for AI agent skills. One CLI to import, install, and sync skills across Claude Code, GitHub Copilot, OpenCode, Cursor, and any agent that reads `SKILL.md` files.

## Table of Contents

- [Why](#why-skrun)
- [Install](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Why SKRUN

AI coding agents are getting powerful — but only when they have the right skills loaded. A "skill" is just a folder with a `SKILL.md` file that tells the agent how to behave (write tests first, follow a code review checklist, use a specific debugging workflow, etc.).

The problem is managing them:

- **You have skills scattered everywhere.** Some live in a team repo, others in personal collections, a few you grabbed from open source. There's no single place to browse what you have.
- **Every agent wants them in a different folder.** Claude Code reads from `.claude/skills/`, Copilot from `.github/skills/`, OpenCode from `.opencode/skills/`, Cursor from `.agents/skills/`. Installing a skill means copying it to the right place for each agent — manually.
- **You load too many or too few.** Skills eat context tokens on every prompt. Loading 20 skills when you only need 3 wastes context and adds latency. But remembering which skills to add to which project is tedious, so most people either dump everything or skip skills entirely.
- **Cleanup never happens.** You installed a debugging skill for a specific bug hunt. The bug is fixed. The skill is still there, burning tokens on every conversation, forever.

SKRUN fixes all of this:

```
skrun import https://github.com/acme/agent-skills.git   # pull skills into a global store
skrun install tdd                                         # symlink into your project (all agents)
skrun install code-review --ttl=2                         # auto-removes after 2 hours
skrun install --tag=backend                               # batch install by tag
```

**One global store** (`~/.config/skrun/skills/`) holds all your skills. **Selective installs** put only what you need into each project. **Multi-agent targeting** handles the folder differences automatically. **TTL auto-expiry** cleans up temporary skills so you don't have to.

## Installation

### Prerequisites

- **Node.js** >= 16.7.0
- **git** (for `skrun import`)

### Run without installing (npx)

You can run any command without a global install:

```bash
npx @akaiserg/skrun <command>

# Examples
npx @akaiserg/skrun --version
npx @akaiserg/skrun list
npx @akaiserg/skrun import https://github.com/acme/agent-skills.git

# Pin a specific version
npx @akaiserg/skrun@0.2.0 list
```

npx caches the package after the first run. To force the newest version after a publish, append `@latest` or clear the cache: `rm -rf ~/.npm/_npx`. For frequent use, prefer the global install — then just `skrun <command>`.

### Install globally via npm

```bash
npm install -g @akaiserg/skrun
```

Installing the scoped package puts the bare `skrun` binary on your `PATH` (the package name is `@akaiserg/skrun`, but the CLI command stays `skrun`).

### Install from source (local development)

```bash
git clone https://github.com/akaiserg/skh.git
cd skh
npm link          # symlinks the package globally so `skrun` is on your PATH
```

This creates a global symlink to your local checkout, so any code changes take effect immediately — no reinstall needed.

```bash
# To remove the link
npm unlink -g skrun
```

### Verify

```bash
skrun --version
# skrun v0.2.0
```

## Quick Start

```bash
# 1. Import skills from a repository
skrun import https://github.com/acme/agent-skills.git

# 2. See what's in your store
skrun list

# 3. Install a skill into your project
cd /path/to/your/project
skrun install tdd

# 4. Done — your agent can now use the skill
```

## How It Works

```
                 ┌─────────────────────────────┐
                 │    Remote Git Repository     │
                 │  skills/tdd/SKILL.md         │
                 │  skills/lint/SKILL.md         │
                 └──────────┬──────────────────┘
                            │ skrun import
                            ▼
                 ┌─────────────────────────────┐
                 │    Global Store              │
                 │  ~/.config/skrun/skills/       │
                 │    tdd/SKILL.md              │
                 │    lint/SKILL.md             │
                 └──────────┬──────────────────┘
                            │ skrun install
                            ▼
          ┌─────────────────┼─────────────────┬─────────────────┐
          ▼                 ▼                 ▼                 ▼
  .claude/skills/   .github/skills/   .opencode/skills/  .agents/skills/
    tdd/ (symlink)    tdd/ (symlink)    tdd/ (symlink)    tdd/ (symlink)
```

**Global store** (`~/.config/skrun/skills/`) is the single source of truth. Skills are symlinked (default) or copied into projects. Symlinks auto-reflect updates; copies can be synced with `skrun sync`.

## Commands

### `skrun import <repo>`

Clone a git repository, scan it for skills (folders containing `SKILL.md`), and interactively select which to add to the global store.

```bash
# Import from a GitHub repo
skrun import https://github.com/akaiserg/skh.git

# Import from a local path
skrun import /path/to/local/repo

# Skip prompts, import everything
skrun import https://github.com/akaiserg/skh.git --force
```

The interactive selector uses arrow keys to navigate, space to toggle, `a` to select all, and enter to confirm:

```
Select skills to import:
  (↑/↓ navigate, space toggle, a all, enter confirm, esc cancel)
  ▸ ● tdd
    ○ lint
    ● code-review
```

After selection, you'll be prompted to tag all imported skills at once. You can then optionally tag skills individually for more specific labels:

```
  Tags for all 3 imported skill(s) (comma-separated, enter to skip): coding,workflow
  Tagged 3 skill(s): coding, workflow
  Tag skills individually? [y/N] y
  Additional tags for "tdd" (comma-separated, enter to skip): testing
  Tagged tdd: coding, workflow, testing
```

### `skrun install <skill> [options]`

Install a skill from the global store into the current project.

```bash
# Symlink (default) — changes to the global store auto-reflect
skrun install tdd

# Copy — independent snapshot of the skill
skrun install tdd --copy

# Target a specific agent directory
skrun install tdd --target=claude

# Auto-remove after 4 hours
skrun install tdd --ttl=4

# Auto-remove after 30 minutes
skrun install tdd --ttl=30m

# Auto-remove after 90 seconds
skrun install tdd --ttl=90s

# Install by tag (OR matching — any skill with "backend" or "testing")
skrun install --tag=backend,testing

# Install by tag (AND matching — only skills with both tags)
skrun install --tag=backend,testing --match=all

# Force overwrite without prompting
skrun install tdd --force
```

**Target resolution** (when `--target` is not specified):
1. Detects existing agent directories (`.claude`, `.github`, `.opencode`, `.agents`) in the current project.
2. Installs into **all** detected directories.
3. If none exist, creates `.agents/skills/` as the default.

### `skrun uninstall <skill> [--target=<agent>]`

Remove an installed skill from the current project. Deletes the symlink or copy and removes the entry from the registry.

```bash
# Remove from all agent dirs
skrun uninstall tdd

# Remove only from a specific agent
skrun uninstall tdd --target=claude
```

### `skrun sync [--dry-run]`

Synchronize installed copies with the global store. Symlinks are always in sync; copies get overwritten from the store.

```bash
# Preview what would be synced
skrun sync --dry-run

# Sync all copy-type installs
skrun sync
```

Example output:

```
  ✓ tdd → /project/.claude/skills/tdd (symlink, auto-synced)
  ↻ lint → /project/.claude/skills/lint (re-copied)

1 copy install(s) synced, 0 skipped.
```

### `skrun list [--tag=<tag>] [--installed]`

List skills in the global store, or show active installs.

```bash
# List all skills in the store
skrun list

# Filter by tag
skrun list --tag=backend

# Show where skills are currently installed
skrun list --installed
```

Example output:

```
Skills in store (3):

  tdd  [testing, backend]
  lint  [quality]
  code-review
```

With `--installed`:

```
Active installs (3):

  tdd (symlink) → /project/.claude/skills/tdd
  tdd (symlink) → /project/.github/skills/tdd
  code-review (copy) → /project/.claude/skills/code-review  expires 6/20/2026, 2:30:00 PM
```

### `skrun tag <add|remove|list> <skill> [tags...]`

Manage tags on skills. Tags enable batch installs via `skrun install --tag=<tag>`.

```bash
# Add tags
skrun tag add tdd testing backend

# List tags for a skill
skrun tag list tdd
# tdd: testing, backend

# Remove a tag
skrun tag remove tdd backend
```

### `skrun purge`

Remove expired TTL installs. Runs automatically via a system scheduler (cron or Windows Task Scheduler) when TTL installs exist, but can also be invoked manually.

```bash
skrun purge
```

Example output:

```
  Expired: tdd (/project/.claude/skills/tdd)

1 install(s) purged.
```

### `skrun logs [--errors] [--lines=N] [--clear]`

View the CLI log file. All errors (including from scheduled `skrun purge` runs) are logged to `~/.config/skrun/skrun.log`.

```bash
# Show recent log entries
skrun logs

# Show only errors
skrun logs --errors

# Show last 100 entries
skrun logs --lines=100

# Clear the log file
skrun logs --clear
```

### `skrun --history [deleted]`

View the audit trail of installs, expirations, and removals.

```bash
# Full history
skrun --history

# Only show deletions and expirations
skrun --history deleted
```

Example output:

```
History — 4 entries:

  [install] tdd in /project — 6/20/2026, 10:30:00 AM
  [install] lint in /project — 6/20/2026, 10:30:05 AM
  [expire] tdd in /project — 6/20/2026, 2:30:00 PM
```

## Install Options Reference

| Option | Description | Default |
|---|---|---|
| `--target=<agent>` | Install into specific agent dir: `claude`, `github`, `opencode`, `agents`, or `all` | Auto-detect |
| `--copy` | Copy files instead of creating a symlink | Symlink |
| `--ttl=<duration>` | Auto-remove after duration: `30s`, `15m`, `2h`, or bare number for hours | No expiry |
| `--tag=<tags>` | Install all skills matching the given tags (comma-separated) | — |
| `--match=all` | Require all tags to match (AND). Default is OR | OR |
| `--force` | Overwrite existing installs without prompting | Prompt |

## TTL Auto-Purge

When you install a skill with `--ttl`, SKRUN automatically registers a system scheduler:

- **macOS/Linux**: cron job running every 15 minutes
- **Windows**: Task Scheduler entry running every 15 minutes

The scheduler runs `skrun purge`, which removes expired installs and cleans up the registry. When no TTL installs remain, the scheduler is automatically removed.

```bash
# Install for a 2-hour pairing session
skrun install code-review --ttl=2

# Check what's scheduled
crontab -l | grep skrun  # macOS/Linux

# Manual purge
skrun purge
```

## Configuration

### Storage Location

All data lives under `~/.config/skrun/`:

```
~/.config/skrun/
  skills/              # Global skill store
    tdd/
      SKILL.md
      skrun.json         # { "tags": ["testing"] }
    lint/
      SKILL.md
  registry.json        # Install tracking + history
```

### Environment Variables

| Variable | Description |
|---|---|
| `XDG_CONFIG_HOME` | Override config root (default: `~/.config`) |
| `SKRUN_CONFIG_DIR` | Override the full SKRUN config directory |

## Workflow Examples

### Team onboarding

```bash
# New developer joins — get all team skills in one shot
skrun import https://github.com/acme/agent-skills.git --force
skrun install --tag=team-standards
```

### Temporary experiment

```bash
# Try a skill for 1 hour, auto-cleanup
skrun install experimental-refactor --ttl=1
```

### Multi-agent project

```bash
# Project uses both Claude Code and GitHub Copilot
ls -d .claude .github
# .claude  .github

# Install into all agents at once (auto-detected)
skrun install tdd
#   symlink: tdd → claude
#   symlink: tdd → github
# 2 install(s) completed.
```

### Keep copies in sync after updating a skill

```bash
# Update the skill in the global store
skrun import https://github.com/acme/agent-skills.git --force

# Sync all projects that used --copy
cd /path/to/project
skrun sync
```

### Audit what happened

```bash
# See full history
skrun --history

# What expired or was removed?
skrun --history deleted
```

## Skill Format

A skill is a folder containing at least a `SKILL.md` file. Optionally, include a `skrun.json` for tags:

```
my-skill/
  SKILL.md          # Required — the skill instructions
  skrun.json          # Optional — { "tags": ["backend", "testing"] }
  helpers.md        # Optional — additional files
```

The `SKILL.md` content is what the AI agent reads. Write it as instructions the agent should follow.

## Testing

```bash
# Run all tests (unit + functional)
npm test

# Run with coverage
node --test --experimental-test-coverage test/*.test.js
```

## Publishing

Published to the public npm registry as [`@akaiserg/skrun`](https://www.npmjs.com/package/@akaiserg/skrun).

### Stable release

```bash
# 1. Bump version (pick one)
npm run release:patch    # 0.2.0 → 0.2.1
npm run release:minor    # 0.2.0 → 0.3.0
npm run release:major    # 0.2.0 → 1.0.0

# 2. Push branch and tag
git push origin main --tags

# 3. Publish (dry-run first if needed)
npm run publish:dry-run
npm run publish:registry
```

### Beta release

```bash
# 1. Create first beta from your feature branch
npm run release:beta       # 0.2.0 → 0.3.0-beta.0

# 2. Push branch and tag
git push origin <your-branch> --tags

# 3. Publish with beta tag
npm run publish:beta

# 4. Subsequent betas (after fixes)
npm run release:beta-bump  # beta.0 → beta.1
git push origin <your-branch> --tags
npm run publish:beta
```

### Installing a beta

```bash
npm install -g @akaiserg/skrun@beta
skrun --version  # 0.3.0-beta.0
```

## Troubleshooting

### `npx @akaiserg/skrun` → `sh: skrun: command not found`

This is an npx fallback message, not a problem with the package. It happens when npx can't resolve the package from the registry — usually a stale npx cache (e.g. a cached 404 from before the package was published). Fix:

```bash
rm -rf ~/.npm/_npx
npx @akaiserg/skrun@0.2.0 --version
```

If it still fails, a global install sidesteps npx entirely: `npm install -g @akaiserg/skrun`.

### npx runs an old version after a publish

npx caches packages. Append `@latest` (or the exact version) or clear the cache:

```bash
npx @akaiserg/skrun@latest <command>
# or
rm -rf ~/.npm/_npx
```

## Contributing

Contributions are welcome. `skrun` is zero-dependency, plain ESM Node.js — no build step, no transpiler.

```bash
# Clone and link the CLI globally for local testing
git clone https://github.com/akaiserg/skh.git
cd skh
npm link          # `skrun` now points at your local checkout

# Run the test suite
npm test

# Run a single suite
node --test test/install.test.js
```

Guidelines:
- Keep the zero-runtime-dependency constraint — only Node core modules (`fs`, `path`, `os`, `child_process`, `readline`).
- Add or update tests under `test/` for any behavior change; `npm test` must pass (all suites, `node:test`).
- Follow the existing code style (plain ESM, no external linters configured).
- Open a pull request against `main` with a clear description of the change and why it's needed.

## License

MIT © Andres Kaiser — see [LICENSE](LICENSE) for details.
