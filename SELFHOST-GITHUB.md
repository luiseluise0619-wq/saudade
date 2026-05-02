# AURA — GitHub Releases + jsDelivr 자체 호스팅 가이드

**비용 영원히 0원 보장.** Cloudflare R2 처럼 한도 초과 시 청구되는 일 없음.
GitHub Release 는 결제 카드를 받지 않으며, jsDelivr CDN 은 인디 프로젝트를 위한 무제한 무료.

---

## 📊 무료 한도 (실질적으로 무제한)

| 항목 | 한도 | 의미 |
|---|---|---|
| GitHub Release 파일 1개당 | **2 GB** | 1080p 60초 영상 = 8MB → 250개 영상 가능 |
| Release 총 합계 | **무제한** | 도시 1000개 × 영상 10개 가능 |
| jsDelivr CDN 시간당 요청 | **100K req/시간** | 사용자 100만명도 가능 |
| 결제 카드 등록 | **없음** | 청구할 방법이 원천적으로 없음 |

---

## 🛠 사전 준비 (운영자 1회, 10분)

### 1. gh CLI 설치
```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux
# https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

### 2. GitHub 로그인
```bash
gh auth login
# → 화살표로 GitHub.com 선택
# → HTTPS 선택
# → "Authenticate Git with your GitHub credentials?" Y
# → "How would you like to authenticate?" → Login with a web browser
# → 표시되는 8자리 코드 복사 → 브라우저에서 입력
```

### 3. ffmpeg 설치 (영상 압축용)
```bash
# macOS
brew install ffmpeg

# Windows
winget install --id Gyan.FFmpeg

# Linux
sudo apt install ffmpeg   # Debian / Ubuntu
sudo dnf install ffmpeg   # Fedora
```

### 4. Pexels API 키 발급 (무료)
```
https://www.pexels.com/api/  → "Your API Key"
```

### 5. 환경변수 설정
```bash
export PEXELS_KEY=여기에_본인_Pexels_키
export GH_REPO=username/aura.os         # 영상 호스팅용 GitHub repo (보통 본 repo 그대로)
export GH_RELEASE=cdn-v1                # release 태그 (한 번 만들면 계속 재사용)
```

> 💡 `GH_REPO` 는 본 코드 저장소를 그대로 써도 됩니다. 영상은 코드 안 들어가고 별도 release attachment 로 첨부되니 repo 크기 영향 없음.

---

## 🚀 실행 — 첫 50 개 도시 (테스트)

```bash
cd /path/to/aura.os
bash scripts/fetch-all-cities.sh --limit 50
```

### 진행 표시 예시
```
📡 호스팅 모드: github
📦 city-videos.js 에서 92개 도시 발견
   범위: 0 ~ 49

═══════════════════════════════════════════════
[1/92] Seoul  →  ./videos/seoul
═══════════════════════════════════════════════
✓ Pexels: 8 clips downloaded (3.2s)
✓ ffmpeg: 8 → optimized/ (avg 5.4 MB)
📦 Release 'cdn-v1' 생성 중...
  ⬆  seoul__01_aerial_4k.mp4 (5.4M)
  ⬆  seoul__02_namsan_tower.mp4 (4.8M)
  ...
