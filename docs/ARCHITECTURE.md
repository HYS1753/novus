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
│        (DashboardPage, HomeV2Screen, StyleGuideV2)     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                      widgets                           │
│   (HomeV2, SettingsV2, Onboarding, Gallery, Finder)    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                      features                          │
│  (useLaunchApp, useWeather, useAmbientPhoto, useIdle)  │
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
│   │   ├── device_profile.rs # 앱 시작 시 Windows/macOS 기기 프로필 1회 수집
│   │   ├── embedded_player.rs # OS별 libmpv 재생 표면을 연결하는 공통 IPC
│   │   ├── macos_player.rs # macOS NSView 표면 및 libmpv 동적 로딩
│   │   ├── media_fs.rs   # OS 드라이브/디렉터리 스캔 및 기본 앱 파일 열기 커맨드
│   │   ├── player.rs     # 인앱 디코더 미지원 형식의 외부 플레이어 폴백 커맨드
│   │   ├── system.rs     # 시스템 상태 및 레거시 웹뷰 호환 커맨드
│   │   └── thumbnail.rs  # 영속 썸네일 축소 생성·캐시 용량 정리
│   ├── display_mode.rs   # Novus 창 모드와 Windows 웹 플레이어 전체화면 상태
│   ├── page_manager.rs   # 스트리밍 싱글톤 브라우저 풀 및 페이지(탭) 라이프사이클 매니저
│   ├── lib.rs            # Tauri 빌더, State 관리, 플러그인 초기화 및 커맨드 등록
│   └── main.rs           # 진입 바이너리
├── capabilities/         # Tauri v2 권한 명세 (default.json)
└── tauri.conf.json       # 앱 설정, 식별자(com.novus.hub), 창 크기
```

### IPC (Inter-Process Communication) 인터페이스 및 내부 동작

프론트엔드는 Rust 커맨드를 직접 호출하지 않고, 반드시 `src/shared/api/tauri/` 래퍼 함수를 통해 통신합니다.

| Tauri 커맨드명                    | 래퍼 함수 (`src/shared/api/tauri/`)               | 내부 동작 및 메커니즘                                                                                                                                                                                              |
| :-------------------------------- | :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `show_streaming_page`             | `showStreamingPage(id, url, bounds)`              | • **지연 생성**: 페이지 미존재 시 자식 웹뷰를 메인 창에 `add_child` 도킹<br>• **재진입**: 이미 존재할 경우 뷰포트 bounds 복원 및 `show()`<br>• **자동 스왑**: 이전에 표시되던 다른 페이지를 자동으로 `hide()` 처리 |
| `hide_streaming_page`             | `hideStreamingPage(id)`                           | • **세션 보존**: 웹뷰를 파괴하지 않고 `hide()` 및 오프스크린 이동 처리<br>• 메모리 상에 DOM과 로그인 세션 쿠키를 유지하여 홈 복귀 지원                                                                             |
| `update_streaming_page_bounds`    | `updateStreamingPageBounds(id, bounds, revision)` | • 태블릿 독 위치(`right` \| `left` \| `bottom`) 변경 시 리로드 없이 뷰포트 크기/위치만 즉시 갱신 (`set_bounds`, 이전 revision 제외)                                                                                |
| `reload_streaming_page`           | `reloadStreamingPage(id)`                         | • 브라우저 프로세스 재시작 없이 웹뷰의 `reload()`만 실행                                                                                                                                                           |
| `go_back_or_close_streaming_page` | `goBackOrCloseStreamingPage(id)`                  | • 브라우저 히스토리 이전 페이지로 뒤로가기 실행 (`history.back()`)<br>• 더 이상 뒤로갈 히스토리가 없는 경우 해당 페이지를 즉시 파괴(`discard`)하여 메모리를 반환하고 홈 복귀 신호(false) 전달                      |
| `discard_streaming_page`          | `discardStreamingPage(id)`                        | • 저사양 메모리 압박 시 비활성 페이지 웹뷰 인스턴스 파괴 (`close()`)<br>• 공용 프로필 쿠키 DB는 유지되어 재오픈 시 즉시 로그인 복원                                                                                |
| `get_system_locations`            | `getSystemLocations()`                            | • Windows 드라이브(`C:\`, `D:\`) / macOS 볼륨 및 주요 시스템 폴더(사진, 동영상, 다운로드, 문서, 홈) 목록 감지 반환                                                                                                 |
| `scan_directory`                  | `scanDirectory(path, filterMode)`                 | • 파인더에서 쓰는 동기 디렉터리 스캔. `filterMode: "media"` 시 이미지/비디오만 추출, `"all"` 시 전체 시스템 파일 추출                                                                                              |
| `get_media_page`                  | `getMediaPage(options)`                           | • 갤러리 전용: 백그라운드에서 폴더를 스캔·검색·정렬해 단일 스냅샷을 만들고, 스냅샷 ID와 오프셋으로 최대 120개씩 반환. 기본 요청 크기는 80개이며 새 검색·정렬·새로고침은 기존 스냅샷을 무효화                       |
| `open_file_in_os`                 | `openFileInOs(path)`                              | • OS 기본 쉘/애플리케이션을 통해 지정된 파일 또는 폴더 열기 (`tauri_plugin_opener`)                                                                                                                                |
| `get_image_thumbnail`             | `getImageThumbnail(filePath, maxDim)`             | • 블로킹 작업 풀에서 축소한 JPEG Base64 URI 반환. 파일 경로·크기·수정 시각·출력 크기 기반 앱 캐시 디렉터리에 저장하며 주기적으로 256MiB 초과분을 정리. 프런트엔드는 동시 요청을 2개로 제한                         |
| `cleanup_thumbnail_cache`         | `cleanupThumbnailCache()`                         | • 명시적으로 호출될 때 앱 캐시 디렉터리의 썸네일 삭제. 앱 시작·종료에는 호출하지 않음                                                                                                                              |
| `play_video_native`               | `playVideoNative(filePath)`                       | • 사용자가 외부 재생을 선택한 경우 MPV 설치 및 로컬 후보 경로를 탐색해 하드웨어 가속으로 구동하고, 없으면 OS 기본 플레이어로 폴백                                                                                  |
| `get_device_profile`              | `getDeviceProfile()`                              | • 앱 시작 시 수집해 Tauri State에 보관한 운영체제·버전·기기명·제조사·모델·CPU·논리 코어·RAM·아키텍처를 반환. 프런트엔드는 동일 Promise를 공유해 다시 수집하지 않음                                                 |
| `get_embedded_player_support`     | `getEmbeddedPlayerSupport()`                      | • Windows는 묶인 DLL 파일을, macOS는 dylib와 의존 파일의 실제 로딩·필수 심볼을 확인해 `available` 반환. macOS 결과는 세션 동안 캐시                                                                                |
| `open_embedded_video`             | `openEmbeddedVideo(id, path, bounds)`             | • Windows 자식 HWND 또는 macOS NSView를 생성해 libmpv에 결합. 파일 경로를 정규화하고 OS별 단일 세션 유지. 엔진이 없으면 갤러리에서 WebView `<video>` 사용                                                          |
| `update_embedded_video_bounds`    | `updateEmbeddedVideoBounds(id, bounds)`           | • 화면 영역을 Windows에서는 DPI 적용 HWND 좌표로, macOS에서는 상단 원점 CSS 좌표를 NSView 프레임으로 변환해 전달. 세션 ID가 다르면 갱신하지 않음                                                                   |
| `close_embedded_video`            | `closeEmbeddedVideo(id)`                          | • 디코더 스레드를 종료하고 Win32 자식 창 또는 NSView를 UI 스레드에서 제거. 이미 바뀐 세션 ID의 닫기 요청은 무시                                                                                                    |
| `control_embedded_video`          | `controlEmbeddedVideo(id, action)`                | • Windows/macOS 공통 재생·일시정지, 10초 앞뒤 이동, 절대 시간/퍼센트 탐색, 음량 조절, 음소거 토글을 해당 libmpv 세션 작업 스레드에 전달. 세션 ID를 확인하고 결과를 반환                                            |
| `get_embedded_video_state`        | `getEmbeddedVideoState(id)`                       | • 현재 재생 위치(time-pos), 전체 길이(duration), 일시정지 여부(pause), 음량(volume), 음소거(mute) 상태를 libmpv C API 속성 조회를 통해 실시간 질의                                                                 |
| `launch_native_app_mode`          | `launchNativeAppMode(url)`                        | • 시스템 Edge / Chrome PWA 앱 모드(`--app`) 외부 프로세스 런처 (비상 폴백용)                                                                                                                                       |

로컬 영상의 프런트엔드 계약은 운영체제에 관계없이 `src/shared/api/tauri/embeddedVideo.ts`를 사용합니다. 앱 시작 시 수집한 `DeviceProfile.os_family`는 지원 조회의 플랫폼 값으로 쓰고, 갤러리는 운영체제명을 직접 비교하지 않고 `available` 기능값으로 재생 경로를 선택합니다. Windows는 자식 HWND를, macOS는 메인 스레드에서 붙인 NSView를 libmpv의 `wid`로 넘깁니다. macOS 지원 조회는 묶인 dylib와 의존성을 실제로 동적 로딩하고 필수 심볼을 확인한 결과를 세션 동안 캐시합니다. 열기·크기 변경·닫기는 OS별 단일 세션을 관리하며 디코더 스레드와 네이티브 뷰를 종료 시 해제합니다. `control_embedded_video`와 `get_embedded_video_state`는 동일 세션 스레드에서 mpv 명령과 속성을 질의·실행하며, 프론트엔드의 `VideoPlayerControls`는 반응형 타임라인 진행 바, 10초 건너뛰기, 정밀 음량 조절, 재생 시간 표시, 모든 재생 경로에서 상·하단 조작 UI의 3초 무조작 자동 숨김과 키보드 단축키를 표준 제공합니다. Windows 네이티브 영상은 고정된 전체 클라이언트 영역에 렌더링하고, 재생 중에만 생성하는 투명 조작 웹뷰가 그 위에서 UI를 합성합니다. 웹뷰 영상도 고정된 캔버스 위 DOM 조작 UI를 사용합니다. 배포 번들은 `src-tauri/tauri.conf.json`의 `bundle.resources` 및 `macOS.files` 설정을 통해 `bin/mpv`의 라이브러리를 각각 Windows `Resources/mpv` 및 macOS `Contents/Frameworks/mpv`에 자동 패키징합니다. 이 폴더에 유효한 라이브러리가 없으면 WebView 재생을 사용합니다. 의존 바이너리는 `pnpm setup:mpv`(`scripts/setup_mpv.py`)를 통해 버전별로 일관되게 관리·다운로드됩니다.

---

- **자동 시작 플러그인**: `tauri-plugin-autostart`를 `lib.rs`에서 등록하고 `capabilities/default.json`에 `autostart:allow-enable/disable/is-enabled`를 허용합니다. 프런트 래퍼는 `src/shared/api/tauri/autostart.ts`.
- **외부 HTTP**: 날씨는 IPC가 아니라 웹뷰에서 직접 `https://api.open-meteo.com`, `https://geocoding-api.open-meteo.com`을 호출합니다(`src/shared/api/weather/`). 현재 CSP는 `null`입니다.

