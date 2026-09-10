#!/usr/bin/env bash
# Verifies the project end-to-end on YOUR machine (requires internet access
# for npm, which the environment that generated this repo did not have).
#
# Usage:
#   chmod +x verify.sh
#   ./verify.sh
#
# What it does, in order:
#   1. npm install (root workspaces: backend + frontend)
#   2. Type-check the backend (tsc --noEmit)
#   3. Build the frontend (tsc -b && vite build) — catches any frontend
#      type errors and confirms the production bundle compiles
#   4. Run backend tests (unit tests + full Temporal workflow scenario suite)
#
# It does NOT start Temporal server / worker / API / frontend dev servers —
# see README.md "Running everything locally" for that (it needs multiple
# long-running terminals, which isn't something a single script should do).

set -euo pipefail

step() { echo; echo "==> $1"; }

step "1/4 Installing dependencies (this may take a minute)"
npm install

step "2/4 Type-checking backend"
npm run lint --workspace backend

step "3/4 Type-checking + building frontend"
npm run build --workspace frontend

step "4/4 Running backend tests (unit + Temporal workflow scenarios)"
npm test --workspace backend

echo
echo "✅ All checks passed: dependencies install, both packages type-check,"
echo "   the frontend builds, and every scenario test in the spec passes."
echo
echo "Next: follow the 'Running everything locally' section in README.md"
echo "to actually exercise the app end-to-end through the UI."
