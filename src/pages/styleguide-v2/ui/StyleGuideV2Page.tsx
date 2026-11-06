import React, { useState } from "react";
import {
  CloseIcon,
  FolderIcon,
  getAmbientArtworkForDay,
  HomeIcon,
  ImageIcon,
  NovusLogo,
  NvButton,
  NvGlyphButton,
  NvGlyphRail,
  NvMonthCalendar,
  NvSegmented,
  NvServicePlate,
  NvStatus,
  PlayIcon,
  RefreshIcon,
  SearchIcon,
  SettingsIcon,
} from "@/shared";
import { HomePatternDemo } from "./HomePatternDemo";
import "./styleguide-v2.css";

type Theme = "system" | "light" | "dark";
type Posture = "tablet" | "tv";

const SECTIONS = [
  { id: "tone", label: "톤 & 매너" },
  { id: "home", label: "홈 패턴" },
  { id: "color", label: "색" },
  { id: "type", label: "타입" },
  { id: "shape", label: "형태 · 크기" },
  { id: "components", label: "컴포넌트" },
  { id: "state", label: "포커스 · 상태" },
  { id: "motion", label: "모션" },
];

const RAMP = [
  { token: "n0", role: "프레임 · 반전 글자" },
  { token: "n1", role: "바탕 (ground)" },
  { token: "n2", role: "면 (surface)" },
  { token: "n3", role: "올린 면 · 괘선" },
  { token: "n4", role: "강한 괘선" },
  { token: "n5", role: "비활성 글자" },
  { token: "n6", role: "3차 글자" },
  { token: "n7", role: "2차 글자" },
  { token: "n8", role: "본문 · 포커스" },
];

const SEMANTIC = [
  { token: "live", label: "실행 중", use: "세션이 살아 있는 서비스에만" },
  { token: "attention", label: "확인 필요", use: "오류, 업데이트 준비 완료" },
  { token: "sun", label: "일요일", use: "달력의 일요일에만" },
  { token: "sat", label: "토요일", use: "달력의 토요일에만" },
];

const TYPE_SCALE = [
  { token: "numeral", sample: "6", note: "오늘 날짜 · 192 / 240px" },
  { token: "display", sample: "Netflix", note: "1화면 서비스 이름 · 64 / 80px" },
  { token: "clock", sample: "20:41", note: "시계 · 36 / 45px" },
  { token: "title", sample: "설정", note: "화면 제목 · 28 / 35px" },
  { token: "heading", sample: "서비스", note: "구역 제목 · 20 / 25px" },
  { token: "body", sample: "세션은 홈으로 가도 유지됩니다.", note: "본문 · 16 / 20px" },
  { token: "label", sample: "이어서 보기", note: "버튼 · 라벨 · 14 / 17.5px" },
  { token: "caption", sample: "12분 전 사용", note: "보조 정보 · 12 / 15px" },
];

const RULES = [
  {
    term: "Novus는 색을 내지 않는다",
    body: "색은 사진과 서비스 공식 로고만 냅니다. Novus의 화면 요소는 중립 9단 램프로만 그립니다.",
  },
  {
    term: "색은 상태를 말할 때만",
    body: "빨강은 실행 중, 주황은 확인 필요, 일·토 색은 달력에서만. 장식용 강조색은 없습니다.",
  },
  {
    term: "원은 어디서나, 사각은 그 자리",
    body: "원형 글리프는 어느 화면에서나 같은 전역 동작이고, 사각 버튼과 플레이트는 그 콘텐츠에 붙은 동작입니다.",
  },
  {
    term: "사실만 말한다",
    body: "캡션은 추측하지 않습니다. '실행 중 · 세션 유지 · 12분 전 사용'처럼 Novus가 실제로 아는 것만 씁니다.",
  },
  {
    term: "한 기기, 두 자세",
    body: "TV형과 태블릿형은 같은 토큰을 쓰고 배율(1.25 / 1)과 터치 영역(64 / 48px)만 바뀝니다.",
  },
];

const MOTIONS = [
  { token: "press", value: "90ms", use: "누름 피드백. 크기 0.97, 이동 없음" },
  { token: "move", value: "200ms", use: "포커스·상태 변화" },
  { token: "fold", value: "420ms", use: "사진 접힘, 시트 진입. 화면당 한 번만 쓰는 순간" },
];