## 4. 디렉토리 구조 맵

```
novus/
├── docs/                 # 프로젝트 공식 문서 센터
│   ├── ARCHITECTURE.md   # 시스템 내부 동작 및 아키텍처 명세
│   ├── PERFORMANCE_GUIDE.md # 4GB RAM 저사양 최적화 가이드
│   └── HANDOVER.md       # 인수인계 및 기능 구현 명세
├── src/                  # React 19 프론트엔드 소스
│   ├── app/              # 앱 루트 & 글로벌 스타일
│   ├── pages/            # 화면 (DashboardPage + HomeV2Screen, Gallery, Finder, StyleGuideV2)
│   ├── widgets/          # 모듈형 위젯
│   ├── features/         # 비즈니스 기능
│   ├── entities/         # 도메인 모델
│   ├── shared/           # 공통 기반 인프라 (UI Kit, Tauri IPC, Hooks)
│   │   ├── ui/           # 공통 UI 컴포넌트 (모든 화면 UI는 이 계층에서 재활용)
│   │   │   ├── v2/       # v2 컴포넌트 (NvRoot, NvButton, NvGlyphButton, NvServicePlate, NvSheet, …)
│   │   │   ├── common/   # v1 코어 6종 (갤러리·파인더·뷰어가 브리지 안에서 사용)
│   │   │   ├── media/    # GlassMediaTile (1:1 풀커버 타일 + GPU 저비용 하단 틴트 오버레이)
│   │   │   ├── nav/      # SubpageDock (내부 서브페이지 표준 시스템 독)
│   │   │   ├── icons/    # BrandIcons, NovusLogo, SystemIcons 및 공통 MotionIcon 모션 프리셋
│   │   │   └── button/   # TouchButton
│   │   ├── api/          # Tauri IPC 래퍼 (mediaFs, mediaPlayer, window)
│   │   ├── hooks/        # 저사양 최적화 훅 (useCurrentTime, useDockPosition, etc.)
│   │   └── types/        # 공통 타입 (DockPosition, etc.)
│   ├── main.tsx          # React DOM 렌더링 엔트리
│   └── vite-env.d.ts     # Vite 환경 타입 정의
├── src-tauri/            # Tauri v2 (Rust 백엔드)
├── eslint.config.js      # 아키텍처 경계 강제 린터 설정
├── tsconfig.json         # TypeScript 엄격 모드 및 @/* 별칭
└── vite.config.ts        # Vite 8 / Rolldown 최적화 번들러 설정
```

