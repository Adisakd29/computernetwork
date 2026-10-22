#!/bin/sh
# Browser end-to-end tests (simulators, practice, exams, XP, analytics, responsive/touch, accounts, learning tools, PWA).
# Needs: PostgreSQL database for E2E_DATABASE_URL (it will be WIPED), python3 + playwright + chromium (+ firefox/webkit for SMOKE_BROWSERS).
# usage: E2E_DATABASE_URL=postgres://.../netlab_e2e [SMOKE_BROWSERS="chromium firefox webkit"] sh tests/e2e/run.sh
cd "$(dirname "$0")/../.."
OUT=${OUT:-/tmp/netlab-e2e}; mkdir -p "$OUT"
FAIL=0
# 3.0 P6: Playwright evaluates string predicates (wait_for_function) inside the page, which an enforced CSP blocks.
# The e2e server sends the same policy as Report-Only; part16 fails on any violation it reports.
CSP=${CSP:-report-only}; export CSP
# ports can be moved so two runs do not clash: E2E_PORT (server, default 3990), E2E_FAKE_PORT (fake Google, default 4556)
P=${E2E_PORT:-3990}; FP=${E2E_FAKE_PORT:-4556}
E2E_BASE=http://127.0.0.1:$P; E2E_FAKE_GOOGLE=http://127.0.0.1:$FP; export E2E_BASE E2E_FAKE_GOOGLE E2E_DATABASE_URL
reset() { DATABASE_URL=$E2E_DATABASE_URL node tests/e2e/setup.js >/dev/null; }
run() { echo "### $*"; "$@" || FAIL=1; }
reset
node tests/e2e/bankans.js "$OUT"
# accounts (2.7): e-mails go to files, Google sign-in goes to a local fake OpenID Connect provider (tests/fake-google.js)
MAIL_DEV_DIR=${MAIL_DEV_DIR:-/tmp/nlmails}; export MAIL_DEV_DIR; rm -rf "$MAIL_DEV_DIR"; mkdir -p "$MAIL_DEV_DIR"
node tests/fake-google.js $FP > "$OUT/fake-google.log" 2>&1 &
FPID=$!
DATABASE_URL=$E2E_DATABASE_URL PORT=$P APP_SECRET=e2e ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-pass-123 \
  EMAIL_MX_CHECK=0 PUBLIC_URL=http://127.0.0.1:$P GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=test-secret \
  GOOGLE_AUTH_URL=http://127.0.0.1:$FP/auth GOOGLE_TOKEN_URL=http://127.0.0.1:$FP/token GOOGLE_JWKS_URL=http://127.0.0.1:$FP/jwks GOOGLE_ISSUER=http://127.0.0.1:$FP \
  node server.js > "$OUT/server.log" 2>&1 &
PID=$!
# 3.0 P6: stop only this run's servers (pwa.py restarts the e2e server on port $P), never other node processes
stop_e2e() { kill $PID $FPID 2>/dev/null; for p in $(pgrep -f "^node server.js"); do tr '\0' '\n' < /proc/$p/environ 2>/dev/null | grep -qx "PORT=$P" && kill $p; done; }
trap stop_e2e EXIT; sleep 2
run python3 tests/e2e/phase4.py "$OUT"
reset; run python3 tests/e2e/phase5.py "$OUT"
run python3 tests/e2e/responsive.py "$OUT"
reset; run python3 tests/e2e/part3.py "$OUT"
reset; run python3 tests/e2e/part4.py "$OUT"
reset; run python3 tests/e2e/part6.py "$OUT"
reset; run python3 tests/e2e/part7.py "$OUT"
reset; run python3 tests/e2e/part8.py "$OUT"
reset; run python3 tests/e2e/part9.py "$OUT"
reset; run python3 tests/e2e/part10.py "$OUT"
reset; run python3 tests/e2e/part11.py "$OUT"
reset; run python3 tests/e2e/part12.py "$OUT"
reset; run python3 tests/e2e/part13.py "$OUT"
reset; run python3 tests/e2e/part14.py "$OUT"
reset; run python3 tests/e2e/part15.py "$OUT"
reset; run python3 tests/e2e/part16.py "$OUT"
reset; run python3 tests/e2e/part17.py "$OUT"
reset; run python3 tests/e2e/part18.py "$OUT"
reset; run python3 tests/e2e/part19.py "$OUT"
reset; run python3 tests/e2e/part20.py "$OUT"     # 3.2: one practical session per week (5 steps, one timer, scores, lock, teacher, mobile)
for B in ${SMOKE_BROWSERS:-chromium}; do reset; BROWSER=$B; export BROWSER; run python3 tests/e2e/smoke.py "$OUT"; done
reset; run python3 tests/e2e/pwa.py "$OUT"          # last: it stops and restarts the server to test offline use
echo "### e2e result: $([ $FAIL = 0 ] && echo PASS || echo FAIL)"
exit $FAIL
