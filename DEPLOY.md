> **DEPRECATED — see [DEPLOY-v8.md](./DEPLOY-v8.md) for current runbook.**
>
> 이 문서는 역사 자료. v8 단일 운영자 가이드는 DEPLOY-v8.md.

---

# 🚀 AURA : WORLD PULSE — 완전 실행 가이드 v2

© 2026 LEEJAEJIN (JADDY) · @jaddy_102

---

## 📦 지금 상태

**10,800+줄 코드, 20개 파일, 완전 작동 가능 상태**

---

## 🎯 세 가지 실행 방법 (원하는 것 선택)

### 🟢 방법 1: 브라우저로 바로 (1분)

```
1. 이 outputs 폴더 전체 다운로드
2. index.html 더블클릭
```

**작동 기능:** 지구본, 뉴스, 이벤트, 스포츠(일부), 테마  
**제한:** CORS 때문에 일부 RSS 막힘 → 방법 3 권장

---

### 🟡 방법 2: Electron 데스크톱 앱 (5분)

```bash
# 1. Node.js 설치: https://nodejs.org
# 2. 폴더에서 터미널 열기
npm install
npm start
```

**장점:** CORS 없음 → 모든 RSS 작동, 푸시 알림 가능  
**빌드:** `npm run build` → dist/ 에 .exe/.dmg 생성

---

### 🔴 방법 3: 무료 서버 + 앱 (10분) ⭐ 추천

#### Step A: Cloudflare Worker 배포

1. https://dash.cloudflare.com 가입 (무료)
2. 좌측 메뉴 → **Workers & Pages** → **Create Application** → **Create Worker**
3. 이름: `aura-api` → **Deploy**
4. **Edit code** 클릭
5. `cloudflare-worker.js` 파일 내용 전체 복사 → 붙여넣기
6. **Save and deploy**
7. 생성된 URL 복사 (예: `https://aura-api.your-name.workers.dev`)

#### Step B: 앱에 서버 URL 설정

`index.html` 23줄 근처:
```javascript
// 이 줄의 주석 풀고 URL 넣기
window.AURA_SERVER = 'https://aura-api.your-name.workers.dev';
```

#### Step C: 실행

브라우저 or Electron으로 실행 — 이제 CORS 완전 해결 + 공유 캐시 + 14점 보안

#### Step D (선택): 도시 영상도 Worker가 대신 받게 하기 ⭐

도시 클릭 시 띄우는 Pexels 영상을 **본인 Pexels 키 서버에만 두고** 모든 사용자에게 공유:

1. https://www.pexels.com/api/ 가입 → API 키 복사 (무료, 즉시 발급)
2. Cloudflare 대시보드 → 방금 만든 `aura-api` Worker → **Settings** → **Variables**
   - **Add variable** → 타입을 **Secret**으로 선택
   - Name: `PEXELS_KEY` / Value: 발급받은 키 → **Save and deploy**
3. 같은 페이지의 **KV Namespace Bindings** 섹션:
   - Worker 페이지에서 **Settings → Variables → KV Namespace Bindings → Add binding**
   - Variable name: `AURA_KV` (대소문자 정확히)
   - Namespace: 새로 만들거나(권장 이름 `aura-kv`) 기존 네임스페이스 선택
   - Save
4. 클라이언트엔 키 안 박아도 자동으로 Worker 프록시(`/pexels-videos`) 호출됨.
   `localStorage.aura_pexels_key`가 비어 있고 `window.AURA_SERVER`가 설정돼 있으면 프록시 모드.

**효과:**
- 클라이언트 코드/네트워크 탭 어디에도 키가 안 보임 (서버 secret)
- KV에 24시간 캐시 → 같은 도시는 재호출 0req
- 본인 Pexels 한도(시간 200, 월 20,000) ÷ 캐시히트 = 사실상 거의 무한
- 본인이 더 빠른 응답 원하면 `localStorage.setItem('aura_pexels_key', '본인키')`로 직접 모드 가능 (Worker 우회)

