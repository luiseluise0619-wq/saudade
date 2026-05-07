# Saudade — 운영자 배포 런북

도메인을 처음 사는 단계는 별도 가이드: [`DEPLOY-DOMAIN.md`](./DEPLOY-DOMAIN.md).

작업 시간 합계: **하루 정도** (RSS 검증 3~4시간이 가장 큼)

---

## 🚀 런칭 체크리스트 (순서대로 한 번씩)

### Step 0 · GitHub 인프라 (10분)
- [ ] Settings → General → Danger Zone → **Make repository public** (Actions 한도 무제한, 시크릿은 안전)
- [ ] 실패한 Actions run 들 → "Re-run all jobs"
- [ ] Settings → Secrets and variables → Actions → New repository secret:
    - [ ] `PEXELS_KEY` (https://www.pexels.com/api/) — 리스닝룸 도시 사진
    - [ ] `FREESOUND_TOKEN` (https://freesound.org/apiv2/apply/) — ASMR mp3
    - [ ] `KAKAO_KEY` (https://developers.kakao.com → REST API key) — 서울 카페 시드
- [ ] Actions 탭에서 워크플로우 1회씩 실행:
    - [ ] "Fetch listening-room content" (target=both) → PR 머지
    - [ ] "Fetch Seoul cafes (Kakao)" (디폴트 14동네) → PR (시드만, 큐레이션은 나중)

### Step 1 · D1 + Worker 시크릿 + 배포
- [ ] [§1 D1 스키마 적용](#1-d1-15분) — 9 schemas (subscriptions.sql 신규 포함)
- [ ] [§2 Worker 시크릿](#2-worker-시크릿-5분) — EDITOR_TOKEN, GEMINI_KEY, RESEND_KEY (옵션) + Stripe 4개 (옵션)
- [ ] [§3 Worker 배포](#3-worker-배포-1분)
- [ ] [§4 RSS 출처 검증](#4-rss-출처-검증-34시간--가장-시간-소요) (3~4시간)

### Step 2 · 콘텐츠 큐레이션
- [ ] Kakao fetched 카페 PR 검토 → 실제 가본 곳만 두 줄 + visited_at 채워서 `cafes-seoul.json` 으로 이전
- [ ] Listening 사진 큐레이션 (옵션) — Pexels 자동 fetch PR 머지면 자동 채워짐
- [ ] 디스패치 cadence 결정 — 매일 vs 화/목/토 (1인 운영 기준 권장: 주 4회)

### Step 3 · 결제 활성화 (수익화 시작 시점)
- [ ] [Stripe Setup](#stripe-setup-결제-활성화) — 4개 시크릿 + 2 가격 생성
- [ ] support.html 의 BMaC 링크 (`buymeacoffee.com/saudade`) 본인 계정으로 교체
- [ ] 첫 결제 테스트 (test mode)
- [ ] 첫 결제 실거래 (live mode)

### Step 4 · 런칭
- [ ] [§5 Pages 배포 확인](#5-pages-자동-배포-확인-5분)
- [ ] PH/Reddit/Twitter 푸시 (commit c160137 마케팅 패키지 참고)
- [ ] Day 30 paywall 활성화 시점 푸터 명시

---

## 0. 사전 준비 (한 번)

```powershell
# Node.js 18+ 설치 (이미 있으면 skip)
# wrangler 설치
npm install -g wrangler

# Cloudflare 로그인
wrangler login
```

---

## 1. D1 (15분)

```powershell
# 데이터베이스 생성 (이미 만들었으면 skip)
wrangler d1 create saudade_db
# 출력의 database_id 를 wrangler.toml [[d1_databases]] 에 적용
# 현재 wrangler.toml 에 0eaf0d89-ec73-4d00-aace-34f385e89c03 이미 적힘 — 확인만

# 스키마 9개 적용 (순서 무관)
wrangler d1 execute saudade_db --remote --file=schema/editor_log.sql
wrangler d1 execute saudade_db --remote --file=schema/cafe_submissions.sql
wrangler d1 execute saudade_db --remote --file=schema/auth.sql
wrangler d1 execute saudade_db --remote --file=schema/city_requests.sql
wrangler d1 execute saudade_db --remote --file=schema/dispatch_retracts.sql
wrangler d1 execute saudade_db --remote --file=schema/ai_pipeline.sql
wrangler d1 execute saudade_db --remote --file=schema/rss_sources.sql
wrangler d1 execute saudade_db --remote --file=schema/v8_following_sessions.sql
wrangler d1 execute saudade_db --remote --file=schema/subscriptions.sql   # 신규 — Stripe 결제 추적

# RSS 출처 시드 (검증 대기 상태로 25 entry)
wrangler d1 execute saudade_db --remote --file=data/rss-sources-seed.sql
```

확인:
```powershell
wrangler d1 execute saudade_db --remote --command="SELECT COUNT(*) FROM rss_sources"
# → 25
```

---

## 2. Worker 시크릿 (5분)

Cloudflare Dashboard → Workers & Pages → `saudade` → Settings → Variables and Secrets → *Add variable* (Type: Secret):

| 이름 | 용도 | 필수 |
|---|---|---|
| `EDITOR_TOKEN` | `/admin/*` 인증 | 필수 |
| `GEMINI_KEY` | AI rewrite (EN cron Write + KO/JA/PT/ES via GitHub Actions) | 필수 |
| `PEXELS_KEY` | Cover videos | 옵션 (이미 있으면 OK) |
| `COVERR_KEY` | Cover videos | 옵션 |
| `RESEND_KEY` | Magic Link 이메일 | 옵션 (없으면 inline 모드 폴백) |
| `RESEND_FROM` | 발신자 (e.g. `Saudade <noreply@your-domain>`) | RESEND_KEY 있을 때 |
| `STRIPE_KEY` | 결제 (Subscriber/Patron) | 옵션 — 없으면 503 BILLING_NOT_CONFIGURED |
| `STRIPE_PRICE_SUBSCRIBER` | $5/mo 구독 가격 ID | STRIPE_KEY 있을 때 |
| `STRIPE_PRICE_PATRON` | $3/mo 후원 가격 ID | STRIPE_KEY 있을 때 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 서명 검증 | STRIPE_KEY 있을 때 |

또는 CLI:
```powershell
wrangler secret put EDITOR_TOKEN
# 입력 프롬프트에 토큰 (랜덤 32자 hex) 붙여넣기
wrangler secret put GEMINI_KEY
```

---

## 3. Worker 배포 (1분)

```powershell
wrangler deploy
```

→ `wrangler.toml` 의 D1 binding + 5 cron triggers 활성화. 현재 cron (모두 EN 에디션 전용):
- `0 15 * * *` — 00:00 KST Gather (RSS 수집)
- `0 17 * * *` — 02:00 KST Sort + Score (도시 분류 + quietness 1-10)
- `0 19 * * *` — 04:00 KST Write (도시 단위 Gemini 재작성)
- `0 20 * * *` — 05:00 KST **(decommissioned in v659 — was Translate)** 빈 슬롯, `{skipped:'decommissioned_v659'}` 반환
- `0 21 * * *` — 06:00 KST File (published) + 월요일이면 weeklyStats 자동

KO/JA/PT/ES 는 GitHub Actions `.github/workflows/refresh-dispatches.yml` 가 매일 06:00 KST 별도로 채움. 워크플로우 첫 활성화는 issue #33 참조.

확인:
```powershell
curl https://saudade.<your-account>.workers.dev/health
# → {"ok":true}
```

---

## 4. RSS 출처 검증 (3~4시간 — 가장 시간 소요)

`docs/rss-sources.md` 참고. 요약:

```powershell
# 시드된 25 entry 확인 (rss_url 모두 NULL)
curl -H "Authorization: Bearer $env:EDITOR_TOKEN" `
     https://saudade.<your-account>.workers.dev/admin/rss-sources?city=lisbon
```

각 출처:
1. `site_url` 직접 방문 → RSS 피드 URL 확보 (없으면 RSS.app 변환)
2. `terms_status='pending'` (8개 큰 매체) ToS 검토
3. PATCH 로 갱신:
   ```powershell
   curl -X PATCH `
        -H "Authorization: Bearer $env:EDITOR_TOKEN" `
        -H "Content-Type: application/json" `
        -d '{"id":3,"rss_url":"https://...","terms_status":"approved","terms_notes":"reviewed 2026-05-XX: ToS 4.2 allows 25-word excerpt + link","active":1}' `
        https://saudade.<your-account>.workers.dev/admin/rss-sources
   ```

---

## 5. Pages 자동 배포 확인 (5분)

Cloudflare Dashboard → Workers & Pages → `saudade` (Pages) → Deployments:
- 최신 main 빌드 → Production 배포됨 확인
- 라이브 URL (saudade.pages.dev 또는 custom domain) 에서:
  - 새로고침 1회 → SW v633 nuke 자동
  - Atlas → MAP 토글 → 우측 하단 "● SHOW MY LOCATION" 버튼 → 위치 표시
  - Desk → "Following" 섹션 → 도시 3개 슬롯
  - Dispatches → 도시 0개일 때 "Popular pairings" 카드 5개 → 한 클릭 시작
  - Listening → "By city · Browse all tracks" 토글

---

## 6. Listening 사진 큐레이션 (선택 — 도시당 1~2시간)

`docs/listening-photos.md` 참고.

- Lisbon 1개 (placeholder 상태 — `/photos/cities/lisbon-alfama.webp` 업로드만 하면 활성)
- 4 도시 추가 (Chiang Mai / Tokyo / Mexico City / Bali) — Unsplash *quiet/empty/rainy* 검색 + 색감 조정 (채도 -5~10%, 살짝 따뜻) + R2 업로드
- `data/listening.json` 의 `cities[]` 에 entry 추가 + 트랙 3개 추가 (`city`, `photo_url` 필드)

전체 14 도시 커버하려면 ~14~28시간 일회성. M3 단계 작업.

---

## 7. 첫 1주 검수 (매일 5분)

```powershell
# RSS gather 확인
wrangler d1 execute saudade_db --remote `
  --command="SELECT COUNT(*) FROM raw_feeds WHERE fetched_at > strftime('%s','now','-1 day')*1000"
# 정상이면 일일 50~200건

# 실패 출처
wrangler d1 execute saudade_db --remote `
  --command="SELECT source_name, fetch_error FROM rss_sources WHERE last_fetch_ok = 0"

# 발행 확인 (06:00 KST 이후)
wrangler d1 execute saudade_db --remote `
  --command="SELECT id, headline, ai_score FROM dispatches_staged WHERE status='published' ORDER BY published_at DESC LIMIT 20"

# 금지어 흘러들어왔나 (사람 검수)
# 6일치 publication 직접 읽기 — magazine 톤 유지 확인
```

문제 발견 시:
- 출처 자체 문제 → `PATCH /admin/rss-sources` `active=0` 으로 차단
- AI 재작성 결과 톤 X → Gemini 프롬프트 (`saudade-ai-pipeline.js` `WEEKDAY_PROMPTS`) 조정
- 특정 dispatch 철회 → `POST /dispatches/retract` (Bearer EDITOR_TOKEN)

---

## 운영자 의사결정 포인트

### Saudade.app 도메인 사용?

- **사용 X** (`saudade.pages.dev` 그대로): Magic Link 이메일 발송 X (Resend 가 검증된 도메인 필요). 사용자 inline 링크로 가입.
- **사용 O**: Cloudflare Pages → Custom domain 추가 + Resend DNS 검증 → Magic Link 정상 작동.

### 카페 데이터 110개 유지 vs 빈 상태?

- 현재 110개 (mock 데이터) 유지 중. v8 §8.10 *"only what we have visited"* 와 충돌하지만 운영자 결정.
- 사용자 검증 후 직접 가본 곳만 남기고 정리하는 게 정합. 또는 `verified_at` 필드로 구분.

### Listening 사진 큐레이션 시기

- **M3 (사용자 100+) 까지 보류** 가능. `Awaiting photograph` placeholder 가 자동 노출.
- 또는 디자인 검증 위해 Lisbon 1개만 먼저 큐레이션.

---

## 트러블슈팅

**`/admin/rss-sources` 가 503 NO_DB**
- D1 binding 안 됨. `wrangler.toml` 의 `database_id` 정확한지 확인 + `wrangler deploy` 재실행.

**Magic Link 안 보임**
- `RESEND_KEY` 미설정 → 응답 body 의 `magic_link` 필드를 화면에 직접 표시 (inline 모드).

**모바일에서 옛 버전 보임**
- SW 캐시. `LOUNJ_RELEASE` (현재 v633) 가 새 버전이면 자동 nuke + reload. 그래도 안 되면 사용자 브라우저 캐시 수동 삭제.

**Atlas 마커 안 뜸**
- HTTPS 인지 확인 (geolocation 은 HTTP X). 모바일 OS 위치 서비스 ON. 사이트 권한 허용.

**cron 실행 안 됨**
- Cloudflare Dashboard → Workers → `saudade` → Triggers 탭에서 5 cron 등록 확인. `wrangler deploy` 다시.

---

## 코드 변경 후 재배포

```powershell
# 1. 로컬에서 수정
# 2. 검수
bash scripts/check.sh

# 3. 캐시 버전 bump (UI 변경 시)
# index.html 의 ?v=v633 → v634 일괄 + bootstrap.js LOUNJ_RELEASE + sw.js CACHE_VERSION

# 4. 커밋 + push
git add .
git commit -m "v634: ..."
git push origin main

# 5. Pages 자동 배포 대기 (1~2분)
# 6. Worker 재배포 (worker 코드 변경했을 때만)
wrangler deploy
```

---

## Stripe Setup (결제 활성화)

런칭 후 수익화 시점에. 그 전까지는 시크릿 미등록 → 모든 결제 엔드포인트 503 BILLING_NOT_CONFIGURED 반환 (앱은 free-only 모드로 정상 동작).

### 1) Stripe 계정 + 두 가격 생성
- https://stripe.com 가입 → 활성화
- Dashboard → Products → Add product 두 번:
  - **Subscriber** — $5/mo recurring · price ID 복사 (`price_xxx`)
  - **Patron** — $3/mo recurring · pay-what-you-want (옵션) · price ID 복사
- Dashboard → Developers → API keys → Secret key 복사 (`sk_live_xxx`)

### 2) Webhook 등록
- Dashboard → Developers → Webhooks → Add endpoint
  - URL: `https://saudade.<your-account>.workers.dev/billing/webhook`
  - Events:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
- Signing secret 복사 (`whsec_xxx`)

### 3) Worker 시크릿 4개 등록
```powershell
wrangler secret put STRIPE_KEY
wrangler secret put STRIPE_PRICE_SUBSCRIBER
wrangler secret put STRIPE_PRICE_PATRON
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler deploy
```

### 4) 검증
```powershell
# 인증된 사용자로 checkout 호출 (Bearer = user.id from localStorage)
curl -X POST https://saudade.<your-account>.workers.dev/billing/checkout `
  -H "Authorization: Bearer <user_id>" `
  -H "Content-Type: application/json" `
  -d '{"plan":"subscriber"}'
# → { ok: true, url: "https://checkout.stripe.com/..." }
```

브라우저로 `support.html` → SUBSCRIBE → Stripe Checkout 도착 → 테스트 카드 (`4242 4242 4242 4242` / any future date / any CVC / any zip) 결제 → success page → tier 자동 'subscriber' 로 갱신.

### 5) BMaC 후원 링크 교체
`support.html` 의 `https://buymeacoffee.com/saudade` 를 본인 BMaC 슬러그로 교체 (또는 Patreon 등 다른 후원 서비스).

---

## 헌법 §17.9 — 매월 자체 검수

```powershell
bash scripts/check.sh
```

통과해야 push. CI 도 같이 검사하지만 로컬에서 먼저 잡는 게 빠름.
