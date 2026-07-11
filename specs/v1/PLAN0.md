# SKM — Standard Agent Skill Manager: Build Plan

## Context

AI coding agents (Claude Code, Copilot, Cursor) load "skills" (folders w/ `SKILL.md`)
from per-agent dirs (`.claude/skills`, `.github/skills`, `.agents/skills`). Problems:
unused skills bloat context/tokens, paths differ per agent, and large catalogs
overwhelm devs who need only a subset.

`skm` solves this: a **local-first, zero-dependency Node CLI** that imports skills from
repos into a global store, then installs a chosen subset into projects (symlink or copy),
across all detected agent targets, with optional TTL auto-expiry. Source of truth is the
local filesystem; behavior is deterministic; state is minimal.

**Decisions (confirmed w/ user):**
- Plain **JavaScript, ESM**, zero runtime deps. No build step. Allowed core modules only:
  `fs`, `path`, `os`, `child_process`, `readline`. Tests via built-in `node:test`.
- **Full cross-platform TTL**: cron (macOS/Linux) + Task Scheduler `schtasks` (Windows).
- Import selection = **arrow-key TUI** (raw-mode keypress, space toggle, enter confirm).
- **Build-then-test**: implement modules, then a `node:test` suite over core flows.

**Assumptions:**
- `git` is on PATH (used by `skm import` via `git clone`). Error clearly if absent.
- Config root = `$XDG_CONFIG_HOME/skm` if set, else `~/.config/skm` (honors spec path,
  adds XDG override). Same on macOS for consistency w/ spec.
- Windows symlinks need privilege; if symlink fails on install, fall back to copy + warn.

---

## Architecture / file layout

```
skm/
  package.json            # { "type":"module", "bin": { "skm": "bin/skm.js" }, engines node>=16.7 }
  bin/skm.js              # shebang entry → import & run src/cli.js
  src/
    cli.js                # argv parse + command router + top-level error handling
    config.js             # resolve configDir, skillsDir, registryPath; ensure dirs exist
    registry.js           # load/save registry.json; addInstall/removeInstall; appendHistory
    targets.js            # detect .claude/.github/.agents in cwd; resolve install targets
    fsutil.js             # recursive copy, symlink-or-copy, force rm, path safety
    tui.js                # arrow-key multi-select (raw mode, zero deps)
    skills.js             # scan store, read/locate SKILL.md, read/write per-skill skm.json
    commands/
      import.js           # clone → scan SKILL.md → TUI select → copy to store → tag prompt
      install.js          # resolve targets, symlink/copy, register, schedule TTL
      sync.js             # re-copy copies from store (registry-tracked); --dry-run
      list.js             # list store skills; --tag filter
      tag.js              # tag add/remove/list (edits per-skill skm.json)
      history.js          # print history (skm --history deleted)
      purge.js            # internal: delete expired installs (called by scheduler)
    ttl.js                # ensure recurring scheduler entry (cron/schtasks); compute expiry
  test/
    *.test.js             # node:test suites (see Testing)
```

### Core data
- **Global store**: `~/.config/skm/skills/<skill-id>/` — folder name = unique skill ID.
- **Per-skill tags**: `<skill-id>/skm.json` → `{ "tags": ["backend","testing"] }`.
- **Registry**: `~/.config/skm/registry.json` — schema exactly per PRD §8:
  `{ installs:[{skill,projectPath,installedPath,type,ttlExpiresAt}], history:[{action,skill,timestamp,projectPath}] }`.

---

## Build steps

### 1. Scaffold + config (`config.js`, `package.json`, `bin/skm.js`)
- `package.json`: `type: module`, `bin`, `engines`, npm scripts (`test`, `start`).
- `config.js`: resolve `configDir` (XDG → ~/.config/skm), expose `skillsDir`,
  `registryPath`; `ensureConfig()` creates dirs idempotently.
- `bin/skm.js`: `#!/usr/bin/env node`, calls `run(process.argv.slice(2))` from `cli.js`.

### 2. Arg parsing + router (`cli.js`)
- Minimal hand-rolled parser: positionals + `--key=val` / `--flag`. No deps.
- Route to command modules. Handle global `--history`. Central try/catch → friendly
  errors + nonzero exit. `--help` / unknown command → usage text.

### 3. Registry + history (`registry.js`)
- `load()` (tolerant of missing/corrupt → fresh skeleton), `save()` (atomic write via
  temp file + rename), `addInstall`, `removeInstall(installedPath)`,
  `appendHistory(action, {skill, projectPath})` w/ ISO timestamps.

### 4. FS utilities (`fsutil.js`)
- `copyDir(src,dst)` recursive (fs.cpSync where available; manual fallback for <16.7 edge).
- `linkOrCopy(src,dst,{copy})` → symlink unless `--copy`; on symlink EPERM (Windows) →
  copy + return effective type.
- `forceRemove(p)` (fs.rmSync recursive force) for TTL purge "ignore modifications".
- Guard against path traversal / refusing to delete outside known roots.

### 5. Skills store helpers (`skills.js`)
- `scanForSkills(rootDir)` → list folders containing `SKILL.md` (recursive walk).
- `listStore()` → skill IDs in store + their tags.
- `getTags(id)` / `setTags(id, tags)` reading/writing `skm.json`.
- Duplicate handling: `exists(id)` for replace prompt / `--force`.

