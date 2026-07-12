#!/usr/bin/env bash
# verify.sh — the deterministic HARD GATE for the autopilot harness.
#
# Auto-detects the stack (same matrix as CLAUDE.md) and runs lint + typecheck +
# build + test. Exits non-zero if ANY step fails. This exit code IS the verdict —
# it is a machine fact, not an LLM's opinion. @test-verifier RUNS this; it does
# not get to overrule it. Run it yourself anytime: `bash verify.sh`.
#
# This gate deliberately runs the FULL suite (not just changed/affected files):
# integrity beats speed here, and it's the last line before a slice is accepted.
# Fast, targeted "affected tests only" belong in @code-builder's inner iteration
# loop for quick feedback — NOT in this gate. Do not narrow it to win speed.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

fail=0
run() {
  local label="$1"; shift
  echo "▶ $label: $*"
  if "$@"; then
    echo "✓ $label passed"
  else
    local rc=$?
    echo "✗ $label FAILED (exit $rc)"
    fail=1
  fi
}

# Run an npm script only if it is actually declared (avoids false "missing script" fails).
has_npm_script() { node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null; }

detected=0

if [ -f package.json ]; then
  detected=1; echo "Detected: Node.js"
  has_npm_script lint      && run "lint"      npm run lint
  has_npm_script typecheck && run "typecheck" npm run typecheck
  has_npm_script build     && run "build"     npm run build
  if has_npm_script test; then
    echo "▶ test: npm test"
    test_out="$(npm test 2>&1)"; rc=$?
    echo "$test_out"
    if [ "$rc" -eq 0 ]; then
      echo "✓ test passed"
    else
      echo "✗ test FAILED (exit $rc)"; fail=1
    fi
    # node --test exits 0 even when ZERO tests ran — warn (don't fail, keeps greenfield green).
    if ! echo "$test_out" | grep -qE '# tests [1-9]|[1-9][0-9]* (passing|passed)|[0-9]+ tests?,'; then
      echo "⚠ test: zero tests detected — gate is green but proves nothing. Add tests."
    fi
  fi
fi

if [ -f go.mod ]; then
  detected=1; echo "Detected: Go"
  run "vet"   go vet ./...
  run "build" go build ./...
  run "test"  go test ./...
fi

if [ -f Cargo.toml ]; then
  detected=1; echo "Detected: Rust"
  run "clippy" cargo clippy -- -D warnings
  run "build"  cargo build
  run "test"   cargo test
fi

if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  detected=1; echo "Detected: Python"
  # Warn (don't silently skip) when a checker is absent — a missing tool means the
  # gate is greener than it looks. Same honesty principle as the zero-tests warning.
  if command -v ruff   >/dev/null; then run "lint"      ruff check .; else echo "⚠ lint: ruff not installed — style unchecked. Install ruff to close this gap."; fi
  if command -v mypy   >/dev/null; then run "typecheck" mypy .;       else echo "⚠ typecheck: mypy not installed — types unchecked."; fi
  if command -v pytest >/dev/null; then run "test"      pytest -q;     else echo "⚠ test: pytest not installed — gate is green but proves nothing. Install pytest."; fi
fi

if [ "$detected" -eq 0 ]; then
  echo "No stack markers found (greenfield/scaffold) — nothing to verify yet. PASS."
  exit 0
fi

if [ "$fail" -ne 0 ]; then
  echo "── verify.sh: GATE FAILED ──"
  exit 1
fi
echo "── verify.sh: GATE PASSED ──"
exit 0
