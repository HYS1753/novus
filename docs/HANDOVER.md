# Novus Project Handover Document (인수인계 및 내부 동작 명세)

본 문서는 다른 개발자 또는 AI 어시스턴트가 프로젝트에 투입되었을 때, 지체 없이 **시스템의 내부 기능과 동작 메커니즘을 파악하고 바로 개발을 이어갈 수 있도록** 작성된 실무 명세서입니다.

---

## 1. 프로젝트 요약

- **프로젝트명**: Novus (`com.novus.hub`)
- **목적**: 저사양 태블릿(4GB RAM급 Surface Pro 4 m3)을 위한 초경량 미디어 콘솔 및 TV형 제어 대시보드
- **기술 스택**: Tauri v2 (Rust) + React 19 + TypeScript + Vite 8 + pnpm
- **아키텍처**:
  - 프론트엔드: Modular Layered Architecture (FSD 기반 단방향 계층: `app` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`)
  - 런타임/엔진: OS 시스템 웹뷰 허브(대시보드) + 싱글톤 브라우저 페이지 매니저(인앱 스트리밍)

---

## 2. 핵심 서브시스템 내부 동작 메커니즘 (How it Works)

### ① 대시보드 허브와 인앱 스트리밍의 분리 구조

- **허브 UI**: OS 시스템 웹뷰(macOS WebKit, Windows Edge WebView2)에서 구동되며 대기 시 **RAM 30MB 안팎**의 초경량 점유율을 유지합니다.
- **인앱 스트리밍 뷰포트**:
  - HTML `<iframe>`을 일절 사용하지 않으며, `Window.add_child()`를 통해 네이티브 자식 뷰로 도킹됩니다.
  - 앱 수명과 동일한 **단일 브라우저 프로세스(싱글톤)** 풀에서 각 스트리밍 URL을 페이지(탭) 단위로 관리합니다.

### ② 스트리밍 페이지 매니저 (`src-tauri/src/page_manager.rs`)

1. **지연 생성 (Lazy Creation)**:
   - 사용자가 스트리밍 카드를 클릭하기 전에는 백그라운드에 페이지를 미리 띄우지 않습니다.
   - 첫 클릭 시점에만 해당 `id`의 자식 뷰를 생성하여 뷰포트 좌표에 도킹합니다.
2. **세션 유지 숨김 (Hide != Destroy)**:
   - 홈(ESC) 버튼을 누르면 웹뷰를 파괴하지 않고 `hide_streaming_page`를 호출하여 화면 밖으로 숨깁니다.
   - 렌더러 메모리와 로그인 세션 쿠키가 그대로 보존되어 재진입 시 즉시 이전 상태가 복원됩니다.
3. **무중단 동적 레이아웃 및 창 리사이징 (`update_streaming_page_bounds`)**:
   - `ResizeObserver` 및 `window.resize` 리스너를 결합하여, 독 위치 변경 뿐만 아니라 **사용자가 메인 창 크기를 동적으로 조절할 때도 웹뷰 크기가 뷰포트에 맞게 실시간 자동 동기화**됩니다.
4. **지능형 뒤로가기 및 메모리 해제 (`go_back_or_close_streaming_page`)**:
   - 인앱 플레이어 독의 '뒤로가기' 버튼을 누르면 먼저 Chromium 히스토리 뒤로가기(`history.back()`)를 시도합니다.
   - **더 이상 뒤로갈 이전 페이지가 없는 첫 진입 페이지에 도달한 상태에서 뒤로가기를 누르면**, 해당 페이지를 완전히 `discard` 파괴하여 백그라운드 메모리를 즉시 반환하고 대시보드 홈으로 자동 복귀합니다.
5. **User-Agent 정직화 전략**:
   - 구글 안티어뷰즈(`accounts.google.com`) 탐지 방지를 위해 YouTube/Google 도메인은 인위적인 가짜 Chrome UA 주입을 배제하고 순정 엔진 지문으로 통신합니다.

### ③ 디자인 시스템 & 머티리얼 런타임

- **0–100 머티리얼 강도**: `<html>`의 `--material-intensity`(0–1)로 제어되며, 기본값은 `0`(완전 불투명). 저사양 환경에서 불필요한 GPU 오버헤드를 막기 위해 기본 상태에서는 `backdrop-filter` 속성을 전혀 렌더링하지 않습니다.
- **모션 시스템**: 모든 상호작용은 6개 레시피(`press`, `lift`, `reveal`, `emerge`, `enter`, `pulse`)와 `transform: translateZ(0)` 하드웨어 레이어 승격으로 60fps 무지연 반응을 보장합니다.
- **대시보드 스크롤 안내**: 상단·하단 그라데이션은 현재 대시보드 스크롤 위치가 실제로 더 이동할 수 있을 때만 표시합니다. 갤러리·파인더·스트리밍 화면에서 홈으로 돌아오면 새 스크롤 영역에 감시를 다시 연결하고 첫 화면 상태를 다시 계산합니다.

### ④ 초경량 미디어 갤러리 및 비디오 플레이어 (`GalleryPage`, `GalleryGrid`, `FullscreenImageViewer`, `InAppVideoModal`)

1. **디자인 시스템 기반 1:1 풀커버 타일 (`GlassMediaTile`)**:
   - 썸네일이 타일을 1:1로 꽉 채우고, 하단 반투명 오버레이에 파일명과 `타입 · 용량`을 두 줄로 분리해 표시합니다. 긴 파일명은 자동 말줄임표 처리됩니다.
   - 비디오 파일인 경우 스타일 가이드의 재생 배지가 자동으로 오버레이됩니다. 신규 표면은 `backdrop-filter` 없이 고정 불투명도 틴트를 사용합니다.
   - 폴더 타일은 사진 격자 크기를 유지하되 테마의 밝은/어두운 표면과 기본 파란 강조색을 사용합니다. 공통 `FolderIcon`은 `currentColor`를 사용하므로 위치 메뉴와 파인더에서도 같은 테마를 따릅니다.
2. **영속 썸네일 캐시 엔진 (`src-tauri/src/commands/thumbnail.rs`)**:
   - Rust 블로킹 작업 풀에서 원본을 축소해 JPEG Base64 URI를 만듭니다. 격자는 320px, 뷰어는 320px 미리보기·1600px 기본 이미지·확대 시 3200px를 사용합니다. 현재 `image::open`은 원본을 한 번 전체 디코딩하므로 매우 큰 원본의 순간 메모리 사용은 별도 성능 측정이 필요합니다.
   - 캐시 키에 파일 경로·크기·수정 시각·출력 크기를 반영합니다. 앱 캐시 디렉터리에 재시작 후에도 유지하고 256MB를 넘으면 오래된 항목부터 정리합니다. 프런트엔드는 요청을 최대 2개 동시에 처리하며 같은 요청을 합치고, 대기 중 화면을 벗어난 타일 요청을 취소합니다.
3. **갤러리 목록 스냅샷·정렬**:
   - Rust가 현재 폴더를 백그라운드에서 스캔·검색·정렬한 스냅샷을 하나 유지하고 80개씩 전달합니다. 검색은 250ms 입력 대기 후 새 스냅샷을 만들며 날짜·크기·파일명 정렬을 지원합니다. 정확한 전체 정렬을 위해 처음 여는 폴더의 메타데이터는 전체 스캔합니다.
4. **몰입형 풀스크린 뷰어 (`FullscreenImageViewer`)**:
   - 상단 반투명 틴트 헤더(뒤로가기 + 파일명)를 제공합니다.
   - **화면 중앙 40% 탭**: 헤더 및 컨트롤 바가 페이드아웃되며 오직 사진만 감상할 수 있는 **전체화면 몰입 모드(Immersive Mode)**로 토글됩니다.
   - **화면 좌측 30% / 우측 30% 탭**: 이전/다음 이미지 이동 (가로 스와이프 제스처 동시 유지).
   - DOM에는 현재 이미지 한 장만 유지합니다. 버튼·휠·핀치·더블클릭으로 확대하고 확대 상태에서 드래그로 이동할 수 있습니다. 기본 크기 이미지를 먼저 보여주고 확대 시에만 고해상도를 요청합니다.
   - 현재 정렬 순서의 디렉터리 사진을 10/15/30초 간격으로 자동 재생할 수 있습니다. 마지막 사진에서 처음으로 돌아가며, 화면이 숨겨지거나 확대 중에는 자동 전환을 멈춥니다.
5. **인앱 우선 비디오 재생 (`InAppVideoModal` & `play_video_native`)**:
   - `libmpv`가 준비된 OS에서는 갤러리 영상이 네이티브 표면에서 하드웨어 가속(D3D11 / Metal)으로 재생됩니다. 바이너리가 없으면 WebView2/WebKit `<video>`로 자동 폴백하며, 이 경로의 로컬 미디어 로딩을 위해 Tauri asset protocol이 활성화되어 있습니다.
   - **의존성 자동 관리 (`pnpm setup:mpv`)**: `scripts/setup_mpv.py`를 통해 Windows 및 macOS용 검증된 `libmpv` 바이너리를 `src-tauri/bin/mpv/`에 자동으로 다운로드·추출·스테이징합니다. 바이너리 파일은 대용량 및 라이선스 분리를 위해 `.gitignore` 처리되어 소스 저장소 용량을 낭비하지 않습니다.
   - **Tauri 번들링 연동**: `tauri.conf.json`의 `bundle.resources` 및 `macOS.files`에 `bin/mpv`가 등록되어 있어 프로덕션 인스톨러 빌드 시 배포 패키지(`Resources/mpv`, `Frameworks/mpv`)에 자동 포함됩니다.
   - **Windows (`embedded_player.rs`)**: 64비트 메인 윈도우 HWND의 자식 Win32 윈도우(`STATIC` 창)를 생성하고 `wid`로 바인딩하여 D3D11 GPU 가속으로 렌더링합니다. 64비트 포인터 무결성을 위해 `surface as usize`로 전달됩니다.
   - **macOS (`macos_player.rs` + `macos_video_view.m`)**: `WKWebView` 아래에 `NSView`를 서브뷰로 추가하고 Metal/OpenGL GPU 가속으로 렌더링합니다. 개발 모드 및 번들 배포 환경 모두에서 `bin/mpv` 서브디렉토리를 정상 인식합니다.
   - 재생 실패 시 사용자가 외부 재생을 선택할 수 있습니다. 설치된 MPV 실행 파일이 있으면 우선 사용하고, 없으면 OS 기본 플레이어로 폴백합니다. 조작 버튼은 네이티브 C API(`mpv_command`)를 직접 호출하여 일시정지 전환과 10초 앞뒤 이동을 지원합니다.
6. **대량 목록 DOM 상한**:
   - 갤러리는 페이지 버튼 없이 연속 스크롤하며, 뷰포트에 보이는 격자 행과 위아래 여유 행만 마운트합니다. 스크롤 위치에 따른 앞뒤 공간은 격자 패딩으로 유지하고, 새로 나타난 타일만 썸네일을 요청합니다.
   - 스크롤 끝에 가까워지면 다음 80개를 자동 요청하고 실패 시 재시도 버튼을 표시합니다. 파인더는 페이지당 40개만 마운트합니다.
7. **탐색 연속성 및 화면 상태**:
   - 갤러리와 파인더는 현재 폴더와 최근 50개 방문 경로를 각각 `localStorage`에 저장합니다. 홈에서 다시 열거나 앱을 재시작해도 마지막 폴더와 뒤로가기 이력이 복원됩니다.
   - 갤러리 독의 뒤로가기는 열린 이미지/동영상 뷰어를 먼저 닫고, 이후 방문 경로를 역순으로 이동합니다. 이력이 없으면 홈으로 돌아갑니다. 파인더도 이력이 없을 때 홈으로 돌아갑니다.
   - 갤러리는 기존 1:1 사진 격자를 유지하며 현재 폴더와 검색 결과 수를 표시합니다. 파인더는 폴더/파일 수, 이름·날짜·크기 정렬, 검색 결과와 접근 오류를 표시합니다.

### ⑤ 서브페이지 표준 시스템 독 (`SubpageDock`) & 전 시스템 파일 파인더 (`FinderPage`, `SystemFinder`)

1. **서브페이지 공통 독 규약 (`SubpageDock`)**:
   - 대시보드를 벗어난 모든 내부 화면(갤러리, 파인더 등)은 화면 한쪽에 일관된 시스템 독을 고정 렌더링합니다.
   - 홈, 방문 기록 기반 뒤로가기, 현재 시각, 새로고침, 툴 액션 슬롯을 표준화했습니다. 뒤로가기는 더 이상 상위 디렉터리 이동을 겸하지 않습니다.
   - 스트리밍용 `InAppDock`도 동일한 `SubpageDock`을 조합하므로 홈·뒤로·새로고침 UI와 아이콘 모션이 한 구현에서 관리됩니다.
   - 좌우 독의 화면 제목은 회전하지 않고 가로 두 줄로 표시하여 한글을 정상 방향으로 읽을 수 있습니다.
2. **시스템 파일 파인더**:
   - 미디어 외의 모든 OS 파일(문서, 압축, 코드 등)과 시스템 드라이브(`C:\`, `D:\`, `/Volumes`)를 태블릿 친화적 터치 인터페이스로 탐색합니다.
   - 리스트 뷰 및 그리드 뷰(`GlassMediaTile`) 전환, 파일명 실시간 필터링, OS 기본 애플리케이션 즉각 실행을 지원합니다.

### ⑥ 공통 아이콘 모션 시스템 (`MotionIcon`)

- 모든 아이콘 효과는 `src/shared/ui/icons/MotionIcon.tsx`와 전역 모션 토큰에서 관리합니다.
- 조작 피드백은 `pop`, `rotate`, `tilt`, `nudge-left/right`, 상태 피드백은 `spin`, `pulse`, `breathe`로 제한합니다.
- 헤더, 시스템 독, 로더, 미디어 타일, 모달·시트·토스트, 메뉴, 세그먼트 컨트롤이 공통 프리셋을 사용합니다.
- 스타일 가이드 `Motion > Icon motion catalog`에서 모든 프리셋의 실제 효과와 용도를 확인할 수 있습니다.

### ⑦ 파일 탐색 내비게이션 규약 (`PathNavigation`)

- `← 뒤로`는 방문 기록, `↑ 상위`는 파일시스템 부모, 브레드크럼은 선택한 조상 폴더로 이동합니다.
- 갤러리와 파인더가 동일한 `PathNavigation` 컴포넌트를 사용합니다.
- 갤러리의 `위치` 메뉴에서 사진·동영상·다운로드·홈·드라이브 루트로 바로 전환할 수 있습니다.
- 경로가 길어지면 현재 폴더와 바로 위 폴더를 표시하고 앞쪽 조상은 `…` 메뉴로 접습니다. 현재 폴더의 긴 이름은 끝부분을 남기며 `상위` 버튼은 줄바꿈 없이 유지합니다.
- 방문 기록은 최근 50개 경로만 저장하며 실제 파일이나 디렉터리를 변경하지 않습니다. 저장소에 접근할 수 없는 환경에서는 메모리 내 탐색을 계속합니다.

---

## 3. 개발 환경 구축 및 빠른 시작 (Environment Setup & Quick Start)

신규 개발자 또는 AI 어시스턴트가 프로젝트에 처음 합류했을 때 아래 절차를 통해 개발 환경을 구성합니다.

### ① 사전 요구 도구 (Prerequisites)

1. **OS별 C++ 빌드 환경 (Tauri v2 네이티브 컴파일용)**:
   - **macOS**: `xcode-select --install`
   - **Windows**: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 설치 ("C++를 사용한 데스크톱 개발" 워크로드) 및 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)
2. **Rust & Cargo**:
   - `rustup` 공식 설치 스크립트 실행 (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` 또는 Windows `rustup-init.exe`)
   - 버전 확인: `rustc --version`, `cargo --version`
