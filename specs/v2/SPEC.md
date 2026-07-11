# Specification: Rename `skm` → `skrun` and Add OpenCode Target Support

## 1. Overview & Goal
Rename the CLI/package identity from `skm` to `skrun` across all code, config, docs, and
runtime paths, and extend `skrun`'s multi-agent install fan-out to support a third agent
target — **OpenCode** — alongside the existing Claude Code (`.claude`) and GitHub Copilot
(`.github`) targets. This is a package-identity rename (command name, binary, config
directory, env var, string literals, docs) — it does **not** rename the git repository
directory (`skh`) or the GitHub remote, per the task instructions.

## 2. Assumptions & Risks
- **Assumption**: "skrun" replaces "skm" as both the npm package name suffix
  (`@akaiserg/skrun`) and the CLI binary name (`skrun`), and the `bin/skm.js` file is renamed
  to `bin/skrun.js`. — **Risk if wrong**: if the user only wanted the *displayed* CLI command
  renamed but kept the npm scope/package name as `@akaiserg/skm`, published package installs
  would break for existing users depending on `skm`.
- **Assumption**: The config directory default moves from `~/.config/skm/` to
  `~/.config/skrun/`, and the override env var is renamed `SKM_CONFIG_DIR` →
  `SKRUN_CONFIG_DIR`. No automatic migration of existing `~/.config/skm/` data is implemented
  (out of scope) — users on an existing install would need to manually move/re-import skills.
  — **Risk if wrong**: silent data-directory split leaves existing users unable to find their
  previously imported skills after upgrading; this should be called out in CHANGELOG.md as a
  breaking change.
- **Assumption**: The per-skill tag file `skm.json` (per `src/skills.js`) is renamed to
  `skrun.json` for new/re-tagged skills. Because it lives inside each skill folder in the
  global store (not the renamed config dir), old skill folders already containing `skm.json`
  will not be auto-migrated. — **Risk if wrong**: if backward-compat for existing stores is
  required, tag reads would need to fall back to the old filename, which is not currently
  planned in-scope.
- **Assumption**: OpenCode's project-level skill/agent-instruction convention is a
  `.opencode` directory in the project root, mirroring `.claude` and `.github`, with skills
  installed under `.opencode/skills/` (consistent with how `resolveTargets` in
  `src/targets.js` already treats `.claude/skills`, `.github/skills`, `.agents/skills`). This
  could not be verified against OpenCode's actual current documentation from this environment.
  — **Risk if wrong**: if OpenCode actually reads skills from a different path (e.g. project
  root `AGENTS.md`, `.opencode/agent/`, or a totally different convention), the installed
  files will not be discovered by the OpenCode agent, silently defeating the feature. **This
  is flagged as an explicit Open Question below and must be confirmed before/while
  implementing.**
- **Assumption**: `.agents` remains a generic fourth fallback target (used today when no
  agent-specific directory is detected) and is unaffected by this rename/feature-add — it is
  not being repurposed as the OpenCode target.
- **Assumption**: The `--target=` CLI flag gains a new accepted value `opencode` (in addition
  to `claude`, `github`, `agents`, `all`), following the exact pattern already established in
  `src/targets.js`'s `AGENT_DIRS` map and its error message.
- **Assumption**: "add support to copy for open code" in the user's request means "add
  OpenCode as a supported install target using the existing symlink-or-copy (`--copy`)
  mechanism," not a request for a different/new copy mechanism specific to OpenCode. The
  existing `fsutil.linkOrCopy` behavior (symlink by default, `--copy` flag for independent
  snapshots) applies unchanged to the new target. — **Risk if wrong**: if the user meant
  something else by "add support to copy," the implementation would miss the actual intent.

## 3. Scope
- **In scope**:
  - Rename npm package `name` field in `package.json` (from `@akaiserg/skm` to
    `@akaiserg/skrun`) and `bin` field key (`skm` → `skrun`, pointing at `bin/skrun.js`).
  - Rename `bin/skm.js` → `bin/skrun.js` (shebang entry unchanged in content, just the file
    name and any self-references).
  - Update `keywords` in `package.json` if `"skm"`-specific terms exist (add `opencode` to
    keywords list alongside `claude`, `copilot`, `cursor`).
  - Update `src/config.js`: `SKM_CONFIG_DIR` env var → `SKRUN_CONFIG_DIR`; default config dir
    path segment `skm` → `skrun` (both XDG and `~/.config` branches).
  - Update `src/cli.js`: all usage/help text strings (`USAGE` const), version print, and error
    message strings that reference `skm` as the command name, replaced with `skrun`.
  - Update `src/skills.js`: per-skill tag filename `skm.json` → `skrun.json`.
  - Update `src/targets.js`: add `opencode: '.opencode'` to `AGENT_DIRS`, include it in
    auto-detection loop and `--target=opencode` explicit selection, update the "Unknown
    target" error message to list `opencode` as a valid value.
  - Update all test files (`test/*.test.js`) referencing `SKM_CONFIG_DIR`, `skm.json`, `skm`
    CLI invocations, or `.claude`/`.github`/`.agents`-only target lists, to use the new names
    and add coverage for the `.opencode` target (detection, explicit `--target=opencode`
    install, and fan-out to all three-plus-fallback targets together).
  - Update `README.md`, `CHANGELOG.md`, `CLAUDE.md` to reflect the new command name `skrun`,
    new config dir, new env var, and the new OpenCode target in the supported-agents list and
    architecture tables (e.g. `src/targets.js` row, "Detects `.claude`/`.github`/`.agents`" →
    "Detects `.claude`/`.github`/`.opencode`/`.agents`").
  - Add a CHANGELOG.md entry documenting the rename as a breaking change (binary name, config
    dir, env var) and the new OpenCode support as a feature addition.
  - Update `verify.sh` if it references the `skm` binary name or config paths.
