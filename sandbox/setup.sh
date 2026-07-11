#!/usr/bin/env bash
set -e

SANDBOX="$(cd "$(dirname "$0")" && pwd)"
SKRUN="node $(dirname "$SANDBOX")/bin/skrun.js"
export SKRUN_CONFIG_DIR="$SANDBOX/.skrun-config"

echo "=== SKRUN Sandbox ==="
echo "Config dir: $SKRUN_CONFIG_DIR"
echo ""

# Clean previous runs
rm -rf "$SANDBOX/fake-repo" "$SANDBOX/my-project" "$SKRUN_CONFIG_DIR"

# --- 1. Create a fake skill repo ---
echo "--- Creating fake skill repo ---"
mkdir -p "$SANDBOX/fake-repo/skills/tdd"
cat > "$SANDBOX/fake-repo/skills/tdd/SKILL.md" << 'SKILL'
---
name: tdd
description: Test-driven development workflow
---
Write tests before implementation. Red → Green → Refactor.
SKILL

mkdir -p "$SANDBOX/fake-repo/skills/code-review"
cat > "$SANDBOX/fake-repo/skills/code-review/SKILL.md" << 'SKILL'
---
name: code-review
description: Code review checklist
---
Review for correctness, readability, and performance.
SKILL

mkdir -p "$SANDBOX/fake-repo/skills/debugging"
cat > "$SANDBOX/fake-repo/skills/debugging/SKILL.md" << 'SKILL'
---
name: debugging
description: Systematic debugging approach
---
Reproduce → Isolate → Fix → Verify.
SKILL

(cd "$SANDBOX/fake-repo" && git init -q && git add -A && git commit -qm "init skills")
echo "Created fake-repo with 3 skills: tdd, code-review, debugging"
echo ""

# --- 2. Create a test project ---
echo "--- Creating test project ---"
mkdir -p "$SANDBOX/my-project/.claude"
mkdir -p "$SANDBOX/my-project/.github"
echo "Created my-project with .claude/ and .github/ dirs"
echo ""

echo "=== Ready! ==="
echo ""
echo "Usage (all commands use the sandbox config, not your real ~/.config/skrun):"
echo ""
echo "  export SKRUN_CONFIG_DIR=$SKRUN_CONFIG_DIR"
echo "  SKRUN=\"$SKRUN\""
echo ""
echo "  # Import skills from fake repo"
echo "  \$SKRUN import $SANDBOX/fake-repo --force"
echo ""
echo "  # List imported skills"
echo "  \$SKRUN list"
echo ""
echo "  # Tag a skill"
echo "  \$SKRUN tag add tdd testing backend"
echo "  \$SKRUN tag list tdd"
echo ""
echo "  # Install into test project"
echo "  cd $SANDBOX/my-project"
echo "  \$SKRUN install tdd"
echo "  \$SKRUN install code-review --copy"
echo "  \$SKRUN install debugging --ttl=1"
echo ""
echo "  # Check installs"
echo "  ls -la .claude/skills/"
echo "  ls -la .github/skills/"
echo ""
echo "  # Sync, purge, history"
echo "  \$SKRUN sync --dry-run"
echo "  \$SKRUN purge"
echo "  \$SKRUN --history"
