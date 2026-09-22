# Novus Software Architecture

Novus는 구형 Surface Pro 4 m3(4GB RAM) 및 저사양 태블릿/PC 환경에서 시동 시 즉시 실행되어 태블릿 형태의 Google TV 대시보드 경험을 제공하는 초경량 크로스 플랫폼 데스크톱 애플리케이션입니다.

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
| **`widgets`**  | 대시보드에 배치되는 독립된 완성형 UI 블록 (Google TV 쉘프 등) | `features`, `entities`, `shared`                     | `app`, `pages` 참조 불가                        |
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
│   ├── pages/            # 화면 (Dashboard 등)
│   ├── widgets/          # 모듈형 위젯
│   ├── features/         # 비즈니스 기능
│   ├── entities/         # 도메인 모델
│   ├── shared/           # 공통 기반 인프라
│   ├── main.tsx          # React DOM 렌더링 엔트리
│   └── vite-env.d.ts     # Vite 환경 타입 정의
├── src-tauri/            # Tauri v2 (Rust 백엔드)
├── eslint.config.js      # 아키텍처 경계 강제 린터 설정
├── tsconfig.json         # TypeScript 엄격 모드 및 @/* 별칭
└── vite.config.ts        # Vite 8 / Rolldown 최적화 번들러 설정
```
