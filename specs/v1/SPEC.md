# Specification: Audit `skm` Implementation Against `specs/PLAN0.md`

## 1. Overview & Goal
The `skm` CLI (repo dir `skh`) already has a complete, shipped implementation
(v0.4.0-beta.0) of the plan described in `specs/PLAN0.md`. This is **not** a
feature-build task. The goal is to audit the existing `src/`, `bin/`, and
`test/` code against every build step, architectural decision, data schema,
error-handling rule, and testing requirement in `PLAN0.md`, confirm what is
correctly implemented, flag any genuine gaps/bugs/deviations found during
this audit, and scope only the fix work needed to bring the code fully in
line with the plan (or explicitly document deliberate, reasonable deviations
that should be kept as-is).

## 2. Assumptions & Risks
- **Assumption**: "Verify what already exists is all ok" means: run the test
  suite and `verify.sh`, then do a line-by-line correctness review of each
  module against `PLAN0.md` build steps 1–12 and the Testing section — not a
  request to redesign or add new features. — **Risk if wrong**: scope creep
  into feature work that belongs to a different task/agent.
- **Assumption**: Deviations that are strict *improvements* over `PLAN0.md`
  (e.g. `execFileSync` array-args for git instead of the plan's `git clone`
  shell string, extra `uninstall`/`logs` commands, `SKM_CONFIG_DIR` test
  override) are acceptable and should be documented, not reverted. —
  **Risk if wrong**: unnecessary regression of already-fixed security/UX work
  (see `CHANGELOG.md` 0.2.0 command-injection fix).
- **Assumption**: The `rtk` shell hook intercepting some bash tool calls
  (`cat`, `grep`, `wc`) in this environment is a local dev-shell artifact
  unrelated to the `skm` codebase and out of scope for this audit. —
  **Risk if wrong**: none for this repo; flagged only so the fix-work owner
  doesn't chase a red herring.
- **Assumption**: "npm test passes" and "verify.sh passes" (both already
  confirmed green during this audit) are necessary but not sufficient proof
  of spec conformance — some `PLAN0.md`-mandated test coverage (notably the
  `forceRemove` path-safety guard) is simply absent, so tests passing does
  not by itself close every gap. — **Risk if wrong**: a fix-work agent might
  treat "tests are green" as "done" and skip closing real coverage gaps.

## 3. Scope
- **In scope**:
  - Verifying each `PLAN0.md` build step (1–12) against actual source files.
  - Verifying registry/store/config data schemas match `PLAN0.md` §"Core data"
    exactly.
  - Verifying error-handling rules (PRD §11 as summarized in `PLAN0.md`).
  - Verifying the Testing section's required coverage exists and is accurate
    (not just "a test file with this name exists" but the described behavior
    is actually asserted).
  - Cataloguing deviations from `PLAN0.md` (both reasonable/keep and
    genuine bugs/gaps to fix).
  - Fix work strictly limited to closing genuine gaps identified below (test
    coverage gap, safety-guard cross-platform bug, one broken doc link).
- **Out of scope**:
  - Any new commands, flags, or behaviors not already implied by `PLAN0.md`
    or already shipped in the current codebase.
  - Redesigning the registry schema, TTL model, or CLI UX.
  - PLAN/TASKS generation for downstream agents (owned by `@plan-architect`).
  - Actually writing the fix code (owned by `@code-builder` once
    `@plan-architect` sequences the tasks below).

## 4. Functional Requirements
- **FR-1**: Every build step in `PLAN0.md` §"Build steps" (1–12) must be
  traced to concrete source in `src/`, `bin/`, or `src/commands/`, and its
  runtime behavior (not just presence) must match the plan's intent.
- **FR-2**: The registry schema actually written/read by `src/registry.js`
  must match `PLAN0.md` §"Core data" exactly:
  `{ installs:[{skill,projectPath,installedPath,type,ttlExpiresAt}], history:[{action,skill,timestamp,projectPath}] }`.
- **FR-3**: `linkOrCopy` must default to symlink, honor `--copy`, and fall
  back to copy + warn on `EPERM`/`EACCES` (Windows symlink privilege case)
  per build step 4 and the Error Handling section.
- **FR-4**: `forceRemove` must refuse to operate on paths shallower than 3
  path segments on **every supported platform**, including Windows drive
  letters (currently it does not — see Gap G-1 below).
- **FR-5**: `git` must never be invoked via shell-interpolated string
  (`execSync` with a template string); it must use `execFileSync` with an
  args array, per `CLAUDE.md`'s documented convention and the `CHANGELOG.md`
  0.2.0 security fix. This must be re-verified as still true (it is, as of
  this audit — see Section 7).
- **FR-6**: `sync` must never merge/diff copy-type installs — it must fully
  overwrite from the store, and `--dry-run` must produce zero filesystem
  side effects.
- **FR-7**: `import` must never cache the cloned temp dir — `forceRemove(tmpDir)`
  must run in a `finally` block for the git-clone code path.
