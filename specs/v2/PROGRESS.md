## 2026-07-11T14:22:48Z — Task 1: Add OpenCode target to src/targets.js
- **Status**: DONE
- **Changed**: src/targets.js
- **Verified**: `node --test test/targets.test.js` — 5/5 existing tests pass
- **Decisions/notes**: Added `opencode: '.opencode'` to AGENT_DIRS map and updated the "Unknown target" error message to list `opencode`. The existing detection/fan-out loop in resolveTargets is fully generic (iterates Object.entries(AGENT_DIRS)), so no other logic changes were needed for auto-detect, --target=all, or explicit --target=opencode to work — verified this is sufficient for FR-5/FR-6/FR-9 code paths, though dedicated opencode test coverage is deferred to Task 2 per the task split.
- **Next**: Task 2 — Add OpenCode detection/fan-out tests to test/targets.test.js

## 2026-07-11T14:27:11Z — Task 2: Add OpenCode detection/fan-out tests to test/targets.test.js
- **Status**: DONE
- **Changed**: test/targets.test.js
- **Verified**: `node --test test/targets.test.js` — 9/9 pass (5 existing + 4 new: detects .opencode dir, --target=all includes opencode, --target=opencode explicit install, unknown target error lists opencode)
- **Decisions/notes**: Followed the existing test pattern exactly (mkdtempSync/mkdirSync/resolveTargets/assert). Covers FR-6, FR-7, FR-8, FR-9 per AC-5.
- **Next**: Task 3 — Extend test/functional.test.js for end-to-end OpenCode fan-out

## 2026-07-11T14:27:11Z — Task 3: Extend test/functional.test.js for end-to-end OpenCode fan-out
- **Status**: DONE
- **Changed**: test/functional.test.js
- **Verified**: `node --test test/functional.test.js` — 34/34 pass; also ran alongside test/targets.test.js (43/43 pass). Note: one earlier ad-hoc run showed 17 failures due to a `2>&1 > file` shell redirection ordering bug on my part (stderr went to terminal, stdout-only file looked empty/truncated) — not a real test failure; re-run with correct redirection confirmed all green.
- **Decisions/notes**: Added two tests to the existing `functional: target resolution` describe block: (1) `.claude`+`.github`+`.opencode` all present with `--target=all` installs into all three and asserts "3 install(s) completed" output, satisfying AC-8; (2) confirms `.agents` fallback still works with no agent dirs present and no `.opencode` dir is created, guarding against regressions to FR-6 auto-detect fallback behavior.
- **Next**: Task 4 — Rename env var and config paths in src/config.js

## 2026-07-11T14:30:08Z — Task 4: Rename env var and config paths in src/config.js
- **Status**: DONE
- **Changed**: src/config.js
- **Verified**: `SKRUN_CONFIG_DIR=/tmp/xyz node -e "import('./src/config.js').then(c=>console.log(c.configDir))"` prints /tmp/xyz
- **Decisions/notes**: Renamed SKM_CONFIG_DIR -> SKRUN_CONFIG_DIR and default paths ~/.config/skm -> ~/.config/skrun.
- **Next**: Task 5 — Update test/config.test.js for renamed env var

## 2026-07-11T14:30:08Z — Task 5: Update test/config.test.js for renamed env var
- **Status**: DONE
- **Changed**: test/config.test.js
- **Verified**: `node --test test/config.test.js` 1/1 pass
- **Decisions/notes**: Replaced SKM_CONFIG_DIR references and tmp dir prefix with skrun equivalents.
- **Next**: Task 6 — Rename per-skill tag file skm.json -> skrun.json in src/skills.js

## 2026-07-11T14:30:08Z — Task 6: Rename per-skill tag file skm.json -> skrun.json in src/skills.js
- **Status**: DONE
- **Changed**: src/skills.js
- **Verified**: `node --test test/skills.test.js` 5/5 pass (run together with Task 7 changes)
- **Decisions/notes**: Updated metaPath constants in getTags/setTags; no migration of existing files, per spec.
- **Next**: Task 7 — Update test/skills.test.js for renamed tag file

## 2026-07-11T14:30:08Z — Task 7: Update test/skills.test.js for renamed tag file
- **Status**: DONE
- **Changed**: test/skills.test.js
- **Verified**: `node --test test/skills.test.js` 5/5 pass
- **Decisions/notes**: Replaced SKM_CONFIG_DIR env references, tmp dir prefix, and skm.json test description with skrun equivalents.
- **Next**: Task 8 — Rename binary bin/skm.js -> bin/skrun.js

