# Implementation Tasks

- [x] **Task 1: Add OpenCode target to `src/targets.js` (foundational, highest risk)**
  - **Objective**: Extend `AGENT_DIRS` with `opencode: '.opencode'` and update the "Unknown target" error message to list `opencode` as an accepted value, per FR-5/FR-6/FR-9. This is the most novel piece of the spec and should land first since everything else is a mechanical rename.
  - **Files to Modify**:
    - `src/targets.js` (Modify — add `opencode: '.opencode'` to `AGENT_DIRS`; update error message to `Unknown target: ${targetFlag}. Use: claude, github, opencode, agents, or all`)
  - **Verification Step**: Run `node --test test/targets.test.js` (existing tests must still pass — no new tests yet, this task is code-only).

- [x] **Task 2: Add OpenCode detection/fan-out tests to `test/targets.test.js`**
  - **Objective**: Cover FR-6 (auto-detect `.opencode` when no `--target` passed), FR-7 (`--target=all` includes opencode when present), FR-8 (`--target=opencode` explicit install creates `.opencode/skills`), and FR-9 (unknown target error lists `opencode`).
  - **Files to Modify**:
    - `test/targets.test.js` (Modify — add new test cases following the existing pattern used for `.claude`/`.github`/`.agents`)
  - **Verification Step**: Run `node --test test/targets.test.js` and verify all new and existing assertions pass.

- [x] **Task 3: Extend `test/functional.test.js` for end-to-end OpenCode fan-out**
  - **Objective**: Add an end-to-end scenario asserting that with `.claude`, `.github`, and `.opencode` all present, `--target=all` (and auto-detect) installs into all three plus verifies `.agents` fallback still works when none are present, satisfying AC-8.
  - **Files to Modify**:
    - `test/functional.test.js` (Modify — add OpenCode-inclusive fan-out scenario, minimal addition alongside existing multi-target test)
  - **Verification Step**: Run `node --test test/functional.test.js` and verify it passes.

- [x] **Task 4: Rename env var and config paths in `src/config.js`**
  - **Objective**: Rename `SKM_CONFIG_DIR` → `SKRUN_CONFIG_DIR`, default config dir from `skm` → `skrun` (both XDG and `~/.config` branches), per FR-3.
  - **Files to Modify**:
    - `src/config.js` (Modify — rename `skmOverride`/env var/path segments)
  - **Verification Step**: Run `node --test test/config.test.js` after Task 5 updates the test file; for this task alone, manually verify via `SKRUN_CONFIG_DIR=/tmp/xyz node -e "import('./src/config.js').then(c=>console.log(c.configDir))"` prints `/tmp/xyz`.

- [x] **Task 5: Update `test/config.test.js` for renamed env var**
  - **Objective**: Replace all `SKM_CONFIG_DIR` references with `SKRUN_CONFIG_DIR` and any `skm`-named path assertions with `skrun`, satisfying AC-4.
  - **Files to Modify**:
    - `test/config.test.js` (Modify)
  - **Verification Step**: Run `node --test test/config.test.js` and verify it passes.

- [x] **Task 6: Rename per-skill tag file `skm.json` → `skrun.json` in `src/skills.js`**
  - **Objective**: Update `getTags`/`setTags` to read/write `skrun.json` instead of `skm.json`, per FR-4. No migration of existing files (out of scope per spec).
  - **Files to Modify**:
    - `src/skills.js` (Modify — change both `metaPath` constants)
  - **Verification Step**: Run `node --test test/skills.test.js` (will fail until Task 7 updates the test file — acceptable to run both together).

- [x] **Task 7: Update `test/skills.test.js` for renamed tag file**
  - **Objective**: Replace `skm.json` references with `skrun.json` in test fixtures/assertions, satisfying AC-7.
  - **Files to Modify**:
    - `test/skills.test.js` (Modify)
  - **Verification Step**: Run `node --test test/skills.test.js` and verify it passes.

