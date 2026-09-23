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

### ④ 초경량 미디어 갤러리 및 비디오 플레이어 (`GalleryPage`, `GalleryGrid`, `FullscreenImageViewer`, `InAppVideoModal`)

1. **디자인 시스템 기반 1:1 풀커버 타일 (`GlassMediaTile`)**:
   - 썸네일이 타일을 1:1로 꽉 채우고, 하단 반투명 오버레이에 `파일명 ∙ 타입 ∙ 용량`이 1줄로 표시되며 긴 파일명은 자동 말줄임표 처리됩니다.
   - 비디오 파일인 경우 스타일 가이드의 재생 배지가 자동으로 오버레이됩니다. 신규 표면은 `backdrop-filter` 없이 고정 불투명도 틴트를 사용합니다.
2. **세션 썸네일 캐시 엔진 (`src-tauri/src/commands/thumbnail.rs`)**:
   - 24MP 이상 원본 사진 대량 마운트 시의 메모리 OOM(Out of Memory)을 원천 차단하기 위해, Rust 백그라운드 스레드풀에서 256x256(뷰어는 1200px) 초경량 JPEG Base64 썸네일을 생성합니다.
   - 캐시는 OS 임시 디렉터리(`temp_dir/novus_thumbnails`)에 세션 단위로 보관되며, **앱 시동 시 이전 찌꺼기 정리 및 앱 종료 시 완전 자동 삭제**되어 4GB RAM 및 저용량 스토리지 부담을 없앱니다.
3. **인메모리 고속 정렬**:
   - 디스크 원본 파일시스템은 일체 건드리지 않고, 앱 메모리 상에서 **파일명순(가나다/ABC) / 날짜순 / 파일크기순** 즉시 정렬(`GlassSegmentedControl` 연동)을 지원합니다.
4. **몰입형 풀스크린 뷰어 (`FullscreenImageViewer`)**:
   - 상단 반투명 틴트 헤더(뒤로가기 + 파일명)를 제공합니다.
   - **화면 중앙 40% 탭**: 헤더 및 컨트롤 바가 페이드아웃되며 오직 사진만 감상할 수 있는 **전체화면 몰입 모드(Immersive Mode)**로 토글됩니다.
   - **화면 좌측 30% / 우측 30% 탭**: 이전/다음 이미지 이동 (가로 스와이프 제스처 동시 유지).
   - DOM에는 현재 이미지 한 장만 유지하고 전환 시 1600px 세션 이미지를 교체하여 메모리 급증을 막습니다.
5. **인앱 우선 비디오 재생 (`InAppVideoModal` & `play_video_native`)**:
   - MP4/H.264, WebM 등 시스템 WebView 미디어 엔진이 지원하는 형식은 Novus 내부 플레이어에서 즉시 재생됩니다. 로컬 미디어 로딩을 위해 Tauri asset protocol을 활성화합니다.
   - MKV/HEVC 등 내장 디코더 미지원 형식에서만 사용자가 외부 재생을 선택할 수 있습니다. 이때 MPV가 실제 설치·번들되어 있으면 우선 사용하고, 없으면 OS 기본 플레이어로 폴백합니다. 현재 저장소에는 MPV 실행 파일 자체가 번들되어 있지 않습니다.
6. **대량 목록 DOM 상한**:
   - 갤러리는 페이지당 60개, 파인더는 72개만 마운트하여 전체 화면 DOM 노드가 500개를 크게 넘지 않도록 방어합니다.

### ⑤ 서브페이지 표준 시스템 독 (`SubpageDock`) & 전 시스템 파일 파인더 (`FinderPage`, `SystemFinder`)

1. **서브페이지 공통 독 규약 (`SubpageDock`)**:
   - 대시보드를 벗어난 모든 내부 화면(갤러리, 파인더 등)은 화면 한쪽에 일관된 시스템 독을 고정 렌더링합니다.
   - 홈, 방문 기록 기반 뒤로가기, 현재 시각, 새로고침, 툴 액션 슬롯을 표준화했습니다. 뒤로가기는 더 이상 상위 디렉터리 이동을 겸하지 않습니다.
   - 스트리밍용 `InAppDock`도 동일한 `SubpageDock`을 조합하므로 홈·뒤로·새로고침 UI와 아이콘 모션이 한 구현에서 관리됩니다.
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
- 방문 기록은 최근 50개 경로만 메모리에 유지하며 실제 파일이나 디렉터리를 변경하지 않습니다.

---

## 3. 새로운 기능 / 위젯 추가 가이드

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
- [x] **싱글톤 Chromium / WebView2 페이지 매니저 기반 인앱 스트리밍 런처**: 넷플릭스/유튜브/티빙/웨이브 등 스트리밍 서비스를 싱글톤 브라우저 풀 내 페이지(탭)로 관리하며 세션 유지 및 지연 생성/Hide 처리 완료.
- [x] **초경량 미디어 갤러리 & 풀스크린 뷰어 (`GalleryPage`)**: 세션 임시 썸네일 캐시, 60개 단위 페이지 렌더링 및 터치 스와이프 구현 완료.
- [x] **인앱 비디오 플레이어 + 명시적 외부 폴백 (`InAppVideoModal`)**: 지원 형식은 앱 내부 재생, 미지원 코덱은 설치된 MPV 또는 OS 플레이어로 사용자 선택 폴백.
- [x] **전 시스템 파일 파인더 (`FinderPage`)**: 드라이브/시스템 폴더 탐색, 리스트/그리드 뷰, 확장자별 아이콘 및 파일 오픈 구현 완료.
- [ ] **초경량 Chromium(CEF 코어 ~120MB) 번들링 파이프라인 (해법 C)**: 불필요한 locale/확장/디버그 리소스를 제거한 순수 웹 렌더러 코어로 `PageManager` 백엔드 완전 전환
- [ ] **Tauri Autostart 플러그인 연동**: Windows 부팅 시 자동 시작 및 백그라운드 상주 옵션 구현
- [ ] **D-Pad / 키보드 방향키 내비게이션**: 터치 외에도 무선 리모컨 및 키보드로 타일 포커스를 이동할 수 있는 `useSpatialNavigation` 기능 구현
- [ ] **시스템 배터리 / Wi-Fi 상태 조회**: Rust 백엔드 시스템 모니터링 커맨드 확장
- [ ] **스마트폰 QR 웹 리모컨**: 동일 Wi-Fi 상에서 스마트폰으로 대시보드를 무선 제어하는 경량 웹소켓 서버 연동
