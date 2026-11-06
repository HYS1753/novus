# Windows 업데이트 런타임

## 동작 범위

`src-tauri/src/updater/`는 Windows x64 NSIS 설치본의 업데이트 조회·다운로드·설치를 담당합니다. `tauri-plugin-updater 2.14.1`을 사용하며 Tauri 코어 2.12.5와 WebView2 바인딩 0.39.1, JS API/CLI 2.12.4를 호환 버전으로 사용합니다. Windows TLS는 OS의 native-tls를 재사용하고 구형 ZIP updater 지원은 포함하지 않습니다.

설정 시트의 소프트웨어 업데이트 카드에서 자동 업데이트 ON/OFF, 수동 확인, 다운로드·취소, 진행률, 릴리즈 내용, 설치를 제공합니다. 자동 업데이트는 기본 ON이며 설치본에서 새 버전을 확인하고 다운로드합니다. 설치·재시작은 항상 사용자의 별도 확인을 받습니다. 브라우저 개발 환경과 Windows x64 외 플랫폼은 unsupported로 응답합니다.

## 설정 저장과 자동 작업

- `<app_config_dir>/updater.json`에 `{ "schemaVersion": 1, "automaticEnabled": true }`를 저장합니다. 파일이 없으면 ON, 손상·읽기 오류는 OFF와 별도 설정 오류로 처리합니다. 설정 변경은 blocking pool에서 같은 디렉터리의 임시 파일을 동기화한 뒤 원자적으로 교체합니다. 저장 실패도 OFF로 처리하며 UI에서 다시 저장할 수 있습니다.
- 자동 작업은 실제 main 웹뷰의 단일 컨트롤러가 소유합니다. 설치된 Windows NSIS 실행만 시작 30초 후 확인하고 이후 6시간 간격으로 확인합니다. OFF·설정 저장 중·설정 오류·미설치 실행에서는 예약하지 않습니다. 오프라인에서는 반복 재시도하지 않고 온라인 복귀·포커스·화면 표시 이벤트에서 기한이 지난 작업을 재개합니다.
- 새 버전은 자동 다운로드하되 같은 버전 실패를 빠르게 반복하지 않습니다. 수동 확인 또는 ON 재설정으로 재시도할 수 있습니다. 준비된 파일은 주기 확인으로 폐기하지 않습니다. OFF는 Rust에서 대기 중인 자동 명령까지 차단하고 진행 중인 자동 조회·다운로드를 취소합니다. 수동 작업과 이미 준비된 파일은 유지합니다. OFF에서도 수동 확인·다운로드·설치가 가능합니다.
- 설정 시트를 닫아도 작업은 유지됩니다. 대시보드에만 새 버전/설치 준비 알림을 표시하며 스트리밍 화면에는 자동 팝업을 띄우지 않습니다. 스트리밍 중 설정을 열면 네이티브 자식 웹뷰를 잠시 숨기고 닫을 때 같은 세션을 다시 표시합니다. 빠른 열기/닫기에도 이전 hide가 새 show를 덮지 않도록 순차 처리합니다.
- 설치 버튼은 종료·콘텐츠 재생 중단·재시작 안내와 최종 확인을 표시합니다. 기본 포커스는 `나중에`이며 시트를 닫거나 버전이 바뀌면 확인을 해제합니다. `ready`와 확인한 버전이 일치할 때만 설치 IPC를 호출합니다. 앱을 재시작하면 준비 캐시를 복원하지 않으며 새로 확인·다운로드합니다.

Windows 테스트 실행 파일에도 Common Controls v6 활성화 컨텍스트가 필요하므로 `build.rs`가 매니페스트 의존성을 링크합니다. 이는 Tauri 2.12가 사용하는 TaskDialogIndirect를 로더가 찾게 하며, 사용자 PC의 Windows 설정을 변경하지 않습니다.

## IPC 계약

IPC는 실제 호출 웹뷰의 label이 `main`일 때만 허용합니다. 서비스 자식 웹뷰와 영상 조작 창은 거부합니다. updater 플러그인의 JS 권한을 capabilities에 추가하지 않아 프런트엔드가 이 경로를 우회해 임의 URL·키·설치 경로를 지정할 수 없습니다.

| Rust 명령                        | shared 래퍼             | 기능                                     |
| -------------------------------- | ----------------------- | ---------------------------------------- |
| get_update_state                 | getUpdateState          | 상태 스냅샷                              |
| set_update_automatic(enabled)    | setAutomaticUpdates     | 자동 업데이트 설정 저장·자동 작업 차단   |
| check_for_update                 | checkForUpdate          | 고정 서버 조회, 새 버전 여부 확인        |
| download_update(expectedVersion) | downloadUpdate(version) | 현재 available 버전만 다운로드·검증      |
| install_update(expectedVersion)  | installUpdate(version)  | 현재 ready 버전만 최종 검증 후 NSIS 실행 |
| cancel_update                    | cancelUpdate            | 조회/다운로드 취소 및 준비 파일 폐기     |

타입은 `src/shared/api/tauri/updater.ts`에서 정의합니다. 성공 응답은 `UpdateState`, 오류는 `{ code, message }`입니다. 상태에는 supported, canInstall, phase, currentVersion, availableVersion, notes, downloadedBytes, totalBytes, error, revision 및 automaticEnabled, preferencesReady, preferenceSaving, preferenceError가 포함됩니다. 조회·다운로드는 선택적 `automatic` 인수(기본 false)로 자동 작업의 네이티브 차단을 적용합니다. `novus-update-state` 이벤트는 main 웹뷰에만 전달합니다. `features/update-app`의 외부 스토어는 이벤트를 먼저 구독하고 최초 조회하며 이전 revision을 무시합니다. 시트는 스토어를 구독하고 앱 루트는 수명만 관리합니다. 연결 실패 시 자동 작업을 멈추고 다시 연결 UI를 제공합니다.