### 아이콘 및 모션 경계

- SVG 아이콘은 `src/shared/ui/icons/`에서만 정의하며 화면·위젯 내부에 개별 SVG나 문자형 닫기/정렬 아이콘을 만들지 않습니다.
- 아이콘 애니메이션은 `MotionIcon`의 `pop`, `rotate`, `tilt`, `nudge-left`, `nudge-right`, `nudge-up`, `spin`, `pulse`, `breathe` 프리셋만 사용합니다.
- 상호작용 프리셋은 상위 버튼의 hover/focus에 반응합니다. 반복 프리셋은 실제 진행·연결 상태에서만 `active`로 실행하고 `prefers-reduced-motion`에서는 정지합니다.
- 스트리밍 `InAppDock`은 별도 내비게이션 DOM을 만들지 않고 `SubpageDock`에 스트리밍 전용 액션 슬롯만 조합합니다.
- 파일 탐색 화면은 `SubpageDock`의 방문 기록 뒤로가기와 `PathNavigation`의 상위 폴더·브레드크럼을 명확히 분리합니다.

---

## 5. 디자인 시스템 & Style Guide

디자인 시스템 명세(토큰 값, 형태·색 규칙, 금지 목록)는 루트의 [`DESIGN.md`](../DESIGN.md)와 `.impeccable/design.json`이 기준입니다. 이 절은 런타임 동작만 설명합니다.

