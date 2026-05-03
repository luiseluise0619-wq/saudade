> **DEPRECATED — see [DEPLOY-v8.md](./DEPLOY-v8.md) for current runbook.**
>
> 이 문서는 역사 자료. v8 단일 운영자 가이드는 DEPLOY-v8.md.

---

# Cloudflare Worker 배포 가이드 (LOUNJ Proxy + API)

`cloudflare-worker.js` 를 자체 호스팅해서 외부 무료 CORS 프록시 (allorigins,
corsproxy.io, codetabs) 의존성을 제거합니다. Worker 가 RSS 화이트리스트 +
rate-limit + 5분 캐시 + KV 영구캐시까지 처리합니다.

> **무료 한도 (Cloudflare Workers Free)**: 100,000 req/day · 10ms CPU/req · KV
> 1GB 저장 · 100,000 read/day. 일반 사용량으로는 충분합니다 — 동시 사용자
> 1,000명 × 일 100요청까지 무료.

---

## 1. Cloudflare 계정 + Worker 생성

1. https://dash.cloudflare.com → Sign up (무료, 카드 X)
2. **Workers & Pages** → **Create** → **Create Worker**
3. 이름: `lounj` (또는 본인이 원하는 것 — 아래 명령 모두 동일하게 맞춰야 함)
4. 생성하면 URL 이 발급됨: `https://lounj.<your-account>.workers.dev`

## 2. wrangler 설치 + 로그인

```bash
npm install -g wrangler          # 또는 npx wrangler ...
wrangler login                   # 브라우저에서 OAuth 로 로그인
wrangler whoami                  # 로그인 확인
```

## 3. 시크릿 등록 (선택)

Pexels/Coverr/Gemini API 키는 Dashboard 에서 Type=Secret 으로 등록:

```
Workers & Pages → lounj → Settings → Variables and Secrets → Add
  - PEXELS_KEY          (Pexels API key, Type: Secret)
  - COVERR_KEY          (Coverr 키, Type: Secret — 선택)
  - GEMINI_KEY          (Gemini API key, Type: Secret — AI Trip 기능)
  - LICENSE_SIGNING_KEY (라이선스 검증, Type: Secret — 프리미엄 기능)
```

CLI 로 등록하려면:
```bash
wrangler secret put PEXELS_KEY    # 입력 프롬프트에 키 붙여넣기
```

## 4. KV 네임스페이스 (선택, 적극 권장)

캐시/rate-limit 가 KV 없이도 동작하지만 KV 가 있으면 cold start + 90일
영구캐시까지 활용 가능:

```bash
wrangler kv namespace create AURA_KV
# → 출력에서 id 복사 후 wrangler.toml 의 [[kv_namespaces]] 섹션 주석 해제 +
#   id 채우기. binding 은 'AURA_KV' 그대로.
```

## 5. 배포

```bash
cd /path/to/aura.os
wrangler deploy                  # cloudflare-worker.js 업로드
# 또는
wrangler deploy cloudflare-worker.js
```

성공하면 출력 마지막 줄에:
```
Published lounj
  https://lounj.<your-account>.workers.dev
```

## 6. 클라이언트에 Worker URL 주입

`bootstrap.js` 의 첫 줄들 :

```js
window.AURA_SERVER = 'https://lounj.<your-account>.workers.dev';
```

이 한 줄만 본인 URL 로 바꾸면 끝. `app.js` 의 `PROXIES` 배열, `rss.js` 의
fetchRss, `extra-data.js` 의 producthunt 호출 등이 모두 자동으로 Worker 우선
사용으로 전환됩니다.

## 7. 동작 확인

브라우저 콘솔에서:

```js
fetch(`${window.AURA_SERVER}/health`).then(r => r.json()).then(console.log)
// → { ok: true, ts: ... }
```

또는 RSS 프록시:
```js
fetch(`${window.AURA_SERVER}/rss?url=https://www.bbc.com/news/world/rss.xml`)
  .then(r => r.text()).then(t => console.log(t.slice(0, 200)))
```

---

## 화이트리스트 (78 호스트)

`cloudflare-worker.js` 의 `RSS_OK` 배열에 정의됨. 추가 도메인 필요하면
`RSS_OK` 끝에 도메인을 push 후 `wrangler deploy` 다시 실행:

- BBC, Reuters, AP, NPR, Guardian, NYT, WSJ, FT, Bloomberg
- TechCrunch, The Verge, Ars Technica, Wired
- Hacker News, Reddit (RSS), Reuters Korea, Yonhap, Chosun
- 기타 70+ (전체 리스트는 `cloudflare-worker.js:56` 참조)

요청 도메인이 화이트리스트 밖이면 `BAD_URL` 422 반환 — SSRF 차단.

## Rate limit

- IP 당 RSS 분당 30회 (`/rss/*`)
- IP 당 전체 분당 60회 (다른 엔드포인트)
- 초과 시 429 + `RATE_LIMIT_RESET` 헤더에 unlock 시각 반환

## 트러블슈팅

**`wrangler deploy` 가 25 MiB 초과로 실패하는 경우**:
`wrangler.toml` 에 `[assets]` 블록이 있으면 제거. main 만 지정:
```toml
name = "lounj"
main = "cloudflare-worker.js"
compatibility_date = "2026-04-30"
```

**CORS 에러 (브라우저 콘솔에 "Access-Control-Allow-Origin")**:
`cloudflare-worker.js` 의 `ALLOWED_ORIGINS` 에 본인 도메인 추가 후 재배포.
Pages 미리보기 (`*.pages.dev`) 는 `ALLOWED_ORIGIN_RX` 정규식으로 통과됨.

**KV 가 비어있어 캐시 안 먹는 경우**:
KV namespace 생성하지 않았으면 `caches.default` (edge cache) 만 사용 — 5분
TTL. 정상 동작이지만 cold start 마다 origin fetch. KV 활성화 권장.
