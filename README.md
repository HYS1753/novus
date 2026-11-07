# Novus (노부스)

> **저사양 PC 및 구형 태블릿을 위한 초경량 미디어 콘솔 & 스마트 대시보드**  
> _Target Hardware: 4GB RAM class Tablets / PCs_

Novus는 부팅 시 자동으로 실행되어 태블릿의 첫 홈 화면처럼 동작하는 크로스 플랫폼 데스크톱 애플리케이션입니다.  
사진 중심의 홈, 미디어 갤러리, 파일 탐색기와 스트리밍 서비스 독을 제공합니다. 터치·마우스·키보드와 태블릿형/TV형 보기를 지원합니다. 저사양 기기의 메모리·렌더링 비용을 줄이는 것이 목표이며, 실제 Surface Pro 4 성능 측정 범위는 [성능 가이드](docs/PERFORMANCE_GUIDE.md)를 따릅니다.

## Windows 설치

[최신 GitHub Release](https://github.com/HYS1753/novus/releases/latest)의 Assets에서 `novus_<버전>_x64-setup.exe`를 실행하세요. 정식 배포 대상은 Windows x64 NSIS이며 현재 사용자 계정에 설치합니다. macOS/Linux 정식 설치 파일은 제공하지 않습니다.

0.2.0 NSIS 설치본은 앱 설정에서 새 버전을 확인·다운로드할 수 있습니다. 설치와 재시작은 직접 선택합니다. updater가 없는 0.1.0은 새 EXE를 한 번 수동 설치해야 합니다. MSI 이전은 별도 검증 대상입니다.

---

## 🌟 핵심 특징

- ⚡ **시스템 웹뷰 사용**: OS 웹뷰를 사용하며, 서비스는 열 때 생성하고 홈 복귀 시 숨겨 세션을 유지합니다. DOM·이미지 캐시·타이머 예산으로 비용을 관리합니다.
- 📺 **미디어 콘솔 대시보드**: 유튜브, 넷플릭스, 캘린더, 웹 검색 등 자주 쓰는 미디어와 도구를 한눈에 제어합니다.
- 🪟 **사진 위 글자 배경 강도 0–100**: 사진 스크림의 농도를 조절합니다. GPU 비용이 큰 backdrop blur는 사용하지 않습니다.
- 🎞️ **Nv 디자인**: 홈·설정·온보딩·사진/영상·파일·업데이트 화면을 같은 컴포넌트로 구성하고 `prefers-reduced-motion`을 존중합니다.
- 👆 **터치 & 마우스 하이브리드 UI**: 48px 이상의 터치 타겟과 지연 없는 `:active` 피드백, 키보드/리모컨 포커스를 지원합니다.
- 🛡️ **하네스 엔지니어링 (Harness Engineering)**: Feature-Sliced Design(FSD) 기반 계층 규칙이 린트와 Git Hook으로 자동 강제되어 장기적인 유지보수성을 보장합니다.

---

## 🏛️ 소프트웨어 아키텍처

```
src/
├── app/          # 앱 진입점, 글로벌 테마/스타일, 라우팅
├── pages/        # 최상위 화면 (DashboardPage 등)
├── widgets/      # 화면 위젯 (HomeV2, SettingsV2, GalleryV2 등)
├── features/     # 비즈니스 인터랙션 기능 (useLaunchApp 등)
├── entities/     # 도메인 모델 (AppItem, DeviceProfile)
└── shared/       # 공통 Nv UI, Tauri IPC, 유틸, 훅
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

- **Node.js (CI 기준 24)**:
  - [Node.js 공식 사이트](https://nodejs.org/) LTS 설치 또는 `nvm` / `fnm` / `brew install node`
- **pnpm 설치**:
  ```bash
  # macOS Homebrew 설치 예시
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

정식 배포는 검증된 main 커밋에 버전 태그를 붙여 GitHub Actions에서 Windows x64 NSIS를 빌드·서명하고, 초안을 확인한 뒤 공개합니다. 일반 main Push는 배포를 실행하지 않습니다. 서명 키 설정과 에이전트 실행 절차는 [배포 가이드](docs/RELEASING.md)를 따릅니다.

```bash
# 배포 구성·버전 확인 (태그 생성이나 공개를 수행하지 않음)
pnpm release:check
# 키가 설정된 환경에서 Windows 서명 패키지 빌드
pnpm release:build:windows
```

Windows 명시적 target 빌드의 산출물은 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`에 생성됩니다. 앱 아이콘은 `pnpm icons:generate`로 공식 NV 마크에서 재생성합니다.

---

## 📚 프로젝트 공식 문서 센터 (Docs Hub)

새로운 기능 개발이나 인수인계를 위해 아래 문서를 참고하십시오:

| 문서                                                   | 설명                                                                                |
| :----------------------------------------------------- | :---------------------------------------------------------------------------------- |
| 🤖 [**AI 에이전트 하네스**](AGENTS.md)                 | 모든 AI 코딩 에이전트(Claude, Cursor, Copilot 등)를 위한 행동 및 아키텍처 강제 규칙 |
| 📐 [**아키텍처 명세서**](docs/ARCHITECTURE.md)         | 프론트엔드/백엔드 계층 구조, 단방향 의존성 규칙, IPC 패턴                           |
| ⚡ [**저사양 성능 가이드**](docs/PERFORMANCE_GUIDE.md) | 4GB RAM급 저사양 기기를 위한 렌더링/메모리 최적화 원칙                              |
| 🤝 [**인수인계 가이드**](docs/HANDOVER.md)             | 신규 참여자를 위한 코드 맵, 새 위젯 추가 방법, 로드맵                               |
| 📦 [**배포 가이드**](docs/RELEASING.md)                | 버전 동기화·서명·태그·Release 공개와 에이전트 실행 절차                             |
| 🔄 [**업데이트 검증**](docs/UPDATE_VALIDATION.md)      | 실제 설치·업데이트·재시작과 로그인·설정 보존 검증 범위                              |

---

## 📄 라이선스

Private & Proprietary - Novus Team