- **Out of scope**:
  - Renaming the git repository directory (`skh`) or the GitHub remote/repo name.
  - Automatic data migration from `~/.config/skm/` to `~/.config/skrun/`, or from
    `skm.json` to `skrun.json` in already-imported skill folders.
  - Publishing the renamed package to npm (`npm run publish:*`) — this spec covers source
    changes only.
  - Adding support for any agent other than Claude Code, GitHub Copilot, and OpenCode (e.g.
    Cursor, despite being listed in `package.json` keywords today, is not a wired-up
    `AGENT_DIRS` target currently and remains out of scope for this task).
  - Changing the symlink/copy mechanics themselves (`src/fsutil.js` `linkOrCopy` logic is
    reused as-is for the new target).

## 4. Functional Requirements
- **FR-1**: Running `node bin/skrun.js --version` (or `skrun --version` after `npm link`)
  prints the current package version with the label `skrun`, not `skm`.
- **FR-2**: Running `skrun --help` prints usage text where every command example uses the
  `skrun` prefix (e.g. `skrun import <repo>`, `skrun install <skill>`).
- **FR-3**: `src/config.js` resolves the config directory using `process.env.SKRUN_CONFIG_DIR`
  first, falling back to `$XDG_CONFIG_HOME/skrun`, falling back to `~/.config/skrun`. The old
  `SKM_CONFIG_DIR` variable and `~/.config/skm` path are no longer referenced anywhere in
  source.
- **FR-4**: `src/skills.js` reads and writes per-skill tags to a file named `skrun.json`
  inside each skill folder in the global store.
- **FR-5**: `src/targets.js`'s `resolveTargets` recognizes `opencode` as a valid `--target=`
  value, mapping to the `.opencode` directory in the project root, and creates
  `.opencode/skills/` when that target is selected or auto-detected.
- **FR-6**: When no explicit `--target` is passed and a project root contains a `.opencode`
  directory, `resolveTargets` includes `{ agent: 'opencode', skillsPath: '<root>/.opencode/skills' }`
  in its detected-targets result, using the same detection pattern already used for `.claude`,
  `.github`, and `.agents`.
- **FR-7**: `--target=all` includes the OpenCode target in its fan-out install/sync when
  `.opencode` is present (or is created if selected explicitly), consistent with existing
  behavior for the other three targets.
- **FR-8**: Installing a skill with `--target=opencode` (or via auto-detected/all fan-out)
  respects the existing symlink-by-default / `--copy`-flag-for-independent-snapshot behavior
  identically to the other targets — no new copy mechanism is introduced.
- **FR-9**: `src/cli.js`'s "Unknown target" error message enumerates `claude, github,
  opencode, agents, or all` as the valid values.
- **FR-10**: `package.json`'s `bin` field maps the command name `skrun` to `bin/skrun.js`; the
  `name` field is `@akaiserg/skrun`.
- **FR-11**: All existing automated tests pass with `skm`/`SKM_CONFIG_DIR`/`skm.json`
  references replaced by `skrun`/`SKRUN_CONFIG_DIR`/`skrun.json`, and new tests exist
  covering OpenCode detection, explicit selection, and unknown-target rejection listing
  `opencode` as accepted.

## 5. Non-Functional Requirements & Constraints
- Zero runtime dependencies must be preserved; no new npm packages introduced.
- ESM module style (`"type": "module"`) preserved throughout.
- No shell interpolation: any `git`/subprocess invocation continues to use `execFileSync`
  with an args array (unaffected by this change, called out for completeness since
  `src/commands/import.js` is touched only for string renames, not logic).
- `forceRemove`'s 3-levels-deep safety guard in `src/fsutil.js` is unaffected and must
  continue to function after the config-dir rename (verify `~/.config/skrun` still resolves
  to a path deep enough not to trip the guard, same as `~/.config/skm` did).
- Tests must continue to use `SKRUN_CONFIG_DIR` env override so no test touches the real
  `~/.config/skrun`.
- Compatibility: Node.js `>=16.7.0` engine constraint unchanged.
- This is a breaking change for any existing installed users of `skm` — must be documented in
  CHANGELOG.md with clear migration guidance (reinstall via `skrun`, manually copy
  `~/.config/skm/skills/` to `~/.config/skrun/skills/` if they want to preserve imports).

## 6. Data & Interfaces
- **Renamed files**:
  - `bin/skm.js` → `bin/skrun.js`
- **Modified files** (rename-only string/const changes): `package.json`, `src/cli.js`,
  `src/config.js`, `src/skills.js`, `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `verify.sh`,
  and all files under `test/` referencing the old names.
