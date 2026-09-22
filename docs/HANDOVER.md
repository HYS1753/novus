# Novus Project Handover Document (인수인계 가이드)

본 문서는 다른 개발자 또는 AI 어시스턴트가 프로젝트에 투입되었을 때, 지체 없이 현재 상태를 파악하고 바로 개발을 이어갈 수 있도록 작성된 공식 인수인계서입니다.

---

## 1. 프로젝트 요약

- **프로젝트명**: Novus (`com.novus.hub`)
- **목적**: 저사양 태블릿(Surface Pro 4 m3 / 4GB RAM)을 위한 초경량 미디어 콘솔 및 Google TV 스타일 제어 대시보드
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
3. **레이어드 뼈대 코드**:
   - `shared`: 저사양용 10초 주기 시계 훅(`useCurrentTime`), 창 제어 API(`window.ts`), 터치 카드/버튼 컴포넌트
   - `entities`: 앱 바로가기(`AppItem`), 시스템 프로필(`DeviceProfile`)
   - `features`: 앱 실행 훅(`useLaunchApp`)
   - `widgets`: 시계/전체화면 제어 헤더(`QuickHeader`), Google TV 스타일 앱 쉘프(`MediaShelf`)
   - `pages`: 메인 대시보드(`DashboardPage`)
   - `app`: 글로벌 테마, 하드웨어 가속 스타일(`global.css`, `variables.css`)
   - `src-tauri`: Rust 모듈 분리 (`commands/system.rs`, `commands/mod.rs`)

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
3. `src-tauri/capabilities/default.json`에 권한 등록 필요 시 추가
4. `src/shared/api/tauri/`에 프론트엔드용 비동기 래퍼 함수 생성

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

- [ ] **Tauri Autostart 플러그인 연동**: Windows 부팅 시 자동 시작 및 백그라운드 상주 옵션 구현
- [ ] **D-Pad / 키보드 방향키 내비게이션**: 터치 외에도 무선 리모컨 및 키보드로 타일 포커스를 이동할 수 있는 `useSpatialNavigation` 기능 구현
- [ ] **시스템 배터리 / Wi-Fi 상태 조회**: Rust 백엔드 시스템 모니터링 커맨드 확장
- [ ] **웹뷰 내장 런처**: 브라우저를 별도 창으로 띄우지 않고 앱 내부 웹뷰(Overlay Webview)로 넷플릭스/유튜브를 재생하는 모드 검토
