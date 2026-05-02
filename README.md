# Λ U R Λ — World Pulse

> **🌍 지구본 lo-fi 라운지 — 클릭 한 번으로 도시 분위기에 들어가는 카페형 작업 화면**

[![status](https://img.shields.io/badge/status-MVP-orange)]()
[![pricing](https://img.shields.io/badge/pricing-100%25_FREE-brightgreen)](#-가격--무료)
[![license](https://img.shields.io/badge/license-Proprietary-blue)](./LICENSE)
[![pwa](https://img.shields.io/badge/PWA-installable-blueviolet)]()
[![stack](https://img.shields.io/badge/stack-Vanilla_JS-yellow)]()

### 한 문장 정의
**도시 마커 클릭 → 그 도시의 영상·lo-fi 음악·실시간 정보가 한 화면에 켜지는 무료 카페 모드 데스크톱.**

> 💡 본 앱은 **완전 무료**입니다. 구독·인앱결제·유료 잠금 0개. 운영비는 globe 마커 일부의 `[SPONSORED]` 광고와 여행 예약 사이트 어필리에이트 링크로만 충당합니다.

### 핵심 사용 흐름 (1개)
1. 지구본에서 도시 클릭 → 도시 영상 + lo-fi 음악 자동 재생
2. (선택) 카페 모드 → 풀스크린 분위기, UI 자동 페이드아웃
3. (선택) 여행 정보 / 뉴스 / 환율 등은 우측 도크에서 필요할 때만 펼침

> 다른 모든 기능(13개+)은 메뉴 깊이로 숨겨져 있어, 처음 5초 안에 가치를 전달합니다.

---

## ☕ 핵심 컨셉

뉴스 앱(텍스트), 여행 앱(검색 후 사라짐), 음악 앱(소리), 날씨 앱(데이터) — 이 모든 것을 **하나의 분위기 있는 화면**으로 합친 카페형 작업 도구.

도쿄 마커 클릭 → 시부야 HD 영상 + lo-fi 음악 자동 재생 + 도쿄 환율 + 도쿄 뉴스. **카페 모드** 켜면 모든 UI 사라지고 풀스크린 도시 분위기만 남음.

---

## 🎯 페르소나

| 사용자 | 사용 시나리오 |
|---|---|
| 🏠 **카공족** | 카페에서 도시 영상 + lo-fi BGM 켜고 공부 |
| 💻 **재택근무자** | 작업 BGM + 환경 노이즈 + 영감 |
| ✈️ **여행 준비자** | 영상으로 분위기 보고 즉시 항공권/호텔 검색 |
| 🌍 **디지털 노마드** | 다음 도시 물가/환율/날씨 비교 |
| 📰 **글로벌 트렌드 탐험가** | 좌/중/우 균형 잡힌 뉴스 한 화면 |

---

## ✨ 주요 기능

| | |
|---|---|
| 🌍 **3D 지구본** | 92개 도시 마커, 클릭 시 카메라 회전 + 도시 정보 모달 |
| 🎬 **도시 영상** | Pexels HD 영상 자동 fetch, 도시당 6개 영상 자동 회전 |
| ☕ **카페 모드** | 풀스크린 분위기, 모든 UI 페이드아웃, 도시 자동 선택 |
| 🎵 **16개 음악 채널** | Lofi/Jazz/Synthwave/Bossa/Piano/Latin/Reggae/Classical 등 |
| 📰 **편파성 라벨 뉴스** | 11개 RSS + AllSides 등급 (L/LC/C/RC/R) — 좌우 균형 |
| 🚨 **실시간 레이어** | 지진 (USGS) · 재난 (NASA EONET) · 날씨 · 공기질 |
| ✈️ **여행 도구** | 항공권 추정 + 호텔 (50도시) + 도시 물가 비교 |
| 🎭 **엔터테인먼트** | iTunes 음원 차트 자동 (KR/US/JP) + 영화 + 게임 |
| ⌨️ **키보드** | 방향키 회전, Space 자동회전, Home 리셋 |
| 📱 **반응형** | 데스크탑 + 태블릿 + 폰 (safe-area 대응) |

---

## 🚀 실행 방법

### 1. 브라우저 (개발/테스트)
```bash
python3 serve.py
# 또는
python3 -m http.server 8000
```
→ `http://localhost:8000` 접속

⚠️ 브라우저 환경에선 일부 RSS가 CORS로 차단될 수 있음. 풀 RSS는 Electron 앱 또는 Cloudflare Worker 프록시 필요.

### 2. Electron 데스크탑 앱 (RSS 95%+ 작동)
```bash
npm install
npm start                # 개발 모드
npm run build:mac        # .dmg
npm run build:win        # .exe
npm run build:linux      # .AppImage
```

### 3. Cloudflare Pages (프로덕션)
1. GitHub에 push
2. Cloudflare Pages → "Connect to Git" → 자동 배포
3. (선택) `cloudflare-worker.js`를 Workers에 배포 → `index.html` 라인 18 `window.AURA_SERVER`에 worker URL 입력 → RSS 100% 통과

---

## 🔑 API 키 설정 (선택)

`aura-secrets.js` 파일을 프로젝트 루트에 생성:

```js
(function() {
    'use strict';
    window.AURA_PEXELS_KEY = 'YOUR_PEXELS_KEY';   // 무료: pexels.com/api/
    window.AURA_TMDB_KEY = 'YOUR_TMDB_BEARER';    // 무료: themoviedb.org
    window.AURA_GA_ID = 'G-XXXXXXX';              // (선택) Analytics
})();
```

이 파일은 `.gitignore`에 등록되어 있어 깃에 안 올라갑니다.

키 없을 때 폴백:
- Pexels 키 X → 도시별 그라디언트 + 도시명 표시
- TMDB 키 X → 수동 큐레이션 영화 데이터 사용
- GA ID X → 추적 비활성화

---

## ⌨️ 키보드 단축키

| 키 | 동작 |
|---|---|
| `←` `→` | 지구본 좌우 회전 |
| `↑` `↓` | 지구본 상하 기울이기 |
| `Shift + 방향키` | 더 빠른 회전 (25°) |
| `+` / `-` | 줌 인/아웃 |
| `Space` | 자동 회전 ON/OFF |
| `Home` | 초기 위치로 리셋 |
| `ESC` | 모달 닫기 / 지구본 lock 해제 |
| `Ctrl/Cmd + R` | 뉴스 새로고침 |

---

## 🏗️ 아키텍처

```
┌──────────────────────────────────────────────┐
│  브라우저 렌더러 (vanilla JS, no bundler)    │
│  • app.js (코어 상태 + 렌더)                  │
│  • ambient-mode.js (도시 영상/음악)          │
│  • cafe-mode.js (풀스크린)                    │
│  • markers-refined.js (지구본 마커)          │
│  • + 40개 모듈                               │
└──────────────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
┌────────────────────┐    ┌──────────────────────┐
│ 브라우저 fetch +   │    │ Electron main.js     │
│ 4단계 CORS 프록시  │    │ Node https (CORS X)  │
│ 폴백              │    │ via IPC              │
└────────────────────┘    └──────────────────────┘
        │                            │
        ▼                            ▼
   ┌─────────────────────────────────────────┐
   │ 외부 API (전부 무료, 대부분 키 불필요): │
   │ • USGS earthquakes (3분)               │
   │ • NASA EONET disasters (10분)          │
   │ • Open-Meteo weather/AQ (30분)         │
   │ • Frankfurter FX (1시간)               │
   │ • CoinGecko crypto (5분)               │
   │ • iTunes RSS music charts (24시간)     │
   │ • Reddit JSON (CORS 통과)              │
   │ • Wikipedia API (24시간)               │
   │ • Pexels videos (키 필요, 무료)        │
   └─────────────────────────────────────────┘
```

**Zero backend** — 100% 클라이언트 사이드. Cloudflare Worker는 *선택사항* (RSS CORS 회피용).

---

## 📰 뉴스 소스 (편파성 라벨 포함 — AllSides 기준)

| 소스 | 편파성 | 지역 |
|---|---|---|
| BBC × 3 | Center | 영국/글로벌 |
| CNBC, DW | Center | 미국 / 독일 |
| Wired, The Verge | Lean Left | 미국 테크 |
| Fox Business | Lean Right | 미국 |
| NY Post, Telegraph | Lean Right | 미국 / 영국 |
| Daily Wire | Right | 미국 |
| Reddit (r/worldnews 외 4개) | Mixed | 글로벌 |

각 뉴스 카드에 **L / LC / C / RC / R** 색상 라벨 자동 표시.

---

## ⚡ 성능 최적화

- **MAX_MARKERS = 60** — 지구본에 60개 이상 마커 안 띄움
- **content-visibility: auto** — 접힌 드로어 렌더 스킵
- **visibilitychange** — 탭 가려질 때 모든 polling + 자동 회전 정지
- **24h Pexels 캐시** — 도시당 — 두 번째 클릭은 즉시
- **24h iTunes 캐시** — 음악 차트 모달 즉시 열림
- **RSS 회로 차단기** — 3번 실패한 피드는 세션 동안 스킵
- **Tenor API 비활성화** — 검증된 GIPHY 풀만 사용 (콘솔 도배 방지)

---

## 📁 프로젝트 구조

```
aura.os/
├── index.html              ← 메인 HTML + CSP + 인라인 critical CSS
├── style.css               ← 메인 스타일 (~50KB)
├── serve.py                ← 개발 서버 (Referrer-Policy 헤더)
├── package.json            ← Electron + npm scripts
├── main.js                 ← Electron main (Node https로 RSS)
├── preload.js              ← contextBridge → window.auraAPI
├── cloudflare-worker.js    ← (선택) RSS CORS 프록시
├── aura-secrets.js         ← API 키 (.gitignored)
│
├── app.js                  ← 코어: 상태/fetch/렌더 (143KB)
├── ambient-mode.js         ← 도시 영상 + 음악
├── cafe-mode.js            ← 풀스크린 모드
├── markers-refined.js      ← 지구본 HTML 마커
├── city-videos.js          ← 92개 도시 lat/lng/태그
│
├── flight-search.js        ← 여행 모달 (BOOK 버튼)
├── hotel-prices.js         ← 50도시 호텔 데이터
├── cost-compare.js         ← 도시 물가 비교
│
├── music-charts.js         ← 10개 차트 + iTunes 자동
├── movies-data.js          ← TMDB / 폴백
├── games-data.js           ← 큐레이션 게임 트렌드
│
├── tutorial.js             ← 7단계 온보딩
├── bookmarks.js            ← 기사 북마크
├── globe-skin.js           ← 8개 지구 테마
├── dock-buttons.js         ← 하단 도크
└── ... (추가 모듈 30+)
```

---

## 🛠️ 개발 노트

- **번들러 없음** — `<script defer>` 순서대로 로드
- **캐시 무효화** — 모든 script 태그에 `?v=v497` query param. `index.html`에서 버전 올리면 일괄 invalidate
- **Sandboxed Electron** — `contextIsolation: true`, `nodeIntegration: false`. 모든 IPC는 `contextBridge` 거침
- **방어적 fetching** — 모든 외부 호출 try/catch + 폴백 체인 (RSS 4단계, 영상 그라디언트 베이스, 고양이 SVG 폴백)

---

## 🗺️ 로드맵

- [x] 92개 도시
- [x] 편파성 라벨 뉴스
- [x] 카페 모드 + 자동 도시 선택
- [x] 키보드 카메라
- [x] 백그라운드 탭 throttle
- [x] 모바일 반응형
- [x] Electron IPC 통합 (RSS 100% 작동)
- [ ] Cloudflare Worker 자동 배포
- [ ] PWA manifest + 오프라인 모드
- [ ] 핀치 줌 + 스와이프 제스처
- [ ] AI 여행 일정 자동 생성
- [ ] Sponsored 마커 시스템 (지역 광고)

---

## 🤝 기여

Issues / PR 환영합니다. 브랜치 명명: `feature/...`, `fix/...`.

---

## 📝 라이선스

MIT — © 2026 LEEJAEJIN (JADDY)

External libraries: Three.js (MIT), Globe.gl (MIT), Orbitron / Rajdhani / Exo 2 / JetBrains Mono fonts.

---

## 💡 한 줄로

> **"실시간 세계 정보 + 도시 분위기 영상 + lo-fi 음악 = 카페 작업자의 새로운 데스크탑"**