3. **Node.js & pnpm**:
   - Node.js v20 이상 LTS 권장
   - **pnpm 설치**: `npm install -g pnpm` 또는 `brew install pnpm`
   - **주의**: 본 프로젝트는 `pnpm` 전용 레포지토리입니다. `npm` 또는 `yarn` 사용을 금합니다 (`AGENTS.md` 규약).

### ② 의존성 설치 및 Git Hooks 등록

```bash
# 의존성 설치 및 simple-git-hooks (pre-commit 린트/포맷 자동화) 등록
pnpm install
```

### ③ 개발 모드 실행

- **프론트엔드 단독 모드 (`pnpm dev`)**:
  - 브라우저(`http://localhost:5173`)에서 순수 UI/위젯/스타일을 빠르게 개발할 때 사용합니다.
- **Tauri 데스크톱 전체 모드 (`pnpm tauri dev`)**:
  - Rust 백엔드 프로세스 + OS 네이티브 윈도우 + 시스템 웹뷰가 결합된 실제 데스크톱 런타임 환경에서 개발 및 테스트할 때 사용합니다.

---

## 4. 새로운 기능 / 위젯 추가 가이드

### ① 새로운 위젯을 추가할 때

1. `src/widgets/{widget-name}/ui/{WidgetName}.tsx` 생성
2. `src/widgets/{widget-name}/index.ts`에서 컴포넌트 export
3. `src/widgets/index.ts` 배럴 파일에 추가
4. **주의**: 위젯은 `app`이나 `pages`를 import할 수 없습니다 (`features`, `entities`, `shared`만 참조 가능).

