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

Rust 백엔드는 OS 네이티브 제어(창 관리, 전체화면, 시스템 상태) 및 **스트리밍 서비스 싱글톤 페이지 매니저(PageManager)**를 담당합니다.

```
src-tauri/
├── src/
│   ├── commands/         # 프론트엔드에서 invoke 가능한 핸들러 모음
│   │   ├── mod.rs        # 커맨드 모듈 등록
│   │   └── system.rs     # 시스템 상태 및 레거시 웹뷰 호환 커맨드
│   ├── page_manager.rs   # 스트리밍 싱글톤 브라우저 풀 및 페이지(탭) 라이프사이클 매니저
│   ├── lib.rs            # Tauri 빌더, State 관리, 플러그인 초기화 및 커맨드 등록
│   └── main.rs           # 진입 바이너리
├── capabilities/         # Tauri v2 권한 명세 (default.json)
└── tauri.conf.json       # 앱 설정, 식별자(com.novus.hub), 창 크기
```

### IPC (Inter-Process Communication) 인터페이스 및 내부 동작

프론트엔드는 Rust 커맨드를 직접 호출하지 않고, 반드시 `src/shared/api/tauri/` 래퍼 함수를 통해 통신합니다.

| Tauri 커맨드명                    | 래퍼 함수 (`src/shared/api/tauri/`)     | 내부 동작 및 메커니즘                                                                                                                                                                                              |
| :-------------------------------- | :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `show_streaming_page`             | `showStreamingPage(id, url, bounds)`    | • **지연 생성**: 페이지 미존재 시 자식 웹뷰를 메인 창에 `add_child` 도킹<br>• **재진입**: 이미 존재할 경우 뷰포트 bounds 복원 및 `show()`<br>• **자동 스왑**: 이전에 표시되던 다른 페이지를 자동으로 `hide()` 처리 |
| `hide_streaming_page`             | `hideStreamingPage(id)`                 | • **세션 보존**: 웹뷰를 파괴하지 않고 `hide()` 및 오프스크린 이동 처리<br>• 메모리 상에 DOM과 로그인 세션 쿠키를 유지하여 홈(ESC) 복귀 지원                                                                        |
| `update_streaming_page_bounds`    | `updateStreamingPageBounds(id, bounds)` | • 태블릿 독 위치(`right` \| `left` \| `bottom`) 변경 시 리로드 없이 뷰포트 크기/위치만 즉시 갱신 (`set_position`, `set_size`)                                                                                      |
| `reload_streaming_page`           | `reloadStreamingPage(id)`               | • 브라우저 프로세스 재시작 없이 웹뷰의 `reload()`만 실행                                                                                                                                                           |
| `go_back_or_close_streaming_page` | `goBackOrCloseStreamingPage(id)`        | • 브라우저 히스토리 이전 페이지로 뒤로가기 실행 (`history.back()`)<br>• 더 이상 뒤로갈 히스토리가 없는 경우 해당 페이지를 즉시 파괴(`discard`)하여 메모리를 반환하고 홈 복귀 신호(false) 전달                      |
| `discard_streaming_page`          | `discardStreamingPage(id)`              | • 저사양 메모리 압박 시 비활성 페이지 웹뷰 인스턴스 파괴 (`close()`)<br>• 공용 프로필 쿠키 DB는 유지되어 재오픈 시 즉시 로그인 복원                                                                                |
| `attach_child_webview`            | `attachChildWebview(...)`               | • 기존 `InAppPlayer` 하위 호환을 위한 래퍼 (내부적으로 `show_streaming_page` 호출)                                                                                                                                 |
| `close_child_webview`             | `closeChildWebview(...)`                | • 기존 `InAppPlayer` 하위 호환을 위한 래퍼 (내부적으로 `hide_streaming_page` 호출)                                                                                                                                 |
| `launch_native_app_mode`          | `launchNativeAppMode(url)`              | • 시스템 Edge / Chrome PWA 앱 모드(`--app`) 외부 프로세스 런처 (비상 폴백용)                                                                                                                                       |

---

## 4. 디렉토리 구조 맵

```
novus/
├── docs/                 # 프로젝트 공식 문서 센터
│   ├── ARCHITECTURE.md   # 시스템 내부 동작 및 아키텍처 명세
│   ├── PERFORMANCE_GUIDE.md # 4GB RAM 저사양 최적화 가이드
│   └── HANDOVER.md       # 인수인계 및 기능 구현 명세
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

---

## 6. 인앱 스트리밍 뷰 및 세션/쿠키 영속성 규약 (Streaming & Storage Architecture)

Novus는 외부 무거운 브라우저 프로그램을 별도로 띄우지 않고, **단일 윈도우 내에서 태블릿 독(InAppDock)과 네이티브 자식 뷰(Child View)가 한 몸으로 동작**하는 일체형 뷰어 아키텍처를 채택합니다.

### 1) 싱글톤 페이지 매니저(Singleton Page Manager) 도킹 구조

- **`<iframe>` 미사용**: 브라우저 보안 정책(`X-Frame-Options: DENY`, `SAMEORIGIN`, CSP frame-ancestors, Frame-Busting 스크립트)을 원천 차단하기 위해 HTML `<iframe>`을 사용하지 않습니다.
- **앱 라이프사이클과 동일한 싱글톤 브라우저 풀**:
  - 대시보드(허브)는 초경량 시스템 웹뷰(RAM ~30MB)로 상시 유지되며, 스트리밍 서비스는 앱당 하나의 브라우저 엔진 풀 안에서 **페이지(탭)** 로 관리됩니다.
  - 스트리밍 URL(`https://www.youtube.com`, `https://www.netflix.com` 등)은 `app.id` 키에 일대일 매핑됩니다.
  - **지연 생성 (Lazy Creation)**: 첫 클릭 시에만 해당 페이지를 생성하여 뷰포트에 도킹합니다. 기동 시 모든 OTT를 미리 띄우지 않습니다.
  - **Hide != Destroy (세션 및 렌더링 유지)**: 홈(ESC)으로 복귀해도 페이지와 브라우저 프로세스를 파괴하지 않고 숨김(`hide_streaming_page`) 처리합니다. 다시 동일 앱을 열면 스크롤 위치 및 로그인 세션이 즉시 복원됩니다.
  - **페이지 스왑**: 다른 앱으로 전환 시 이전 페이지를 hide하고 대상 페이지를 show(없으면 create)합니다.
  - **Bounds 업데이트**: 태블릿 독 위치(`right` | `left` | `bottom`)나 화면 회전 시 페이지를 재생성하지 않고 뷰포트 bounds만 즉시 갱신(`update_streaming_page_bounds`)합니다.
  - **메모리 압박 대응**: 4GB 저사양 환경에서 필요 시 비활성 백그라운드 페이지만 선별적으로 `discard_streaming_page`할 수 있으며, 공용 프로필 쿠키는 영구 보존됩니다.