export const StyleGuideV2Page: React.FC = () => {
  const [theme, setTheme] = useState<Theme>("system");
  const [posture, setPosture] = useState<Posture>("tablet");
  const [plateState, setPlateState] = useState<"live" | "ended" | "idle">("live");
  const today = new Date();
  const artwork = getAmbientArtworkForDay(today);

  return (
    <div
      className="nv-root sg2"
      data-theme={theme === "system" ? undefined : theme}
      data-posture={posture}
      lang="ko"
    >
      <header className="sg2-top">
        <div className="sg2-top__brand">
          <NovusLogo />
          <span className="sg2-top__title">디자인 가이드 v2</span>
        </div>
        <div className="sg2-top__controls">
          <NvSegmented<Theme>
            label="테마"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "시스템" },
              { value: "light", label: "라이트" },
              { value: "dark", label: "다크" },
            ]}
          />
          <NvSegmented<Posture>
            label="보기 모드"
            value={posture}
            onChange={setPosture}
            options={[
              { value: "tablet", label: "태블릿형" },
              { value: "tv", label: "TV형" },
            ]}
          />
        </div>
      </header>

      <nav className="sg2-nav" aria-label="가이드 목차">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.label}
          </a>
        ))}
      </nav>

      <main className="sg2-main">
        <section id="tone" className="sg2-section sg2-tone">
          <h1>밤의 액자, 낮의 한 장</h1>
          <p className="sg2-lede">
            Novus는 스스로 색을 내지 않는 검은 액자입니다. 하던 것이 사진 위에 가득 차고, 내리면
            오늘이 한 장으로 펼쳐지며, 가만히 두면 거실의 액자가 됩니다.
          </p>
          <dl className="sg2-rules">
            {RULES.map((rule) => (
              <div key={rule.term}>
                <dt>{rule.term}</dt>
                <dd>{rule.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="home" className="sg2-section">
          <h2>홈 패턴</h2>
          <p className="sg2-desc">
            Surface Pro 4 실제 화면(1368×912)을 축소해 보여줍니다. 데모 안에서 스크롤하면 사진이
            위로 접혀 띠가 됩니다. 사진 한 장만 transform으로 움직이고 나머지는 움직이지 않습니다.
          </p>
          <HomePatternDemo />
          <dl className="sg2-notes">
            <div>
              <dt>1화면 · 한 화면 한 개</dt>
              <dd>
                실행 중인 세션이 주인공. 없으면 마지막 사용 서비스, 그것도 없으면 오늘의 사진과
                시계만.
              </dd>
            </div>
            <div>
              <dt>2화면 · 오늘 한 장</dt>
              <dd>사진 띠, 왼쪽 큰 날짜, 오른쪽 달력, 서비스 7개, 맨 아래 작은 탐색기 줄.</dd>
            </div>
            <div>
              <dt>앰비언트</dt>
              <dd>무조작이 이어지면 캡션과 레일이 사라지고 사진과 시계만 남습니다.</dd>
            </div>
            <div>
              <dt>사진 접힘 (시그니처)</dt>
              <dd>스크롤 위치에 맞춰 같은 사진이 위로 이동합니다. 사진 요소 하나만 움직입니다.</dd>
            </div>
          </dl>
        </section>

        <section id="color" className="sg2-section">
          <h2>색</h2>
          <p className="sg2-desc">중립 램프 9단. 컴포넌트는 램프 값이 아닌 역할 토큰만 씁니다.</p>
          <ol className="sg2-ramp">
            {RAMP.map((step) => (
              <li key={step.token}>
                <span
                  className="sg2-ramp__chip"
                  style={{ background: `var(--nv-${step.token})` }}
                />
                <code>--nv-{step.token}</code>
                <span>{step.role}</span>
              </li>
            ))}
          </ol>
          <ul className="sg2-semantic">
            {SEMANTIC.map((color) => (
              <li key={color.token}>
                <span
                  className="sg2-semantic__chip"
                  style={{ background: `var(--nv-${color.token})` }}
                />
                <span>
                  <strong>{color.label}</strong>
                  <code>--nv-{color.token}</code>
                </span>
                <span className="sg2-muted">{color.use}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="type" className="sg2-section">
          <h2>타입</h2>
          <p className="sg2-desc">
            시스템 글꼴(Segoe UI Variable + 언어별 OS 글꼴). 웹폰트는 번들하지 않습니다. 크기는
            태블릿형 / TV형 순서.
          </p>
          <ul className="sg2-type">
            {TYPE_SCALE.map((row) => (
              <li key={row.token}>
                <code>{row.token}</code>
                <span className={`sg2-type__sample sg2-type__sample--${row.token}`}>
                  {row.sample}
                </span>
                <span className="sg2-muted">{row.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="shape" className="sg2-section">
          <h2>형태 · 크기</h2>
          <div className="sg2-shape">
            <div className="sg2-shape__item">
              <NvGlyphButton icon={<HomeIcon />} label="홈" />
              <p>
                <strong>원 = 전역 동작</strong>
                어느 화면에서나 같은 자리, 같은 뜻. 홈, 뒤로, 검색, 설정.
              </p>
            </div>
            <div className="sg2-shape__item">
              <NvButton variant="primary" icon={<PlayIcon />}>
                이어서 보기
              </NvButton>
              <p>
                <strong>사각 = 콘텐츠의 동작</strong>
                모서리 4px. 그 콘텐츠를 떠나면 의미가 없는 동작.
              </p>
            </div>
          </div>
          <div className="sg2-targets">
            <div>
              <span className="sg2-targets__box" style={{ width: 48, height: 48 }} />
              <span>태블릿형 최소 48px</span>
            </div>
            <div>
              <span className="sg2-targets__box" style={{ width: 64, height: 64 }} />
              <span>TV형 최소 64px</span>
            </div>
            <div>
              <span className="sg2-targets__current" />
              <span>현재 보기 모드 터치 영역</span>
            </div>
          </div>
        </section>

        <section id="components" className="sg2-section">
          <h2>컴포넌트</h2>

          <h3>버튼</h3>
          <div className="sg2-row">
            <NvButton variant="primary" icon={<PlayIcon />}>
              이어서 보기
            </NvButton>
            <NvButton>세션 종료</NvButton>
            <NvButton variant="quiet">Google 캘린더 열기</NvButton>
            <NvButton disabled>사용할 수 없음</NvButton>
          </div>

          <h3>사진 위</h3>
          <div className="sg2-media nv-on-media">
            {artwork && <img src={artwork.url} alt="" className="sg2-media__img" />}
            <div className="sg2-media__scrim" />
            <div className="sg2-media__content">
              <NvStatus tone="live" onMedia>
                실행 중 · 세션 유지
              </NvStatus>
              <div className="sg2-row">
                <NvButton variant="primary" onMedia icon={<PlayIcon />}>
                  이어서 보기
                </NvButton>
                <NvButton onMedia>세션 종료</NvButton>
              </div>
            </div>
            <NvGlyphRail label="예시 레일" className="sg2-media__rail">
              <NvGlyphButton onMedia icon={<SearchIcon />} label="검색" />
              <NvGlyphButton onMedia icon={<ImageIcon />} label="갤러리" />
              <NvGlyphButton onMedia icon={<SettingsIcon />} label="설정" />
            </NvGlyphRail>
          </div>

          <h3>글리프 레일</h3>
          <NvGlyphRail label="예시 가로 레일" orientation="horizontal">
            <NvGlyphButton icon={<HomeIcon />} label="홈" />
            <NvGlyphButton icon={<RefreshIcon />} label="새로고침" />
            <NvGlyphButton icon={<FolderIcon />} label="파일" />
            <NvGlyphButton icon={<CloseIcon />} label="닫기" />
          </NvGlyphRail>

          <h3>서비스 플레이트</h3>
          <div className="sg2-row">
            <NvSegmented
              label="플레이트 상태"
              value={plateState}
              onChange={setPlateState}
              options={[
                { value: "live", label: "실행 중" },
                { value: "ended", label: "종료됨" },
                { value: "idle", label: "대기" },
              ]}
            />
          </div>
          <div className="sg2-plates">
            <NvServicePlate id="netflix" name="Netflix" shortcut={1} state={plateState} />
            <NvServicePlate id="youtube" name="YouTube" shortcut={2} />
            <NvServicePlate id="tving" name="티빙" shortcut={4} />
            <NvServicePlate id="watcha" name="왓챠" shortcut={6} />
          </div>

          <h3>달력</h3>
          <div className="sg2-calendar">
            <NvMonthCalendar date={today} locale="ko-KR" />
          </div>
        </section>

        <section id="state" className="sg2-section">
          <h2>포커스 · 상태</h2>
          <p className="sg2-desc">
            Tab 또는 방향키로 이동해 보세요. 포커스는 흰(라이트에서는 검은) 4px 링 하나이고, 이웃
            요소의 크기를 바꾸지 않습니다.
          </p>
          <div className="sg2-row">
            <NvStatus tone="live">실행 중</NvStatus>
            <NvStatus tone="ended">종료됨</NvStatus>
            <NvStatus tone="attention">업데이트 준비 완료</NvStatus>
            <NvStatus tone="neutral">12분 전 사용</NvStatus>
          </div>
          <dl className="sg2-notes">
            <div>
              <dt>종료됨</dt>
              <dd>세션을 닫으면 플레이트에 '종료됨'을 한 박자 보인 뒤 목록에서 빠집니다.</dd>
            </div>
            <div>
              <dt>빈 상태</dt>
              <dd>
                실행 중 세션이 없으면 1화면은 사진·시계·인사만 보여주고 버튼을 지어내지 않습니다.
              </dd>
            </div>
            <div>
              <dt>오류</dt>
              <dd>무엇이 안 됐는지와 다음 행동을 한 줄로. 주황 점은 사용자가 할 일이 있을 때만.</dd>
            </div>
          </dl>
        </section>

        <section id="motion" className="sg2-section">
          <h2>모션</h2>
          <ul className="sg2-motion">
            {MOTIONS.map((motion) => (
              <li key={motion.token}>
                <code>--nv-dur-{motion.token}</code>
                <span className="nv-numeral">{motion.value}</span>
                <span className="sg2-muted">{motion.use}</span>
              </li>
            ))}
          </ul>
          <p className="sg2-desc">
            transform과 opacity만 움직입니다. 시스템의 동작 줄이기 설정이 켜지면 모든 모션이 즉시
            끝납니다.
          </p>
        </section>
      </main>
    </div>
  );
};
