# Novus v2 리디자인 실행 계획

이 문서는 v2 리디자인을 **어떤 순서로, 어떤 impeccable 명령으로, 어떤 통과 기준으로** 진행하는지 정의하는 작업 명세입니다. 각 페이즈가 끝나면 체크박스와 "현재 상태"를 갱신하고, v2 전환이 끝나면 이 문서의 내용은 `ARCHITECTURE.md`, `HANDOVER.md`, `DESIGN.md`로 흡수한 뒤 삭제합니다.

- 제품 사실: [`PRODUCT.md`](../PRODUCT.md)
- 홈 방향 계약: `.impeccable/surfaces/src-pages-dashboard-ui-dashboardpage-tsx.md`
- 확정 PoC 스케치: `.impeccable/mocks/decision/hybrid.html` (1368×912, 두 화면 스냅)

---

## 0. 확정된 것

| 항목      | 결정                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 홈 구조   | **한 화면 + 오늘 한 장**. 1화면: 하던 것이 사진 위에 가득. 아래로 스냅: 사진 띠 + 왼쪽 큰 날짜 + 오른쪽 월 달력 + 서비스 7개 + 작은 탐색기 줄. 무조작 시 앰비언트 액자 |
| 모드      | 홈 = Operate(실행·복귀), 앰비언트·갤러리 뷰어·영상 = Experience                                                                                                        |
| 빌드 방식 | code-led (작업 화면은 이미지 시안 없이 코드로 바로 빌드, 방향 계약으로 감사)                                                                                           |
| 신규 기능 | 보기 모드(TV형/태블릿형), 다국어, 첫 실행 온보딩                                                                                                                       |
| 유지      | 기존 기능 전부, novus 이름·로고, OTT 공식 로고·브랜드 컬러                                                                                                             |

## 1. 톤 & 매너 정의 (P1에서 토큰으로 고정)

**한 줄 정의: "밤의 액자, 낮의 한 장."** Novus는 스스로 색을 내지 않는 검은 액자이고, 색은 사진과 서비스 로고만 냅니다.

| 축        | 규칙                                                                                                                                          | 근거                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 장면      | 저녁 거실, 낮은 조명, 1–2m. 그래서 **다크가 기본**, 라이트는 낮 시간용 보조 테마                                                              | PRODUCT.md Operating Context             |
| 색 전략   | Restrained: 중립 9단 램프(검정→흰색) + 의미색 4개뿐. `live`(실행 중), `attention`(확인 필요), `sun`(일요일), `sat`(토요일). 그 외 강조색 없음 | 탈락안 '모노크롬'·'암실'에서 흡수한 규율 |
| 형태 문법 | **원 = 어디서나 누르는 동작**(글리프 레일), **사각 = 콘텐츠**(서비스 플레이트, 사진, 달력 칸). 모서리는 콘텐츠 0–4px, 원형 버튼 50%           | PoC 스케치                               |
| 타입      | 시스템 스택(Windows: Segoe UI Variable + 맑은 고딕, 언어별 OS 폰트). 웹폰트 번들 없음. 숫자(시계·날짜)는 디스플레이 크기, 굵기 차이로 위계    | 다국어 + 저사양: CJK 웹폰트는 수 MB      |
| 스케일    | `data-posture="tv"`는 기준 크기의 약 1.25배, 터치 영역 64px 이상. `tablet`은 48px 이상                                                        | PRODUCT.md 접근성                        |
| 재질      | 불투명 면 + 사진 하단 스크림만 허용. 블러·글래스·장식 그라데이션 금지. 머티리얼 강도 설정은 유지하되 스크림 농도로 재해석                     | AGENTS.md 금기                           |
| 모션      | 시그니처는 **사진 접힘**(스냅 시 같은 사진이 위로 밀려 띠가 됨, transform만). 그 외 모션은 포커스 이동·눌림·시트 진입 3종                     | 방향 계약 SIGNATURE                      |
| 상태 표현 | 세션은 조용히 사라지지 않음: 종료 시 "종료됨"을 한 박자 보인 뒤 제거. 포커스는 흰 4px 링, 이웃 크기를 바꾸지 않음                             | 탈락안 '항공권'·'노선도'에서 흡수        |