- **머티리얼 강도**: 0–100 값 하나(`useMaterialIntensity`, `src/shared/lib/material.ts`)가 `<html>`에 `--material-intensity`(0–1)를 씁니다. v2에서는 블러가 아니라 사진 스크림 농도(`--nv-scrim-strength`)로만 반영됩니다.
- **Style Guide 페이지** (`StyleGuideV2Page`): Vite 브라우저 DEV에서만 `/styleguide`로 접근(`isStyleGuideRouteEnabled`). Tauri 런타임과 프로덕션 빌드에서는 마운트되지 않습니다. 실제 `HomeV2` 위젯을 예시 데이터로 1368×912에 렌더링하고, 언어·테마·보기 모드를 실시간으로 바꿉니다.

### v2 디자인 시스템

- **범위**: v2 토큰은 `.nv-root` 요소 아래에서만 적용됩니다. v1 화면(`html.dark`, `--color-*`)에는 영향이 없습니다.
- **토큰**: `src/app/styles/v2/tokens.css`. 중립 9단 램프(`--nv-n0`~`--nv-n8`) → 역할 토큰(`--nv-ground`, `--nv-surface`, `--nv-text` 등). 의미색은 `--nv-live`(실행 중), `--nv-attention`(확인 필요), `--nv-sun`/`--nv-sat`(달력 주말) 네 개뿐입니다.
- **테마**: `data-theme` 없음 = OS 설정 추종, `light`/`dark` = 사용자 고정.
- **보기 모드**: `data-posture="tablet"`(배율 1, 터치 48px) / `"tv"`(배율 1.25, 터치 64px). 모든 크기 토큰은 `--nv-scale`을 곱합니다.
- **사진 위 크롬**: `.nv-on-media` 안에서는 테마와 무관하게 흰색. 유일한 반투명은 사진 하단 스크림(`--nv-scrim`)이며, 머티리얼 강도는 스크림 농도로만 반영됩니다. 블러는 쓰지 않습니다.
- **컴포넌트**: `src/shared/ui/v2/` (`Nv*` 접두사). 원형 `NvGlyphButton` = 전역 동작, 사각 `NvButton`/`NvServicePlate` = 콘텐츠의 동작.
- **`NvRoot`**: 모든 v2 화면의 루트. 저장된 테마·보기 모드·언어를 `data-theme`/`data-posture`/`lang`으로 적용하고, 시트·대화상자 포털(`data-nv-portal`)과 방향키 공간 탐색을 제공합니다.
- **설정 저장소**: `src/shared/lib/preferences.ts` (`novus.v2.preferences` 한 레코드, localStorage 실패 시 메모리). 컴포넌트는 `usePreference(key)`로 읽고 씁니다. 키: `language`, `posture`, `theme`, `onboardingDone`, `ambientFolder`, `ambientDelayMinutes`, `weatherCity`.
- **다국어**: `src/shared/lib/i18n/`. 한국어 카탈로그(`messages/ko.ts`)가 기준이고 `en`/`ja`/`zh-CN`은 같은 키를 타입으로 강제합니다. `useI18n()`이 `t(key, vars)`, 상대 시간, 목록, 시각 포맷(`Intl`)을 제공합니다. 언어 미설정 시 OS 언어에서 고르고, 없으면 한국어.
- **방향키 공간 탐색**: `src/shared/lib/spatialNavigation.ts` + `useSpatialNavigation`. 누른 방향에서 가장 가까운 포커스 대상을 고르며, `[data-nav-scope]`(시트·대화상자) 밖으로 나가지 않습니다. 텍스트 입력·슬라이더·라디오 그룹은 좌우 키를 스스로 씁니다.
- **세션 사용 시각**: `src/shared/lib/sessionActivity.ts`. 허브가 실제로 본 사실(서비스가 화면에 나타나고 떠난 시각)만 기록해 "12분 전 사용" 캡션에 씁니다.
- **v1 → v2 토큰 브리지** (`src/app/styles/v2/bridge.css`): v2 모드에서 갤러리·파인더·뷰어·영상·스트리밍 화면은 `NvRoot className="nv-bridge"` 안에서 렌더링됩니다. 그 안에서 v1 토큰(`--color-*`, `--glass-*`, `--radius-*`)이 v2 램프로 다시 연결되어, 로직은 v1 그대로 두고 색·모서리·그림자만 v2가 됩니다. 브리지 안에서는 `backdrop-filter`를 강제로 끕니다. 독(`in-app-dock`)은 원형 글리프 레일(채운 홈 원)로 바뀝니다. 갤러리·스트리밍은 자체 방향키를 쓰므로 공간 탐색을 끄고, 파인더는 켭니다.
- **기본 앰비언트 아트워크**: `src/assets/ambient/*.jpg`(1600×1000 절차 생성 래스터, 생성기 `scripts/design/generate-ambient-art.py`). 각 이미지에 초점 높이(`focusY`)가 있어, 사진이 접힐 때 띠가 그 높이(수평선 등)를 중심으로 보입니다. 사용자 사진은 0.5.
- **v2 Style Guide**: DEV 브라우저에서 `/styleguide`. 테마·보기 모드를 실시간으로 바꾸며 홈 패턴(사진 접힘 포함)을 1368×912 기준으로 확인합니다.

