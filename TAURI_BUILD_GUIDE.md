# AURA : WORLD PULSE — Tauri 데스크톱 앱 빌드 가이드

## 📌 왜 Tauri 인가?

| 항목 | Electron | Tauri |
|------|----------|-------|
| 앱 크기 | 150MB+ | **3~15MB** |
| 메모리 | 300MB+ | **50~80MB** |
| 보안 | 낮음 | **높음 (Rust 기반)** |
| 속도 | 보통 | **빠름** |
| 한국 윈도우 | ✅ | ✅ |

→ **우리 앱엔 Tauri가 정답**

---

## 🔧 1단계: 개발 환경 설치 (1회만)

### Windows
1. **Node.js 설치**: https://nodejs.org (LTS 버전)
2. **Rust 설치**: https://www.rust-lang.org/tools/install
3. **Visual Studio Build Tools** 설치 (C++ 빌드 도구 체크)

### macOS
```bash
# Homebrew
brew install node
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Xcode Command Line Tools (macOS)
xcode-select --install
```

### 설치 확인
```bash
node --version   # v20.x.x 이상
cargo --version  # 1.77+ 이상
```

---

## 🚀 2단계: Tauri 프로젝트 만들기

```bash
# 프로젝트 폴더 어디든 이동
cd ~/Desktop

# Tauri 앱 생성
npm create tauri-app@latest

# 질문 답변:
# ? Project name: aura-world-pulse
# ? Identifier: com.jaddy.aura
# ? Frontend language: TypeScript / JavaScript
# ? Choose which frontend: Vanilla
# ? Add Vite: No (우리는 이미 HTML/CSS/JS 있음)
# ? Choose UI template: Vanilla
```

---

## 📂 3단계: AURA 파일 이식

### 기존 파일을 `src` 폴더로 복사

```
aura-world-pulse/
├── src/
│   ├── index.html         ← 여기로
│   ├── style.css
│   ├── app.js
│   ├── optimize.js
│   ├── security-patch.js
│   ├── intel-engine.js
│   ├── daily-shorts.js
│   └── learn-mode.js
├── src-tauri/
│   ├── tauri.conf.json   ← 설정
│   ├── Cargo.toml
│   └── icons/             ← 앱 아이콘
└── package.json
```

---

## ⚙️ 4단계: `src-tauri/tauri.conf.json` 설정

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "AURA World Pulse",
  "version": "1.0.0",
  "identifier": "com.jaddy.aura",
  
  "build": {
    "frontendDist": "../src",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  
  "app": {
    "windows": [
      {
        "title": "AURA : WORLD PULSE",
        "width": 1440,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 640,
        "resizable": true,
        "fullscreen": false,
        "center": true,
        "decorations": true,
        "transparent": false,
        "alwaysOnTop": false,
        "focus": true,
        "visible": true
      }
    ],
    
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https: ipc: http://ipc.localhost; img-src 'self' https: data: blob: asset:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://cdn.jsdelivr.net; font-src https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
      "freezePrototype": true,
      "assetProtocol": {
        "enable": true,
        "scope": ["$APPCONFIG/*", "$APPDATA/*"]
      }
    }
  },
  
  "bundle": {
    "active": true,
    "targets": "all",
    "category": "Productivity",
    "copyright": "© 2026 LEEJAEJIN (JADDY)",
    "shortDescription": "Real-time global intelligence dashboard",
    "longDescription": "Observe the world. AURA tracks news, aircraft, earthquakes, disasters, and geopolitical signals from 78+ sources worldwide with AI-powered surge detection.",
    
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "wix": {
        "language": ["ko-KR", "en-US"]
      }
    },
    
    "macOS": {
      "entitlements": null,
      "providerShortName": null,
      "signingIdentity": null
    },
    
    "linux": {
      "deb": {
        "depends": []
      }
    }
  }
}
```

---

## 🎨 5단계: 앱 아이콘 생성

### 방법 A: Tauri CLI 자동 생성 (추천)
```bash
# 1024x1024 PNG 하나 준비 (로고)
# icons/icon.png로 저장 후:

npm install -D @tauri-apps/cli
npx tauri icon icons/icon.png
```

자동으로 `.ico`, `.icns`, `.png` 전부 생성됨.

### 방법 B: 로고 수동 제작
현재 `logo-preview.html`의 SVG를 PNG로 변환:

1. `logo-preview.html` 브라우저에서 열기
2. 140px 로고 영역 스크린샷
3. 1024x1024로 업스케일
4. https://icon.kitchen 에서 `.ico`, `.icns` 생성

---

## 🛠 6단계: Package.json 수정

```json
{
  "name": "aura-world-pulse",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "build:windows": "tauri build --target x86_64-pc-windows-msvc",
    "build:mac": "tauri build --target x86_64-apple-darwin",
    "build:mac-arm": "tauri build --target aarch64-apple-darwin"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

---

## 🧪 7단계: 개발 모드 실행

```bash
cd aura-world-pulse
npm install
npm run dev
```

첫 실행은 Rust 컴파일 때문에 **5~10분** 걸림. 이후는 빠름.

### 🔍 개발 중 확인할 것:
- ✅ 지구본 정상 렌더링
- ✅ RSS 피드 로딩 (CORS 이슈 없음!)
- ✅ 번역 작동
- ✅ 데일리 쇼츠 열림
- ✅ 학습 모드 용어 하이라이트

---

## 📦 8단계: 프로덕션 빌드

### Windows (.exe + 설치 프로그램)
```bash
npm run build
# 결과: src-tauri/target/release/bundle/msi/AURA_1.0.0_x64_en-US.msi
# 결과: src-tauri/target/release/bundle/nsis/AURA_1.0.0_x64-setup.exe
```

### macOS (.dmg)
```bash
npm run build:mac
# 결과: src-tauri/target/release/bundle/dmg/AURA_1.0.0_x64.dmg
```

---

## 🔐 9단계: 코드 서명 (중요!)

### Windows
서명 안 하면 Windows SmartScreen이 "알 수 없는 게시자" 경고 띄움.

**옵션 A: 자체 서명 (테스트용)**
```powershell
# PowerShell 관리자 권한
New-SelfSignedCertificate -Type Custom -Subject "CN=JADDY" -KeyUsage DigitalSignature
```

**옵션 B: 진짜 코드 서명 인증서 (판매용)**
- Comodo, Sectigo에서 구매 (연 $70~200)
- **EV 코드사인**은 SmartScreen 즉시 통과 (연 $300~500)

### macOS
```bash
# Apple Developer 계정 필수 ($99/년)
# Xcode에서 서명 인증서 발급
```

**추천:** 처음엔 서명 없이 배포. 판매 100개 넘어가면 인증서 구매.

---

## 💰 10단계: 판매 준비

### Lemon Squeezy (추천, 수수료 5%)
1. https://lemonsqueezy.com 가입
2. 제품 생성 → 파일 업로드 (.exe, .dmg)
3. 가격: ₩14,900 (런칭) → ₩19,900 (정가)
4. 라이선스 키 자동 발급 설정

### Gumroad (대안, 수수료 10%)
- 설정 쉬움
- 한국 사용자 친화적
- 한글 지원

### 수익 예상
```
런칭가 ₩14,900 × 100명/월 = ₩1,490,000
정가 ₩19,900 × 100명/월 = ₩1,990,000
정가 ₩19,900 × 150명/월 = ₩2,985,000  ← 목표!
```

---

## 🚨 11단계: 라이선스 검증 추가 (1회 구매 검증)

### 간단한 서버리스 방법:

`src/license-check.js` 생성:

```javascript
// 사용자가 라이선스 키 입력 → Lemon Squeezy API로 검증
(async function() {
    const storedLicense = localStorage.getItem('aura_license_v1');
    
    if (!storedLicense) {
        // 첫 실행: 라이선스 입력 모달
        showLicenseModal();
        return;
    }
    
    // 검증 시도
    try {
        const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `license_key=${encodeURIComponent(storedLicense)}`
        });
        const data = await res.json();
        if (!data.valid) {
            localStorage.removeItem('aura_license_v1');
            showLicenseModal();
        }
    } catch {
        // 오프라인일 때 - 일단 통과 (최대 7일)
    }
})();
```

**장점:** 서버 없이 Lemon Squeezy가 검증 서버 대신함.

---

## 📋 12단계: 배포 체크리스트

### 런칭 전 필수
- [ ] `console.log` 전부 제거 or DEBUG 플래그
- [ ] CSP 강화 (`unsafe-inline` 최소화)
- [ ] 아이콘 1024x1024 준비
- [ ] 라이선스 검증 로직 테스트
- [ ] Windows + Mac 빌드 성공
- [ ] 최소 사양 문서화

### 배포
- [ ] Lemon Squeezy 제품 등록
- [ ] 랜딩 페이지 (landing.html)
- [ ] Product Hunt 런칭 계정 등록
- [ ] Twitter/X @jaddy_102 발표
- [ ] 인스타그램 프로모션
- [ ] 개발자 커뮤니티 (OKKY, 디스코드)

### 런칭 후
- [ ] 사용자 피드백 수집 (Gumroad 리뷰, DM)
- [ ] 버그 fix 업데이트
- [ ] 2주마다 기능 추가 (기대감 유지)

---

## 🎯 현실적 타임라인

| 주 | 할 일 |
|-----|-------|
| 1주 | Tauri 환경 설치, 프로젝트 이식, dev 모드 실행 |
| 2주 | 아이콘, 빌드 스크립트, Windows 빌드 테스트 |
| 3주 | Lemon Squeezy 셋업, 라이선스 검증, 랜딩 페이지 |
| 4주 | 베타 5명 → 피드백 → 수정 → 런칭 |

**4주 후 첫 판매 가능.**

---

## 🆘 흔한 문제 해결

### ❌ "Rust not found"
→ 터미널 재시작 (PATH 갱신됨)

### ❌ 빌드 느림
→ 첫 빌드만 10분. 이후 30초.

### ❌ Windows에서 "알 수 없는 게시자"
→ 코드 서명 인증서 필요 (판매 시)

### ❌ macOS "개발자 확인 안 됨"
→ 시스템 환경설정 → 보안 → "그래도 열기"
→ 판매 시 Apple Developer 가입

### ❌ 앱 크기 너무 큼
→ `tauri.conf.json`의 `"bundle.resources"`에서 불필요한 파일 제외

---

## 📞 다음 단계

이 가이드대로 하고 막히면:
- Tauri Discord: https://discord.com/invite/tauri
- Stack Overflow: `[tauri]` 태그

**화이팅! 🚀**

Signed,  
*AURA WORLD PULSE Team*