- [x] **Task 8: Rename binary — `bin/skm.js` → `bin/skrun.js`**
  - **Objective**: Rename the shebang entry file (content/shebang line unchanged aside from any self-referential comments), satisfying part of FR-10.
  - **Files to Modify**:
    - `bin/skrun.js` (Create — copy of `bin/skm.js` content)
    - `bin/skm.js` (Delete)
  - **Verification Step**: Run `node bin/skrun.js --version` and verify it prints a version string (may still say `skm v...` until Task 9 lands — that's expected at this point).

- [x] **Task 9: Rewrite CLI usage/version text in `src/cli.js`**
  - **Objective**: Replace all `skm` command-name references in `USAGE`, `--version` output, `--help` output, and the "Unknown command" error message with `skrun`; update `--target=` help line to include `opencode`, per FR-1/FR-2/FR-9.
  - **Files to Modify**:
    - `src/cli.js` (Modify — `USAGE` string, `console.log('skm v...')`, error messages)
  - **Verification Step**: Run `node bin/skrun.js --version` and confirm output is `skrun v<version>`; run `node bin/skrun.js --help` and confirm usage lines read `skrun ...` and mention `opencode` in target options.

- [x] **Task 10: Rename package identity in `package.json`**
  - **Objective**: Rename `name` to `@akaiserg/skrun`, `bin` key `skm` → `skrun` pointing at `bin/skrun.js`, `start` script to `node bin/skrun.js`, and add `opencode` to `keywords`, per FR-10.
  - **Files to Modify**:
    - `package.json` (Modify — `name`, `bin`, `scripts.start`, `keywords`)
  - **Verification Step**: Run `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')).bin)"` and verify it prints `{ skrun: 'bin/skrun.js' }`; run `npm start -- --version` and verify it prints `skrun v<version>`.

- [x] **Task 11: Sweep remaining `skm`/`SKM_CONFIG_DIR` references in `src/commands/*.js` and `src/logger.js`/`src/ttl.js`**
  - **Objective**: Replace remaining string literals/log messages/comments referencing `skm` or `SKM_CONFIG_DIR` in `src/commands/import.js`, `install.js`, `list.js`, `tag.js`, `uninstall.js`, `src/logger.js`, `src/ttl.js` with `skrun`/`SKRUN_CONFIG_DIR` equivalents.
  - **Files to Modify**:
    - `src/commands/import.js` (Modify)
    - `src/commands/install.js` (Modify)
    - `src/commands/list.js` (Modify)
    - `src/commands/tag.js` (Modify)
    - `src/commands/uninstall.js` (Modify)
  - **Verification Step**: Run `grep -rn "skm\|SKM" src/commands/` and verify no output; run `npm test` and confirm no new failures introduced by this task.

- [x] **Task 12: Sweep remaining `skm` references in `src/logger.js` and `src/ttl.js`**
  - **Objective**: Replace remaining `skm`/`SKM_CONFIG_DIR`/scheduler-name references (e.g. cron job identifiers, log file naming context) in `src/logger.js` and `src/ttl.js` with `skrun`/`SKRUN_CONFIG_DIR`.
  - **Files to Modify**:
    - `src/logger.js` (Modify)
    - `src/ttl.js` (Modify)
  - **Verification Step**: Run `grep -rn "skm\|SKM" src/logger.js src/ttl.js` and verify no output; run `node --test test/purge.test.js` and verify it passes.

- [x] **Task 13: Update remaining test files for renamed CLI/env var/paths**
  - **Objective**: Replace all remaining `skm`/`SKM_CONFIG_DIR` references in `test/fsutil.test.js`, `test/functional.test.js`, `test/purge.test.js`, `test/registry.test.js` with `skrun`/`SKRUN_CONFIG_DIR` equivalents, satisfying FR-11.
  - **Files to Modify**:
    - `test/fsutil.test.js` (Modify)
    - `test/functional.test.js` (Modify)
    - `test/purge.test.js` (Modify)
    - `test/registry.test.js` (Modify)
  - **Verification Step**: Run `npm test` and verify the full suite passes with zero failures.

- [x] **Task 14: Full-suite `skm` reference sweep verification (AC-1 gate)**
  - **Objective**: Run the acceptance-criteria grep across `package.json`, `bin/`, `src/`, `test/` and fix any stragglers missed by prior tasks (e.g. comments, stray strings) before moving to docs.
  - **Files to Modify**:
    - Any of `package.json`, `bin/skrun.js`, `src/**/*.js`, `test/**/*.js` (Modify, as needed based on grep output — expected to be empty or near-empty after Tasks 1-13)
  - **Verification Step**: Run `grep -rn "skm\|SKM" package.json bin/ src/ test/` and verify it returns no matches (excluding this being run against files already covered — should be clean). Then run `npm test` and verify all suites pass.

- [x] **Task 15: Update `verify.sh` for renamed binary/config paths**
  - **Objective**: Replace `skm` binary invocations and `~/.config/skm` / `SKM_CONFIG_DIR` path references in `verify.sh` with `skrun` equivalents.
  - **Files to Modify**:
    - `verify.sh` (Modify)
  - **Verification Step**: Run `bash verify.sh` (or `sh verify.sh`) and verify it completes successfully referencing `skrun` throughout its output.

- [x] **Task 16: Update `README.md` for rename and new OpenCode target**
  - **Objective**: Replace all `skm` command examples/config-dir/env-var references with `skrun` equivalents; add OpenCode to the list of supported agent targets and update any `AGENT_DIRS`/detection tables to include `.opencode`, satisfying AC-10.
  - **Files to Modify**:
    - `README.md` (Modify)
  - **Verification Step**: Run `grep -n "skm\|SKM" README.md` and verify no matches remain (aside from intentionally historical text, if any); visually confirm `.opencode` is listed alongside `.claude`/`.github`/`.agents`.

- [x] **Task 17: Update `CHANGELOG.md` with breaking-change and feature entry**
  - **Objective**: Add a new entry documenting the `skm` → `skrun` rename as a breaking change (binary name, config dir `~/.config/skrun`, env var `SKRUN_CONFIG_DIR`, no auto-migration) and the new OpenCode (`--target=opencode`, `.opencode/skills/`) support, per AC-9.
  - **Files to Modify**:
    - `CHANGELOG.md` (Modify — prepend new version entry, preserve historical `skm` references in old entries as-is)
  - **Verification Step**: Visually review the new entry for accuracy; run `git diff CHANGELOG.md` and confirm only a new entry was added, no historical entries were altered.

- [x] **Task 18: Update `CLAUDE.md` architecture doc for rename and OpenCode**
  - **Objective**: Update package name, commands, architecture tables, and conventions section in `CLAUDE.md` to reflect `skrun`, `SKRUN_CONFIG_DIR`, `skrun.json`, and OpenCode detection in `src/targets.js`'s row, per AC-10.
  - **Files to Modify**:
    - `CLAUDE.md` (Modify)
  - **Verification Step**: Run `grep -n "skm\|SKM" CLAUDE.md` and verify no non-historical matches remain.

- [ ] **Task 19: Final full verification pass**
  - **Objective**: Confirm all acceptance criteria (AC-1 through AC-10) hold together after the full rename + OpenCode feature addition.
  - **Files to Modify**: None (verification-only task; fix-forward only if a regression is found, touching only the specific file at fault).
  - **Verification Step**: Run `npm test` (full suite green); run `node bin/skrun.js --version` and `node bin/skrun.js --help` (both show `skrun`); run `grep -rn "skm\|SKM" package.json bin/ src/ test/` (no output); run `SKRUN_CONFIG_DIR=/tmp/skrun-verify node bin/skrun.js list` and confirm `/tmp/skrun-verify/skills` and `/tmp/skrun-verify/registry.json` are created.
