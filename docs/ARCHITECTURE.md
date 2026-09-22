# Novus Software Architecture

Novus는 저사양 태블릿/PC(4GB RAM급) 환경에서 시동 시 즉시 실행되어 TV형 대시보드 경험을 제공하는 초경량 크로스 플랫폼 데스크톱 애플리케이션입니다.

---

## 1. 아키텍처 개요 및 설계 철학

- **RAM 30MB 안팎의 초경량 유지**: Chromium 전체를 번들링하는 Electron 대신, OS 내장 렌더러(Windows WebView2, macOS WebKit)를 활용하는 **Tauri v2** 기반 런타임을 사용합니다.
- **철저한 단방향 의존성 (Unidirectional Dependencies)**: Feature-Sliced Design(FSD) 사상을 기반으로 계층을 나누고, 역참조(Reverse Import)를 린트 단계에서 원천 차단합니다.
- **Zero-Jank 60fps UX**: 저사양 GPU에서도 버벅임 없는 반응을 위해 CSS GPU 가속(`transform: translateZ(0)`), 최소한의 DOM 노드 유지, 가벼운 번들링을 고수합니다.

```
┌────────────────────────────────────────────────────────┐
│                        app                             │
│   (App Root, Global Providers, Global CSS, Routing)   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                       pages                            │
│           (DashboardPage, SettingsPage, etc.)          │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                      widgets                           │
│     (QuickHeader, MediaShelf, WeatherClock, etc.)      │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                      features                          │
│     (useLaunchApp, TouchNavigation, VirtualDPad)       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                      entities                          │
│        (AppItem, DeviceProfile, SystemMetrics)         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                       shared                           │
│ (Tauri IPC Bridge, UI Kit, Low-spec Hooks, Lib, Types) │
└────────────────────────────────────────────────────────┘
```

---

## 2. 프론트엔드 레이어 정의 및 참조 규칙

| 레이어 (Layer) | 역할 및 내용                                                  | 허용된 의존성 (Import 가능 대상)                     | 금지 사항 (역참조)                              |
| :------------- | :------------------------------------------------------------ | :--------------------------------------------------- | :---------------------------------------------- |
| **`app`**      | 전역 프로바이더, 앱 진입점, 글로벌 테마/스타일                | `pages`, `widgets`, `features`, `entities`, `shared` | -                                               |
| **`pages`**    | 사용자에게 보여지는 최상위 화면 단위 뷰                       | `widgets`, `features`, `entities`, `shared`          | `app` 참조 불가                                 |
| **`widgets`**  | 대시보드에 배치되는 독립된 완성형 UI 블록 (미디어 쉘프 등)    | `features`, `entities`, `shared`                     | `app`, `pages` 참조 불가                        |
| **`features`** | 사용자 상호작용 및 비즈니스 유스케이스 로직                   | `entities`, `shared`                                 | `app`, `pages`, `widgets` 참조 불가             |
| **`entities`** | 도메인 모델(앱 아이템, 시스템 상태 등) 정의                   | `shared`                                             | `app`, `pages`, `widgets`, `features` 참조 불가 |
| **`shared`**   | 공통 UI(터치 버튼, 카드), Tauri IPC 래퍼, 저사양 훅, 유틸리티 | 오직 `shared` 내부만 참조                            | **모든 상위 레이어 절대 참조 금지**             |

> **하네스 강제**: 상위 레이어를 하위 레이어에서 임포트할 경우 `pnpm lint` 및 Git commit 시점에서 즉각적인 컴파일/린트 에러(`boundaries/dependencies`)가 발생합니다.

---

## 3. 백엔드 (Rust / Tauri v2) 아키텍처

Rust 백엔드는 OS 네이티브 제어(창 관리, 전체화면, 자동 실행, 시스템 배터리 및 하드웨어 모니터링)를 담당합니다.

```
src-tauri/
├── src/
│   ├── commands/         # 프론트엔드에서 invoke 가능한 핸들러
│   │   ├── mod.rs        # 커맨드 모듈 등록
│   │   └── system.rs     # 시스템 상태, 전원, 프로세스 관리 커맨드
│   ├── lib.rs            # Tauri 빌더, 플러그인 초기화 및 커맨드 핸들러 등록
│   └── main.rs           # 진입 바이너리
├── capabilities/         # Tauri v2 권한 명세 (default.json)
└── tauri.conf.json       # 앱 설정, 창 크기, 식별자(com.novus.hub)
```

### IPC (Inter-Process Communication) 규약

- 프론트엔드는 Rust 커맨드를 직접 호출하지 않고, 반드시 `src/shared/api/tauri/` 래퍼 함수를 거쳐 호출합니다.
- 이를 통해 IPC 시그니처 변경 시에도 프론트엔드 전반에 걸친 수정 없이 단일 인터페이스에서 대응할 수 있습니다.

