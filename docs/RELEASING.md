# Novus 배포 규칙과 버전 관리

## 현재 범위

- 배포 준비 버전은 `0.2.0`입니다. 버전 표시는 배포 완료를 의미하지 않습니다.
- 1단계는 Windows 설치 규칙, 버전 동기화, 태그 검사, 소스 추적 정보까지만 구현합니다. 서명 키, updater, 자동 빌드 워크플로, 태그 Push 및 Release 게시는 아직 구성하지 않았습니다.
- 정식 배포 대상은 Windows x64입니다. macOS와 Linux의 정식 지원 여부는 각 플랫폼 실행 검증 이후 결정합니다.
- 소스 및 배포 저장소는 공개 저장소 `HYS1753/novus`입니다. 공개 여부는 2026-11-04 인증 없는 GitHub 저장소 API에서 확인했습니다. 저장소 공개 범위는 변경하지 않았습니다.

## Windows 설치 계약

| 항목                 | 고정 값                     |
| -------------------- | --------------------------- |
| 설치 형식            | NSIS `.exe` 한 종류         |
| 대상                 | `x86_64-pc-windows-msvc`    |
| 설치 범위            | `currentUser` — 현재 사용자 |
| 앱 식별자            | `com.novus.hub`             |
| 제품명 / 실행 파일명 | `novus` / `novus.exe`       |
| 채널                 | `stable`                    |

`release.config.json`이 배포 계약을 정의합니다. `src-tauri/tauri.windows.conf.json`은 Tauri가 Windows 빌드에서 자동 병합하는 플랫폼 설정이며 NSIS와 현재 사용자 설치만 선택합니다. 다른 운영체제의 번들 설정은 공통 `tauri.conf.json`에 유지합니다.

기존 로컬 `novus_0.1.0_x64-setup.exe`의 생성된 NSIS 템플릿에서도 제품명 `novus`, 식별자 `com.novus.hub`, `currentUser`를 확인했습니다. 새 설치본도 이 값을 유지합니다. 설치 경로를 강제로 바꾸는 커스텀 템플릿이나 설치 해제·앱 데이터 삭제 단계는 추가하지 않습니다.

기존 MSI 산출물도 발견했지만 실제 배포·설치 여부는 확인되지 않았습니다. MSI에서 NSIS로의 자동 이전은 지원한다고 가정하지 않습니다. 기존 설치본이 MSI이거나 다른 사용자/관리자 범위에 설치되었다면 정식 배포 전에 별도 전환 절차와 데이터 보존을 검증해야 합니다. 현재 PC의 제거 프로그램 레지스트리에서는 Novus 설치 항목을 찾지 못했으므로 실제 업그레이드 호환성은 이후 설치 검증 단계에서 확인합니다.

## 버전 변경

버전의 기준은 `package.json.version`입니다. 다음 명령은 네 파일을 함께 변경합니다.

```powershell
pnpm release:version 0.2.0
```

동기화 대상:

- `package.json`의 루트 버전
- `src-tauri/tauri.conf.json`의 앱 버전
- `src-tauri/Cargo.toml`의 `[package].version`
- `src-tauri/Cargo.lock`의 로컬 `novus` 패키지 버전

의존 패키지 버전과 `pnpm-lock.yaml`은 변경하지 않습니다. 동일 버전으로 실행하면 파일 간 버전 불일치를 복구합니다. 버전을 낮추는 변경은 거부합니다. 현재 채널은 선행 0, 접두사 `v`, prerelease, build metadata가 없는 `MAJOR.MINOR.PATCH`만 허용하며 Windows 버전 필드에 맞춰 각 숫자를 65535 이하로 제한합니다.

버전 의미는 기능 추가 시 minor(`0.2.0`), 호환되는 수정 시 patch(`0.2.1`), 호환성을 깨는 정식 전환 시 major로 구분합니다. 재빌드한 다른 파일을 동일한 정식 버전으로 다시 배포하지 않고 새 버전을 부여합니다.

## 빌드 전 검사와 태그

`.gitattributes`는 텍스트 체크아웃의 줄바꿈을 LF로 고정해 Windows의 `core.autocrlf` 설정과 Prettier 검사 충돌을 방지합니다. Windows 배치 파일만 CRLF를 사용합니다. 이 규칙은 앱 실행 동작에 영향을 주지 않습니다.

```powershell
pnpm release:check
pnpm release:check --tag v0.2.0
pnpm release:test
```

- 네 파일의 버전과 설치 계약이 일치하지 않으면 종료 코드 1로 실패합니다.
- `--tag`는 전달된 태그 문자열과 앱 버전의 일치 여부만 검사합니다. Git 태그 생성, Push 또는 Release 게시를 수행하지 않습니다.
- GitHub Actions의 `GITHUB_REF_TYPE=tag` 환경에서는 `GITHUB_REF_NAME`도 같은 규칙으로 검사합니다. 태그는 반드시 `v` + 앱 버전이어야 합니다.
- `pnpm build`는 버전 검사를 먼저 실행합니다. Tauri의 기존 `beforeBuildCommand`도 이 명령을 호출하므로 일반 네이티브 패키징에 검사가 적용됩니다.
- main 포함 여부, 태그 보호, 배포 권한 및 게시 순서는 이후 자동 배포 워크플로 단계에서 구성합니다. 현재 명령은 이를 검증한다고 주장하지 않습니다.

## Windows 빌드 명령과 추적 정보

```powershell
pnpm release:build:windows
pnpm release:info
```

Windows 빌드 명령은 대상 아키텍처와 NSIS 형식을 명시합니다. 로컬 MPV 준비는 기존 `pnpm setup:mpv` 절차를 사용하며, 라이브러리를 포함한 설치 검증과 CI의 준비 실패 차단은 이후 배포 단계에서 수행합니다.

명시적 target 빌드의 설치 파일 위치는 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`입니다. Cargo 출력 경로를 별도로 설정하면 해당 설정을 따릅니다.

`release:info`는 현재 앱 버전, 기대 태그, source/release 저장소, 설치 계약, HEAD 커밋과 `dirty` 여부를 JSON으로 출력합니다. 이는 현재 체크아웃의 정보이며 이미 존재하는 EXE의 출처를 증명하지 않습니다. 정식 빌드에서는 다음 순서를 유지해야 합니다.

1. 변경사항을 커밋하고 작업 트리가 깨끗한지 확인합니다.
2. 해당 커밋에서 버전 검사와 설치 파일 빌드를 수행합니다.
3. 같은 체크아웃의 소스 정보를 빌드 산출물과 함께 보관합니다. `dirty: true`인 산출물은 정식 배포하지 않습니다.
4. 이후 배포 워크플로는 이 메타데이터를 설치 파일·해시·실제 태그와 연결해 Release에 보관합니다.

기존 버전 설치본의 설정·로그인·MPV 재생 유지와 updater 검증을 통과하기 전에는 `0.2.0`을 정식 배포하지 않습니다. 기존 `0.1.0`에는 updater가 없으므로 updater 탑재 버전으로의 최초 전환은 수동 설치입니다.

## 다음 단계의 시작 조건

2단계(서명 키 및 업데이트 배포 파일)는 사용자 시작 지시 이후 진행합니다. 1단계 명령은 키 생성, GitHub Secrets 변경, updater 의존성 추가, 태그 Push, Release 게시를 실행하지 않습니다.
