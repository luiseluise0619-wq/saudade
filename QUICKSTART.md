# 🚀 AURA : WORLD PULSE 실행 가이드

## 📋 3가지 실행 방법

---

## 1️⃣ 가장 쉬운 방법: 브라우저에서 바로 실행

**웹처럼 실행 (설치 필요 없음)**

1. 모든 파일을 한 폴더에 저장
2. `index.html` 더블클릭
3. 끝!

**단점:** 일부 기능(푸시 알림 등)이 제한될 수 있음. CORS 때문에 일부 RSS 피드 차단 가능.

---

## 2️⃣ Electron 데스크톱 앱 (권장) ⭐

### 설치 (최초 1회만, 5분)

1. **Node.js 설치**: https://nodejs.org/ko/download (LTS 버전)
2. 모든 파일을 한 폴더에 저장 (아래 구조 참조)
3. 폴더에서 터미널/명령 프롬프트 열기
4. 명령어 실행:
```bash
npm install
```
→ 처음엔 5분 정도 걸림 (~200MB 다운로드)

### 실행
```bash
npm start
```
→ 창이 뜨면서 AURA 앱 실행!

### Windows/Mac 설치파일(.exe/.dmg) 만들기
```bash
npm run build
```
→ `dist/` 폴더에 설치파일 생성됨

---

## 3️⃣ Tauri 데스크톱 앱 (앱 크기 작음, 고급)

자세한 방법은 `TAURI_BUILD_GUIDE.md` 참조.

**장점:** 앱 크기 ~10MB (Electron은 ~150MB)
**단점:** Rust 설치 필요

---

## 📁 필요한 파일 구조

```
aura-world-pulse/
├── index.html              ← 메인 진입
├── style.css
│
├── app.js                  ← 메인 로직
├── optimize.js
├── security-patch.js
├── intel-engine.js
├── events-engine.js
├── ux-v2.js
├── daily-shorts.js
├── learn-mode.js
│
├── main.js                 ← Electron 메인 프로세스
├── preload.js              ← Electron 프리로드
├── package.json            ← 패키지 설정
│
└── assets/
    └── aura-logo.png       ← 로고 이미지
```

---

## 🎯 실행 후 사용법

### 이벤트/스포츠 보기
- 오른쪽 패널의 **EVENTS** 탭 클릭
- 전체 / 축제 / 스포츠 / 콘서트 필터
- 카드 클릭 → 공식 사이트로 이동

### 국가 뉴스 보기
- 지구본의 🇰🇷 국가 마커 **클릭**
- 팝업에서 해당 국가 뉴스 TOP 5
- 기사 옆 🔗 버튼 → 원본 사이트

### 데일리 쇼츠
- 상단 우측 `▶ DAILY` 버튼
- ↓ 키 or 스와이프로 카드 넘기기

### 급증 신호 알림
- 상단 빨간 🔴 뱃지 (신호 있을 때)
- 클릭하면 왼쪽 패널로 이동

---

## ❓ 문제 해결

### "이벤트가 없다"고 뜨면
→ **localStorage를 비워야 함** (이전 캐시 때문)
- F12 → Console 탭 → 아래 명령어 실행:
```javascript
localStorage.clear();
location.reload();
```

### RSS 피드가 안 뜬다
→ CORS 문제. 해결책:
1. 가장 좋음: Electron 앱으로 실행
2. 또는 Chrome 확장 "CORS Unblock" 설치

### 한국어 번역이 안 된다
→ MyMemory API 일일 한도(10,000자) 초과 가능. 내일 다시 시도.

### 알림이 안 뜬다
→ 브라우저 설정 → 알림 허용 필요

---

## 💻 개발/커스터마이징

### 서버 붙이기 (CORS 해결, 배포용)
`cloudflare-worker.js` 파일을 Cloudflare Workers에 배포 후,
`index.html` 상단의 `window.AURA_SERVER` 에 URL 입력.

### 테마 바꾸기
`style.css` 상단의 `--accent` 변수 수정

### RSS 피드 추가/제거
`optimize.js`의 `RSS_FEEDS_CURATED` 배열 수정

---

## 📞 문의
Instagram: [@jaddy_102](https://instagram.com/jaddy_102)

---

*Observe the world.*