## 2. 벤치마킹 → Novus 패턴 매핑

| 레퍼런스                     | 가져올 것                                           | Novus 구현                                               | 버릴 것                         |
| ---------------------------- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------- |
| Apple TV (tvOS)              | 앱 줄 위 Top Shelf, 포커스된 것만 강조, 크롬 최소화 | 1화면 캡션이 Top Shelf 역할. 포커스는 링만               | 패럴랙스, 블러 재질             |
| Google TV                    | 이어보기 최상단, Ambient 사진 액자                  | 실행 중 세션이 1화면 주인공, 무조작 시 액자              | 추천 피드(데이터 없음), 상단 탭 |
| Samsung The Frame / Nest Hub | 쉴 때는 거실 오브제                                 | 앰비언트: 사진 + 시계만, 캡션 페이드아웃                 | —                               |
| Tizen / webOS                | 숫자 채널, 하단 런처 바                             | 숫자키 1–7로 서비스 바로 열기, 오늘 한 장 하단 탐색기 줄 | 콘텐츠 위에 런처 겹치기         |
| Netflix / 티빙               | 이어보기가 첫 줄                                    | "실행 중 · 12분 전 사용" 캡션                            | 자동 전환 히어로 캐러셀         |
| 세로 피드 (숏폼)             | 한 화면 한 개, 하단 스크림 캡션, 우측 글리프 레일   | 1화면 문법 그대로                                        | 끝없는 스와이프                 |
| 벽걸이 달력                  | 사진 위 + 큰 날짜 + 일/토 색                        | 오늘 한 장                                               | 종이 질감                       |

**우리만의 차별점:** 다른 서비스의 "이어보기"는 추천 데이터인데, Novus는 **실제로 살아 있는 세션**입니다. 그래서 캡션은 추측("시청 중인 작품")을 말하지 않고 사실("실행 중 · 세션 유지 · 12분 전 사용")만 말합니다.

## 3. 개발 전략

- **병행 구축 후 교체(strangler):** v2 토큰과 컴포넌트를 v1 옆에 새로 만들고, 화면 단위로 갈아끼운 뒤 마지막에 v1(`Glass*`, `global.css` 구 블록, 구 스타일 가이드)을 삭제합니다. 중간 단계에서도 앱은 항상 빌드·동작합니다.
- **전환 스위치:** 개발 중에는 `html[data-ui="v2"]`로 v2 화면을 켜고, P7에서 기본값으로 승격합니다.
- **CSS 구조:** `src/app/styles/v2/`에 `tokens.css`(램프·의미색·posture 스케일), `base.css`, 컴포넌트별 CSS. 5,378줄짜리 `global.css`에는 더 추가하지 않습니다.
- **레이어 규칙:** v2 공용 컴포넌트는 `src/shared/ui/v2/`, 홈 위젯은 `src/widgets/home-*`, 온보딩·설정 로직은 `src/features/`. 경계 규칙(AGENTS.md §3) 그대로.
- **신규 인프라는 직접 구현(외부 패키지 금지):**
  - i18n: `src/shared/lib/i18n/` 문자열 카탈로그(JSON) + `useT()` 훅 + `Intl.DateTimeFormat`/`Intl.RelativeTimeFormat`. 달력의 주 시작 요일도 locale을 따름
  - 방향키 내비게이션: `src/shared/lib/focus/` 행·열 기반 로빙 포커스(roving tabindex). 공간 탐색 라이브러리 없이 영역(zone) 단위로
  - 보기 모드·언어·온보딩 완료 여부: `src/shared/lib/preferences.ts`(localStorage + 메모리 폴백)

## 4. 페이즈

