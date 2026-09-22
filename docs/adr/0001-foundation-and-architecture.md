# ADR 0001: 기반 기술 스택 및 계층형 모듈러 아키텍처(FSD) 채택

- **상태**: 승인됨 (Accepted)
- **날짜**: 2026-09-22
- **결정자**: Novus 코어 엔지니어링 팀

---

## 1. 배경 및 문제 정의 (Context)

본 프로젝트는 구형 Surface Pro 4 m3 (Intel Core m3, 4GB RAM)와 같은 저사양 x86/ARM64 윈도우 및 맥 태블릿/PC에서 부팅 즉시 런처 형태로 실행되는 미디어 대시보드를 목표로 합니다.

- Chromium 전체를 패키징하는 Electron은 기동 시 기본 150~200MB 이상의 RAM을 점유하여 4GB 메모리 환경에서 심각한 스왑과 스터터링을 유발합니다.
- 대시보드 위젯, 미디어 런처, 시스템 제어가 빈번하게 추가될 예정이므로, 컴포넌트 간 결합도가 높아지면 스파게티 코드가 되고 유지보수성이 급격히 떨어집니다.

---

## 2. 결정 사항 (Decision)

### 1) 런타임: Tauri v2 (Rust)

- **근거**: OS 내장 렌더러(Windows Edge WebView2, macOS WebKit)를 사용하여 앱 실행 시 RAM 점유율을 30MB 안팎으로 극단적으로 억제합니다.
- 시스템 창 제어, 자동 시작, 저수준 하드웨어 제어를 Rust 백엔드에서 안전하게 처리합니다.

### 2) 프론트엔드: React 19 + TypeScript + Vite 8 (Rolldown)

- **근거**: 선언적 UI 구축의 생산성을 취하면서, Vite 8의 초고속 번들링과 코드 스플리팅(vendor/tauri chunk 분리)을 통해 빠른 기동 속도를 확보합니다.

### 3) 아키텍처: Modular Layered Architecture (FSD 변형)

- 계층: `app` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`
- **단방향 의존성 강제**: `eslint-plugin-boundaries`를 도입하여 상위 계층이 하위 계층을 역참조하는 것을 빌드/린트 단계에서 원천 차단합니다.

### 4) 자동화 하네스 (Harness Engineering)

- `simple-git-hooks`와 `lint-staged`를 구성하여, 개발자가 로컬에서 Git commit을 실행할 때마다 타입 검사와 린트, 포맷이 자동으로 검증되도록 강제합니다.

---

## 3. 기대 효과 및 결과 (Consequences)

- **긍정적 효과**:
  - 저사양 태블릿에서도 버벅임 없는 60fps 대시보드 경험 제공
  - 새로운 위젯이나 기능을 추가하더라도 기존 레이어 구조가 훼손되지 않음
  - 신규 참여자도 `docs/` 문서를 통해 즉각적인 인수인계 및 온보딩 가능
- **고려 사항**:
  - WebKit/WebView2 간의 사소한 CSS 렌더링 차이는 `docs/PERFORMANCE_GUIDE.md`의 표준 CSS 가이드라인을 준수하여 상쇄함.
