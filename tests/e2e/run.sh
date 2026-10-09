#!/bin/sh
# Browser end-to-end tests (simulators, practice, exams, XP, analytics, responsive/touch, accounts, learning tools, PWA).
# Needs: PostgreSQL database for E2E_DATABASE_URL (it will be WIPED), python3 + playwright + chromium (+ firefox/webkit for SMOKE_BROWSERS).
# usage: E2E_DATABASE_URL=postgres://.../netlab_e2e [SMOKE_BROWSERS="chromium firefox webkit"] sh tests/e2e/run.sh
cd "$(dirname "$0")/../.."
OUT=${OUT:-/tmp/netlab-e2e}; mkdir -p "$OUT"
FAIL=0
reset() { DATABASE_URL=$E2E_DATABASE_URL node tests/e2e/setup.js >/dev/null; }
run() { echo "### $*"; "$@" || FAIL=1; }
reset
node tests/e2e/bankans.js "$OUT"
DATABASE_URL=$E2E_DATABASE_URL PORT=3990 APP_SECRET=e2e ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-pass-123 node server.js > "$OUT/server.log" 2>&1 &
PID=$!; trap 'kill $PID 2>/dev/null; pkill -f "^node server.js" 2>/dev/null' EXIT; sleep 2
run python3 tests/e2e/phase4.py "$OUT"
reset; run python3 tests/e2e/phase5.py "$OUT"
run python3 tests/e2e/responsive.py "$OUT"
reset; run python3 tests/e2e/part3.py "$OUT"
reset; run python3 tests/e2e/part4.py "$OUT"
for B in ${SMOKE_BROWSERS:-chromium}; do reset; BROWSER=$B; export BROWSER; run python3 tests/e2e/smoke.py "$OUT"; done
reset; run python3 tests/e2e/pwa.py "$OUT"          # last: it stops and restarts the server to test offline use
echo "### e2e result: $([ $FAIL = 0 ] && echo PASS || echo FAIL)"
exit $FAIL