✅ 8 개 파일 업로드 완료.
✅ city-videos.js 패치 완료. 8 URL 주입됨.
[2/92] Busan  →  ./videos/busan
...
```

### 시간 예상

| 도시 수 | 첫 다운로드 + 압축 + 업로드 | 비고 |
|---|---|---|
| 10 도시 | 약 30~60분 | 워밍업 |
| 50 도시 | **2~3시간** | 추천 시작 규모 |
| 92 도시 (전체) | 4~5시간 | 백그라운드로 두기 |

---

## 🔄 추가 / 갱신

### 새 도시 추가됐을 때
```bash
# city-videos.js 에 새 도시 추가 후
bash scripts/fetch-all-cities.sh --skip-existing
# → 이미 처리된 도시는 건너뛰고 신규 도시만 처리
```

### 영상 풀 갱신 (3개월 후 등)
```bash
# 특정 도시만
node scripts/fetch-pexels.mjs "Tokyo" 8
bash scripts/optimize-videos.sh ./videos/tokyo
GH_REPO=$GH_REPO GH_RELEASE=$GH_RELEASE bash scripts/upload-github.sh ./videos/tokyo
GH_REPO=$GH_REPO GH_RELEASE=$GH_RELEASE node scripts/patch-city-videos.mjs ./videos/tokyo
```

### 새 Release 로 통째로 교체
```bash
# release 자체를 새 버전으로 (cdn-v1 → cdn-v2)
export GH_RELEASE=cdn-v2
bash scripts/fetch-all-cities.sh
# → 모든 도시가 cdn-v2 의 URL 로 패치됨. 구버전(cdn-v1) 은 GitHub 에 그대로 남음 (필요 시 수동 삭제).
```

---

## 🌐 jsDelivr CDN 작동 원리

업로드된 파일은 자동으로 다음 URL 로 접근 가능:
```
https://cdn.jsdelivr.net/gh/<GH_REPO>@<GH_RELEASE>/<city>__<file>.mp4
```

예:
```
https://cdn.jsdelivr.net/gh/luiseluise0619-wq/aura.os@cdn-v1/seoul__01_namsan.mp4
```

- **글로벌 CDN** — 사용자 가까운 엣지에서 자동 캐시
- **자동 무료** — 별도 가입 X, jsDelivr 가 GitHub 자산 자동 프록시
- **무제한 대역폭** — 인디 프로젝트 트래픽 100%
- **HTTPS 강제** — 보안 OK
- **버전 고정** — `@cdn-v1` 태그로 영상 안 바뀜 보장

---

## 💸 비용 명세

| 시나리오 | 비용 |
|---|---|
| 50 도시 × 8 영상 = 400 파일 (~2GB) | **0원** |
| 100 도시 × 10 영상 = 1000 파일 (~5GB) | **0원** |
| 사용자 1명 / 월 | **0원** |
| 사용자 10만명 / 월 | **0원** |
| jsDelivr 시간당 100K 요청 초과 시 | 자동 throttle (사용자 일시 대기) — 청구 X |

→ 사실상 **인디 1인 운영자 평생 0원**.

---

## ⚠ 한 가지 트레이드오프

| GitHub Releases + jsDelivr | Cloudflare R2 |
|---|---|
| ✅ 완전 무료 (청구 위험 X) | 무료 10GB, 초과 시 GB당 1.5센트 |
| ✅ 결제 카드 등록 X | 결제 카드 등록 (안 하면 차단) |
| ✅ jsDelivr 자동 캐시 | R2 = Cloudflare 직접 |
| 🟧 영상 변경 시 jsDelivr 캐시 만료 대기 (1~24h) | 즉시 |
| 🟧 큰 release 는 Git client 작업 시 약간 느림 | 무관 |
| ✅ 영상 자체는 코드 push 와 별도 (release attachment) | — |

→ 인디 운영자에게 **GitHub Releases 가 압도적 유리**.

---

## 🆘 문제 해결

### "gh: command not found"
gh CLI 설치 필요. 위 [사전 준비] 1번 참고.

### "gh auth status 실패"
`gh auth login` 다시 실행.

### "Release upload 실패"
- 파일이 2GB 초과 → ffmpeg 비트레이트 더 낮춰야 함 (optimize-videos.sh 수정).
- 네트워크 일시 문제 → 같은 명령어 재실행 (idempotent — 이미 올라간 파일은 skip).

### "city-videos.js 패치 실패"
city-videos.js 의 키 (예: `'Seoul':`) 와 fetch 명령에 쓴 도시명 일치 확인.
또는 manifest.json 수동 확인 후 직접 patch 명령 실행.

### "jsDelivr URL 이 404"
- Release 가 `--prerelease` 가 아닌 `latest` 여야 jsDelivr 가 더 빨리 인덱스 (자동).
- 또는 5~30분 대기 (jsDelivr 가 GitHub 새 release 인식하는 데 시간 걸림).

---

## 🎯 최종 체크리스트

- [ ] gh CLI 로그인 완료 (`gh auth status`)
- [ ] ffmpeg 설치 (`ffmpeg -version`)
- [ ] Pexels 키 발급
- [ ] 환경변수 export (`PEXELS_KEY`, `GH_REPO`)
- [ ] 디스크 5GB 이상 여유 (임시 처리용)
- [ ] 인터넷 안정 (1~3시간 백그라운드 작업)
- [ ] `bash scripts/fetch-all-cities.sh --limit 5` 로 첫 5개 테스트
- [ ] 앱 새로고침 → Seoul 클릭 → 자체호스팅 영상 빠르게 재생되는지 확인
- [ ] 문제 없으면 `--limit 999` 로 전체 실행

— © 2026 LEEJAEJIN (JADDY)