---

## 6. 로컬 미디어 및 파일 탐색 상태

갤러리와 파인더는 `DashboardPage`가 전환하는 독립 화면입니다. 두 화면의 `useFileBrowser`는 `navigateTo`가 방문 경로를 최대 50개 쌓으며 `navigateBack`이 이를 역순으로 소비합니다. 각 화면의 현재 경로와 방문 기록은 `novus.browser.media` / `novus.browser.all` 키로 `localStorage`에 저장됩니다. 홈으로 이동하면 화면 컴포넌트와 파일 목록은 해제되고 재진입 시 저장된 경로를 다시 스캔합니다. 파인더는 `scan_directory`로 전체 목록을 읽고, 갤러리는 `get_media_page`로 Rust 메모리의 현재 폴더 스냅샷에서 80개씩 받습니다. 갤러리 검색은 입력 후 250ms 대기해 재스캔하고, 정렬·검색·새로고침은 새 스냅샷을 만듭니다. 검색과 정렬은 파일시스템을 변경하지 않습니다.

독의 뒤로가기는 갤러리의 열린 뷰어, 방문 기록, 홈 순서로 동작합니다. 상위 폴더와 브레드크럼 이동은 `PathNavigation`의 별도 동작입니다. 갤러리는 현재 스크롤 위치와 뷰포트 크기에서 보이는 격자 행 및 양쪽 여유 행만 마운트하고, 스크롤 끝에 가까워지면 다음 묶음을 요청합니다. 파인더는 40개 단위 페이지로 DOM 수를 제한합니다. 정확한 전체 정렬을 위해 갤러리의 첫 요청은 폴더 전체 메타데이터를 Rust에서 스캔·정렬하지만 프런트엔드로는 필요한 묶음만 전달합니다. 뷰어는 아직 받지 않은 다음 사진에 도달하면 후속 묶음을 요청합니다. 썸네일은 2개 동시 요청 큐와 Base64 문자열 길이 기준 12MiB 프런트엔드 URI 캐시를 거쳐 Rust 영속 디스크 캐시에 저장됩니다. 뷰어는 1600px 화면 이미지를 디코딩한 뒤 표시하고 확대 시 3200px를 요청하며, 10/15/30초 자동 재생을 지원합니다.

긴 파일 경로는 `PathNavigation`에서 현재 폴더와 바로 위 폴더를 우선 표시하고 앞쪽 조상은 `…` 메뉴로 접습니다. `상위` 버튼은 고정 크기로 유지하며 긴 현재 이름은 앞쪽을 생략해 끝부분을 표시합니다.

대시보드의 스크롤 안내 상태는 `DashboardPage`의 현재 스크롤 영역에만 대응합니다. 내부 앱에서 홈으로 돌아와 대시보드 DOM이 다시 생성되면 `useLayoutEffect`가 새 영역에 스크롤·크기 감시를 연결하고 상단/하단 그라데이션 표시 여부를 페인트 전에 다시 계산합니다.

## 7. 인앱 스트리밍 뷰 및 세션/쿠키 영속성 규약 (Streaming & Storage Architecture)

Novus는 외부 무거운 브라우저 프로그램을 별도로 띄우지 않고, **단일 윈도우 내에서 태블릿 독(InAppDock)과 네이티브 자식 뷰(Child View)가 한 몸으로 동작**하는 일체형 뷰어 아키텍처를 채택합니다.

### 1) 싱글톤 페이지 매니저(Singleton Page Manager) 도킹 구조

- **`<iframe>` 미사용**: 브라우저 보안 정책(`X-Frame-Options: DENY`, `SAMEORIGIN`, CSP frame-ancestors, Frame-Busting 스크립트)을 원천 차단하기 위해 HTML `<iframe>`을 사용하지 않습니다.
- **앱 라이프사이클과 동일한 싱글톤 브라우저 풀**:
  - 대시보드(허브)는 초경량 시스템 웹뷰(RAM ~30MB)로 상시 유지되며, 스트리밍 서비스는 앱당 하나의 브라우저 엔진 풀 안에서 **페이지(탭)** 로 관리됩니다.
  - 스트리밍 URL(`https://www.youtube.com`, `https://www.netflix.com` 등)은 `app.id` 키에 일대일 매핑됩니다.
  - **지연 생성 (Lazy Creation)**: 첫 클릭 시에만 해당 페이지를 생성하여 뷰포트에 도킹합니다. 기동 시 모든 OTT를 미리 띄우지 않습니다.
  - **Hide != Destroy (세션 및 렌더링 유지)**: 홈으로 복귀해도 페이지와 브라우저 프로세스를 파괴하지 않고 숨김(`hide_streaming_page`) 처리합니다. 다시 동일 앱을 열면 스크롤 위치 및 로그인 세션이 즉시 복원됩니다.
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

### 실행 중인 웹 앱과 공통 독