- **FR-8**: The Testing section's coverage list (registry, fsutil, targets,
  skills/tags, install, purge, sync, import) must be satisfied either by
  dedicated unit tests or by equivalent end-to-end functional tests — gaps
  must be enumerated explicitly (see Section 7 / Gap G-2).
- **FR-9**: Any deviation from `PLAN0.md`'s exact file layout or command
  list (e.g. `commands/uninstall.js`, `commands/logs.js`, `src/logger.js`,
  `SKM_CONFIG_DIR` env override) must be catalogued as a deliberate,
  reasonable, documented addition rather than silently left unmentioned.

## 5. Non-Functional Requirements & Constraints
- Must remain plain JavaScript ESM, zero runtime dependencies, using only
  `fs`, `path`, `os`, `child_process`, `readline` (per `CLAUDE.md`).
- No shell interpolation for `git` invocation (see FR-5).
- `npm test` (node:test) and `bash verify.sh` must both exit 0 after any fix
  work — these are the two acceptance gates.
- Fix work must not alter the on-disk registry/skm.json schemas in a
  backward-incompatible way (existing installs/registries must keep working).
- Any fix to `forceRemove`'s path-safety guard must preserve current Unix
  behavior exactly (do not loosen it) while closing the Windows drive-letter
  gap.

## 6. Data & Interfaces
Files audited (all under repo root
`/Users/andreskaiser/PROJECTS/github-projects/skh`):
- `package.json` — name `skm`, `bin.skm -> bin/skm.js`, `type: module`,
  `engines.node >= 16.7.0`. Matches plan.
- `bin/skm.js` — shebang entry, delegates to `src/cli.js:run()`.
- `src/config.js` — `configDir` resolution order: `SKM_CONFIG_DIR` env →
  `XDG_CONFIG_HOME/skm` → `~/.config/skm`. `ensureConfig()` creates
  `skillsDir` recursively.
- `src/cli.js` — hand-rolled `parseArgs`, command router, opportunistic
  `purgeExpired(false)` before every command except `purge`, central
  try/catch → `logError` + nonzero exit.
- `src/registry.js` — `loadRegistry`/`saveRegistry` (atomic temp-file +
  rename), `addInstall`, `removeInstall(installedPath)`,
  `appendHistory(registry, action, {skill, projectPath})`.
- `src/fsutil.js` — `copyDir`, `linkOrCopy(src,dst,{copy})`, `forceRemove(p)`
  with the `parts.length < 3` depth guard (see Gap G-1).
- `src/skills.js` — `scanForSkills`, `listStore`, `skillExists`, `skillPath`,
  `getTags`/`setTags`, `findByTag(tag, matchAll)`.
- `src/targets.js` — `resolveTargets(cwd, targetFlag)` detects
  `.claude`/`.github`/`.agents`, falls back to `.agents/skills`.
- `src/tui.js` — `multiSelect`, `confirm`, `prompt`; throws on non-TTY.
- `src/ttl.js` — `ensureScheduler`/`removeScheduler` (cron marker line /
  `schtasks`), uses `execSync` with interpolated strings built from
  internal constants and `which`/`where` output (not user-controlled input
  — acceptable, but distinct from the git `execFileSync` convention; see
  Section 7 observation O-1).
- `src/logger.js` — file-based JSON-lines logger with rotation at 512KB;
  **not mentioned in `PLAN0.md`** — deliberate addition, keep.
- `src/commands/*.js` — `import`, `install`, `uninstall`, `sync`, `list`,
  `tag`, `purge`, `logs`, `history`; `uninstall.js` and `logs.js` are
  additions beyond `PLAN0.md`'s command list — deliberate, keep.
- `test/*.test.js` — `cli`, `config`, `fsutil`, `functional`, `purge`,
  `registry`, `skills`, `targets` (8 files, 59 assertions total, all
  passing as of this audit).

## 7. Acceptance Criteria
- **AC-1**: `npm test` exits 0 (confirmed: 59/59 tests pass as of this audit).
- **AC-2**: `bash verify.sh` exits 0 with `GATE PASSED` (confirmed as of this
  audit).
- **AC-3**: Every build step 1–12 in `PLAN0.md` is confirmed implemented as
  described:
  - Steps 1–3 (scaffold/config, arg parsing/router, registry+history):
    confirmed correct, matches schema exactly.
  - Step 4 (fsutil): `copyDir`/`linkOrCopy`/`forceRemove` confirmed correct
    **except** the Windows drive-letter depth-guard bug (Gap G-1).
  - Steps 5–7 (skills store, targets, TUI): confirmed correct, including
    non-TTY fail-fast in `tui.js`.
  - Step 8 (`import`): confirmed correct — local-path vs git-clone dual mode
    is a deliberate, sensible extension of the plan (usage text documents
    both `skm import <repo>` and `skm import <path>`); `finally` block
    correctly `forceRemove`s the temp dir only when a clone actually
    happened.
  - Step 9 (`install`): confirmed correct — tag OR/AND matching, multi-target
    fan-out, TTL parsing (`s`/`m`/`h` suffixes, bare number = hours),
    registry entries match schema.
  - Step 10 (TTL scheduler + purge): confirmed correct — idempotent cron
    marker / `schtasks` entry, opportunistic purge on every CLI invocation,
    scheduler removal when no TTL installs remain.
  - Step 11 (`sync`): confirmed correct — symlinks reported (not touched),
    copies unconditionally overwritten, `--dry-run` is a true no-op.
  - Step 12 (`list`/`tag`/`history`): confirmed correct, plus `list
    --installed` and `logs` as documented additions.