#### Step E: AI 여행 일정 (Gemini 무료) ⭐

1. https://aistudio.google.com/apikey → "Create API key" → 키 복사 (무료, 가입 즉시).
2. Worker → Settings → Variables → **Secret** 추가:
   - Name: `GEMINI_KEY` / Value: 발급받은 키 → Save and deploy.
3. AURA_KV 바인딩이 이미 있으면 → 자동으로 24h 캐시 작동. 도시 30개 × 일수 3가지 × 예산 3가지 ≈ 270 조합 → 첫 사용자 270번 호출 후 무한히 cache hit.
4. 무료 한도: 일 1,500 요청 (Gemini 2.0 Flash). 캐시까지 합치면 10K 사용자도 여유.

#### Step F: 광고 (사용자 결정: 전부 무료 + 광고 모델) ⭐

**결정 변경 (2026-04):** PRO 구독 제거 → 모든 도시·AI 무료. 수익은 광고 + 어필리에이트만.

**광고 슬롯 3곳 (자동, 풀스크린 영상 / focus 모드 / 카페 모드에서는 자동 숨김):**
1. 좌측 뉴스 패널 하단 (sticky)
2. 도시 패널 안 (도시 클릭 시)
3. AI 여행 일정 결과 끝 (전환 가장 좋음)

**옵션 A — Google AdSense (가장 흔함)**
1. https://adsense.google.com 가입 → site 등록 → ca-pub-XXXXX 받음
2. 슬롯 3개 생성 (Display ad, Responsive)
3. `index.html` 에 추가 (bootstrap.js 위):
   ```html
   <script>
     window.AURA_ADS_PROVIDER = 'adsense';
     window.AURA_ADS_CLIENT = 'ca-pub-XXXXXXXXXXX';
     window.AURA_ADS_SLOT_IDS = {
       'left-news': '1234567890',
       'city-panel': '2345678901',
       'ai-trip': '3456789012'
     };
   </script>
   ```

**옵션 B — Carbon Ads (개발자 친화, 깔끔)**
1. https://www.carbonads.net/ 신청 → 승인 필요 (트래픽 5K UV/월 이상)
2. placement code 받음 (예: `cdn.carbonads.com/...&placement=auraworldpulse`)
3. `index.html` 에:
   ```html
   <script>
     window.AURA_ADS_PROVIDER = 'carbon';
     window.AURA_ADS_PLACEMENT = 'auraworldpulse';
   </script>
   ```

**옵션 C — EthicalAds (개발자 / 코드 사이트 특화, 추적 X)**
1. https://www.ethicalads.io/ 신청
2. publisher ID 받음
3. `index.html`:
   ```html
   <script>
     window.AURA_ADS_PROVIDER = 'ethical';
     window.AURA_ADS_PUBLISHER = 'aura-worldpulse';
   </script>
   ```

**옵션 D — 자체 sponsored 카드 (가장 큰 수익 / 가장 큰 노력)**
   직접 호텔·항공사 영업해서 도시 카드 안에 sponsored 배지 + 어필리에이트 링크 박음.
   `travel-affiliate.js`의 ID(SKYSCANNER/BOOKING/AGODA 등)에 본인 가입 ID 주입.

**예상 수익 (1만 MAU 기준):**
- AdSense: $5–20/월 (CTR 1%, 한국 기준 RPM $1)
- Carbon: $50–150/월 (개발자 타깃, RPM $5)
- 어필리에이트만 (Booking 5%): 클릭 5% × 예약 3% × $300 평균 × 1만 = $45/월 정도
- 합계 현실적: **$50–200/월** (1만 MAU 기준)

**광고 윤리:** 영상 재생 / Focus / 카페 모드에선 자동 숨김. 몰입 깨지 않게.

---

