#!/usr/bin/env bash
# verify-gate.sh — Stop hook. Blocks Claude from ENDING its turn while the
# deterministic gate (verify.sh) is red.
#
# This is the piece that turns verify.sh from a soft instruction ("please run
# tests") the model can skip into a HARD gate the harness enforces: the model
# literally cannot finish on broken code. (LangChain-style "verify before exit".)
set -uo pipefail

input="$(cat)"

# Loop guard: if we already blocked once this turn, let the turn end.
if printf '%s' "$input" | grep -q '"stop_hook_active":[[:space:]]*true'; then
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Only gate when there are uncommitted changes — pure Q&A turns pass straight through.
if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  exit 0
fi

out="$(bash verify.sh 2>&1)"; rc=$?
if [ "$rc" -ne 0 ]; then
  {
    echo "Verification gate FAILED — do not finish this turn."
    echo "Fix the failures below and re-run \`bash verify.sh\` until it passes:"
    echo "$out"
  } >&2
  exit 2   # exit 2 = block the Stop; stderr is fed back to Claude
fi
exit 0
