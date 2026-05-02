# AURA — 출시 전 최종 체크리스트

이 문서는 출시 직전 검증용입니다. 위에서 아래로 한 번에 통과시키세요.

---

## 🚨 P0 — 출시 차단 항목 (반드시)

### 보안
- [ ] **Pexels API 키 reset** — https://www.pexels.com/api/ → [Reset]
- [ ] git history 에 평문 키가 남아있지 않은지:
      ```bash
      git log --all -p -S "PEXELS_KEY" | head
      git log --all -p -S "sk-ant-"    | head
      git log --all -p -S "AIza"       | head
      ```
- [ ] `aura-secrets.js` 가 빈 템플릿 상태 (현재 ✓)
- [ ] 모든 외부 API 키는 Cloudflare Worker 환경변수로만 보관
- [ ] `index.html` CSP 에서 `unsafe-eval` 제거됨 (현재 ✓)
- [ ] `main.js` prod CSP 에서 `unsafe-eval` 제거됨 (현재 ✓ — `--dev` 일 때만 허용)

### 법적 문서
- [ ] [`LICENSE`](./LICENSE) 존재 + `package.json` `license` 필드 일치 (현재 ✓)
- [ ] [`privacy.html`](./privacy.html) 한·영 양쪽 (현재 ✓)
- [ ] [`terms.html`](./terms.html) 자동갱신·환불·AI 면책 (현재 ✓)
- [ ] [`credits.html`](./credits.html) 데이터 출처 attribution (현재 ✓)
- [ ] [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) (현재 ✓)
- [ ] index.html footer 에 PRIVACY / TERMS / CREDITS / PRIVACY CHOICES 노출 (현재 ✓)

### 동의 / 추적
- [ ] EU 사용자 첫 방문 시 consent 모달 (`consent.js` 동작 확인)
- [ ] 동의 전 GA 호출 0회 (DevTools Network 에서 `gtag` / `googletagmanager` 요청 없는지)
- [ ] PRIVACY CHOICES 링크 → 모달 재오픈 가능 (현재 ✓)

### AI / 추정치 / 어필리에이트 표기
- [ ] 항공편 추정가 안내에 ±15% + 어필리에이트 표기 (현재 ✓)
- [ ] 호텔 가격에도 동일 표기
- [ ] AI 기능 (서버 활성 시) 출력 위에 `AURA_DISCLAIMER.ensure(container,'ai')` 호출
- [ ] AI prompt 에 system rule: "Do not give medical/legal/financial/immigration advice. Do not name stocks or coins."

### 콘텐츠 권리
- [ ] README "라이센스 무료 BGM" 문구 삭제 (현재 ✓)
- [ ] 카페 사장 시나리오 — "B2B 라이선스 계약 시" (현재 ✓)
- [ ] `luiseluise0619@gmail.com` 받은편지함 모니터링 (개인정보·takedown·결제 통합)

---

## 🟧 P1 — 출시 1~2주 내

### 도시 미디어
- [ ] Pexels 영상으로 확장 시 `aerial / drone / timelapse / skyline / landmark` 만 사용
- [ ] `subway / crossing / market / street / bazaar / tuk tuk / tram / cable car / floating` 키워드 제거
- [ ] `AURA_CITY_VIDEOS.block(url)` 차단 흐름 동작 확인
- [ ] localStorage `aura_media_blocklist` 영속 확인

### 결제 / 구독 (FREE-MODE: 비활성)
- [x] **앱 100% 무료 전환 완료** — premium-ui / license-state / Lemon Squeezy 모두 비활성
- [ ] (참고) 향후 결제 부활 시: PAYMENT.md 의 가이드 + git revert 로 복구 가능

### 데스크톱 빌드
- [ ] Windows: EV 코드사이닝 또는 SmartScreen reputation
- [ ] macOS: Apple Developer ID + notarization
- [ ] Linux: AppImage / .deb 정상 실행 테스트

### 데이터 정리
- [ ] Cloudflare KV TTL 90일 (`aura_device_fp`, license 항목)
- [ ] `/privacy/delete` 엔드포인트 (GDPR Art.17 / PIPA §36)

---

## 🟢 P2 — 출시 후 1개월 내

- [ ] `app.js` 모듈 분리 + esbuild 번들
- [ ] 외부 API 2단 fallback (Pexels → Pixabay → 정적 GIF)
- [ ] 상표 검색 (KIPRIS / USPTO TESS) — AURA / AURA OS / World Pulse
- [ ] Worker `chkOrigin` 강화 — `null` 허용 제거 또는 Turnstile
- [ ] RSS Worker max body 1MB 제한
- [ ] 빈 `catch {}` 점진적 교체 (`AURA.dbgWarn`)
- [ ] Lighthouse 모바일 성능 > 75
- [ ] Sentry / Cloudflare Analytics 오류 모니터링

---

## 📋 월간 운영 점검

```bash
git log --all -p -S "sk-"  | head
git log --all -p -S "AIza" | head
git ls-files | grep -E "secret|\.env"
```

- [ ] Pexels / TMDB / Gemini quota 비정상 spike 없는지
- [ ] consent 모달 표시율 (EU traffic 비율 대비)
- [ ] takedown 메일박스 미처리 0건
- [ ] privacy / terms 변경 시 사용자 7일 전 공지

---

## 🚦 릴리스 게이트

P0 항목 **전부** 체크되지 않으면 GA 빌드 생성 금지.

---

## 🆓 무료 자동화 (운영자 1회 실행)

```bash
# 1. SRI 해시 자동 계산 + index.html 패치
bash scripts/compute-sri.sh

# 2. (선택) git history 평문 키 영구 제거
bash scripts/cleanup-git-history.sh
```

배포: [`DEPLOY-FREE.md`](./DEPLOY-FREE.md) 의 Cloudflare Pages 또는 GitHub Pages — **0원/월** 운영.

상표 사전조사: [`TRADEMARK-NOTES.md`](./TRADEMARK-NOTES.md) — KIPRIS / USPTO / EUIPO **무료 검색**.

— © 2026 LEEJAEJIN (JADDY)