상태 흐름은 idle → checking → upToDate/available → downloading → ready → installing입니다. 실패는 error, 취소는 idle로 돌아갑니다. 진행 중인 중복 작업은 busy로 거부하며 작업 세대 번호가 바뀐 뒤 도착한 응답과 진행 이벤트는 현재 상태를 덮지 않습니다. 설치 시작 후에는 취소할 수 없습니다. 오류 후 다시 조회할 수 있습니다.

## 조회와 다운로드

- endpoint는 `https://github.com/HYS1753/novus/releases/latest/download/latest.json` 한 개입니다. 공개 Release가 없거나 서버·JSON·플랫폼 오류가 있으면 실패로 응답하며 최신 버전으로 오인하지 않습니다.
- 설정의 공개 키는 `signing/updater.pub`와 일치해야 하며 requireSignedVersion=true, allowDowngrades=false, TLS 검증 유지가 필수입니다. 빌드 도구와 런타임에서 모두 확인합니다.
- 현재보다 높은 stable MAJOR.MINOR.PATCH 버전만 허용합니다. prerelease/build metadata 및 Windows 필드 범위(각 65535)를 벗어난 버전은 거부합니다.
- 설치 파일 URL은 해당 버전의 `https://github.com/HYS1753/novus/releases/download/v<버전>/novus_<버전>_x64-setup.exe`와 정확히 일치해야 합니다. HTTPS 리다이렉트만 최대 5회 허용합니다.
- 조회 요청은 15초, 다운로드 요청은 5분, 연결은 10초 제한입니다. manifest는 헤더와 실제 수신 크기 모두 64KiB로 제한한 뒤 공식 updater의 restore_update로 버전·플랫폼을 해석합니다. 네트워크 실패·타임아웃은 재시도 가능한 별도 오류 코드로 반환합니다.
- 다운로드는 `<app_cache_dir>/updates/novus-update-*.exe` 임시 파일에 스트리밍합니다. Content-Length와 실제 누적 바이트 모두 128MiB 제한을 적용합니다. 완료 후 blocking pool에서 파일을 읽어 Tauri의 파일 서명·trusted comment의 버전 서명과 EXE 헤더를 검증합니다.
- ready 상태에는 임시 파일 경로만 보관하고 검증 버퍼는 해제합니다. 부분 다운로드·검증 실패·취소·준비 폐기 시 파일을 정리합니다. 취소 시 이미 실행 중인 blocking 검증은 끝난 뒤 파일을 해제하며 설치나 상태 복원은 하지 않습니다. 비정상 종료로 남은 전용 임시 파일은 다음 다운로드 준비 시 최대 64개 정리합니다. 사용자 미디어와 브라우저 프로필은 정리 대상이 아닙니다.

## 설치

설치는 release 빌드에서 NSIS bundle marker와 같은 설치 폴더의 uninstall.exe가 확인된 경우에만 허용합니다. 개발 실행·테스트·포터블 실행 파일은 canInstall=false이며 조회와 다운로드 검증만 가능합니다. 호출자는 확인한 expectedVersion을 전달해야 합니다.

설치 직전 디스크 파일을 제한 크기로 다시 읽고 서명·서명된 버전·허용 URL을 재검증합니다. 캐시 파일이 바뀌면 설치하지 않습니다. 검증과 설치 시작은 blocking pool에서 수행합니다. 준비 캐시는 제거하고, Tauri updater가 별도 임시 설치 파일로 NSIS를 실행합니다. passive 설치와 재시작은 플러그인이 처리하며 정상 실행 후 현재 앱 프로세스가 종료됩니다. 설치 실패 시 오류를 상태와 호출자에게 반환합니다. 실제 앱 종료·재시작과 사용자 데이터 보존은 정식 설치본·업데이트 버전으로 별도 검증해야 합니다.

## 검증

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib
pnpm release:test
pnpm update:test
```

네이티브 테스트는 임시 키로 Tauri CLI가 만든 실제 서명, 루프백 HTTP 서버, Tauri MockRuntime 및 IPC 경로를 사용합니다. 설치 프로그램은 실행하지 않습니다. 정상 조회/다운로드/검증, 같은 버전, 404, 파일 변조, 서명된 버전 불일치, 과대 파일, 취소·파일 정리, 늦은 응답·중복 요청, 잘못된 웹뷰와 미설치 상태의 설치 차단을 검사합니다. HTTP·임시 키 허용은 테스트 코드에만 있으며 릴리즈 설정과 키를 바꾸지 않습니다.

네이티브 테스트는 설정 재읽기·원자적 교체·손상 오류, OFF의 자동 작업 취소·뒤늦은 응답 차단·수동 작업 보존도 검증합니다. `update:test`는 가짜 시계·API로 시작/6시간 예약, OFF·미설치 차단, 수동 작업, 명시적 설치 확인, 순서가 뒤바뀐 이벤트, 오류 재시도 제한, 오프라인 복귀와 구독 정리를 검증합니다. CI에서도 실행합니다.

실제 설치/재시작 및 로그인·설정 보존 검증에는 updater가 포함된 설치본과 더 높은 버전의 서명된 설치 파일이 필요합니다. 공개 전에는 별도 QA 식별자와 키의 실제 NSIS 사본으로 검증합니다. 절차와 정식 GitHub 경로 검증의 한계는 [UPDATE_VALIDATION.md](UPDATE_VALIDATION.md)를 따릅니다. 정식 Release 공개는 사용자 승인 후 진행합니다.
