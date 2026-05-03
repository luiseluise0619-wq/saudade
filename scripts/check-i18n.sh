#!/usr/bin/env bash
# saudade — translation completeness scan.
#
# Reports:
#   1. JSON dispatches: any non-en file containing English-looking phrases
#      that are likely untranslated (basic stop-word grep).
#   2. JS files: hard-coded English UI strings that should be wrapped in L({...}).
#
# Run:   bash scripts/check-i18n.sh

set -euo pipefail

cd "$(dirname "$0")/.."

ROOT=$(pwd)
echo "saudade · i18n scan · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "----------------------------------------------------"

# Phrases that should never appear in non-English JSON dispatches.
# These are common English filler words; if found it usually means a translation slot was skipped.
EN_LEAK='\b(the|today|filed|next|continue|sign in|sign up|tomorrow|yesterday|please|click|here|loading)\b'

for f in data/dispatches.ko.json data/dispatches.ja.json data/dispatches.es.json data/dispatches.pt.json; do
    [ -f "$f" ] || continue
    echo
    echo "[CHECK] $f"
    if grep -nIE "$EN_LEAK" "$f" >/dev/null 2>&1; then
        echo "  ⚠ English-looking phrases found:"
        grep -nIE "$EN_LEAK" "$f" | head -20 | sed 's/^/    /'
    else
        echo "  ok — no obvious English leaks"
    fi
done

echo
echo "----------------------------------------------------"
echo "[CHECK] JS files for hard-coded English UI strings (>= 4 chars)"
echo "        (excluding console.*, comments, errors, throw, regex)"

# We grep for capitalised multi-word strings inside double-quoted JS string literals.
# Only first 80 hits — anything more is a flag, not an exhaustive list.
grep -nE '"[A-Z][A-Za-z][A-Za-z ]{3,40}"' \
    saudade-*.js 2>/dev/null \
    | grep -vE 'console\.|throw |/\*|//|Error\(|RegExp\(|JSON\.|\.test\(' \
    | grep -vE '"(GET|POST|PUT|DELETE|PATCH|OPTIONS)"' \
    | head -80 \
    || echo "  (none — looks tidy)"

echo
echo "----------------------------------------------------"
echo "[CHECK] privacy.* — per-edition file should exist"
for ed in en ko ja es pt; do
    if [ "$ed" = "ko" ]; then f=privacy.html; else f=privacy.$ed.html; fi
    if [ -f "$f" ]; then
        echo "  $f: present"
    else
        echo "  $f: MISSING"
    fi
done

echo
echo "Done. This is a rough heuristic; a human editor should still skim each edition."
