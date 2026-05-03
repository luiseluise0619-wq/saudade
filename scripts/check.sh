#!/usr/bin/env bash
# SAUDADE · v7 §17 통합 검수 — 매 PR 전 실행
#
# 사용:
#   bash scripts/check.sh
#   pnpm check       (package.json scripts 등록 시)

set -e
cd "$(dirname "$0")/.."

echo "════════════════════════════════════════════════════════"
echo "  SAUDADE v7 §17 verification suite"
echo "════════════════════════════════════════════════════════"

# §17.5 contrast
echo
node scripts/check-contrast.js

# §17.9 forbidden
echo
bash scripts/check-forbidden.sh

# JS syntax (모든 saudade-*.js + worker)
echo
echo "=== JS syntax check ==="
FAIL=0
for f in saudade-*.js cloudflare-worker.js bootstrap.js sw.js; do
    if [ -f "$f" ]; then
        if node --check "$f" 2>/dev/null; then
            echo "  ✓ $f"
        else
            echo "  ✗ $f"
            FAIL=$((FAIL+1))
        fi
    fi
done
if [ "$FAIL" -gt 0 ]; then
    echo "✗ $FAIL JS syntax error(s)"
    exit 1
fi

# JSON validity (모든 data/*.json + manifest)
echo
echo "=== JSON validity ==="
FAIL=0
for f in data/*.json manifest.json; do
    if [ -f "$f" ]; then
        if node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then
            echo "  ✓ $f"
        else
            echo "  ✗ $f"
            FAIL=$((FAIL+1))
        fi
    fi
done
if [ "$FAIL" -gt 0 ]; then
    echo "✗ $FAIL JSON parse error(s)"
    exit 1
fi

echo
echo "════════════════════════════════════════════════════════"
echo "  ✓ All v7 §17 checks passed"
echo "════════════════════════════════════════════════════════"