## 🔒 무료 서버의 이점 (체크리스트 전부 적용됨)

| 항목 | 상태 |
|------|------|
| ✅ CORS 화이트리스트 | 허용 도메인만 접근 |
| ✅ HTTPS 강제 + HSTS | 자동 |
| ✅ Rate Limit 엔드포인트별 | rss 30/min, license 10/min 등 |
| ✅ SSRF 방어 | 내부 IP/localhost 차단 |
| ✅ 입력값 검증 | URL/텍스트 길이·타입 체크 |
| ✅ XSS 방어 | DOM API 사용, innerHTML 0개 |
| ✅ 에러 통일 | 내부 정보 노출 금지 |
| ✅ 캐시 안전 | SHA-256 기반 키 |
| ✅ API 키 서버 보관 | Lemon Squeezy 등 |
| ✅ 보안 헤더 | CSP, X-Frame, X-Content-Type 등 |
| ✅ Timeout | 모든 외부 호출 5-8초 |
| ✅ User-Agent 검증 | 봇 차단 |
| ✅ 라이선스 검증 격리 | 서버에서만 |

---

## 💰 비용 / 한도 참고

**Cloudflare Workers 무료 한도:** 100,000 요청/일, 엣지 전세계 배포, 비용 0원.
**현재 결제/구독 인프라 미구현.** 어필리에이트 ID(Skyscanner/Booking 등) 주입 시에만 수수료 발생.

---

## 🎬 도시 영상 — Pexels API vs 자체 호스팅 (의사결정 가이드)

**현재: Pexels API + Worker 프록시.** 60도시 다 자동 fetch + 도시 매칭 검증 + 도로뷰 필터.

### 자체 호스팅(R2)으로 옮기는 게 나은 시나리오

| 상황 | 결정 |
|------|------|
| **Pexels에 좋은 결과가 적은 도시** (Busan, Cusco, Tbilisi 등) | 자체 호스팅 우위. 큐레이션 관리 가능. |
| **MAU 100K 이상** | Pexels 한도(시 200/월 20K)에 부딪힘. R2 캐시 필수. |
| **항상 같은 분위기 보장 원함** (PRO 차별화) | 자체 호스팅. 영상 품질·길이 통제. |
| **노마드 타깃 → 한국·아시아 + 유럽 메인** | 메인 20도시만 자체, 나머지는 Pexels. |

### 자체 호스팅 비용 (Cloudflare R2 기준)

```
영상 1개: 1080p 15초 ≈ 5–10MB (h.264)
도시 1개: 큐레이션 5–10클립 = 30–80MB
60도시 × 평균 50MB = 약 3GB 저장소

R2 비용:
  - 저장: $0.015/GB/월 → 3GB = $0.045/월 (월 5센트)
  - egress: $0 (Cloudflare CDN 안에선 무료)
  - 요청: $0.36/100만 (무시 가능)

총: 사실상 무료 (월 $1 이하)
```

### 자체 호스팅 시 작업량

```
1. 도시별로 5–10개 클립 다운로드 (Pexels CC0 라이선스 — 모두 무료 + 상업 OK)
   - 자동화 가능: pexels-downloader 쪼만한 노드 스크립트
   - 도시 60개 × 8클립 = 480개 다운로드 (~5GB)
2. 일관성 확보 (선택):
   - 길이 통일 (10–20초)
   - 1080p 다운컨버트 (4K 너무 큼)
   - ffmpeg 한 줄로 처리
3. R2 버킷 업로드:
   wrangler r2 bucket create aura-city-videos
   wrangler r2 object put aura-city-videos/seoul/01.mp4 --file=./videos/seoul/01.mp4
4. CDN URL 매핑 작성 (city-videos.js 의 customQueries 옆에 hardcoded URLs)
```

### 추천 하이브리드 (실용)