- **AC-4**: Error-handling rules (duplicate → prompt/`--force`, missing
  skill → error + nonzero exit, unknown tag → warning not error, missing
  `git` → actionable error, symlink `EPERM` → fallback + warn) all confirmed
  present and correctly wired.
- **AC-5**: Registry schema fields exactly match `PLAN0.md` §"Core data"
  (confirmed, `src/registry.js:29-57`).
- **AC-6**: Git invocation uses `execFileSync` with an args array — never
  shell-interpolated `execSync` (confirmed, `src/commands/import.js:27,33`).
- **AC-7 (gap, must fix)**: `forceRemove`'s path-depth safety guard behaves
  identically in intent on Windows and POSIX — i.e. a Windows path whose
  "real" depth below the drive root equals a refused POSIX path (e.g.
  `C:\Users\name` vs `/Users/name`) must also be refused. Currently it is
  **not** refused, because splitting `C:\Users\name` on `[\\/]` yields 3
  segments (`C:`, `Users`, `name`) vs POSIX's 2 (`Users`, `name`), so the
  `< 3` threshold lets the Windows case through. **Gap G-1.**
- **AC-8 (gap, must fix)**: A `node:test` case exists that directly exercises
  `forceRemove`'s path-safety guard (e.g. asserts it refuses to delete a
  2-segment path and a Windows-style shallow path), per `PLAN0.md`'s
  Testing section ("fsutil: ... path-safety guards" — currently untested).
  **Gap G-2.**
- **AC-9 (gap, should fix)**: `README.md` references `BETA_PUBLISHING.md`
  (in the Publishing section) which does not exist anywhere in the repo —
  either create the file or remove the dead link. **Gap G-3.**
- **AC-10 (documentation only, no code change)**: The following deliberate
  deviations from `PLAN0.md` are catalogued and should be kept as-is, not
  "fixed":
  - `execFileSync`(array-args) for `git` instead of the plan's illustrative
    `git clone` string — a documented security improvement
    (`CHANGELOG.md` 0.2.0).
  - `commands/uninstall.js` and `commands/logs.js` plus `src/logger.js` —
    commands/modules not in `PLAN0.md`'s original file layout, but consistent
    with its spirit and documented in `README.md`/`CLAUDE.md`.
  - `SKM_CONFIG_DIR` env override in `config.js` — enables test isolation,
    not in `PLAN0.md` but consistent with its "Assumptions" section on
    config-root resolution.
  - `import`'s dual local-path/git-clone mode — a sensible generalization of
    build step 8, documented in the CLI usage text.
  - README title ("SKH — Skill Handler") and repo directory (`skh`) diverge
    cosmetically from the package/CLI name (`skm`) and `PLAN0.md`'s title
    ("SKM — Standard Agent Skill Manager"); package.json's `name` field is
    correctly `skm` throughout, so this is a cosmetic/branding
    inconsistency only, not a functional gap — no fix required unless the
    user wants branding unified.
- **AC-11 (observation, no fix required)**: `src/ttl.js` uses `execSync`
  with interpolated strings for `crontab`/`schtasks` (not `execFileSync`
  with array args). Inputs are internal constants (`TASK_NAME`) or the
  output of `which`/`where` (not attacker-controlled repo/user input), so
  this is **not** the same class of issue as the `git` command-injection
  fix in `CHANGELOG.md` 0.2.0, and is not required to change under this
  audit's scope — flagged only for completeness (**O-1**).

## 8. Open Questions
- Should Gap G-1 (Windows drive-letter depth guard) be fixed by counting
  only path segments *below* the drive root on Windows, or by simply raising
  the threshold to 4 when a drive letter is detected? Either approach
  satisfies AC-7; the choice is an implementation detail for
  `@plan-architect`/`@code-builder` to decide — flagging so it isn't
  silently under- or over-corrected (e.g. over-correcting must not start
  refusing legitimate 3-level POSIX installs like
  `~/.config/skm/skills/<id>` used internally, though that path is never
  passed through the user-facing `forceRemove` guard for the store itself —
  only for `installedPath`/tmp dirs).
- Should the README's dead `BETA_PUBLISHING.md` link be resolved by writing
  the missing guide or by trimming the reference to inline steps already in
  `README.md`'s own Publishing section (which appears to duplicate the same
  content)? Deferred to whoever owns docs fix-up.
- Is the cosmetic `SKH`/`skm` naming inconsistency worth a follow-up task at
  all, or intentionally left as historical/working-title noise? No action
  taken here; documented as AC-10 for the user's awareness only.
