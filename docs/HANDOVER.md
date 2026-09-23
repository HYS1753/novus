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
- [ ] **초경량 Chromium(CEF 코어 ~120MB) 번들링 파이프라인 (해법 C)**: 불필요한 locale/확장/디버그 리소스를 제거한 순수 웹 렌더러 코어로 `PageManager` 백엔드 완전 전환
- [ ] **Tauri Autostart 플러그인 연동**: Windows 부팅 시 자동 시작 및 백그라운드 상주 옵션 구현
- [ ] **D-Pad / 키보드 방향키 내비게이션**: 터치 외에도 무선 리모컨 및 키보드로 타일 포커스를 이동할 수 있는 `useSpatialNavigation` 기능 구현
- [ ] **시스템 배터리 / Wi-Fi 상태 조회**: Rust 백엔드 시스템 모니터링 커맨드 확장
- [ ] **스마트폰 QR 웹 리모컨**: 동일 Wi-Fi 상에서 스마트폰으로 대시보드를 무선 제어하는 경량 웹소켓 서버 연동
