# Listening Room — 사진 큐레이션 가이드라인

v7 §11 By City 모드용. 사용자가 60분 사운드 트랙을 들으며 작업하는 동안 시각적으로 방해받지 않아야 함. 사진 = 배경 음악, 시선 끌면 안 됨.

**참고 톤**: Monocle / Kinfolk · **회피 톤**: National Geographic / 여행 잡지

## 권장 사진 5 카테고리

1. **빈 공간** — 사람 0~2명. 도쿄 새벽 5시 신주쿠, 리스본 일요일 아침 알파마, 멕시코시티 비 오는 평일 오후. 군중 X.
2. **날씨와 시간** — 비, 안개, 황혼, 새벽, 그림자가 긴 늦은 오후. 정오 강한 햇빛 / 맑은 하늘 X.
3. **건축 디테일** — 창문, 문, 타일 벽, 계단, 발코니 클로즈업. 도쿄 료칸 창문, 리스본 아줄레주, 치앙마이 사찰 문. 랜드마크 전면 X.
4. **자연 요소** — 도시 안의 강, 공원, 가로수, 비에 젖은 길, 안개 낀 언덕. 우붓 논, 타구스 강, 신주쿠 교엔.
5. **빈티지 / 흑백 아카이브** — Public Domain 1900년대 초중반 도시 사진. 흑백은 시각 부담 작아 work session 적합.

## 회피 7 유형

- **관광 명소 정면** — 에펠탑, 도쿄타워. 여행 책자 톤.
- **군중** — 시부야 횡단보도, 만석 카페. 시각적 소음.
- **강한 색상** — 네온, 강렬한 노을, 형광 간판. paper/ink 토큰과 충돌.
- **음식** — 음식 코너 톤. 카페 내부 OK / 테이블 음식 클로즈업 X.
- **사람 얼굴** — 시선 고정. 뒷모습 / 실루엣 / 작은 형체만 허용.
- **가공 강한** — 인스타 필터, HDR 과한, 비네팅 강한. 자연 노출 우선.
- **풀블리드 (구도)** — v7 §1.3 비율: 사진은 화면 가장자리 14px 여백 + 4px paper frame.

## 도시별 톤 디테일

| 도시 | 권장 | 회피 |
|---|---|---|
| Lisbon | 부드러운 햇빛, 파스텔 건물, 트램 골목, 살짝 흐린 오후 | 강한 푸른 하늘 |
| Chiang Mai | 사찰 그림자, 우기 비, 새벽 안개, 골목 안쪽 | 관광객 많은 올드시티 정면 |
| Tokyo | 비 오는 시부야 골목, 새벽 자판기, 료칸 창문, 텅 빈 지하철 | 네온 화려한 신주쿠 정면 |
| Mexico City | 코요아칸 자갈길, 로마노르테 빈티지 카페, 비 광장 | 화려한 벽화 / 행사 사진 |
| Bali | 우붓 논, 새벽 사원, 비 야자수 | 짱구 노마드 핫스팟, 해변 클럽 |

## 색감 후처리

- **채도 −5~10%** (완전 흑백은 빈티지 아카이브에만)
- **대비 살짝 낮게** — 부드러운 그라데이션. 그림자 디테일 살리기.
- **색온도 살짝 따뜻** — sepia/cream 살짝. 과도한 sepia X.

## 큐레이션 워크플로우 (도시 1개 ≈ 1시간)

```
1. Unsplash / Pexels 검색
   "lisbon quiet" / "lisbon empty alley" / "lisbon rainy"
   회피 키워드 의도적 사용

2. 1차 선별 (20장)
   직감으로 빠르게. 회피 7 유형은 즉시 제외.

3. 사운드 트랙과 매칭 (1~3장)
   비 트랙 → 비 사진. 새벽 사찰 → 안개 사진.

4. 색감 조정
   채도 -5~10% / 대비 -5% / 색온도 +5

5. R2 업로드
   1080px webp (모바일) + 1920px jpg (데스크탑).
   파일당 평균 200KB 이하.
```

## 데이터 등록

`data/listening.json` 의 `cities[]` 배열에 추가:

```json
{
  "slug": "tokyo",
  "names": { "en": "Tokyo", "ko": "도쿄", "ja": "東京", "pt": "Tóquio", "es": "Tokio" },
  "default_photo_url": "/photos/cities/tokyo-yamanote-night.webp",
  "photo_caption": {
    "en": "Tokyo — Yamanote line at midnight, October. Photograph by [name].",
    "ko": "도쿄 — 자정의 야마노테선, 10월. [이름] 촬영."
  },
  "photographer": "[name]",
  "photo_source": "own | unsplash | public_domain",
  "license_url": "https://unsplash.com/license"
}
```

각 트랙에 `city: "tokyo"` + `photo_url: "/photos/cities/..."` 필드 추가. `tracks[]` 의 city 없는 항목은 By Category 모드 라이브러리로만 사용.

## R2 경로 컨벤션

```
/photos/cities/{city-slug}-{scene-keyword}.webp
/photos/cities/{city-slug}-{scene-keyword}.jpg     ← jpg 폴백

예:
/photos/cities/lisbon-alfama.webp
/photos/cities/lisbon-tagus.webp
/photos/cities/tokyo-yamanote-night.webp
```

업로드 안 되면 코드가 자동으로 paper-d 배경 + "Awaiting photograph." placeholder 표시.

## 솔직히

이 가이드라인은 까다로워 보이지만 정체성 유지의 필수 기준. 가이드라인 없으면 사진이 강해져 핵심인 **사운드가 묻힘**. Listening Room = 사진 갤러리 X · 사운드 작업 공간 O · 사진 = 분위기 보조 장치.

**첫 도시 큐레이션 시**: 가이드라인을 머리로 외우지 말고, 5~10장 직접 골라본 후 본인이 보기에 잡지 톤 가까운 1장 선별. 감각으로 익히는 게 효율적.

리스본 프로토타입 사진 1장 큐레이션 → 결과 피드백 → 다른 도시 확장. 안전한 접근.