## 2026-07-11T14:40:50Z — Task 8: Rename binary bin/skm.js -> bin/skrun.js
- **Status**: DONE
- **Changed**: bin/skrun.js (moved from bin/skm.js)
- **Verified**: `node bin/skrun.js --version` prints version string
- **Decisions/notes**: bin/ dir untracked by git (mv used, not git mv). Relative import `../src/cli.js` unchanged.
- **Next**: Task 9 — Rewrite CLI usage/version text in src/cli.js

## 2026-07-11T14:40:50Z — Task 9: Rewrite CLI usage/version text in src/cli.js
- **Status**: DONE
- **Changed**: src/cli.js
- **Verified**: `node bin/skrun.js --version` -> "skrun v0.4.0-beta.0"; `node bin/skrun.js --help` shows all skrun-prefixed usage lines
- **Decisions/notes**: Replaced all skm -> skrun in USAGE banner, version print, and unknown-command hint. Also updated --target= option list to include opencode (was missing from Task 1's scope), since FR-9 requires it reflected in help text.
- **Next**: Task 10 — Rename package identity in package.json

## 2026-07-11T14:40:50Z — Task 10: Rename package identity in package.json
- **Status**: DONE
- **Changed**: package.json
- **Verified**: `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')).bin)"` -> { skrun: 'bin/skrun.js' }; `npm start -- --version` -> "skrun v0.4.0-beta.0"; `grep -n "skm\|SKM" package.json` -> no matches
- **Decisions/notes**: Renamed name to @akaiserg/skrun, bin map key skrun -> bin/skrun.js, start script to node bin/skrun.js, added "opencode" keyword. Ran targeted tests (cli, config, targets, skills = 19/19 pass). Full `npm test` / `node --test test/*.test.js` hangs on test/purge.test.js because purgeExpired() -> removeScheduler() -> execSync('crontab -l'/'crontab -') triggers a macOS permission prompt in this sandbox — pre-existing env issue unrelated to tasks 8-10 (ttl.js untouched). test/functional.test.js also currently fails (references literal 'bin/skm.js' path) — expected breakage, in scope for Task 13's test-file sweep, not Tasks 8-10.
- **Next**: Task 11 — Sweep remaining skm/SKM_CONFIG_DIR references in src/commands/*.js and src/logger.js/src/ttl.js

## 2026-07-11T15:04:03Z — Task 11: Sweep remaining skm/SKM_CONFIG_DIR references in src/commands/*.js
- **Status**: DONE
- **Changed**: src/commands/import.js, src/commands/list.js, src/commands/install.js, src/commands/tag.js, src/commands/uninstall.js
- **Verified**: `grep -rn "skm\|SKM" src/commands/` — no output
- **Decisions/notes**: Plain string-literal renames only (usage/error messages, tmp dir prefix `skm-import-` -> `skrun-import-`); no logic changes.
- **Next**: Task 12 — Sweep remaining skm references in src/logger.js and src/ttl.js

## 2026-07-11T15:04:03Z — Task 12: Sweep remaining skm references in src/logger.js and src/ttl.js
- **Status**: DONE
- **Changed**: src/logger.js, src/ttl.js
- **Verified**: `grep -rn "skm\|SKM" src/logger.js src/ttl.js` — no output; `node --test test/purge.test.js` — 2/2 pass (crontab hang did NOT reproduce this run; purgeExpired's removeScheduler path is apparently not exercised by these tests, or the sandbox prompt only fires under some other trigger — see LEARNINGS.md)
- **Decisions/notes**: Renamed CRON_MARKER, TASK_NAME, log message, `resolveSkm()` -> `resolveSkrun()` function (including internal `which skm`/`npx skm` strings) in src/ttl.js; renamed log file `skm.log` -> `skrun.log` in src/logger.js.
- **Next**: Task 13 — Update remaining test files for renamed CLI/env var/paths

## 2026-07-11T15:04:03Z — Task 13: Update remaining test files for renamed CLI/env var/paths
- **Status**: DONE
- **Changed**: test/fsutil.test.js, test/registry.test.js, test/purge.test.js, test/targets.test.js, test/functional.test.js
- **Verified**: `node --test-concurrency=1 --test test/functional.test.js test/registry.test.js test/fsutil.test.js test/targets.test.js` — 55+ tests, 0 fail. functional.test.js's `bin/skm.js` literal path fixed to `bin/skrun.js` (this was the known interim breakage from Task 10 noted in LEARNINGS.md), plus all `skm*` helper function names (`skm`, `skmAll`, `skmFail`, `skmEnv`, `skmEnvFail`) renamed to `skrun*` equivalents and `SKM`/`SKM_CONFIG_DIR` consts renamed to `SKRUN`/`SKRUN_CONFIG_DIR`.
- **Decisions/notes**: Discovered that running `test/functional.test.js` at default concurrency intermittently fails ~16 subtests with 10s execSync timeouts (empty stdout/stderr) purely from resource contention spawning many concurrent `node bin/skrun.js ...` child processes in this sandbox — NOT caused by the rename (confirmed: isolating the failing describe block alone, or forcing `--test-concurrency=1`, both pass 100%). Logged in LEARNINGS.md so future full-suite runs use `--test-concurrency=1`.
- **Next**: Task 14 — Full-suite skm reference sweep verification (AC-1 gate)

## 2026-07-11T15:04:03Z — Task 14: Full-suite skm reference sweep verification (AC-1 gate)
- **Status**: DONE
- **Changed**: None (verification-only; no stragglers found)
- **Verified**: `grep -rn "skm\|SKM" package.json bin/ src/ test/` — no output (AC-1 clean). `node --test-concurrency=1 --test test/cli.test.js test/config.test.js test/fsutil.test.js test/functional.test.js test/purge.test.js test/registry.test.js test/skills.test.js test/targets.test.js` — 67/67 pass, 0 fail (ran all 8 suites together including purge.test.js; crontab hang did not occur in this run).
- **Decisions/notes**: All Task 11-13 renames were sufficient; no additional stragglers needed fixing for the AC-1 gate.
- **Next**: Task 15 — Update verify.sh for renamed binary/config paths

## 2026-07-11T15:11:07Z — Tasks 15-18: docs sweep (verify.sh, README.md, CHANGELOG.md, CLAUDE.md)
- **Status**: DONE
- **Changed**: verify.sh (no edit needed — already generic, no skm/SKM literals present), README.md, CHANGELOG.md, CLAUDE.md
- **Verified**: `bash verify.sh` → GATE PASSED (67/67 tests, `skrun` referenced throughout output); `grep -n "skm\|SKM" README.md` and `grep -n "skm\|SKM" CLAUDE.md` → no matches; `git diff CHANGELOG.md` (untracked file, N/A) — visually confirmed only new `0.4.0-beta.0` entry prepended, `0.2.0` historical section untouched.
- **Decisions/notes**: Task 15's `verify.sh` had zero `skm`/`SKM` literal references to begin with (it's a generic stack-detecting gate that just shells to `npm test`), so no code change was required there — only confirmed it runs clean and its output mentions `skrun`. Added OpenCode (`.opencode/skills/`, `--target=opencode`) mentions to README.md (tagline, why-section, ASCII diagram, target-resolution list, options table) and CLAUDE.md (What This Package Does, `src/targets.js` row) to match `src/targets.js`'s actual target keys (`claude`, `github`, `opencode`, `agents`). CHANGELOG.md got one new `0.4.0-beta.0` entry documenting the rename as a Breaking change (no auto-migration) plus OpenCode support as Added.
- **Next**: Task 19 — Final full verification pass

## 2026-07-11T15:20:00Z — Code-review audit fix: sandbox/setup.sh + uninstall.js usage string
- **Status**: DONE
- **Changed**: sandbox/setup.sh, src/commands/uninstall.js
- **Verified**: `grep -rn "skm\|SKM" sandbox/ src/commands/uninstall.js` — no matches; `bash -n sandbox/setup.sh` — syntax OK; `node --test-concurrency=1 --test test/*.test.js` — 67/67 pass, 0 fail
- **Decisions/notes**: sandbox/setup.sh was missed by the earlier rename sweep (Tasks 10-14) since it's not under bin/, src/, or test/ — the AC-1 grep gate scope didn't cover it. Renamed `SKM`->`SKRUN` var, `bin/skm.js`->`bin/skrun.js`, `.skm-config`->`.skrun-config`, all echoed `$SKM ...` usage examples, and the `~/.config/skm` reference in the usage banner. Also added missing `opencode` to uninstall.js's usage-error target list to match cli.js/targets.js.
- **Next**: Task 19 — Final full verification pass
