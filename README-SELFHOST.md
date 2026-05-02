# AURA — 자체 호스팅 가이드

도시 영상을 본인 Cloudflare R2에 호스팅 → Pexels API 의존 0%, 0.2초 로딩, $0/월.

## 사전 준비 (1회, ~16분)

| 도구 | 명령어 | 시간 |
|---|---|---|
| Node.js | https://nodejs.org (이미 있을 수 있음) | 5분 |
| ffmpeg | `brew install ffmpeg` (Mac) / `sudo apt install ffmpeg` (Linux) / [installer](https://ffmpeg.org/download.html) (Win) | 5분 |
| Cloudflare R2 활성화 | dash.cloudflare.com → R2 → Activate (10GB 무료) | 2분 |
| R2 버킷 생성 | R2 → "Create bucket" → 이름 `aura-city-videos` | 30초 |
| R2.dev 공개 URL 활성화 | 버킷 → Settings → "R2.dev subdomain" → Enable, URL 복사 (`https://pub-xxxxxxxx.r2.dev`) | 30초 |
| wrangler CLI | `npm install -g wrangler && wrangler login` | 3분 |
| Pexels API 키 | pexels.com/api 가입 → 키 복사 | 1분 |

## 환경변수 설정

```bash
export PEXELS_KEY="your-pexels-key-here"
export R2_PUBLIC_BASE="https://pub-xxxxxxxx.r2.dev"
export BUCKET="aura-city-videos"   # 기본값과 같으면 생략
```

## 도시 1개 처리 (~11분)

```bash
# 1) 다운로드 (자동, ~30초)
node scripts/fetch-pexels.mjs Seoul 8
# → ./videos/seoul/01.mp4 ~ 08.mp4

# 2) 검수 (수동, ~5분)
ls -lh videos/seoul/*.mp4
# 영상 하나하나 보고 이상한 거 (서울 아닌 거, 도로뷰) 있으면:
rm videos/seoul/05.mp4

# 3) 최적화 (자동, ~5분)
bash scripts/optimize-videos.sh ./videos/seoul
# → ./videos/seoul/optimized/ 에 1080p 15초 8MB 통일

# 4) R2 업로드 (자동, ~1분)
bash scripts/upload-r2.sh ./videos/seoul
# → R2 버킷 'cities/seoul/01.mp4' 등에 업로드

# 5) city-videos.js 패치 (자동, 즉시)
node scripts/patch-city-videos.mjs ./videos/seoul
# → 'Seoul' 항목에 selfHosted 배열 자동 주입
```

브라우저 새로고침 → 서울 클릭 → R2 영상이 즉시 (0.2초) 재생.

## 추천 5도시 (트래픽 60-70% 커버)

```bash
for city in Seoul Tokyo "New York" Paris Bangkok; do
    node scripts/fetch-pexels.mjs "$city" 8
    # 검수 시간 (위 단계 2)
    bash scripts/optimize-videos.sh "./videos/${city,,}"
    bash scripts/upload-r2.sh "./videos/${city,,}"
    node scripts/patch-city-videos.mjs "./videos/${city,,}"
done
```

총 1시간 내. 결과:
- R2 저장: ~250MB
- R2 비용: $0.005/월 (사실상 무료)
- 트래픽 비용: $0 (R2 egress 무료)
- Pexels 의존도: 5도시는 0%

## 라이선스

Pexels License: 무료 다운로드 + 상업 사용 + 재호스팅 OK. 무수정 원본을 다른 stock site에 되팔기만 금지.
출처: https://www.pexels.com/license/

원작자 크레딧은 의무는 아니지만 manifest.json 에 보관됨. 도시 패널 footer 같은 곳에 작은 글씨로
"Videos courtesy of Pexels contributors" 정도 추가 권장.

## 트러블슈팅

**ffmpeg 명령어 못 찾음**
- Mac: `brew install ffmpeg`
- Win: 설치 후 PATH 추가 (또는 cmder/git-bash 사용)

**wrangler r2 object put 실패**
- `wrangler login` 다시
- 버킷 이름 확인: `wrangler r2 bucket list`

**R2 URL 접근하니 403 / Access Denied**
- 버킷 Settings → "R2.dev subdomain" 활성화 안 함
- 또는 Public access 안 켜져 있음 → Settings → Public Access → R2.dev subdomain Toggle ON

**다운로드된 영상이 도시랑 무관**
- 그게 정확히 자체 호스팅이 필요한 이유. 검수 단계에서 `rm` 으로 제거하면 됨.
- 도시별로 검수에 5-10분 정도 들이는 게 정상.

**같은 영상 다시 업로드되네**
- `upload-r2.sh` 는 이미 있는 키는 SKIP 함. 강제 덮어쓰려면:
  ```bash
  wrangler r2 object delete aura-city-videos/cities/seoul/05.mp4
  ```

## 갱신 주기

도시별 영상은 6-12개월에 한 번 갱신 권장. 그 사이엔 손 안 대도 됨.
