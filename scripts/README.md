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

## ⚙️ GitHub Actions로 실행 (키 노출 없음)

수동 실행, 결과는 PR로 들어옴. 키는 GitHub Secrets에만 있고 워크플로우 러너 밖으로 안 나감.

### 1회 셋업

GitHub 리포 → Settings → Secrets and variables → Actions → New repository secret

| 이름 | 값 |
|---|---|
| `PEXELS_KEY` | https://www.pexels.com/api/ 에서 발급 |
| `FREESOUND_TOKEN` | https://freesound.org/apiv2/apply/ 에서 발급 |

### 실행

Actions 탭 → "Fetch listening-room content" → Run workflow → 옵션 선택:

- `target` — pexels / freesound / both
- `per` — 쿼리당 결과 수 (기본 3)
- `queries` — 커스텀 쿼리 (콤마 구분, 선택)

완료 후 자동으로 `content/listening-<run_id>` 브랜치 + PR 생성. 리뷰어가 결과물 보고 (사진은 Pexels URL 클릭, mp3는 다운받아 듣기) 안 좋은 거 삭제 후 merge.

`.github/workflows/fetch-content.yml` 참고.

---

## fetch-pexels-photos.js

Listening Room 사진 수집. Pexels CDN 직링 + 라이선스 sidecar 자동 생성.

```bash
# 1. 키 발급 — https://www.pexels.com/api/ (무료, 200/hr)
# 2. 시크릿 export
export PEXELS_KEY=YOUR_KEY
# 3. 기본 8쿼리 × 3장 = 24장 가져오기
node scripts/fetch-pexels-photos.js
# 4. 또는 커스텀 쿼리
node scripts/fetch-pexels-photos.js --queries "porto port wine cellar,seoul cafe ceramic"
# 5. dry-run (미리보기)
node scripts/fetch-pexels-photos.js --dry
```

출력:
- `data/listening-photos.json` — id, src, photographer, alt
- `data/licenses/pexels-<id>.json` — sidecar (validate-content.js 통과용)

사진은 다운로드 X — Pexels CDN URL 직링. 운영자가 결과 보고 listening-photos.json 에서 안 좋은 거 삭제 → 커밋.

## fetch-freesound.js

Listening Room 사운드 수집. CC0 / CC-BY 만, 60초+, 44.1kHz+, 다운로드 100+, 평점 3.5+.

```bash
# 1. 토큰 발급 — https://freesound.org/apiv2/apply/ (무료 가입 + 신청)
export FREESOUND_TOKEN=YOUR_TOKEN
# 2. 기본 9쿼리 × 3트랙 = 27 후보 (필터 후 더 적음)
node scripts/fetch-freesound.js
# 3. 메타만, 다운로드 X
node scripts/fetch-freesound.js --no-download
# 4. 커스텀
node scripts/fetch-freesound.js --queries "lisbon tram,kissaten kettle"
```

출력:
- `audio/asmr/<slug>-<id>.mp3` — preview HQ mp3 (스트리밍 OK)
- `data/listening-tracks.json` — listening.json 에 머지할 트랙 목록
- `data/licenses/freesound-<id>.json` — 작자, 라이선스, 출처 sidecar

운영자가 mp3 들어보고 좋은 거만 골라서 `data/listening.json` "tracks" 배열에 머지. 나머지는 mp3 + sidecar 같이 삭제.

전제: NC 라이선스는 자동 배제 (상업 사이트 안전). 검색 후 ≥3.5 평점 또는 ≥5 평가 받은 것만 통과.

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