- **Modified file** (new logic): `src/targets.js`
  - `AGENT_DIRS` map gains: `opencode: '.opencode'`
  - `resolveTargets(cwd, targetFlag)` signature unchanged; behavior extended to include the
    new key in both the explicit-flag branch and the auto-detect loop.
- **Env var**: `SKM_CONFIG_DIR` → `SKRUN_CONFIG_DIR`
- **Config paths**:
  - `~/.config/skm/` → `~/.config/skrun/`
  - `~/.config/skm/skills/` → `~/.config/skrun/skills/`
  - `~/.config/skm/registry.json` → `~/.config/skrun/registry.json`
- **Per-skill file**: `<skill-id>/skm.json` → `<skill-id>/skrun.json`
- **New project-level directory convention**: `<project-root>/.opencode/skills/` (mirrors
  `.claude/skills/`, `.github/skills/`, `.agents/skills/`).
- **CLI**: binary name `skm` → `skrun`; `--target=` accepted values gain `opencode`.

## 7. Acceptance Criteria
- **AC-1**: `grep -r "skm" package.json bin/ src/ test/` (excluding this SPEC.md, CHANGELOG.md
  history entries, and any deliberately-preserved historical/migration-guidance text) returns
  no remaining references to the old command name, env var, or config-dir path in source or
  test code.
- **AC-2**: `node bin/skrun.js --version` runs successfully and prints a version prefixed
  `skrun`.
- **AC-3**: `node bin/skrun.js --help` output shows all commands using the `skrun` prefix.
- **AC-4**: With `SKRUN_CONFIG_DIR` set to a temp dir, running any command creates
  `<tmp>/skills` and `<tmp>/registry.json` (i.e. `ensureConfig()` still works against the
  renamed env var).
- **AC-5**: `src/targets.js` unit tests confirm: (a) a project with only `.opencode/` present
  is auto-detected and returns `{ agent: 'opencode', skillsPath: '.../opencode/skills' }`;
  (b) `resolveTargets(cwd, 'opencode')` creates `.opencode/skills` and returns it explicitly
  even if the directory didn't previously exist; (c) `resolveTargets(cwd, 'bogus')` throws an
  error whose message includes `opencode` in the list of valid targets.
- **AC-6**: `npm test` (all `node:test` suites in `test/*.test.js`) passes with zero failures
  after the rename and the new OpenCode-target tests are added.
- **AC-7**: A skill tagged via `skrun tag add <skill> <tag>` writes tags into a `skrun.json`
  file inside the skill's global-store folder (verified via `test/skills.test.js`).
- **AC-8**: Installing with `--target=all` in a project containing `.claude`, `.github`, and
  `.opencode` directories installs the skill into all three `skills/` subfolders (verified via
  `test/functional.test.js` end-to-end flow).
- **AC-9**: CHANGELOG.md contains a new entry describing the `skm` → `skrun` rename as a
  breaking change and the OpenCode target as an added feature.
- **AC-10**: README.md and CLAUDE.md no longer reference `skm` as the command name and
  correctly list Claude Code, GitHub Copilot, and OpenCode as supported agent targets.

## 8. Open Questions
- **OQ-1 (high risk, blocks confident implementation of the OpenCode target)**: What is
  OpenCode's actual, current, documented convention for project-level skill/instruction
  files — is it `.opencode/skills/` (assumed here for consistency with `.claude` and
  `.github`), a root-level `AGENTS.md`, `.opencode/agent/`, or something else entirely? This
  must be verified (e.g. against OpenCode's official docs) before or during implementation;
  if the assumed path is wrong, `@plan-architect`/`@code-builder` should treat `AGENT_DIRS`
  as a single-line config change to correct once confirmed, but all detection/fan-out logic
  and tests should still be built against the same generalized pattern already used for the
  other three targets so the fix stays cheap.
- **OQ-2**: Should the rename include automatic one-time migration logic (e.g. on first run,
  if `~/.config/skrun/` doesn't exist but `~/.config/skm/` does, copy it over with a warning)?
  This spec currently treats migration as out of scope and manual, but it's a reasonable
  scope addition if the user wants a smoother upgrade path for existing installs.
- **OQ-3**: Is npm package scope `@akaiserg/skrun` correct, or should the package be
  unscoped/renamed differently (e.g. just `skrun`)? Not verified against npm registry
  availability.
- **OQ-4**: Should `.agents` (the generic fallback target) be deprecated/removed now that
  three named agents are supported, or does it remain as-is for agents not otherwise listed
  (e.g. Cursor, future agents)? This spec assumes it remains unchanged.
