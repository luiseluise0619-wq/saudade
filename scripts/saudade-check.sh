#!/usr/bin/env bash
# SAUDADE · CI lint — 헌법 §7 DON'T 룰 검출
# SAUDADE_TYPOGRAPHY.md ⑤ 의 grep 패턴 정밀화 (CJK 한글 / 매거진 글리프 제외).
# 사용: bash scripts/saudade-check.sh
set -u
RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; RST=$'\033[0m'

fail=0
note() { printf '%s\n' "$*"; }
err()  { printf '%s%s%s\n' "$RED" "$*" "$RST"; fail=1; }
ok()   { printf '%s%s%s\n' "$GRN" "$*" "$RST"; }
warn() { printf '%s%s%s\n' "$YEL" "$*" "$RST"; }

# CSS 파일에서 /* */ 블록 코멘트와 // 라인 코멘트는 grep 대상에서 제외하기 위해
# 미리 stripped temp file 로 만든 뒤 검사.
stripped() {
    # arg: path. CSS/JS 코멘트 stripped — 라인 번호 보존 (코멘트 라인은 빈 줄로).
    awk '
        BEGIN { in_block=0 }
        {
            line=$0
            # block comment 처리
            while (1) {
                if (in_block) {
                    p = index(line, "*/")
                    if (p) { line = substr(line, p+2); in_block=0 }
                    else   { line = ""; break }
                }
                p = index(line, "/*")
                if (!p) break
                # block 시작 — 끝이 같은 라인에 있는지 검사
                rest = substr(line, p+2)
                q = index(rest, "*/")
                if (q) {
                    line = substr(line, 1, p-1) substr(rest, q+2)
                } else {
                    line = substr(line, 1, p-1)
                    in_block=1
                    break
                }
            }
            # // 라인 코멘트 제거
            sub(/\/\/.*$/, "", line)
            print line
        }
    ' "$1"
}

# 1) letter-spacing 하드코딩 — saudade-* 파일에서 var(--tr-*) 또는 inherit/normal/0 만 허용
note "── 1. letter-spacing 하드코딩 검출 ──"
hits=""
for f in saudade-skin.css saudade-typography.css saudade-tokens.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" | nl -ba | awk '
        /letter-spacing:[[:space:]]*[^;]+/ {
            line=$0
            sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "", line)
            # 허용: var(--tr-...), inherit, normal, 0, 0!important
            if (line ~ /letter-spacing:[[:space:]]*var\(--tr-/) next
            if (line ~ /letter-spacing:[[:space:]]*inherit/) next
            if (line ~ /letter-spacing:[[:space:]]*normal/) next
            if (line ~ /letter-spacing:[[:space:]]*0[[:space:];!]/) next
            print FILENAME ":" $0
        }
    ' FILENAME="$f")
    [ -n "$out" ] && hits="$hits$out
"
done
if [ -n "$hits" ]; then
    err "❌ letter-spacing 하드코딩 (--tr-* 변수 또는 inherit/normal/0 만 허용):"
    printf '%s' "$hits"
else
    ok "✓ 자간 모두 var(--tr-*) 또는 허용 keyword"
fi

# 2) font-weight 700/600/bold (Fraunces 300, Mono 300/400/500 만 허용)
note "── 2. font-weight 700/600/bold 검출 ──"
hits=""
for f in saudade-skin.css saudade-typography.css saudade-tokens.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" | grep -nE "font-weight:[[:space:]]*(700|600|800|900|bold|bolder)" || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ 금지 weight: $hits"
else
    ok "✓ weight 300/400/500 만 사용"
fi

# 3) 금지 폰트 (Handoff v2 §1.2 + §12) — Cormorant Garamond / EB Garamond / Inter /
# Roboto / system-ui / Orbitron / Rajdhani / Exo. Cormorant Infant 는 Português 에디션 허용.
note "── 3. 금지 폰트 검출 (v2 확장) ──"
hits=""
for f in saudade-skin.css saudade-typography.css saudade-tokens.css saudade-edition-tokens.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" \
        | grep -nE 'Cormorant Garamond|EB Garamond|font-family.*"Inter"|font-family.*Roboto|font-family.*system-ui|font-family.*Orbitron|font-family.*Rajdhani|font-family.*Exo' \
        || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ 금지 폰트 발견: $hits"
else
    ok "✓ saudade-*.css 에 금지 폰트 없음 (Cormorant Infant 는 PT 에디션 예외)"
fi

