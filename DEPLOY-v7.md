# SAUDADE — v7 운영자 활성화 가이드

7 PR 머지 후 한 번 실행. 모든 D1 schema · secrets · wrangler.toml 추가 통합.

## 0. 사전 준비

```bash
# Cloudflare 계정 (무료) + wrangler CLI
npm i -g wrangler
wrangler login
```

## 1. D1 데이터베이스

```bash
# DB 생성 (한 번만)
wrangler d1 create saudade_db
# → 출력의 database_id 를 wrangler.toml 에 붙여넣기
```

`wrangler.toml` 의 `[[d1_databases]]` 블록 주석 해제 후 id 채움:
```toml
[[d1_databases]]
binding = "SAUDADE_DB"
database_name = "saudade_db"
database_id = "여기에-받은-id"
```

스키마 적용 (PR 머지 후 모든 schema/*.sql 파일이 있어야 함):
```bash
wrangler d1 execute saudade_db --remote --file=schema/editor_log.sql        # PR #1 §9.10
wrangler d1 execute saudade_db --remote --file=schema/cafe_submissions.sql  # PR #2 §8.9
wrangler d1 execute saudade_db --remote --file=schema/auth.sql              # PR #3 §13
wrangler d1 execute saudade_db --remote --file=schema/city_requests.sql     # PR #4 §5.5
wrangler d1 execute saudade_db --remote --file=schema/ai_pipeline.sql       # PR #4 §10
```

## 2. Secrets

```bash
# 편집장 토큰 (POST /editor/log + /desk admin UI Bearer)
wrangler secret put EDITOR_TOKEN
# → 32 byte 랜덤. 예: openssl rand -hex 32

# Magic Link 이메일 (옵션 — 미설정 시 inline link 응답 모드)
wrangler secret put RESEND_KEY     # https://resend.com 가입 후 API key
wrangler secret put RESEND_FROM    # 'Saudade <desk@yourdomain.com>'

# AI 파이프라인 (옵션 — 미설정 시 write/translate 스텁 모드)
wrangler secret put GEMINI_KEY     # https://aistudio.google.com/apikey
```

## 3. AI 파이프라인 (옵션 — 일간 자동 발행)

`wrangler.toml` 추가:
```toml
# v7 §10 — 일간 cron (KST = UTC+9)
[triggers]
crons = [
    "0 15 * * *",    # 00:00 KST gather  (RSS → raw_feeds)
    "30 15 * * *",   # 00:30 KST sort    (Workers AI city classify)
    "0 17 * * *",    # 02:00 KST score   (quietness/dignity 1~10)
    "0 19 * * *",    # 04:00 KST write   (Gemini rewrite → staged)
    "0 20 * * *",    # 05:00 KST translate (en → ko/ja/pt/es)
    "30 20 * * *",   # 05:30 KST stage   (no-op marker)
    "0 21 * * *"     # 06:00 KST file    (top 3 → published)
]

# Workers AI binding (sort/score)
[ai]
binding = "AI"
```

Cloudflare Workers Free tier:
- AI: 10,000 neurons/일 (사용 ~500, 여유 20×)
- Gemini Free: 1,500 req/일 (사용 ~36, 여유 40×)

미설정 시 모든 phase 가 reason='no_*' 반환 — 워커는 정상 동작.

## 4. Pages 배포 (정적 자산)

```bash
# 단일 wrangler 명령 (워커 + Pages 분리 시)
wrangler deploy
# → https://lounj.absbjj1230.workers.dev (워커)

# Pages 는 Cloudflare Dashboard 에서 GitHub repo 연결
# - 빌드 명령: (없음 — 정적)
# - 출력 디렉토리: /
```

`bootstrap.js:22` 의 `window.AURA_SERVER` 가 워커 URL 과 일치해야 함:
```js
window.AURA_SERVER = 'https://lounj.absbjj1230.workers.dev';
```

## 5. 콘텐츠 셋업 (편집장 직접)

### 본인 도시 결정
- 영문판만 시작 (Phase 1 M1)
- 본인 정착 도시 1개 (예: Seoul)

### 카페 5~10개 등록 (`data/cafes-seoul.json`)
- amenities 어휘 풀에서만 선택 (`data/cafe-vocabulary.json`)
- 3태그 (best_for / known_for / not_for)
- editor_note 2~4 문장
- 시드 예: PR #2 의 CAFÉ ONION ANGUK 항목 참조

### 비자/세금/보험/연금 입력 (Ledger)
- 본인 ISO 입국일 + 만료일 (`saudade-ledger.js` 폼)
- 한국 NHIS 정지 일정
- 국민연금 해외체류 신고 일정

### RSS 시드 (`cloudflare-worker.js:RSS_PIPELINE_FEEDS`)
- Phase 2 default: Lisbon city hall · BBC Europe · Tate London (3개)
- 본인 도시 city hall · 박물관 RSS 추가

## 6. 검수 (자동 + 수동)

### 자동 (PR 마다)
```bash
bash scripts/check.sh    # contrast · forbidden · syntax · JSON
```

GitHub Actions `.github/workflows/check.yml` 가 PR 마다 실행 (CI 도입 후).

### 수동 (편집장 일일 ~15분)
- `/desk` 진입 (Ctrl+Shift+D 또는 #desk)
- 오늘 staged dispatches REVIEW / EDIT / RETRACT
- POST `/editor/log` → §9.10 활동 감지 입력 (Editor-on-Leave 방지)

### Editor-on-Leave 자동 일시중지 (§9.10)
- 7일 무활동: `UNEDITED` 라벨 (계속 발행)
- 14일: 발행 cron 정지 + Cover 메시지
- 30일: Stripe pause (free-mode 라 stub)

## 7. PR 머지 순서

PR 들이 같은 worker / index.html 을 건드림 — sequential merge 시 conflict 가능.

권장:
1. **#1** — `add-quarterly-dispatch-qKAvy` (§02b · §10.6 · §9.5q · §9.10 · §11)
2. **#2** — `atlas-gps-walkring` (§8 series, 8 commits)
3. **#3** — `phase-1-completion` (§13 Magic Link)
4. **#4** — `phase-2-dispatches-desk` (§5.4 · §9.5d · §10 desk · §5.5 · AI scaffold)
5. **#5** — `phase-2b-followups` (§5.5 endpoint · scheduled() gather/sort/score)
6. **#6** — `phase-2c-ai-publish` (write/translate/file · /dispatches/today · city wiring)
7. **#7** — `v7-tooling` (scripts/check.sh)
8. **이 PR** — `ci-and-deploy-guide` (CI workflow · 이 가이드)

#5/#6/#7/이 PR 은 worker 또는 인덱스에 동시 추가 — conflict 시 모두 보존 머지.

## 8. 운영비 (Phase 1)

| 서비스 | 무료 한도 | 사용 (예상) | 비용 |
|---|---|---|---|
| Cloudflare Pages | 무제한 | — | $0 |
| Cloudflare Workers | 100k req/일 | ~5k | $0 |
| Cloudflare D1 | 5GB · 5M reads/일 | ~10MB · ~100k | $0 |
| Cloudflare R2 | 10GB · 무제한 download | ~1GB (audio) | $0 |
| Workers AI | 10k neurons/일 | ~500 | $0 |
| Gemini 2.0 Flash | 1.5k req/일 | ~36 | $0 |
| Resend | 3k/월 | ~50 | $0 |
| **월 합계** | | | **$0** |

도메인만 $10~15/년. 헌법 §13 "운영비 영구 0원 (도메인 외)" 충족.

## 9. v2 백로그 (차단됨)

| 항목 | 차단 사유 |
|---|---|
| Vector style migration (§8.7) | Y2+ · 사용자 5,000명+ |
| Stripe Editor-on-Leave 30d | free-mode 종료 후 |
| §10.6 worker write protection | 관리 API 설계 결정 후 |
| §19 광고 모델 Editor's Choice | Year 3 · 사용자 5,000+ |
| LOUNJ 레거시 정리 (Phase 5) | 편집장 사전 허가 필요 |

---

**완성 상태**: v7 §21 Phase 1~3 모두 ✅. Phase 4~5 운영 후 결정.