각 페이즈의 **통과 기준(Gate)** 을 모두 만족해야 다음 페이즈로 넘어갑니다. 모든 페이즈 공통 Gate:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```

UI를 바꾼 페이즈는 추가로 `.claude/skills/impeccable/scripts/impeccable detect --json <변경 파일>`을 한 번 실행하고 기계적 지적을 고칩니다.

### P0. 기반 정리 — ✅ 완료

- [x] impeccable 4.8.0 설치·설정 (`.claude/skills/impeccable`, `.impeccable/config.json`)
- [x] `/impeccable init` → `PRODUCT.md`
- [x] 방향 라운드(concept-seed) → 조합안 확정, PoC 스케치
- [x] 방향 계약을 홈 surface brief에 기록

### P1. 톤 & 매너 고정 + v2 디자인 가이드 페이지

목표: §1의 규칙을 **실제 토큰과 살아 있는 가이드 페이지**로 고정해서, 이후 모든 화면이 같은 언어로 만들어지게 합니다.

- [x] `src/app/styles/v2/tokens.css`: 중립 9단 램프, 의미색 4개(live·attention·sun·sat), 타입 스케일, 간격(8px 기반), 모서리, 모션 3종, `data-posture` × `data-theme` 조합
- [x] `/styleguide/v2` 가이드 페이지 (개발 모드 전용, 기존 `/styleguide` 라우팅 규칙 재사용)
  - 원칙, 색 램프, 타입 스케일, 형태 문법(원/사각), 포커스 링, 상태(실행 중·종료됨·오류·빈 상태)
  - TV형 ↔ 태블릿형, 다크 ↔ 라이트 실시간 전환
  - 홈 두 화면 패턴과 사진 접힘 모션 데모
- impeccable: `/impeccable typeset`, `/impeccable colorize` 로 스케일·색 검토 → `/impeccable critique styleguide`
- Gate: 가이드 페이지를 1368×912(TV형)와 손에 든 태블릿형 크기에서 캡처해 사용자 승인

### P2. v2 핵심 컴포넌트 + 인프라

- [x] 컴포넌트: `ActionButton`(사각, primary/secondary), `GlyphButton`(원형), `GlyphRail`, `ServicePlate`(공식 로고 규격 플레이트 + 실행 중 점), `Caption`(스크림 위 캡션), `MonthCalendar`, `ListRow`, `Sheet`, `Toggle`, `Segmented`, `Toast`, `Dialog`, `EmptyState`
- [x] i18n 인프라 + 한국어 카탈로그(현재 문자열 이관), 영어 카탈로그로 긴 라벨 테스트
- [x] 방향키 로빙 포커스 (zone: 레일 / 캡션 동작 / 서비스 줄 / 탐색기 줄)
- [x] preferences: posture, language, onboardingDone, ambientFolder, ambientDelay
- [x] 세션 마지막 사용 시각 추적 (페이지 매니저 이벤트 기반, 프런트 저장 또는 Rust 커맨드 추가 시 `src/shared/api/tauri/` 래퍼)
- impeccable: `/impeccable extract` 로 토큰·컴포넌트 정리, `/impeccable audit` (접근성·포커스)
- Gate: 모든 컴포넌트가 가이드 페이지에 상태별로 올라가 있고, 키보드만으로 전부 조작 가능

### P3. 홈 v2 (핵심 화면)

- [x] 1화면: 풀블리드 사진, 캡션(실행 중 세션 / 없으면 마지막 사용 서비스 / 그것도 없으면 오늘 인사), 글리프 레일, 시계
- [x] 오늘 한 장: 사진 띠, 큰 날짜, 월 달력(Google 캘린더 열기), 서비스 7개, 탐색기 줄(갤러리·다운로드·드라이브·검색·라디오·앰비언트·리모컨)
- [x] 사진 접힘 스냅(CSS scroll-snap + transform), 숫자키 1–7
- [x] 앰비언트: 무조작 N분 후 캡션·레일 페이드아웃, 사진 순환(10초 이상 간격, 갤러리 썸네일 캐시 1600px 재사용, 이미지 1장만 DOM)
- [x] 실행 중 목록·닫기·오류 등 기존 DashboardPage 기능 이관
- impeccable: `/impeccable shape home`(상태 목록 확정) → 빌드 → `/impeccable critique`, `/impeccable optimize`
- Gate: DOM 500개 미만(측정 258개), 스냅·접힘 60fps(Surface Pro 4 실측은 P6), 터치·방향키 모두로 실행·복귀·닫기 가능

### P4. 첫 실행 온보딩 + 설정 v2

- [ ] 온보딩 3단계: 언어 → 보기 모드(TV형/태블릿형, 실제 크기 미리보기) → 앰비언트 사진 폴더(건너뛰기 가능)
- [ ] 설정 시트 v2: 언어, 보기 모드, 테마, 앰비언트(폴더·대기 시간), 머티리얼(스크림 농도), 업데이트, 기기 정보
- impeccable: `/impeccable onboard`, `/impeccable clarify`(문구), `/impeccable harden`(빈 값·오류·긴 번역)
- Gate: 설치 직후 상태에서 온보딩 → 홈까지 방향키만으로 완료

### P5. 하위 화면 이관

- [ ] 스트리밍 독(InAppDock/SubpageDock): 글리프 레일 문법으로 통일, 홈·뒤로·새로고침·시계
- [ ] 갤러리 격자 + 풀스크린 뷰어 + 영상 컨트롤 (Experience 규칙: 콘텐츠가 주인공, 크롬은 스크림 위 흰 글리프)
- [ ] 파인더 + PathNavigation
- impeccable: 화면별 `/impeccable critique` → `/impeccable polish`, 영상 컨트롤은 `/impeccable animate`
- Gate: 기존 기능 회귀 없음(HANDOVER.md §2 ④⑤⑦ 항목별 확인), 가상 격자 DOM 상한 유지

### P6. 품질 마감

- [ ] `/impeccable adapt`: 1280–1600 폭, 세로 회전, 두 posture 전 화면
- [ ] `/impeccable harden`: 다국어 긴 라벨, 오프라인, 권한 오류, 빈 폴더
- [ ] `/impeccable audit`: 대비, 포커스 순서, `prefers-reduced-motion`
- [ ] Surface Pro 4 실측: 유휴 RAM, 스냅·뷰어 프레임, 콜드 부팅 시간 → `PERFORMANCE_GUIDE.md`

### P7. 마무리 · v1 제거 · 문서화

- [ ] `impeccable detect` 최종 실행, 스크린샷을 `.impeccable/review/`에 캡처
- [ ] `impeccable-finish-reviewer` 서브에이전트 리뷰 → 지적 반영
- [ ] `impeccable-documenter` 서브에이전트로 **완성된 빌드에서** `DESIGN.md` + `.impeccable/design.json` 생성 (impeccable 규칙: 새 월드의 DESIGN.md는 빌드 후 기록)
- [ ] v2를 기본값으로 승격, v1 컴포넌트·CSS·구 스타일 가이드 삭제
- [ ] `ARCHITECTURE.md`, `HANDOVER.md`, `PERFORMANCE_GUIDE.md` 갱신, 이 문서 삭제

## 5. 결정 사항 (HITL)

| 항목          | 결정                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| 지원 언어     | 한국어(기준), English, 日本語, 中文(简体)                                                 |
| 날씨          | Open-Meteo(API 키 없음). 설정에서 도시 선택, 30분 이상 간격 갱신, 오프라인·미설정 시 숨김 |
| 앰비언트 사진 | 기본 OS 사진 폴더, 설정·온보딩에서 변경. 사진이 없으면 앱 번들 기본 아트워크              |
| 테마          | 기본은 시스템 테마 추종, 설정에서 라이트/다크 고정 가능                                   |
| 캘린더 일정   | 데이터 없음. 달력은 날짜·오늘·주말만 표시                                                 |