### ② 새로운 스트리밍 앱/서비스를 추가할 때

1. `src/pages/dashboard/ui/DashboardPage.tsx`의 `STREAMING_APPS` 배열에 항목 추가:
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

1. `src-tauri/src/commands/` 또는 해당 백엔드 모듈에 함수 작성 후 `#[tauri::command]` 매크로 부여
2. `src-tauri/src/lib.rs`의 `invoke_handler`에 등록
3. `src/shared/api/tauri/`에 타입 안전한 래퍼 함수 작성 후 export

---

## 5. 개발 및 커밋 전 필수 실행 체크리스트

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

## 6. 다음 단계 로드맵 (Next Milestones)

- [x] **앱 설정 화면 (SettingsSheet)**: `GlassSheet` + `GlassListRow` + `GlassSlider`(0–100 머티리얼 강도) 기반 설정 화면 구현 완료.
- [x] **현재 나의 기기 (`DeviceProfile`)**: 앱 시작 시 Windows/macOS 네이티브 API로 모델·CPU·RAM·OS·아키텍처·논리 코어를 한 번 수집해 Tauri State에 보관합니다. 설정 패널은 고정된 Surface Pro 4 문구 대신 실제 기기 정보와 현재 로컬 영상 재생 경로를 표시합니다. 수집되지 않은 필드는 확인 불가로 표시하고 GPU 모델은 아직 수집하지 않습니다.
- [x] **싱글톤 Chromium / WebView2 페이지 매니저 기반 인앱 스트리밍 런처**: 넷플릭스/유튜브/티빙/웨이브 등 스트리밍 서비스를 싱글톤 브라우저 풀 내 페이지(탭)로 관리하며 세션 유지 및 지연 생성/Hide 처리 완료.
- [x] **미디어 갤러리 & 풀스크린 뷰어 (`GalleryPage`)**: 갤러리 목록 묶음 로딩, 가상 격자, 영속 썸네일 캐시, 확대·이동·자동 재생 구현 완료. 실제 Surface Pro 4 성능 측정과 Windows 시스템 썸네일 캐시 비교는 남아 있습니다.
- [x] **인앱 비디오 플레이어 + 명시적 외부 폴백 (`InAppVideoModal`)**: 지원 형식은 앱 내부 재생, 미지원 코덱은 설치된 MPV 또는 OS 플레이어로 사용자 선택 폴백.
- [ ] **Windows `libmpv` 영상 표면 통합**: HWND 생성·DPI 크기 갱신·세션 정리 경로를 구현하고 Windows 교차 타입 검사를 통과했습니다. DLL 번들링, Windows 실기기 검증, 자막·음성 트랙과 Novus 조작 UI는 남아 있습니다.
- [ ] **macOS `libmpv` 영상 표면 통합**: NSView 생성·크기 변경·정리와 libmpv 동적 로딩, 의존 라이브러리 스테이징, 번들 복사 구성과 기본 조작 IPC를 구현했습니다. 실제 영상 출력·조작·배포 서명 검증이 남아 있습니다. 라이브러리가 없는 환경은 WebView `<video>`로 전환합니다.
- [ ] **기기별 미디어 성능 분기**: 현재는 운영체제와 네이티브 엔진 존재 여부로 재생 경로를 선택합니다. 다음 단계에서 GPU/하드웨어 디코더 지원을 실제 재생 시 확인해 코덱별 하드웨어 디코딩 옵션과 소프트웨어 폴백을 결정해야 합니다. CPU·RAM 정보만으로 코덱 지원을 추정하지 않습니다.
- [x] **전 시스템 파일 파인더 (`FinderPage`)**: 드라이브/시스템 폴더 탐색, 리스트/그리드 뷰, 확장자별 아이콘 및 파일 오픈 구현 완료.
- [ ] **초경량 Chromium(CEF 코어 ~120MB) 번들링 파이프라인 (해법 C)**: 불필요한 locale/확장/디버그 리소스를 제거한 순수 웹 렌더러 코어로 `PageManager` 백엔드 완전 전환
- [ ] **Tauri Autostart 플러그인 연동**: Windows 부팅 시 자동 시작 및 백그라운드 상주 옵션 구현
- [ ] **D-Pad / 키보드 방향키 내비게이션**: 터치 외에도 무선 리모컨 및 키보드로 타일 포커스를 이동할 수 있는 `useSpatialNavigation` 기능 구현
- [ ] **시스템 배터리 / Wi-Fi 상태 조회**: Rust 백엔드 시스템 모니터링 커맨드 확장