- **렌더링 엔진**:
  - **Windows (Surface Pro 4)**: Microsoft Edge WebView2 (Chromium 기반, 단일 브라우저 프로세스/프로필 풀)
  - **macOS**: Apple WebKit (`WKWebView`)

### 2) 계정 로그인 및 세션/쿠키 저장 위치 (Session Persistence)

Novus는 `incognito: false` (기본 영속 모드)로 구동되므로, 사용자가 유튜브, 웨이브, 쿠팡플레이 등에서 로그인한 세션 및 쿠키는 **앱을 종료하거나 OS를 재부팅해도 영구적으로 유지(자동 로그인)**됩니다. 모든 스트리밍 페이지는 단일 공용 프로필 경로를 공유합니다.

| 운영체제                          | 웹 렌더링 엔진                     | 쿠키 및 사용자 데이터 저장 디렉토리                                                                                                                                               |
| :-------------------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows 10/11** (Surface Pro 4) | Microsoft Edge WebView2 (Chromium) | `%LOCALAPPDATA%\com.novus.hub\EBWebView\Default\`<br>• 쿠키: `Network\Cookies` (SQLite DB, DPAPI 암호화)<br>• 로컬 스토리지: `Local Storage\leveldb\`<br>• 인덱스DB: `IndexedDB\` |
| **macOS**                         | Apple WebKit (`WKWebView`)         | `~/Library/WebKit/com.novus.hub/`<br>• 쿠키: `~/Library/HTTPStorages/com.novus.hub.binarycookies`<br>• 웹사이트 데이터: `WebsiteData/Default/LocalStorage/` 및 `IndexedDB/`       |
| **Web Dev Server** (`pnpm dev`)   | 로컬 웹 브라우저 (Chrome/Safari)   | 브라우저 자체 프로필 디렉토리의 Cookie / LocalStorage                                                                                                                             |

> **자동 로그인 보장 규칙**:
>
> 1. `tauri.conf.json`의 앱 식별자(`identifier: "com.novus.hub"`)를 임의로 변경하지 않습니다.
> 2. `WebviewBuilder` 생성 시 임시 세션 모드(`incognito: true`)를 지정하지 않습니다.
> 3. 다른 외부 브라우저(Chrome/Safari)의 쿠키 DB를 직접 읽거나 변조하지 않습니다.

### 3) User-Agent 전략 및 Google 계정 로그인 정책

- **선별적 UA 적용 (지문 일치화)**:
  - 구글 안티어뷰즈 시스템(`accounts.google.com`)은 `User-Agent` 문자열과 실제 브라우저 엔진의 클라이언트 힌트(`Sec-CH-UA`, JS 피처 지문) 불일치를 임베디드 웹뷰/위장 브라우저 판정의 핵심 근거로 사용합니다.
  - 따라서 **YouTube/Google 도메인에 대해서는 가짜 데스크톱 Chrome UA 강제 주입을 배제**하고, 렌더링 엔진 고유의 순정 지문 그대로 통신하도록 처리합니다.
  - 쿠팡플레이 등 특정 OTT가 비표준 환경을 차단하는 경우에만 해당 서비스에 국한하여 데스크톱 UA를 선별 주입합니다.

### 4) 초경량 Chromium(CEF 코어 ~120MB) 전환 로드맵 (해법 C)

- **배경**: Electron(상시 150~200MB RAM) 전면 전환을 피하고, 1GB에 달하는 풀 CEF 배포본에서 불필요한 번들을 쳐낸 순수 웹 브라우징 코어만을 추출하여 도킹하는 단계적 전환을 추진합니다.
- **다이어트 목표 및 패키징 구성**:
  - `libcef` 코어 렌더링 바이너리 (~100MB)
  - V8 스냅샷 및 ICU 데이터 (`v8_context_snapshot.bin`, `icudtl.dat`, ~20MB)
  - 다국어 80개 언어 제외, 필수 언어(`ko.pak`, `en-US.pak`)만 유지 (약 60MB 절감)
  - DevTools, PDF 뷰어, Chrome Extensions, 인쇄 스풀러 등 잉여 모듈 배제
  - ➡️ 총 번들 크기 **약 120MB** 수준의 초경량 렌더러 코어로 `PageManager` 백엔드를 바인딩합니다.
