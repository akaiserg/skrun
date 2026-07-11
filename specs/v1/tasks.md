# Implementation Tasks

> Source: `SPEC.md` audit findings. Repo is not greenfield (existing `package.json`,
> `npm test` 59/59 passing, `verify.sh` gate passing) — no init task needed. Only three
> genuine gaps require fix work: G-1/AC-7 (Windows path-safety guard bug in
> `forceRemove`), G-2/AC-8 (missing regression test coverage for that guard), and
> G-3/AC-9 (dead doc link to a non-existent `BETA_PUBLISHING.md`). All other ACs
> (AC-1–AC-6, AC-10, AC-11) are already satisfied — no fix task, only a final
> verification pass. Tasks are sequenced so the regression test lands and is
> confirmed to fail against current code **before** the fix is applied, per the
> spec-writer's explicit recommendation.

- [x] **Task 1: Add regression test capturing the `forceRemove` Windows path-safety gap**
  - **Objective**: Add test cases to `test/fsutil.test.js` that directly exercise `forceRemove`'s path-depth safety guard, so the current cross-platform bug (Gap G-1/AC-7) is captured in the test suite before it is fixed (Gap G-2/AC-8). At minimum:
    1. A regression assertion that a 2-segment POSIX path (e.g. `/Users/name`) is refused — this already passes today; it locks in current correct behavior so the upcoming fix cannot regress it.
    2. A new assertion that a Windows-style shallow drive-letter path (e.g. `C:\Users\name`, 2 real segments below the drive root) is also refused — this **must fail against the current code**, since `resolved.split(/[\\/]/).filter(Boolean)` currently counts the drive letter (`C:`) as an extra segment, letting a 2-segment Windows path slip past the `< 3` guard.
    - Do not perform any destructive operation against real paths outside the test's own sandboxed tmp directory. Prefer either (a) real directories created under a short, controlled path (e.g. `/tmp/skm-test-guard-<random>`, which naturally resolves to 2 segments on POSIX without symlink resolution) so refusal can be asserted via `existsSync` after calling `forceRemove`, manually cleaning up with a direct `rmSync` afterward; and/or (b) exporting a small, pure depth-check helper from `src/fsutil.js` for direct unit assertions on Windows-style strings, without ever calling `rmSync` on an untrusted resolved path. Do not weaken or bypass the existing guard to make the test pass — the Windows assertion is expected to fail at this stage.
  - **Files to Modify**:
    - `test/fsutil.test.js` (Modify)
  - **Verification Step**: Run `node --test test/fsutil.test.js`. Confirm the new POSIX regression assertion passes, and confirm the new Windows-style assertion **fails**, printing an assertion failure that documents the gap (e.g. path was not refused as expected). Do not proceed to Task 2 until this failure is observed and confirmed to be the Windows-specific assertion (not a typo/setup error elsewhere in the file).

- [x] **Task 2: Fix the `forceRemove` Windows drive-letter path-safety guard**
  - **Objective**: Close Gap G-1/AC-7 in `src/fsutil.js` by tightening `forceRemove`'s depth guard so a Windows-style path is measured at the same effective depth as its POSIX equivalent. Concretely: detect when the input matches a Windows absolute path (e.g. `/^[a-zA-Z]:[\\/]/`); when it does, resolve it with `path.win32.resolve` (so it isn't incorrectly merged with the host `cwd` when tests run on a POSIX box), and exclude the leading drive-letter segment (e.g. `C:`) from the depth count — it is a root marker equivalent to POSIX's leading `/`, which is already excluded by the existing `filter(Boolean)`. Leave the existing POSIX resolution path and depth-counting logic byte-for-byte unchanged for non-Windows-style inputs, per the constraint that current Unix behavior must be preserved exactly.
  - **Files to Modify**:
    - `src/fsutil.js` (Modify)
  - **Verification Step**: Run `node --test test/fsutil.test.js` and confirm **all** assertions now pass, including the previously-failing Windows-style case from Task 1 and the existing POSIX cases (no regressions). Then run `npm test` and confirm all suites still pass (59+ tests, 0 failures).

- [x] **Task 3: Remove dead `BETA_PUBLISHING.md` link from README**
  - **Objective**: Close Gap G-3/AC-9. `README.md`'s Publishing section links to `BETA_PUBLISHING.md`, a file that does not exist in the repo. The Publishing section already contains the full step-by-step content inline (Stable release, Beta release, and beta-install instructions), so the linked file would be pure duplication — remove the dead link line rather than creating a new file, keeping the section self-contained and consistent with the rest of the docs.
  - **Files to Modify**:
    - `README.md` (Modify)
  - **Verification Step**: Run `grep -n "BETA_PUBLISHING" README.md` and confirm no matches remain. Manually re-read the Publishing section to confirm it still reads coherently (no dangling "see X for details" sentence left referring to the removed link).

- [x] **Task 4: Final full verification pass**
  - **Objective**: Confirm the three fixes (Tasks 1–3) close the identified gaps without regressing any already-satisfied acceptance criteria (AC-1–AC-6, AC-10, AC-11) or the two acceptance gates required by the spec (`npm test`, `verify.sh`).
  - **Files to Modify**:
    - None (verification only; no source files modified in this task)
  - **Verification Step**: Run `npm test` and confirm exit code 0 with all suites passing (baseline was 59/59 — count should now be 59+N given Task 1's new assertions). Then run `bash verify.sh` and confirm it exits 0. Then run `git status`/`git diff --stat` and confirm only `test/fsutil.test.js`, `src/fsutil.js`, and `README.md` were touched (matches the audit's fix scope, no unrelated files changed).