### 6. Targets resolver (`targets.js`)
- Detect `.claude`, `.github`, `.agents` dirs in cwd.
- Default: install into ALL detected (their `skills/` subdir). If none → create
  `.agents/skills`. `--target=claude|github|agents|all` override.
- Returns absolute `installedPath`s per resolved target.

### 7. TUI multi-select (`tui.js`)
- Raw mode on `process.stdin`; render numbered list w/ cursor + `[x]/[ ]`.
- Keys: ↑/↓ (`\x1b[A`/`\x1b[B`), space toggle, `a` all, enter confirm, Ctrl-C/Esc abort.
- Restore terminal state on exit/error. Non-TTY fallback → throws clear msg (or simple
  index prompt) so CI doesn't hang.

### 8. `import` command (`commands/import.js`)
- `git clone --depth 1 <repo> <tmp>` into `os.tmpdir()` subdir.
- `scanForSkills(tmp)` → TUI select → `copyDir` each into store (replace prompt / `--force`
  on collision). Prompt for tags if skill lacks `skm.json` (readline) → write `skm.json`.
- `finally`: `forceRemove(tmp)` (no caching, per spec).

### 9. `install` command (`commands/install.js`)
- Inputs: `<skill>` or `--tag=<t>` (`--match=all` for AND; default OR). Resolve skill set
  from store. Resolve targets (step 6). For each (skill × target): `linkOrCopy`,
  `registry.addInstall`, `appendHistory('install')`.
- `--ttl=<hours>`: compute `ttlExpiresAt = now + h`; store in registry; call
  `ttl.ensureScheduler()`.

### 10. TTL scheduler + purge (`ttl.js`, `commands/purge.js`)
- `ensureScheduler()` installs **one idempotent recurring entry** that runs `skm purge`
  (e.g. every 15 min): unix via `crontab -l|edit` w/ a tagged marker line; Windows via
  `schtasks /Create /TN skm-purge /SC MINUTE /MO 15` (guard re-create).
- `purge.js` (internal): read registry, for each install w/ `ttlExpiresAt <= now` →
  `forceRemove(installedPath)`, `removeInstall`, `appendHistory('expire')`. Idempotent;
  safe to run when nothing expired. Also invoked opportunistically at CLI startup as a
  belt-and-suspenders cleanup.

### 11. `sync` command (`commands/sync.js`)
- Source of truth = store. Symlinks: no-op (auto-reflect) — report as "ok".
- Copies: re-`copyDir` from store over `installedPath` (overwrite; no merge/diff per spec).
- `--dry-run`: print intended actions, change nothing.

### 12. `list`, `tag`, `history` (`commands/list.js`, `tag.js`, `history.js`)
- `list` / `list --tag=<t>`: print store skills (+ tags); filter by tag.
- `tag add|remove|list <skill> <tags...>`: edit per-skill `skm.json`.
- `skm --history deleted`: print history filtered to delete/expire actions
  (and general history view). Unknown tag → warning, not error (per §11).

---

## Error handling (PRD §11)
- Duplicate skill on import/store → replace prompt unless `--force` (then overwrite).
- Missing skill on install → clear error, nonzero exit.
- Unknown tag → warning, continue.
- Missing `git` → actionable error. Symlink EPERM → fallback to copy + warn.

---

## Testing (build-then-test, `node:test`)
Run with `node --test`. Use temp dirs (`os.tmpdir()`) + a fake `configDir` via env override
so tests never touch the real `~/.config/skm`.

- **registry**: load missing/corrupt, add/remove install, history append, atomic save.
- **fsutil**: recursive copy fidelity, symlink vs copy, forceRemove, path-safety guards.
- **targets**: all-detected / single / none→create `.agents/skills` / `--target`.
- **skills/tags**: scan finds `SKILL.md` folders; tag add/remove/list round-trips `skm.json`.
- **install**: symlink + copy paths, multi-target fan-out, registry entries correct,
  `--tag` OR vs `--match=all`.
- **purge**: expired removed + history `expire`; non-expired untouched; idempotent.
- **sync**: copy re-synced from store; `--dry-run` no-ops; symlink reported ok.
- **import**: mock a local git repo (init + commit) as `<repo>`, run import w/ TUI stubbed
  / `--force`, assert store populated and tmp cleaned.

### End-to-end manual verification
```bash
# local fake skill repo
mkdir -p /tmp/skmrepo/skills/tdd && echo "# tdd" > /tmp/skmrepo/skills/tdd/SKILL.md
( cd /tmp/skmrepo && git init -q && git add -A && git commit -qm init )

node bin/skm.js import /tmp/skmrepo        # TUI select tdd → store + tag prompt
node bin/skm.js list                        # shows tdd
mkdir -p /tmp/proj/.claude && cd /tmp/proj
node /path/skm/bin/skm.js install tdd --ttl=1   # symlink into .claude/skills, registry+TTL
ls -la .claude/skills/tdd                    # symlink present
node /path/skm/bin/skm.js install tdd --copy # copy variant
node /path/skm/bin/skm.js sync --dry-run     # shows planned re-copy
node /path/skm/bin/skm.js purge              # nothing expired yet
node /path/skm/bin/skm.js --history deleted  # audit trail
crontab -l | grep skm                        # scheduler entry present (unix)
```

---

## Out of scope / notes
- No repo caching (temp clone deleted every import).
- No merge/diff in sync — copies are overwritten (spec-mandated).
- TTL never touches the global store, only project installs.
- Scheduler is a single recurring `skm purge`, not one entry per install (simpler, robust).
