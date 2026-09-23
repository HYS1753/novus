# AGENTS.md - AI Coding Agent Engineering Harness

> **이 문서는 본 프로젝트에서 작업하는 모든 AI 코딩 에이전트(Claude, Antigravity, Cursor, Copilot, Codex 등) 및 개발자를 위한 엄격한 행동 지침이자 하네스(Harness) 명세서입니다.**  
> 본 레포지토리에서 코드를 분석, 수정, 생성할 때는 예외 없이 아래의 규칙을 준수해야 합니다.

---

## 1. 프로젝트 정체성 및 핵심 제약 조건 (Critical Constraints)

- **제품명 / ID**: Novus (`com.novus.hub`)
- **타깃 하드웨어**: Microsoft Surface Pro 4 m3 (Intel Core m3 듀얼코어, **4GB RAM**, Intel HD 515 내장 그래픽) 및 저사양 태블릿
- **핵심 목표**: 부팅 시 자동 실행되는 Google TV 스타일 대시보드. **RAM 30MB 안팎의 초경량 점유율** 및 **60fps 무지연 터치 UX**.

> [!CAUTION]
> **저사양 디바이스 금기 사항 (Violations will cause severe stuttering)**
>
> 1. **무거운 외부 패키지 설치 절대 금지**: Lodash, Moment.js, MUI, Ant Design, Chakra, Tailwind 등 런타임을 무겁게 만드는 번들 추가 금지.
> 2. **CSS `backdrop-filter: blur(...)` 사용 금지**: 구형 Intel HD 515 GPU에서 프레임 드랍을 유발합니다. 대신 불투명도 단색 배경(`rgba(20, 24, 32, 0.85)`)을 사용하십시오.
> 3. **DOM 노드 폭증 금지**: 대시보드 전체 DOM 노드 수는 항상 500개 미만을 유지하고, 목록은 가상화(Virtualization) 원칙을 따릅니다.
> 4. **고빈도 타이머 금지**: 시계/상태 폴링 인터벌은 10초 이상 간격으로 실행합니다 (`src/shared/hooks/useCurrentTime.ts` 준수).

---

## 2. 듀얼 코어 구조 (`src/` vs `src-tauri/`) 이해

본 프로젝트는 **Tauri v2** 표준 구조에 따라 화면단과 OS 제어단이 완전히 분리되어 있습니다:

- **`src/` (Frontend)**:
  - 언어: React 19 + TypeScript + Vite 8
  - 역할: 태블릿 UI, 터치/제스처 반응, 대시보드 화면, 위젯 렌더링
  - OS 렌더러: Windows Edge WebView2 / macOS WebKit
- **`src-tauri/` (Backend / Native Host)**:
  - 언어: Rust (2021 edition) + Cargo
  - 역할: OS 창 제어(전체화면, 최소화), 윈도우 부팅 자동시동, 하드웨어(배터리/전원) 접근, 로컬 프로세스 실행

---

## 3. 프론트엔드 단방향 아키텍처 규칙 (Architecture Boundaries)

프론트엔드(`src/`)는 **Modular Layered Architecture (FSD 변형)**를 따르며, `eslint-plugin-boundaries`에 의해 엄격하게 검증됩니다.

```
src/
├── app/          # 앱 루트, 라우팅, 글로벌 CSS
├── pages/        # 화면 단위 컴포넌트 (DashboardPage 등)
├── widgets/      # 독립형 UI 위젯 (QuickHeader, MediaShelf 등)
├── features/     # 비즈니스 인터랙션 기능 (useLaunchApp 등)
├── entities/     # 도메인 엔티티 모델 (AppItem, DeviceProfile 등)
└── shared/       # 공통 기반 인프라 (UI 컴포넌트, Tauri IPC, 훅, 유틸, 타입)
```

### 🚨 의존성 허용 규칙 (역참조 절대 금지)

