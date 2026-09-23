# Brand Assets Directory

이 디렉토리는 대시보드 카드에 표시할 각 서비스/앱의 로컬 이미지 에셋을 보관하는 공간입니다.

## 파일 추가 방법

원하시는 서비스의 이미지(**JPEG, JPG, PNG, WebP, SVG** 지원, 대소문자 무관)를 **`[앱ID].[확장자]`** 파일명으로 이 폴더에 넣으시면 됩니다.
카드 전체를 꽉 채우는 16:9 비율의 이미지(예: 960×540, 1920×1080 등)를 넣으시면 가장 완벽하게 핏됩니다.

### 파일명 예시:

- TVING: `tving.jpg` (또는 `tving.jpeg`, `tving.png`, `tving.webp`)
- Watcha: `watcha.jpg` (또는 `watcha.jpeg`, `watcha.png`)
- Coupang Play: `coupang.jpg` (또는 `coupang.jpeg`, `coupang.png`)
- Netflix: `netflix.jpeg` (또는 `netflix.png`, `netflix.jpg`)
- YouTube: `youtube.jpg` (또는 `youtube.jpeg`, `youtube.png`)

## 이미지 표시 우선순위

1. **1순위 (URL)**: `item.imageUrl`이 지정되어 있으면 해당 웹/CDN 이미지 로드
2. **2순위 (개별 에셋)**: 본 디렉토리(`src/assets/brands/`)에 등록된 파일 로드
3. **3순위 (내장 SVG)**: 내장 벡터 SVG 로고 표시
4. **4순위 (텍스트)**: 볼드 텍스트 타이틀 표시
