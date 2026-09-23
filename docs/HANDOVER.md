# Novus Project Handover Document (인수인계 가이드)

본 문서는 다른 개발자 또는 AI 어시스턴트가 프로젝트에 투입되었을 때, 지체 없이 현재 상태를 파악하고 바로 개발을 이어갈 수 있도록 작성된 공식 인수인계서입니다.

---

## 1. 프로젝트 요약

- **프로젝트명**: Novus (`com.novus.hub`)
- **목적**: 저사양 태블릿(4GB RAM급)을 위한 초경량 미디어 콘솔 및 TV형 제어 대시보드
- **기술 스택**: Tauri v2 (Rust) + React 19 + TypeScript + Vite 8 + pnpm
- **아키텍처**: Modular Layered Architecture (FSD 기반 단방향 계층: `app` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`)

---

## 2. 현재 구현 완료 내역 (Baseline Status)

1. **인프라 & 빌드 환경**:
   - 최신 `.gitignore` 정비 (Tauri Rust `target/`, Node/pnpm, Vite, OS 메타데이터, 환경변수)
   - `@/*` -> `src/*` 경로 별칭 완벽 바인딩 (`tsconfig.json`, `vite.config.ts`)
   - Vite 8 Rolldown 호환 청크 분할(`vendor`, `tauri`) 최적화
2. **하네스 엔지니어링 (Harness Engineering)**:
   - `eslint-plugin-boundaries` 기반 계층 간 단방향 의존성 자동 강제
   - `simple-git-hooks` + `lint-staged` 연동으로 커밋 시 자동 린트/포맷/타입 검사 강제
   - Prettier 코드 스타일 통일
3. **레이어드 뼈대 코드 & 디자인 시스템**:
   - `shared/ui/common`: UI 코어 컴포넌트 18종
     - Actions/Inputs: `GlassButton`, `GlassInput`, `GlassCheckbox`, `GlassToggle`, `GlassSegmentedControl`, `GlassSlider`, `GlassMenu`, `GlassTooltip`
     - Feedback: `GlassBadge`, `GlassProgress`, `GlassSkeleton`, `GlassToast`, `GlassEmptyState`
     - Surfaces: `GlassCard`, `GlassListRow`, `GlassDivider`, `GlassModal`, `GlassSheet`
   - `shared/ui/icons`: 초경량 정밀 벡터 SVG 아이콘 모음 (YouTube, Netflix, TVING, Wavve, Disney+, Google Calendar, Web Radio, Photo Frame, Google Search, Weather, Settings, Moon, Remote, Battery)
   - 머티리얼 모델: `틴트 + 헤어라인 엣지 + 상단 스펙큘러 + elevation`, 역할별 블러 비율 14 : 26 : 40
   - 머티리얼 강도는 **0–100 연속값** 하나(`--material-intensity`). 기본 0(불투명)이며 100에서도 틴트 알파 0.62 하한과 엣지 보정으로 면이 떠 보이지 않습니다. `shared/lib/material.ts` + `useMaterialIntensity`로 제어하며 앱 설정에서 슬라이더로 노출할 수 있도록 설계
   - 모션: 인터랙션 → 레시피 6종(`press` · `lift` · `reveal` · `emerge` · `enter` · `pulse`) 고정 매핑. `prefers-reduced-motion` 대응 포함
   - `shared/ui/button & card`: 기존 `TouchButton`, `MediaCard`를 시스템 기반으로 하위 호환 및 브랜드 SVG/뱃지 확장 유지
   - `shared`: 저사양용 10초 주기 시계 훅(`useCurrentTime`), 창 제어 API(`window.ts`), 런타임 게이트(`isTauriRuntime`, `isStyleGuideRouteEnabled`)
   - `entities`: 앱 바로가기(`AppItem`), 시스템 프로필(`DeviceProfile`)
   - `features`: 앱 실행 훅(`useLaunchApp`)
   - `widgets`: 시계/날씨/설정 헤더(`QuickHeader`), TV 스타일 앱 쉘프(`MediaShelf`), 설정 사이드 시트(`SettingsSheet`)
   - `pages`: 3단 섹션 분리 및 검색 연동 메인 대시보드(`DashboardPage`) 및 **DEV 전용** 스타일 가이드(`StyleGuidePage`)
   - `app`: 글로벌 시맨틱 토큰 및 머티리얼 스타일(`global.css`, `variables.css`), 앰비언트 레이어 + 뷰 게이트(`App.tsx`)
   - `src-tauri`: Rust 모듈 분리 (`commands/system.rs`, `commands/mod.rs`)

### Style Guide 접근 (개발 전용)

- **경로**: Vite 브라우저 개발 서버에서만 `http://localhost:1420/styleguide`
- **성격**: Figma형 톤앤매너/토큰/컴포넌트 스펙시먼 문서. 제품 설정·기능 데모가 아님.
- **조건**: `import.meta.env.DEV === true` 이고 Tauri 런타임이 아닐 것
- Tauri 앱(개발/배포 모두) 및 프로덕션 빌드에는 노출되지 않음. 헤더 진입 버튼 없음.

---

## 3. 새로운 기능 / 위젯 추가 가이드

### ① 새로운 위젯을 추가할 때

1. `src/widgets/{widget-name}/ui/{WidgetName}.tsx` 생성
2. `src/widgets/{widget-name}/index.ts`에서 컴포넌트 export
3. `src/widgets/index.ts` 배럴 파일에 추가
4. **주의**: 위젯은 `app`이나 `pages`를 import할 수 없습니다 (`features`, `entities`, `shared`만 참조 가능).

### ② 새로운 바로가기 앱/서비스를 추가할 때

1. `src/pages/dashboard/ui/DashboardPage.tsx`의 `FEATURED_APPS` 배열에 항목 추가:
   ```typescript
   {
     id: "disney",
     title: "Disney+",
     category: "media",
     url: "https://www.disneyplus.com",
     accentColor: "#113ccf",
   }
   ```

### ③ 새로운 Rust IPC 커맨드를 추가할 때

1. `src-tauri/src/commands/`에 함수 작성 후 `#[tauri::command]` 매크로 부여
2. `src-tauri/src/lib.rs`의 `invoke_handler`에 등록

### ④ 공통 디자인 시스템 컴포넌트를 활용 및 확장할 때

1. **컴포넌트 참조**: 상위 레이어(`pages`, `widgets`)에서는 `@/shared`에서 바로 `GlassCard`, `GlassButton`, `GlassInput`, `GlassModal`, `TouchButton`, `MediaCard`를 임포트합니다.
2. **신규 컴포넌트 추가**: `src/shared/ui/common/` 내에 작성하고 `src/shared/ui/common/index.ts`에 배럴 익스포트합니다.
3. **토큰 수정**: 메인 컬러는 `src/app/styles/variables.css`의 `--color-primary`, 면의 농도/블러는 `--material-*` 정의를 조정합니다. 컴포넌트에 임의 블러값을 쓰지 말고 역할 토큰(`control`/`panel`/`overlay`)을 사용합니다.
4. **모션 규칙**: duration·easing·이동거리를 컴포넌트에 직접 쓰지 않습니다. 인터랙션에 맞는 레시피(`.motion-press`, `.motion-lift`, `.motion-reveal`, `.motion-emerge`, `.motion-enter-*`)와 `--motion-*` / `--ease-*` 토큰만 참조합니다. `transform`과 `opacity` 외의 속성은 애니메이션하지 않습니다.
5. **접근성 및 터치 기준**: 모든 버튼과 터치 요소는 최소 48x48px(`min-h-touch`) 및 active 피드백(`scale(0.97)`)을 보장하고, 반투명 면 위 소형 텍스트는 4.5:1 대비를 확인합니다. 새 컴포넌트는 default · hover · focus · active · disabled 상태를 모두 정의합니다.
6. **머티리얼 기본값**: 배포 기본 강도는 `0`입니다. 상향은 설정에서 사용자가 선택하는 옵션이며, 미지원 환경과 투명도 감소 설정에서는 자동으로 0으로 폴백됩니다.
7. **금지**: 무거운 UI 라이브러리, 임의 블러/duration/hex 하드코딩, 코드·문서에 타사 디자인 브랜드명을 시스템 명칭으로 사용하는 것.

---

## 4. 개발 및 커밋 전 필수 실행 체크리스트

```bash
# 1. 타입 검사 (에러 없어야 함)
pnpm typecheck

# 2. 린트 및 아키텍처 경계 검사 (boundaries 위반 없어야 함)
pnpm lint

# 3. 코드 포맷 검사
pnpm format:check

# 4. 프론트엔드 프로덕션 빌드 검사
pnpm build
```

---

## 5. 다음 단계 로드맵 (Next Milestones)

- [x] **앱 설정 화면 (SettingsSheet)**: `GlassSheet` + `GlassListRow` + `GlassSlider`(0–100 머티리얼 강도) 기반 설정 화면 구현 완료.
- [ ] **Tauri v2 Child Webview 기반 인앱 스트리밍 런처**: 넷플릭스/유튜브/티빙/웨이브를 브라우저 없이 Tauri 자식 웹뷰 및 OSD(Home/Back)로 앱 내 재생
- [ ] **Tauri Autostart 플러그인 연동**: Windows 부팅 시 자동 시작 및 백그라운드 상주 옵션 구현
- [ ] **D-Pad / 키보드 방향키 내비게이션**: 터치 외에도 무선 리모컨 및 키보드로 타일 포커스를 이동할 수 있는 `useSpatialNavigation` 기능 구현
- [ ] **시스템 배터리 / Wi-Fi 상태 조회**: Rust 백엔드 시스템 모니터링 커맨드 확장
- [ ] **스마트폰 QR 웹 리모컨**: 동일 Wi-Fi 상에서 스마트폰으로 대시보드를 무선 제어하는 경량 웹소켓 서버 연동
