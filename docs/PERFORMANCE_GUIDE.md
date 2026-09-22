# Novus Low-Spec Performance Guide

> **타깃 기기 프로필**: Microsoft Surface Pro 4 (Intel Core m3-6Y30 듀얼코어, Intel HD 515, **4GB LPDDR3 RAM**, 12.3인치 2736x1824 고해상도 터치 디스플레이)

---

## 1. 저사양 디바이스 성능 도전 과제

1. **극히 제한된 RAM (4GB)**: Windows 10/11 OS 자체 점유율만 2~2.5GB에 달하므로, 앱 단독 메모리 사용량을 **30~50MB** 이내로 엄격히 통제해야 합니다.
2. **저전력 듀얼코어 CPU (4.5W TDP)**: 잦은 JavaScript 가비지 컬렉션(GC)이나 반복적인 DOM 리플로우가 발생하면 즉시 프레임 드랍(Jank)이 발생합니다.
3. **고해상도 디스플레이 (2736x1824)**: 픽셀 수가 많아 무거운 CSS 필터(blur, 복잡한 box-shadow 등)를 남발하면 내장 그래픽(HD 515)에 과부하가 걸립니다.

---

## 2. 프론트엔드 최적화 5대 원칙

### ① 무거운 CSS 필터 금지 및 GPU 하드웨어 가속 강제

- `backdrop-filter: blur(...)`는 구형 인텔 내장 GPU에서 치명적인 렌더링 지연을 유발합니다. 대신 **반투명 단색 배경(`rgba(20, 24, 32, 0.85)`)**을 사용하십시오.
- 모션/트랜지션이 있는 모든 인터랙티브 요소(버튼, 카드)에는 반드시 `transform: translateZ(0)`를 부여하여 독립 컴포지팅 레이어로 승격시킵니다.
- 위치 이동이나 크기 조절은 `top`, `left`, `width`, `height` 대신 항상 **`transform: translate(...)` 및 `scale(...)`**만을 사용합니다.

### ② 저빈도(Low-frequency) 타이머 및 백그라운드 절전

- 시계/날짜 위젯은 1초 단위(`1000ms`)가 아닌 **10초 또는 30초 단위**로만 인터벌을 실행합니다 (`src/shared/hooks/useCurrentTime.ts` 참조).
- 창이 최소화되거나 비활성화되면 백그라운드 애니메이션 및 폴링을 즉시 일시정지합니다.

### ③ DOM 노드 수의 최소화 및 가상화(Virtualization)

- 렌더링 트리에 존재하는 총 DOM 노드 수를 500개 미만으로 억제합니다.
- 긴 앱 목록이나 동영상 리스트를 표시할 때는 전체를 렌더링하지 않고 화면에 보이는 요소만 렌더링하는 가상 스크롤(Virtual Shelf) 방식을 적용합니다.

### ④ 44px 이상의 터치 타겟과 즉각적인 Active 피드백

- 윈도우/태블릿 환경에서 손가락 터치 시 빗나가지 않도록 모든 터치 버튼 및 카드는 **최소 48x48px** 이상의 터치 영역을 보장합니다 (`--touch-target-min`).
- 터치 시 지연감(300ms delay)을 방지하기 위해 `-webkit-tap-highlight-color: transparent`를 전역 적용하고, `:active` 상태에서 즉각적인 `scale(0.96)` 반응을 제공합니다.

### ⑤ 가벼운 번들 사이즈 유지 (Zero Bloatware)

- Moment.js, Lodash, 대형 UI 라이브러리(Material UI, Ant Design) 도입을 엄격히 금지합니다.
- 유틸리티는 순수 JS 및 `src/shared/lib/`의 경량 함수를 사용하고, UI는 자체 제작한 순수 CSS 기반 `src/shared/ui/` 컴포넌트를 사용합니다.

---

## 3. 메모리 누수 방지 체크리스트

- [ ] `useEffect` 내부에서 생성된 이벤트 리스너, 타이머, Tauri 이벤트 언리스너가 cleanup 함수에서 100% 해제되는가?
- [ ] 대용량 이미지 자산을 직접 번들링하지 않고, SVG 아이콘 또는 최적화된 WebP/AVIF를 사용하는가?
- [ ] 개발자 도구 Performance 탭에서 60fps가 안정적으로 유지되는가?