- 홈 이동은 웹뷰를 숨겨 DOM·재생 상태를 유지합니다. 홈 1화면 캡션 아래 "실행 중 N" 트레이와 2화면 서비스 타일의 닫기 버튼이 같은 목록을 씁니다.
- 스트리밍 앱·갤러리·파인더의 공통 `SubpageDock`은 `RunningAppsContext`로 실행 목록을 받아 레일 가운데에 서비스별 16:9 플레이트(`NvBrandArt`, 홈 타일과 같은 아트)로 보여 줍니다. 현재 앱은 잉크 링, 각 플레이트 모서리의 원형 ×가 종료입니다. 레일 폭은 `--nv-target-glyph` + 여백으로 계산되어 어떤 배율에서도 원이 잘리지 않습니다. 기본 우측 독 외에 좌측·하단 설정도 따릅니다.
- `list_streaming_pages` / `listStreamingPages()`는 PageManager에 등록되고 실제 웹뷰가 존재하는 앱 ID를 반환합니다. 웹뷰 생성·닫기·이전 탐색 완료 후 프론트엔드 이벤트로 목록을 갱신하며 폴링하지 않습니다.
- 아이콘 선택은 기존 웹뷰를 다시 표시하고, 닫기는 `discard_streaming_page`로 웹뷰를 파괴합니다. 현재 앱을 닫으면 홈으로 이동합니다. 닫기 실패 시 목록을 유지하고 오류를 표시합니다. 로그인 프로필 쿠키는 유지됩니다.
- 목록은 앱이 열려 있다는 표시이며 오디오 재생 여부를 감지하지 않습니다. 외부 브라우저 프로세스는 추적하지 않습니다. 브라우저 개발 서버(`pnpm dev`)에서는 PageManager가 없으므로 `InAppPlayer`가 `markWebStreamingPageOpen`으로 메모리 목록에 등록하고, `listStreamingPages`/`discardStreamingPage`가 그 목록을 씁니다(다시 열면 iframe은 새로 로드됨). 넷플릭스 등은 iframe을 거부하므로 실제 재생 확인은 `pnpm tauri dev`로 합니다.

### 내장 영상 플레이어 입력·종료 안전성

- 네이티브/웹뷰 모두 화면 클릭·터치로 상·하단 조작 UI를 토글하고 3초 무조작 후 숨깁니다. Windows/웹뷰에서는 영상 영역을 고정한 채 opacity만 140ms로 전환하고 숨겨진 버튼은 inert 처리합니다. 슬라이더·버튼의 포인터 조작 중에는 자동 숨김을 보류합니다. Windows는 mpv의 비활성 자식 창에서 호스트 STATIC HWND로 전달되는 클릭을 SetWindowSubclass로 받아 메인 웹뷰에 embedded-video-input 이벤트를 전달합니다. macOS는 NSClickGestureRecognizer 콜백으로 같은 이벤트를 전달합니다. 프론트엔드는 세션 ID가 일치하는 이벤트만 처리하고 종료 시 리스너를 해제합니다. 이벤트 연결 실패 시에는 조작 UI를 유지합니다. 고빈도 입력 폴링은 없습니다.
- Escape는 캡처 단계에서 입력 컨트롤의 단축키 제외 규칙보다 먼저 처리합니다. mpv 기본 키 바인딩과 VO 키보드 입력은 비활성화합니다. Novus 종료 버튼은 허용된 `core:window:allow-close` 권한으로 메인 창을 닫습니다.
- Windows 크기 변경은 작업 스레드에서 `SWP_ASYNCWINDOWPOS`로 전달해 UI 스레드가 영상 창의 메시지 처리를 기다리지 않게 합니다. 상태·조작 IPC는 세션 잠금을 해제한 뒤 응답을 기다립니다.
- 종료는 세션을 먼저 분리하고 창을 비동기로 숨긴 뒤 정리 스레드에서 디코더 종료와 HWND 파괴를 순서대로 수행합니다. 호출자는 최대 2초 기다리며 지연 시 오류를 반환하고 정리는 계속됩니다. 디코더가 종료되기 전에는 HWND/DLL을 강제 해제하지 않습니다. 디코더 자체가 멈춘 경우 오디오 종료 시점은 보장되지 않지만 앱 종료는 UI 경로에서 수행할 수 있습니다.
- 메인 스레드 작업 응답도 2초로 제한합니다. 시간 초과 뒤 생성된 HWND는 메인 스레드에서 즉시 파괴해 고아 창을 방지합니다.

### 영상 플로팅 조작 창과 고정 이미지 캔버스

