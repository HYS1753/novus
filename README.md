# Novus (노부스)

> **저사양 PC 및 구형 태블릿을 위한 초경량 미디어 콘솔 & 스마트 대시보드**  
> _Target Hardware: 4GB RAM class Tablets / PCs_

Novus는 부팅 시 자동으로 실행되어 태블릿의 첫 홈 화면처럼 동작하는 크로스 플랫폼 데스크톱 애플리케이션입니다.  
터치와 마우스 모두에 최적화된 반응성을 제공하며, 4GB 저사양 메모리 환경에서도 30MB 안팎의 초경량 메모리 점유율과 부드러운 60fps 대시보드 UX를 보장합니다.

---

## 🌟 핵심 특징

- ⚡ **극저용량 메모리 점유 (RAM ~30MB)**: OS 내장 웹뷰(Windows WebView2 / macOS WebKit)를 활용하여 Chromium 전체를 싣는 Electron 대비 80% 이상의 메모리를 절약합니다.
- 📺 **미디어 콘솔 대시보드**: 유튜브, 넷플릭스, 캘린더, 웹 검색 등 자주 쓰는 미디어와 도구를 한눈에 제어합니다.
- 🪟 **머티리얼 강도 0–100**: 면의 투명도와 블러를 연속값 하나로 조절합니다. 기본값 `0`은 저사양에서 합성 비용이 전혀 없고, 최대값에서도 가독성 하한이 걸려 면이 배경에 녹지 않습니다.
- 🎞️ **일관된 모션 문법**: 모든 인터랙션이 6개 모션 레시피(press · lift · reveal · emerge · enter · pulse)에 매핑되며, `prefers-reduced-motion`을 존중합니다.
- 👆 **터치 & 마우스 하이브리드 UI**: 48px 이상의 터치 타겟과 지연 없는 `:active` 피드백, 키보드/리모컨 포커스를 지원합니다.
- 🛡️ **하네스 엔지니어링 (Harness Engineering)**: Feature-Sliced Design(FSD) 기반 계층 규칙이 린트와 Git Hook으로 자동 강제되어 장기적인 유지보수성을 보장합니다.

---

## 🏛️ 소프트웨어 아키텍처

```
src/
├── app/          # 앱 진입점, 글로벌 테마/스타일, 라우팅
├── pages/        # 최상위 화면 (DashboardPage 등)
├── widgets/      # 독립형 대시보드 위젯 (QuickHeader, MediaShelf)
├── features/     # 비즈니스 인터랙션 기능 (useLaunchApp 등)
├── entities/     # 도메인 모델 (AppItem, DeviceProfile)
└── shared/       # 공통 UI(TouchButton, MediaCard), Tauri IPC, 유틸, 훅
```

_참조 방향_: `app` ➔ `pages` ➔ `widgets` ➔ `features` ➔ `entities` ➔ `shared`  
_(하위 레이어에서 상위 레이어를 역참조할 경우 린트 및 커밋 단계에서 차단됩니다)_

---

## 🛠️ 개발 시작 가이드 (Environment Setup)

### 1. 필수 사전 요구 도구 (Prerequisites)

본 프로젝트는 **Tauri v2 (Rust)**와 **React 19 (TypeScript, Vite 8)**를 사용하며, 패키지 매니저로 **`pnpm`을 전용으로 사용**합니다 (`npm`, `yarn` 사용 금지).

#### ① OS별 C++ 빌드 도구

Tauri 네이티브 백엔드 컴파일을 위해 플랫폼 빌드 도구가 필요합니다.

- **macOS**:
  ```bash
  xcode-select --install
  ```
- **Windows (타깃 디바이스 / PC)**:
  - [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 설치
  - 워크로드: **"C++를 사용한 데스크톱 개발"** 선택 설치
  - [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) 설치 (Windows 10/11 기본 탑재)

#### ② Rust 및 Cargo 설치

Rust 공식 도구체인 관리자인 `rustup`을 통해 최신 안정판을 설치합니다.

- **macOS / Linux**:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source "$HOME/.cargo/env"
  ```
- **Windows**:
  - [rustup-init.exe](https://rustup.rs/) 다운로드 후 실행
- **버전 확인**:
  ```bash
  rustc --version
  cargo --version
  ```

#### ③ Node.js & pnpm 설치

- **Node.js (v20 이상 권장)**:
  - [Node.js 공식 사이트](https://nodejs.org/) LTS 설치 또는 `nvm` / `fnm` / `brew install node`
- **pnpm 설치**:
  ```bash
  npm install -g pnpm
  # 또는 macOS Homebrew
  brew install pnpm
  ```
- **버전 확인**:
  ```bash
  node -v
  pnpm -v
  ```

---

### 2. 프로젝트 실행 단계 (Quick Start)

```bash
# 1. 의존성 설치 및 Git hook 자동 등록 (simple-git-hooks)
pnpm install

# 2. 프론트엔드 단독 브라우저 개발 모드 (UI/컴포넌트 빠른 작업 시)
pnpm dev

# 3. 데스크톱 앱 전체 개발 모드 (Rust 백엔드 + WebView + 핫 리로드)
pnpm tauri dev
```

---

### 3. 코드 무결성 검증 체크리스트 (AGENTS.md 준수)

코드 작성 및 수정 후 커밋하기 전, 아래 명령어들을 순차적으로 실행하여 모두 정상 통과(Exit Code 0)해야 합니다:

```bash
# 1. TypeScript 정적 타입 검증
pnpm typecheck

# 2. 아키텍처 계층 경계 및 코드 린트 검증 (FSD 규칙 위반 차단)
pnpm lint

# 3. 코드 포맷 검증 (Prettier)
pnpm format:check
# 필요 시 포맷 자동 수정: pnpm format

# 4. 프로덕션 번들 빌드 검증
pnpm build
```

---

## 📦 빌드 및 배포

Tauri v2를 통해 각 플랫폼별 독립 실행 파일 및 인스톨러를 생성할 수 있습니다:

```bash
# 데스크톱 배포 패키지 생성 (Windows: .msi/.exe, macOS: .dmg/.app)
pnpm tauri build
```

빌드 산출물은 `src-tauri/target/release/bundle/` 디렉토리에 생성됩니다.

---

## 📚 프로젝트 공식 문서 센터 (Docs Hub)

새로운 기능 개발이나 인수인계를 위해 아래 문서를 참고하십시오:

| 문서                                                            | 설명                                                                                |
| :-------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| 🤖 [**AI 에이전트 하네스**](AGENTS.md)                          | 모든 AI 코딩 에이전트(Claude, Cursor, Copilot 등)를 위한 행동 및 아키텍처 강제 규칙 |
| 📐 [**아키텍처 명세서**](docs/ARCHITECTURE.md)                  | 프론트엔드/백엔드 계층 구조, 단방향 의존성 규칙, IPC 패턴                           |
| ⚡ [**저사양 성능 가이드**](docs/PERFORMANCE_GUIDE.md)          | 4GB RAM급 저사양 기기를 위한 렌더링/메모리 최적화 원칙                              |
| 🤝 [**인수인계 가이드**](docs/HANDOVER.md)                      | 신규 참여자를 위한 코드 맵, 새 위젯 추가 방법, 로드맵                               |
| 📝 [**ADR 0001**](docs/adr/0001-foundation-and-architecture.md) | Tauri v2 및 FSD 레이어드 아키텍처 선정 의사결정 기록                                |

---

## 📄 라이선스

Private & Proprietary - Novus Team