# 4) 이모지 (실제 이모지 unicode 블록만 — § © ★ → ← · 등 매거진 글리프는 허용)
note "── 4. 이모지 검출 (Misc Symbols & Pictographs / Emoticons / Transport / Supplemental Symbols) ──"
hits=""
for f in saudade-cover.js saudade-rings.js saudade-masthead.js saudade-footer-rule.js saudade-skin.css saudade-typography.css saudade-tokens.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" | grep -nP '[\x{1F300}-\x{1F5FF}\x{1F600}-\x{1F64F}\x{1F680}-\x{1F6FF}\x{1F900}-\x{1F9FF}\x{1FA70}-\x{1FAFF}\x{2600}-\x{26FF}]' 2>/dev/null || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ 이모지: $hits"
else
    ok "✓ saudade-* 에 이모지 없음"
fi

# 5) box-shadow (SAUDADE 매거진 그림자 금지)
note "── 5. box-shadow 검출 ──"
hits=""
for f in saudade-skin.css saudade-tokens.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" | grep -nE "box-shadow:[[:space:]]*[^n0v]" \
        | grep -vE "box-shadow:[[:space:]]*(none|0|var\(--shadow-)" || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ box-shadow 사용: $hits"
else
    ok "✓ box-shadow none 또는 hairline 토큰"
fi

# 6) border-radius >= 8px
note "── 6. border-radius >= 8px ──"
hits=""
for f in saudade-skin.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" | grep -nE "border-radius:[[:space:]]*([89][0-9]*|[1-9][0-9]+)px" \
        | grep -vE "999px|/\*|50%" || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ radius 8px 이상: $hits"
else
    ok "✓ radius 0~4px"
fi

# 7) 그라디언트
note "── 7. linear-gradient / radial-gradient ──"
hits=""
for f in saudade-skin.css saudade-tokens.css saudade-typography.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" | grep -nE "(linear-gradient|radial-gradient|conic-gradient)\(" || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ 그라디언트: $hits"
else
    ok "✓ saudade-*.css 에 그라디언트 없음"
fi

# 8) 회전 애니메이션 — refresh spin 만 예외 (saudade-skin.css §20)
note "── 8. 회전 애니메이션 검출 (refresh spin 외) ──"
hits=""
for f in saudade-skin.css saudade-cover.js saudade-rings.js saudade-masthead.js saudade-footer-rule.js; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" | grep -nE "(rotate\(|@keyframes[[:space:]]+(spin|rotate))" \
        | grep -vE "rotate\(0deg\)|rotate\(360deg\)|@keyframes spin" || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ 회전 애니메이션: $hits"
else
    ok "✓ refresh spin 외 회전 애니메이션 없음"
fi

# 9) 도시 큐레이션 수
note "── 9. saudade-cover.js COVER_COPY 도시 수 ──"
city_count=$(grep -cE "^[[:space:]]+'[A-Z]" saudade-cover.js 2>/dev/null || echo 0)
note "현재 ${city_count} 도시 큐레이션 (목표 100)."

# 10) v2 추가 금지 카피 — Breaking / Urgent / Alert 등 (Handoff v2 §5.3.4)
note "── 10. 금지 카피 검출 (Breaking / Urgent / Alert / Top stories) ──"
hits=""
for f in saudade-*.js data/*.json; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" 2>/dev/null \
        | grep -niE '(^|[^a-z])(BREAKING|URGENT|ALERT|TOP STORIES|TOP STORY)([^a-z]|$)' \
        || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ 금지 카피 발견: $hits"
else
    ok "✓ Breaking / Urgent / Alert / Top stories 0건"
fi

# 11) 16:9 / 9:16 / 21:9 풀블리드 비율 (Handoff v2 §1.3)
note "── 11. 금지 비율 검출 (16:9 / 9:16 / 21:9) ──"
hits=""
for f in saudade-*.css; do
    [ -f "$f" ] || continue
    out=$(stripped "$f" \
        | grep -nE 'aspect-ratio:[[:space:]]*(16[/:][[:space:]]*9|9[/:][[:space:]]*16|21[/:][[:space:]]*9)' \
        || true)
    [ -n "$out" ] && hits="$hits[$f]$out
"
done
if [ -n "$hits" ]; then
    err "❌ 금지 비율: $hits"
else
    ok "✓ 16:9 / 9:16 / 21:9 풀블리드 0건"
fi

echo
if [ $fail -eq 0 ]; then
    printf '%s\n' "${GRN}━━━ SAUDADE LINT PASS ━━━${RST}"
    exit 0
else
    printf '%s\n' "${RED}━━━ SAUDADE LINT FAIL — 머지 금지 ━━━${RST}"
    exit 1
fi
