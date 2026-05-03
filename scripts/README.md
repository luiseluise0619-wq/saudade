# scripts/

v7 §17 자동 검수 도구. 매 PR 전 `bash scripts/check.sh` 실행 권장.

## check.sh

전체 검수 통합:
- §17.5 contrast (paper × 모든 토큰, 5 에디션 + base 폴백)
- §17.9 forbidden grep (금지 폰트 / 금지어 / 펄스 / "You are here")
- JS syntax (모든 `saudade-*.js`, `cloudflare-worker.js`, `bootstrap.js`, `sw.js`)
- JSON validity (모든 `data/*.json`, `manifest.json`)

```bash
bash scripts/check.sh
```

미달 시 exit 1 (CI fail). 통과 시 exit 0.

## check-contrast.js

WCAG contrast 계산. 5 에디션 + base 폴백 모두 검증.

목표 (v7 §4.1):
- `--ink × --paper` ≥ 11
- `--bone-d × --paper` ≥ 7
- `--bone × --paper` ≥ 4.5 (PR1.5 옵션 4 후 비-텍스트 데코 전용 — 4.5 미달 시 경고만)
- `--accent × --paper` ≥ 5

```bash
node scripts/check-contrast.js
```

토큰 변경 시 (예: edition 추가, accent 색조 조정) 이 스크립트의 EDITIONS 배열도 동기화.

## check-forbidden.sh

§17.9 grep 패턴:
- 금지 폰트 (Inter / Roboto / Cormorant Garamond / EB Garamond) — `font-family` 컨텍스트
- 금지어 UI 카피 (BREAKING / URGENT / ALERT / CRISIS / SHOCKING / TRAGIC / OUTRAGE / SCANDAL / CONTROVERSY) — `FORBIDDEN_WORDS` 가드 변수는 제외
- 둥근 채워진 버튼 (`button { border-radius: non-zero }`) — 수동 검토 권장
- 펄스 애니메이션 (`animation: pulse` / `@keyframes pulse`)
- "You are here" 텍스트

`scripts/`, `node_modules/`, `.git/`, `logos/`, `test/` 는 grep 제외.

## package.json 통합 (옵션)

```json
{
  "scripts": {
    "check": "bash scripts/check.sh",
    "contrast": "node scripts/check-contrast.js"
  }
}
```

## CI 통합 (옵션)

`.github/workflows/check.yml`:
```yaml
on: [pull_request]
jobs:
  v7-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: bash scripts/check.sh
```
