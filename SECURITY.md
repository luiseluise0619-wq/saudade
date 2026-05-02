# AURA — 보안 가이드 + 키 관리

## 🚨 즉시 조치 필요 — Pexels 키 노출

### 발견된 사실
- `aura-secrets.js` 가 git history에 포함되어 있습니다 (첫 commit `0899185`).
- `.gitignore` 에 등록되어 있어도, **이미 한 번 commit된 파일은 git history에 영구 보존**됩니다.
- GitHub repo가 public이면 누구나 키 볼 수 있습니다.

### 노출된 키
- **Pexels API Key** (`Xq8qa...`) — `aura-secrets.js`에 평문

### 즉시 해야 할 일

1. **Pexels에 가서 키 즉시 Reset**
   - https://www.pexels.com/api/ 로그인
   - 우측 상단 **"Reset"** 버튼 클릭
   - 새 키 발급됨 (이전 키는 즉시 무효화)

2. **새 키 안전하게 보관**
   - **절대 코드에 평문 저장 X**
   - `aura-secrets.js` 에 적되, 그 파일은 commit 안 됨 (이번 라운드에 git 추적 해제됨)
   - 또는 더 안전: **Cloudflare Worker**에 키를 두고 proxy로 사용 (PAYMENT.md 참고)

3. **GitHub commit history에서 삭제 (선택)**
   - 키는 이미 Reset 했으니 무효화돼서 위험 X
   - 하지만 history 깨끗이 하려면 `git filter-repo` 사용:
     ```bash
     # ⚠️ 이건 모든 commit hash를 변경합니다. 협업자 있으면 위험.
     git filter-repo --path aura-secrets.js --invert-paths
     git push origin --force --all
     ```
   - 또는 그냥 두고 새 키만 잘 관리 (대부분 OK)

---

## 🔐 일반 보안 정책

### API 키 처리 (현재 상태)

| 키 | 저장 위치 | 위험도 | 비고 |
|---|---|---|---|
| **Pexels** | `aura-secrets.js` (.gitignored) + localStorage | ⚠️ 사용자 환경만 노출 | 새 키 발급 후 OK |
| **TMDB** | `window.AURA_TMDB_KEY` (선택) | 🟢 사용자 본인 환경만 | 키 없으면 정적 데이터 |
| **Anthropic / Gemini / Groq (AI)** | localStorage `aura_anthropic_key` | 🟢 사용자 본인 키 | XSS 없으면 안전 |
| **Stripe (계획중)** | 절대 client에 노출 X | — | server-only |

### 어떻게 안전한가
- **localStorage**: 같은 origin (도메인) 의 JS만 접근 가능. 다른 사이트가 못 읽음.
- **CORS**: API 응답이 다른 origin에 leak 안 됨.
- **CSP** (`index.html` 라인 8): `script-src` strict — 외부 스크립트 함부로 못 끼어듦.
- **Electron sandbox**: `contextIsolation: true`, `nodeIntegration: false`. Renderer 프로세스가 Node API 못 씀.
- **IPC 화이트리스트** (`main.js`): RSS는 80개 도메인만, JSON API는 8개 도메인만 허용.

### 어떻게 위험한가 (이론)
- **XSS** (Cross-Site Scripting) 공격이 성공하면 localStorage 키 다 털림.
  - 방어: 모든 외부 데이터 (RSS 제목/요약, Reddit 포스트) 는 `textContent` 로 표시 (`make()` 헬퍼 사용). innerHTML 직접 외부 데이터 X.
  - sponsors.js만 innerHTML 사용 (운영자 통제 데이터) — 추가 안전 위해 escape() 적용.
- **Man-in-the-middle**: 공공 Wi-Fi 등에서 HTTPS 안 쓰면 키 노출 가능.
  - 방어: 모든 API 호출이 HTTPS. CSP `default-src 'self' https:` 강제.
- **CSP bypass**: `'unsafe-inline'` + `'unsafe-eval'` 가 prod에서 허용되면 XSS 가능성.
  - 방어: Electron prod CSP는 `unsafe-eval` 제거 (main.js:42). Web (브라우저) CSP는 inline scripts 호환성 위해 unsafe-inline 유지 — 하지만 사용자 입력이 script로 해석되는 곳 없음.

### 무엇이 안전한 패턴
- ✅ 사용자가 직접 키 입력 (UI) → localStorage 저장 → 사용자만 자기 키 노출
- ✅ Server-side proxy (Cloudflare Worker 등) → key는 server에만, client는 worker URL만 호출
- ✅ Auth-required API는 매번 사용자 인증 (OAuth)

### 무엇이 위험한 패턴
- ❌ 코드에 키 평문 + GitHub 공개 repo
- ❌ 클라이언트 코드에서 third-party API 호출 시 키를 URL params에 (히스토리/로그 노출)
- ❌ localStorage 키를 `console.log()` 로 출력

---

## 📋 점검 체크리스트 (운영자용)

### 매월
- [ ] `aura-secrets.js`가 git에 안 올라갔는지 확인: `git ls-files | grep secrets`
- [ ] localStorage 키 노출 없는지: `console.log` 로 키 출력 X
- [ ] CSP 정책 변경 없는지: production은 strict
- [ ] Pexels/TMDB key reset 검토 (분기에 한 번)

### 새 기능 추가 시
- [ ] 외부 데이터를 innerHTML 로 직접 안 넣음 (textContent 또는 escape)
- [ ] 새 API 추가 시 키는 헤더로 (URL params X)
- [ ] User input (search, form 등) escape 처리
- [ ] iframe sandbox 적용

### 배포 전
- [ ] `git log --all -p` 에 'sk-' / 'AIza' / 'secret' 검색해서 키 노출 없는지
- [ ] HTTPS 강제 (HTTP 리다이렉트)
- [ ] CSP report-only 모드로 1주 운영 후 strict
- [ ] 의존성 audit: `npm audit`

---

## 🆘 비상 대응 (키 노출 발견 시)

1. **즉시 키 Reset** — 1순위. 노출된 키는 즉시 무효화.
2. **노출 범위 파악**:
   - 어느 파일 / commit / 시간?
   - public / private repo?
   - 노출 기간 (몇 분 vs 몇 일 vs 몇 개월)
3. **로그 확인**:
   - Pexels: API 사용 quota 비정상 spike?
   - Google Cloud (Gemini): Billing → 비정상 사용량?
   - Anthropic: Usage 페이지 → 비정상 요청?
4. **새 키로 업데이트** + 다시는 코드에 평문 저장 X
5. **장기**: server-side proxy 도입 (Cloudflare Worker)

---

## 🔧 개발자 도구 (점검 명령어)

```bash
# 추적 중인 secrets 파일 확인
git ls-files | grep -E "secret|\.env"

# 모든 commit history에서 특정 키 검색
git log --all -p -S "sk-ant-" | head
git log --all -p -S "AIza"     | head

# 추적 해제 (로컬 파일은 유지, git 만 무시)
git rm --cached aura-secrets.js

# 현재 working dir에서 키 같은 패턴 찾기
grep -rE "[A-Za-z0-9]{30,}" --include="*.js" .gitignore=true 2>/dev/null

# CSP 검사 (브라우저 DevTools)
# Network 탭 → 페이지 새로고침 → Response Headers 에 Content-Security-Policy 확인
```

---

## 📞 보안 이슈 신고

코드/배포에서 보안 취약점 발견 시:
- 메인테이너에게 직접 연락 (issue 공개 X)
- 90일 이내 패치 + 공개 announcement
- 신고자 credit (요청 시)

— © 2026 LEEJAEJIN (JADDY)
