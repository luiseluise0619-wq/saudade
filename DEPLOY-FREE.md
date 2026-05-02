# AURA — 무료 배포 가이드

이 문서는 **0원으로** AURA 를 인터넷에 공개하는 방법입니다.
도메인·인증서·서버 비용 모두 불필요합니다.

---

## 🟢 옵션 1 — Cloudflare Pages (가장 추천)

### 무료 한도
- 무제한 대역폭 / 빌드 500회/월 / 사용자 무제한
- 무료 SSL · 무료 서브도메인 (`*.pages.dev`)
- 글로벌 CDN

### 절차 (5분)
1. https://dash.cloudflare.com/sign-up — 무료 가입
2. **Workers & Pages → Create application → Pages → Connect to Git**
3. GitHub 저장소 선택 (이 repo)
4. Build settings: 비어있음 (정적 파일이라 빌드 단계 없음)
5. Deploy → 1~2분 후 `https://<repo-name>.pages.dev` 에서 라이브

### Worker 도 (선택, RSS CORS 회피)
1. **Workers & Pages → Create → Worker**
2. `cloudflare-worker.js` 내용 복사 → "Edit code" 에 붙여넣기
3. Deploy → 발급된 URL 을 `index.html` 의 `window.AURA_SERVER` 에 입력
4. KV 추가: **Workers & Pages → KV → Create namespace** (이름: `AURA_KV`)
5. Worker → Settings → Variables → KV namespace bindings → `AURA_KV` 연결
6. 환경변수: `GEMINI_KEY` (선택, AI 트립 사용 시 — 무료 한도 안에서 운영)

### 무료 한도 (Worker)
- 100,000 요청/일
- 10ms CPU / 요청
- KV 1,000회 쓰기/일, 100,000회 읽기/일

→ 일 1,000명까지 충분히 무료.

---

## 🟢 옵션 2 — GitHub Pages (가장 단순)

### 무료 한도
- 100GB 대역폭/월 / 무료 SSL / `*.github.io` 서브도메인
- Build 시간 무제한

### 절차 (3분)
1. GitHub repo → Settings → Pages
2. Source: **Deploy from a branch** → `main` 또는 `claude/app-launch-audit-q60yY`
3. Save → 2분 후 `https://<user>.github.io/<repo>/` 에서 라이브

### 단점
- RSS CORS 우회 어려움 (Cloudflare Worker 별도 운영 권장)
- AI 트립플래너 / sponsors API 등 서버 기능 X (정적 파일만)

---

## 🟢 옵션 3 — Vercel / Netlify (대체)

둘 다 비슷한 무료 한도. 정적 호스팅 + 서버리스 함수 가능.
정적 사이트만 배포할 거면 어느 쪽이든 5분 내 가능.

---

## 🛠 배포 직전 1회 실행

```bash
# 1. SRI 해시 자동 채움 (CDN 변조 방어)
bash scripts/compute-sri.sh

# 2. (선택) git history 의 옛 키 정리 — 협업자 있으면 사전 통보
bash scripts/cleanup-git-history.sh

# 3. Pexels 키 reset
#    https://www.pexels.com/api/ 로그인 → [Reset] 클릭
#    → 새 키는 Cloudflare Worker 환경변수 PEXELS_KEY 로만 보관
```

---

## 🚫 배포해도 안 되는 곳 (현 무료 상태에서)

| 채널 | 이유 |
|---|---|
| **Apple App Store / Mac App Store** | 코드사이닝 인증서 ($99/년) 미발급 |
| **Microsoft Store** | 개발자 계정 ($19 1회) 미가입 |
| **Google Play (TWA)** | 개발자 계정 ($25 1회) 미가입 |
| **Direct .dmg / .exe 배포** | 코드사이닝 없으면 첫 실행 시 "확인되지 않은 개발자" 경고 → 사용자 80% 이탈 |

→ **무료 배포 = 웹(Cloudflare Pages / GitHub Pages) + PWA "홈 화면 추가"**.
PWA 는 manifest.json 이 있어서 모바일 사용자가 직접 홈 화면에 추가 가능.

---

## 📊 운영 모니터링 (무료)

| 도구 | 용도 | 무료 한도 |
|---|---|---|
| Cloudflare Pages Analytics | 방문자 통계 | 무제한 (CF 가입자) |
| Plausible (자체호스팅) | 개인정보 친화 분석 | VPS 비용 (Oracle Cloud Free Tier 사용 시 0원) |
| UptimeRobot | 다운타임 알림 | 50개 모니터, 5분 간격 |
| Sentry | 에러 추적 | 5,000 events/월 |

→ 4개 다 합쳐도 0원으로 운영 가능.

---

## ✉ 사용자 신고 / 문의

운영자 메일박스 (Gmail 무료):
- `luiseluise0619@gmail.com` — 개인정보·takedown·일반 문의 통합

→ 별도 도메인 메일 없이 Gmail 만으로 약관·법률 요건 충족.

---

## 💰 운영비 (무료 배포 시)

| 항목 | 비용 |
|---|---|
| 호스팅 (Cloudflare Pages) | **0원** |
| 도메인 | **0원** (`*.pages.dev` 무료) |
| SSL | **0원** (자동) |
| 분석 | **0원** (Plausible 자체 / GA 무료 / 또는 미사용) |
| 메일박스 | **0원** (Gmail) |
| AI 트립 (Gemini Flash) | **0원** (Google AI Studio 무료 한도 내) |
| Pexels API | **0원** (개인 무료 키) |
| **합계** | **0원/월** |

→ 일 1,000명 트래픽까지 100% 무료로 운영 가능.

---

— © 2026 LEEJAEJIN (JADDY)