```
무료 도시 10개 (Top 인기): 자체 호스팅 → 항상 좋은 화질, 빠른 로드
나머지 50도시: Pexels API + 도시 매칭 검증 (지금 코드)
```

이렇게 하면:
- 무료 사용자 첫 인상은 무조건 좋음 (자체 큐레이션)
- 50도시는 Pexels로 자동 충당 (관리 비용 0)
- R2 비용은 월 1달러 미만

### 자체 호스팅으로 옮기는 코드 패턴

`city-videos.js` 에 `selfHosted` 필드 추가:
```js
'Seoul': {
    lat: ..., ko: ...,
    selfHosted: [
        'https://media.your-domain.com/cities/seoul/01.mp4',
        'https://media.your-domain.com/cities/seoul/02.mp4',
        ...
    ],
    customQueries: [...]  // Pexels fallback (위 클립 다 끝나면)
}
```

`ambient-mode.js` 의 `tryPexelsVideo` 시작에 한 줄:
```js
const cityData = window.AURA_CITY_VIDEOS?.getCity?.(state.currentCity);
if (cityData?.selfHosted?.length) {
    videoLinks = cityData.selfHosted.slice();
    // Pexels fetch 건너뜀 (또는 보충용으로 이어서 호출)
}
```

**결론:** 시작은 Pexels (지금처럼) → MAU 검증 → 인기 도시 10개만 자체 호스팅 추가. 처음부터 60도시 다 다운로드는 시간 낭비.

---

## 📁 파일 설명

### 앱 (반드시 필요)
```
index.html          진입점
style.css           디자인
app.js              지구본 + 뉴스 메인 로직
optimize.js         RSS 페치 + 캐싱
security-patch.js   XSS 방어 + DOM 헬퍼
intel-engine.js     급증 감지
events-engine.js    축제/스포츠/콘서트 (73개)
ux-v2.js           드로어 + 마커 팝업
sports-sidebar.js   🆕 우측 스포츠 사이드바 (축구·이스포츠·NFL 등)
daily-shorts.js     쇼츠 뷰
learn-mode.js       학습 모드
assets/             로고 6색 (테마별 자동)
```

### Electron (선택)
```
main.js             메인 프로세스
preload.js          IPC 브리지
package.json        의존성
```

### 서버 (선택)
```
cloudflare-worker.js  무료 서버 (14점 보안)
```

### 기타
```
landing.html              판매 랜딩
logo-preview.html         로고 테스트
```

---

## ⚡ 새로 추가된 기능

### 🏆 스포츠 사이드바 (오른쪽)
- 축구 / 미식축구(NFL) / 농구(NBA) / 야구(MLB/KBO) / 하키(NHL) / 이스포츠
- 위 → 아래 **가까운 경기 순**
- 팀vs팀, 스코어, 시간, 장소 전부 표시
- LIVE 경기는 빨간 빛 + 점멸
- 클릭 → 해당 경기 상세 페이지로 이동
- 3분마다 자동 새로고침

### 🎮 이스포츠 포함
- LCK (T1, Gen.G, KT, Hanwha)
- LEC (G2, Fnatic)
- VCT (DRX, Sentinels)
- Valorant / CS2 / Dota 2 / LoL

### 📅 축제·스포츠 73개
- 1월~12월 전체 커버 (올림픽, 월드컵, F1, 마스터스, 윔블던, 콜드플레이 투어, BTS 등)

---

## 🔧 문제 해결

### "이벤트/스포츠 없음" 뜨면
F12 → Console:
```javascript
localStorage.clear();
location.reload();
```

### RSS 느림 / 번역 안 됨
→ **방법 3 (무료 서버)** 붙이세요. CORS 완전 해결.

### "알 수 없는 게시자" (Windows)
→ 코드 서명 없음. 판매 시 인증서 구매 (₩90k/년)

---

## 📞 문의
Instagram: [@jaddy_102](https://instagram.com/jaddy_102)

---

*Observe the world.*