- Windows open_embedded_video_overlay(sessionId, video)는 메인 클라이언트 영역에 투명한 세션 ID별 video-controls-* 투명 소유 창 하나를 만듭니다. App은 네이티브가 주입한 로컬 초기화 데이터가 있으면 대시보드 대신 기존 InAppVideoModal의 조작 UI만 렌더링합니다. 디코더와 영상 HWND는 메인 창에 유지하며, 이 창은 별도의 영상 세션을 생성하지 않습니다.
- request_embedded_video_overlay_action은 갤러리 복귀·앱 종료·전체화면 요청을 세션 ID와 함께 메인 웹뷰로 전달합니다. 영상 닫기에서 소유 조작 창을 먼저 파괴하고 기존 디코더 정리를 이어갑니다. 메인 창 크기 변경 시 조작 창 크기도 맞춥니다. 네이티브 표면의 크기 갱신은 Z 순서를 변경하지 않습니다.
- FullscreenImageViewer는 전체 화면 크기의 고정 img 박스에 object-fit: contain을 적용합니다. 1600px URI를 Image.decode()로 준비하는 동안 GlassProgress를 표시하며, 이전 사진이나 작은 미리보기를 새 사진으로 확대하지 않습니다. 다음 사진은 미리 요청하고, 확대용 3200px도 디코딩 후 교체합니다. 경로 전환 시 확대·이동을 초기화하고 새 사진에 이전 transform 애니메이션을 넘기지 않습니다.

### 창 모드와 Windows 스트리밍 전체화면

- `display_mode.rs`는 사용자 선택인 `appFullscreen`과 임시 플레이어 상태인 `contentPage`를 구분합니다. 실제 메인 창 전체화면은 두 상태의 OR이며 플레이어 종료 시 사용자 선택을 복원합니다. 창 위치·크기 및 최대화 상태 복원은 Tauri의 네이티브 전체화면 전환이 담당합니다. 시작 모드는 창 모드이며 앱 재시작 사이에는 저장하지 않습니다.
- `get_display_mode`, `toggle_window_fullscreen`, `exit_streaming_fullscreen`은 shared API 래퍼로 호출합니다. `useDisplayMode`는 `novus-display-mode` 이벤트와 최초 조회를 구독하며 revision으로 늦은 응답을 배제합니다. 대시보드 버튼·F11·내장 영상 조작 창은 동일한 메인 창 모드를 변경합니다. 웹 개발 환경에서는 DOM Fullscreen API를 사용합니다.
- Windows 서비스 웹뷰의 WebView2 `ContainsFullScreenElementChanged` 이벤트를 관찰합니다. 기존 Tauri 핸들러가 창 모드를 바꾸므로 페이지별 순차 비동기 이벤트 큐를 거쳐 Novus의 최종 모드를 적용합니다. 원격 서비스에는 Novus IPC 권한을 주지 않습니다. macOS 서비스 전체화면과 독 동기화는 아직 구현하지 않았습니다.
- 플레이어 전체화면 동안 `InAppPlayer`는 독을 마운트하지 않고 자식 웹뷰를 메인 클라이언트 전체로 확장합니다. 창 크기 변경 시에도 같은 영역을 유지합니다. 해제하면 현재 독 위치와 뷰포트 크기로 복원합니다. bounds 요청에 revision을 포함하고 숨겨진 웹뷰에는 위치 갱신을 적용하지 않습니다.
- 전체화면은 앱 ID와 웹뷰 생성 세대로 검증합니다. 홈·앱 전환·새로고침·닫기에서 HTML 전체화면 해제를 요청하고 임시 상태를 정리합니다. 뒤로가기는 HTML 전체화면을 먼저 해제한 뒤 다음 요청에서 탐색합니다. 메인 UI의 Escape는 플레이어 전체화면 → Novus 전체화면 → 홈 이동 순서로 처리합니다. 자식 웹뷰의 Escape는 서비스/브라우저가 처리하며 F11은 네이티브 가속키에서 연결합니다.
- `streaming_fullscreen.js`는 전체화면 컨테이너에 보조 종료 버튼 한 개를 추가합니다. 진입 시와 상단 56px 영역의 포인터/터치 입력 시 3초 표시하고 opacity로 숨깁니다. video/iframe 자체의 전체화면에는 추가하지 않고 브라우저/서비스 조작을 사용합니다. 별도 웹뷰나 디코더를 만들지 않습니다.
- Escape 해제는 `exit_window_fullscreen` 명령으로 처리합니다. 토글과 분리해 반복 입력이나 늦은 프런트엔드 상태로 전체화면에 재진입하지 않게 합니다. 내장 영상 Escape는 최신 네이티브 상태를 조회하고 처리 중 입력을 합칩니다. 소유 조작 창의 키보드 포커스는 창 전환과 활성 창 크기 변경 후 복원합니다.
- 공통 SubpageDock에서도 창 전체화면 버튼을 제공하며 아이콘·접근성 상태는 실제 사용자 선택을 반영합니다. 대시보드 Escape는 열린 설정/모달이나 내부 화면이 없을 때 창 전체화면을 해제합니다.

### 배포 버전과 설치 계약

