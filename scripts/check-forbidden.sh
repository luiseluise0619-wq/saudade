#!/usr/bin/env bash
# SAUDADE · v7 §17.9 — 금지 폰트 / 금지어 / 둥근 마커 / 펄스 grep
#
# 사용:
#   bash scripts/check-forbidden.sh

set -e
cd "$(dirname "$0")/.."

echo "=== v7 §17.9 forbidden grep ==="

EXCLUDE_DIRS='--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude-dir=scripts --exclude-dir=logos --exclude-dir=saudade-wordmark --exclude-dir=test'
# LOUNJ 레거시 파일 (v6 SAUDADE 전환 잔재 — Phase 5 정리 백로그):
#   cafe-mode.js · ambient-mode.js · style.css · app.js · landing.html ·
#   style-color.css · saudade-skin.css (LOUNJ→SAUDADE 매핑 레이어)
EXCLUDE_LEGACY='--exclude=cafe-mode.js --exclude=ambient-mode.js --exclude=style.css --exclude=app.js --exclude=landing.html --exclude=style-color.css --exclude=saudade-skin.css --exclude=index.html --exclude=credits.html --exclude=privacy.html --exclude=terms.html --exclude=logo-preview.html'
INCLUDE='--include=*.js --include=*.css --include=*.html'

FAIL=0

# ─── 금지 폰트 (v7 §2.2) ────────────────────────────────────
# Inter, Roboto, system-ui, Cormorant Garamond, EB Garamond
# 단, font-family 컨텍스트 내에서만 fail (URL/주석 제외 어려움 → grep 후 수동 검토)
echo
echo "[금지 폰트 — font-family 또는 import 컨텍스트만]"
HITS=$(grep -rnE '\b(Inter|Roboto|Cormorant Garamond|EB Garamond)\b' $INCLUDE $EXCLUDE_DIRS $EXCLUDE_LEGACY . 2>/dev/null | \
       grep -vE 'comment|@cf/meta|import\s+\{|require\(' | \
       grep -E 'font-family|@import|@font-face|src:' || true)
if [ -n "$HITS" ]; then
    echo "$HITS"
    FAIL=$((FAIL+1))
else
    echo "  ✓ 0 hits"
fi

# system-ui 는 Phase 1 제한 (v7 §3.2 한국어판 sans 에는 허용) → 확인만
SYS_UI=$(grep -rnE 'font-family[^;]*system-ui' $INCLUDE $EXCLUDE_DIRS $EXCLUDE_LEGACY . 2>/dev/null | wc -l)
echo "  system-ui font-family 사용: $SYS_UI 건 (한국어판 sans 외엔 X)"

# ─── 금지어 (v7 §9.6 / §10.5) — 사용자 노출 카피만 ──────────
echo
echo "[금지어 — UI 카피 (en/ko/ja/pt/es)]"
# 가드 리스트 자체는 worker/quarterly 등에 등장 — 'FORBIDDEN_WORDS' 같은 변수 정의는 제외
HITS=$(grep -rnwE '(BREAKING|URGENT|ALERT|CRISIS|SHOCKING|TRAGIC|OUTRAGE|SCANDAL|CONTROVERSY)' $INCLUDE $EXCLUDE_DIRS $EXCLUDE_LEGACY . 2>/dev/null | \
       grep -vE 'FORBIDDEN|forbidden|PIPELINE_FORBIDDEN|hasForbidden|alert\(|console\.alert|TRACK|setInterval|clearInterval|interval' | \
       grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|--|#)' || true)
if [ -n "$HITS" ]; then
    echo "$HITS"
    FAIL=$((FAIL+1))
else
    echo "  ✓ 0 hits"
fi

# ─── 둥근 채워진 버튼 (v7 §18) ──────────────────────────────
# border-radius:50% 는 §8.5 dot marker / atlas badge 만 허용 (decoration)
# button { background:fill ... border-radius:50%+ } 패턴 검색
echo
echo "[둥근 채워진 버튼 — button { border-radius >0 + background fill }]"
HITS=$(grep -rnE 'button[^{]*\{[^}]*border-radius:\s*([1-9]|50%)' $INCLUDE $EXCLUDE_DIRS $EXCLUDE_LEGACY . 2>/dev/null | head -10 || true)
if [ -n "$HITS" ]; then
    echo "  (수동 검토 — dot marker/뱃지는 OK, 채워진 버튼은 ✗)"
    echo "$HITS" | head -5
    # FAIL 안 함 — 수동 검토 (background fill 자동 분석 어려움)
else
    echo "  ✓ 0 hits (button + non-zero border-radius)"
fi

# ─── 펄스 애니메이션 (v7 §8.5) ───────────────────────────────
echo
echo "[펄스 애니메이션 — animation: pulse / @keyframes pulse]"
HITS=$(grep -rnE 'animation:\s*pulse|@keyframes\s+pulse' $INCLUDE $EXCLUDE_DIRS $EXCLUDE_LEGACY . 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "$HITS"
    FAIL=$((FAIL+1))
else
    echo "  ✓ 0 hits"
fi

# ─── "You are here" 텍스트 (v7 §8.5) ────────────────────────
echo
echo "[You are here 텍스트]"
HITS=$(grep -rnEi '"You are here"|당신은 여기' $INCLUDE $EXCLUDE_DIRS $EXCLUDE_LEGACY . 2>/dev/null | grep -vE 'comment|//|/\*' || true)
if [ -n "$HITS" ]; then
    echo "$HITS"
    FAIL=$((FAIL+1))
else
    echo "  ✓ 0 hits"
fi

echo
if [ "$FAIL" -gt 0 ]; then
    echo "✗ §17.9 — $FAIL forbidden hit(s)"
    exit 1
else
    echo "✓ §17.9 — all forbidden patterns clean"
    exit 0
fi
