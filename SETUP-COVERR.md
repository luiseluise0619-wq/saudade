# Coverr API — Worker Secret Setup

LOUNJ 의 cafe-mode 영상 풀 보강용 무료 소스. 키는 **Cloudflare Worker 환경변수에만** 저장.

> 🚫 **절대 금지**: 키 평문을 git tracked 파일(소스/문서/주석)에 적지 말 것.
> 한 번 commit 되면 history 에 영원히 남아 키를 reset 해야 함.

---

## 1) Worker secret 등록 (1회)

```bash
# Cloudflare Worker 디렉터리에서
wrangler secret put COVERR_KEY
# 프롬프트 뜨면 키를 붙여넣고 Enter
# (입력값은 Cloudflare KV 의 암호화 저장소로만 들어가고
#  로컬 파일/log/git 어디에도 남지 않음)
```

운영자가 키 값을 공유받았다면 그 값만 프롬프트에 붙여넣을 것.
키 값은 어떤 chat/issue/PR/commit message 에도 적지 않는다.

---

## 2) 클라이언트 동작

`ambient-mode.js` 의 `fetchCoverrFallback()` 은 다음 순서로 시도:

1. `window.AURA_SERVER` 가 설정돼 있으면 → `${AURA_SERVER}/coverr-videos?q=...` 프록시 호출
2. 없으면 → 사용자 본인이 `localStorage.aura_coverr_key` 에 입력한 자기 키로 직접 호출
3. 둘 다 없으면 → Coverr 비활성, Pexels 만 사용

→ 운영 환경에서는 Worker 만 키를 보유. 클라이언트 번들엔 키가 없음.

---

## 3) Worker 측 보호 레이어 (`cloudflare-worker.js` `/coverr-videos`)

| 보호 | 값 |
|---|---|
| 입력 sanitize | `^[A-Za-z0-9\s\-_,.]{1,100}$` 만 통과 |
| Per-IP rate limit | 30 req/min |
| Origin 화이트리스트 | `chkOrigin()` 에서 검사 |
| KV 캐시 | 24h (TTL 86400s) — 같은 도시는 하루 1회만 upstream |
| 시간당 quota guard | 45/h (Coverr 무료 50/h 한도 미만에서 자동 차단) |
| 응답 트리밍 | mp4 URL + 최소 메타만 노출, 원본 raw 응답 비공개 |
| Timeout | 8s (`fetchT`) |

→ 사용자가 단일 키로 abuse 시도해도:
- 분당 30회 / 시간당 45회 hard cap
- 같은 query 는 24h KV 히트로 0 비용
- Cross-origin 호출 차단

---

## 4) 키 노출 시 대응

만약 키가 commit 됐거나 의심되면:

1. https://coverr.co/account → API 메뉴에서 즉시 reset
2. 새 키를 다시 `wrangler secret put COVERR_KEY` 로 등록
3. 평문이 박힌 파일은 `git filter-repo` 로 history 에서 제거
4. force-push 전 협업자 통보

---

## 5) 로컬 개발 (선택)

본인이 직접 발급받은 무료 키로 로컬 테스트만 하고 싶다면:

```js
// 브라우저 콘솔에서 — 본인 브라우저 localStorage 에만 저장됨
localStorage.setItem('aura_coverr_key', '<본인 키>');
```

이 값은 절대 git push 되지 않음 (`aura-secrets.js` 가 .gitignore 에 등록).