- `release.config.json`은 공개 소스/배포 저장소, stable 채널, Windows x64 NSIS currentUser 설치 및 `com.novus.hub` 식별자·제품명·실행 파일명을 고정합니다. Windows 빌드에는 `tauri.windows.conf.json`이 병합되어 NSIS만 생성합니다.
- 버전의 기준은 package.json이며 `scripts/release.mjs`가 Tauri 설정, Cargo.toml, Cargo.lock의 로컬 novus 항목과의 일치를 검사합니다. `pnpm release:version`은 네 파일을 함께 갱신하고 의존 패키지 버전은 유지합니다. `pnpm build` 시작 시 이 검사를 실행합니다.
- 전달된 배포 태그와 GitHub의 실제 tag ref는 모두 `v` + 앱 버전과 일치해야 합니다. source info는 버전·기대 태그·HEAD·dirty 여부와 설치 계약을 출력합니다. 자동 배포의 `ci-release.mjs guard`는 저장소, 깨끗한 체크아웃, 실행 커밋, 태그 대상 및 origin/main 포함 여부를 검사합니다. 수동 검증 실행은 main만 허용합니다.
- 업데이트 서명은 저장소 밖의 암호화된 개인 키와 `signing/updater.pub`의 공개 키를 사용합니다. Windows 설정은 공개 키 내용, GitHub Release의 HTTPS `latest.json` 주소, passive 설치 모드와 `createUpdaterArtifacts: true`, 서명 버전 필수와 다운그레이드 금지를 선언합니다. Windows updater 런타임은 아래 IPC로 동작하며 설치본에서는 사용자 설정에 따라 자동 확인·다운로드합니다.
- `scripts/update-artifacts.mjs`는 Node 표준 암호화 기능으로 Tauri minisign의 파일 서명과 trusted comment 서명을 모두 검증합니다. 버전·파일명·공개 키·다운로드 주소 계약을 검사한 뒤 EXE 옆에 `latest.json`과 `SHA256SUMS`를 생성합니다. 이 단독 도구는 빌드 출처를 검사하지 않습니다.
- `.github/workflows/release-windows.yml`은 v* 태그 Push 시 Windows x64 서명 빌드와 Release 초안을 생성합니다. workflow_dispatch는 main에서 동일한 빌드를 검증하되 Release를 만들지 않습니다. Node 24, pnpm 12.6.0, Rust 1.98.1과 잠금 파일을 사용하고 Actions는 커밋 SHA로 고정합니다. 네이티브 updater 및 기존 Rust 회귀 테스트도 실행합니다.
- CI는 빌드 전·후 커밋과 Git tree를 비교하고, 고정 MPV DLL 해시 및 EXE 서명을 확인한 뒤 EXE·sig·latest.json·SHA256SUMS·release-source.json만 별도 폴더에 복사합니다. 메타데이터는 커밋·실행 번호·MPV 및 파일 해시를 연결하는 CI 추적 정보이며 별도의 서명된 attestation은 아닙니다. 별도 Release 작업은 내려받은 파일을 재검증하고 기존 버전의 덮어쓰기를 거부합니다. Secrets는 서명 빌드 단계에만, contents: write는 Release 작업에만 부여합니다. 절차는 RELEASING.md를 따릅니다.

### 업데이트 런타임

- `src-tauri/src/updater/`는 Windows x64에서 Tauri updater 2.14.1과 OS TLS를 사용합니다. 요구 버전에 맞춰 Tauri 2.12.5, WebView2 0.39.1, JS API/CLI 2.12.4를 사용합니다. Common Controls v6 의존성을 테스트 EXE에도 링크합니다.
- `check_for_update`, `download_update`, `install_update`, `cancel_update`, `get_update_state`, `set_update_automatic`은 실제 main 웹뷰에서만 호출할 수 있습니다. `shared/api/tauri/updater.ts`가 타입 안전한 경계를 제공하며 plugin updater JS 권한은 부여하지 않습니다.
- 싱글톤 상태는 작업 세대·revision으로 중복 실행과 취소 후 늦은 응답을 차단하고 `novus-update-state` 이벤트를 main에 전달합니다. mutex는 네트워크나 설치 대기 중 보유하지 않습니다. `<app_config_dir>/updater.json`에 기본 ON 설정을 원자적으로 저장하며 손상·저장 오류는 OFF로 처리합니다. OFF는 네이티브에서도 자동 명령을 차단하고 자동 작업만 취소합니다.
- `features/update-app` 컨트롤러는 main 앱 루트에서 구독·타이머 수명을 관리하고 설정 시트는 외부 스토어를 구독합니다. 설치본에서만 시작 30초 뒤 및 6시간 간격으로 조회·다운로드하며 오프라인은 이벤트 복귀로 처리합니다. 다운로드·취소·재시도·진행률과 버전별 설치 확인을 제공하고 자동 설치는 하지 않습니다. 대시보드의 조용한 알림은 available/ready 변경만 구독합니다. 설정 시트를 닫아도 작업을 유지하며 스트리밍 자식 웹뷰는 시트 동안 숨겼다가 복원합니다.
- 고정된 HTTPS 저장소와 높은 stable 버전만 허용합니다. 최대 128MiB를 캐시에 스트리밍하고 blocking pool에서 서명·서명된 버전을 검증합니다. ready 상태는 파일 경로만 보관하며 설치 직전에 다시 검증합니다. NSIS 설치본만 설치를 시작할 수 있고, 성공 시 플러그인이 설치·앱 종료·재시작을 처리합니다. 계약과 검증 범위는 [UPDATE_RUNTIME.md](UPDATE_RUNTIME.md)를 따릅니다.