---

## 4. 디렉토리 구조 맵

```
novus/
├── docs/                 # 프로젝트 공식 문서 센터
│   ├── ARCHITECTURE.md   # 본 문서
│   ├── PERFORMANCE_GUIDE.md # 4GB RAM 저사양 최적화 가이드
│   ├── HANDOVER.md       # 인수인계 및 작업 가이드
│   └── adr/              # 아키텍처 결정 기록
├── src/                  # React 19 프론트엔드 소스
│   ├── app/              # 앱 루트 & 글로벌 스타일
│   ├── pages/            # 화면 (DashboardPage, StyleGuidePage 등)
│   ├── widgets/          # 모듈형 위젯
│   ├── features/         # 비즈니스 기능
│   ├── entities/         # 도메인 모델
│   ├── shared/           # 공통 기반 인프라 (UI Kit, Tauri IPC, Hooks)
│   │   ├── ui/           # 공통 UI 컴포넌트
│   │   │   ├── common/   # UI 코어 18종
│   │   │   │              #   Actions/Inputs: Button, Input, Checkbox, Toggle, SegmentedControl, Slider, Menu, Tooltip
│   │   │   │              #   Feedback: Badge, Progress, Skeleton, Toast, EmptyState
│   │   │   │              #   Surfaces: Card, ListRow, Divider, Modal, Sheet
│   │   │   ├── button/   # TouchButton (하위 호환)
│   │   │   └── card/     # MediaCard (하위 호환)
│   │   ├── api/          # Tauri IPC 래퍼
│   │   ├── hooks/        # 저사양 최적화 훅
│   │   └── types/        # 공통 타입
│   ├── main.tsx          # React DOM 렌더링 엔트리
│   └── vite-env.d.ts     # Vite 환경 타입 정의
├── src-tauri/            # Tauri v2 (Rust 백엔드)
├── eslint.config.js      # 아키텍처 경계 강제 린터 설정
├── tsconfig.json         # TypeScript 엄격 모드 및 @/* 별칭
└── vite.config.ts        # Vite 8 / Rolldown 최적화 번들러 설정
```

---

## 5. 디자인 시스템 & Style Guide

- **토큰**: `src/app/styles/variables.css` (색·타입·모션·머티리얼), 컴포넌트는 `src/shared/ui/common`
- **머티리얼 모델**: 모든 면은 `틴트 + 헤어라인 엣지 + 상단 스펙큘러 + elevation`으로 구성되며, 여기에 역할별 블러가 더해집니다.
  - **머티리얼 강도는 0–100 연속값 하나**입니다. 런타임이 `<html>`에 `--material-intensity`(0–1)를 씁니다.
  - 역할별 블러는 강도에 비례하며 항상 `14 : 26 : 40` 비율을 유지합니다 (`--material-blur-control` / `-panel` / `-overlay`).
  - 설계상 상한이 있습니다: 100에서도 틴트 알파는 `0.62`에서 멈추고(`--material-tint-alpha`), 엣지는 `--material-edge-boost`만큼 진해집니다. 값을 끝까지 올려도 면이 배경에 녹아 떠 보이지 않습니다.
  - 기본값은 `0`(완전 불투명)이며, `html[data-frost]`가 없을 때는 `backdrop-filter`를 **한 선언도 출력하지 않습니다**. 저사양 타깃에서 합성 레이어가 생기지 않습니다.
  - `backdrop-filter` 미지원 또는 `prefers-reduced-transparency: reduce`일 때 강도는 강제로 0으로 내려갑니다.
- **런타임 제어**: `src/shared/lib/material.ts`(`applyMaterialIntensity`, `resolveMaterialIntensity`, `clampMaterialIntensity`, `describeMaterialIntensity`)와 `useMaterialIntensity` 훅. 향후 설정 화면이 이 API를 그대로 사용합니다.
- **모션 시스템**: 인터랙션 → 레시피 매핑을 고정합니다. `press`(누름) · `lift`(호버) · `reveal`(제자리 등장) · `emerge`(트리거 기반 오버레이) · `enter`(가장자리 진입) · `pulse`(무한 진행). 컴포넌트는 duration/easing을 직접 쓰지 않고 `--motion-*`, `--ease-*`, `--press-scale`, `--lift-distance` 토큰과 `.motion-*` 클래스를 참조합니다. `prefers-reduced-motion: reduce`에서 이동은 제거되고 상태 변화만 남습니다.
- **Style Guide 페이지** (`StyleGuidePage`): Vite 브라우저 DEV에서만 `/styleguide`로 접근. Tauri 런타임 및 프로덕션 빌드에서는 마운트되지 않음 (`isStyleGuideRouteEnabled`). 제품 설정 화면이 아니라 톤앤매너·토큰·컴포넌트 스펙시먼 문서입니다.