- `app` ➔ `pages`, `widgets`, `features`, `entities`, `shared` 참조 가능
- `pages` ➔ `widgets`, `features`, `entities`, `shared` 참조 가능
- `widgets` ➔ `features`, `entities`, `shared` 참조 가능
- `features` ➔ `entities`, `shared` 참조 가능
- `entities` ➔ `shared` 참조 가능
- `shared` ➔ **오직 `shared` 내부만 참조 가능 (상위 레이어 역참조 시 린트 에러)**

### 🔌 Tauri IPC 호출 규칙

- 프론트엔드 컴포넌트는 Rust 커맨드(`invoke`)를 직접 호출해서는 안 됩니다.
- 반드시 `src/shared/api/tauri/` 디렉토리 내의 타입 안전한 래퍼 함수를 통해 호출해야 합니다.

---

## 4. 에이전트 필수 실행 커맨드 (Verification Checklist)

에이전트는 코드 작성 또는 수정을 완료한 후, **반드시 아래 명령어들을 순차적으로 실행하여 모두 정상 통과(Exit Code 0)함을 입증**해야 합니다:

```bash
# 1. TypeScript 타입 무결성 검증
pnpm typecheck

# 2. 아키텍처 경계 및 코드 린트 검증 (Boundaries 위반 시 실패)
pnpm lint

# 3. 코드 포맷 규칙 검증
pnpm format:check

# 4. 프로덕션 빌드 검증 (Rolldown 번들러 에러 확인)
pnpm build
```

> **패키지 매니저 규약**: 본 프로젝트는 `pnpm`을 전용 매키지 매니저로 사용합니다. `npm` 또는 `yarn` 명령을 실행하지 마십시오.

---

## 5. 경로 별칭 (Path Aliases) 규칙

- 상대 경로 지옥(`../../..`)을 지양하고 항상 `@/*` 경로 별칭을 사용하십시오.
  - 예시: `import { TouchButton } from "@/shared";`
  - 예시: `import { MediaShelf } from "@/widgets";`

---

## 6. 문서 최신화 의무 및 작성 원칙 (Documentation Integrity)

본 프로젝트의 `docs/` 디렉토리는 단순한 의사결정 히스토리(커밋 로그로 대체 가능)가 아니라, **“Novus 프로그램이 내부적으로 어떤 기능을 갖고 어떻게 동작하는지”**를 명확하고 직관적으로 파악할 수 있는 기능/아키텍처 명세서입니다.

새로운 기능, 위젯, IPC 인터페이스, 상태 관리 메커니즘을 추가하거나 변경할 경우, 다음 문서를 즉시 최신화해야 합니다:

1. **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**:
   - 각 계층별 역할, 런타임/프로세스 모델(시스템 웹뷰 허브 + 싱글톤 페이지 매니저), IPC 규약 및 세션 영속성 등 시스템 내부 동작 메커니즘 명세 동기화.
2. **[`docs/HANDOVER.md`](docs/HANDOVER.md)**:
   - 신규 투입 개발자 및 AI가 바로 구현할 수 있도록 현재 구현 완료된 기능 목록, 실질적 컴포넌트/모듈 동작 방식, 다음 단계 로드맵 최신화.
3. **[`docs/PERFORMANCE_GUIDE.md`](docs/PERFORMANCE_GUIDE.md)**:
   - 저사양 타깃(Surface Pro 4 4GB RAM) 최적화 규칙 및 렌더링/메모리 동작 가이드라인 유지.

> [!IMPORTANT]
> **문서화 작성 원칙**:
>
> - ADR(Architecture Decision Record)과 같은 장황한 배경/결정 이력 문서는 작성하지 마십시오. (히스토리는 Git 커밋 메시지로 관리)
> - 모든 문서는 코드베이스의 **현재 실제 구현(Truth)과 런타임 동작 메커니즘**을 정확하고 직관적으로 설명하는 데 집중하십시오.
