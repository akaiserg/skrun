## 2026-07-11T14:41:00Z — Task 10: Rename package identity in package.json
- **Class**: env/tooling
- **Symptom**: `node --test test/*.test.js` (full suite) hangs indefinitely with no completion after test/purge.test.js starts.
- **Root cause**: `purgeExpired()` in src/commands/purge.js unconditionally calls `removeScheduler()` in src/ttl.js, which runs `execSync('crontab -l ...')` / `execSync('crontab -', ...)`. In this macOS sandbox, invoking `crontab` triggers an OS-level permission prompt that never resolves non-interactively, hanging the test process forever.
- **Fix**: Not fixed (out of scope for Tasks 8-10; ttl.js is untouched by this rename). Worked around by running targeted test files (cli, config, targets, skills) instead of the full suite for verification.
- **Lesson**: Never run the full `npm test`/`node --test test/*.test.js` blindly in this sandbox — test/purge.test.js will hang via crontab. Run individual test files relevant to the task, or background+timeout+kill the crontab-touching suites specifically when full-suite coverage is truly needed.

## 2026-07-11T15:04:03Z — Task 13: Update remaining test files for renamed CLI/env var/paths
- **Class**: env/tooling
- **Symptom**: `node --test test/functional.test.js` (default concurrency) fails ~16/34 subtests with errors like `skrun import <path> --force failed:\nstdout: \nstderr: ` after a ~10000ms execSync timeout, or assertions seeing empty/unexpected CLI output — but only in the full multi-suite run, not when the same describe block is run in isolation.
- **Root cause**: The default `node --test` concurrency spawns many test files/subtests in parallel, each of which shells out via `execSync` to `node bin/skrun.js ...` as a child process. In this sandboxed macOS environment, that level of concurrent process-spawning starves/times out some child processes (10s execSync timeout in the test helper), producing flaky empty-output failures unrelated to any code change.
- **Fix**: Not a real bug — re-ran with `node --test-concurrency=1 --test <files...>` and all tests pass consistently (67/67 across the full suite). No source or test-logic change needed.
- **Lesson**: When verifying `test/functional.test.js` (or the full suite) in this sandbox, always use `node --test-concurrency=1` to avoid false-negative flakiness from child-process contention; do not chase phantom failures that only appear under parallel test execution here.