### 운영체제별 로컬 영상 고도화 순서

1. **완료 — 기기 프로필 수집과 공통 분기 계약**: 앱 시작 시 Windows/macOS의 정적 하드웨어 정보를 한 번 수집합니다. 갤러리는 운영체제 이름 대신 `get_embedded_player_support`의 `available`을 보고 재생 경로를 고릅니다. 설정에서 실제 프로필과 현재 경로를 확인할 수 있습니다.
2. **다음 — 두 운영체제의 `libmpv` 표면 검증과 배포**: Windows 자식 HWND 경로에 DLL 및 의존 파일을 번들링하고, macOS NSView 경로의 실제 영상 출력·재생 제어·서명된 앱 번들을 검증합니다. 공통 열기·크기 변경·닫기 IPC와 플레이어 UI를 유지합니다.
3. **그다음 — 실제 디코더 능력 기반 선택**: GPU와 하드웨어 디코더 정보는 재생 엔진에서 확인합니다. 파일별 코덱·프로필을 기준으로 하드웨어 디코딩을 시도하고 실패하면 소프트웨어 디코딩으로 전환합니다. CPU나 RAM 수치만으로 재생 가능 여부를 판정하지 않습니다.
4. **검증 — 양쪽 OS에서 재생과 자원 사용량 측정**: [`VIDEO_PLAYER_VALIDATION.md`](VIDEO_PLAYER_VALIDATION.md)의 형식별 재생·탐색·자막·음성 트랙·닫기 시 메모리 회수 절차를 macOS와 Windows에서 각각 수행합니다. Windows 실기기가 생기면 Surface Pro 4에서도 프레임 드롭과 메모리를 측정합니다.

- [ ] **스마트폰 QR 웹 리모컨**: 동일 Wi-Fi 상에서 스마트폰으로 대시보드를 무선 제어하는 경량 웹소켓 서버 연동
