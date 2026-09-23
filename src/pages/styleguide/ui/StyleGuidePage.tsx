import React, { useState } from "react";
import {
  describeMaterialIntensity,
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassCheckbox,
  GlassDivider,
  GlassEmptyState,
  GlassInput,
  GlassListRow,
  GlassMenu,
  GlassModal,
  GlassProgress,
  GlassSegmentedControl,
  GlassSheet,
  GlassSkeleton,
  GlassSlider,
  GlassToast,
  GlassToggle,
  GlassTooltip,
  MATERIAL_INTENSITY_STEP,
  useMaterialIntensity,
  GlassMediaTile,
  SubpageDock,
  PlayIcon,
  FolderIcon,
  ImageIcon,
  VideoIcon,
  DocumentIcon,
  ArchiveIcon,
  GridIcon,
  ListIcon,
  CloseIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CloudSunIcon,
  ExternalLinkIcon,
  MotionIcon,
  RefreshIcon,
  SettingsIcon,
  ThemeIcon,
  PathNavigation,
  type IconMotionPreset,
} from "@/shared";

type SectionId =
  | "overview"
  | "principles"
  | "material"
  | "color"
  | "type"
  | "layout"
  | "motion"
  | "actions"
  | "feedback"
  | "surfaces";

const NAV: { group: string; items: { id: SectionId; label: string }[] }[] = [
  {
    group: "Foundation",
    items: [
      { id: "overview", label: "Overview" },
      { id: "principles", label: "Principles" },
      { id: "material", label: "Material" },
      { id: "color", label: "Color" },
      { id: "type", label: "Typography" },
      { id: "layout", label: "Layout" },
      { id: "motion", label: "Motion" },
    ],
  },
  {
    group: "Library",
    items: [
      { id: "actions", label: "Actions & Inputs" },
      { id: "feedback", label: "Feedback" },
      { id: "surfaces", label: "Surfaces" },
    ],
  },
];

/** Every interaction in the product resolves to one of these recipes. */
const MOTION_RECIPES = [
  {
    name: "Press",
    trigger: "액션 가능한 요소를 누를 때",
    effect: "scale 0.97로 눌렸다가 즉시 복귀",
    token: "--motion-fast · --ease-standard",
  },
  {
    name: "Lift",
    trigger: "선택 가능한 면 위에 포인터가 올라올 때",
    effect: "translateY −4px + 그림자 한 단계 상승",
    token: "--motion-base · --ease-out",
  },
  {
    name: "Reveal",
    trigger: "콘텐츠가 제자리에 나타날 때",
    effect: "아래에서 10px 올라오며 페이드 인",
    token: "--motion-base · --ease-out",
  },
  {
    name: "Emerge",
    trigger: "트리거에 붙은 오버레이가 열릴 때",
    effect: "트리거 쪽을 기준으로 0.97 → 1 스케일 + 페이드",
    token: "--motion-base · --ease-out",
  },
  {
    name: "Enter",
    trigger: "큰 면이 화면 가장자리에서 들어올 때",
    effect: "도킹된 변에서 슬라이드 인",
    token: "--motion-slow · --ease-out",
  },
  {
    name: "Pulse",
    trigger: "끝을 알 수 없는 작업이 진행 중일 때",
    effect: "낮은 진폭으로 반복 (시머 · 무한 진행바)",
    token: "1.2–1.6s · linear / --ease-standard",
  },
] as const;

const ICON_MOTION_RECIPES: {
  name: string;
  motion: IconMotionPreset;
  usage: string;
  icon: React.ReactNode;
  active?: boolean;
}[] = [
  { name: "Pop", motion: "pop", usage: "열기·선택·확대", icon: <PlayIcon size={22} /> },
  { name: "Rotate", motion: "rotate", usage: "설정·새로고침", icon: <SettingsIcon size={22} /> },
  { name: "Tilt", motion: "tilt", usage: "테마·모드 전환", icon: <ThemeIcon size={22} /> },
  {
    name: "Nudge left",
    motion: "nudge-left",
    usage: "뒤로 이동",
    icon: <ArrowLeftIcon size={22} />,
  },
  {
    name: "Nudge right",
    motion: "nudge-right",
    usage: "외부·다음 이동",
    icon: <ExternalLinkIcon size={22} />,
  },
  {
    name: "Nudge up",
    motion: "nudge-up",
    usage: "상위 폴더 이동",
    icon: <ArrowUpIcon size={22} />,
  },
  {
    name: "Spin",
    motion: "spin",
    usage: "진행 중인 작업만",
    icon: <RefreshIcon size={22} />,
    active: true,
  },
  {
    name: "Pulse",
    motion: "pulse",
    usage: "주의가 필요한 상태만",
    icon: <PlayIcon size={22} />,
    active: true,
  },
  {
    name: "Breathe",
    motion: "breathe",
    usage: "연결·대기 상태만",
    icon: <CloudSunIcon size={22} />,
    active: true,
  },
];

const COLORS = [
  {
    name: "Background",
    role: "가장 뒤에 놓이는 캔버스. 콘텐츠가 앞으로 나오도록 물러납니다.",
    token: "--color-background",
    css: "var(--color-background)",
  },
  {
    name: "Surface",
    role: "패널·카드·컨트롤의 기본 면. 틴트 알파는 머티리얼 강도가 결정합니다.",
    token: "--color-surface",
    css: "var(--color-surface)",
  },
  {
    name: "Elevated",
    role: "모달·메뉴·툴팁처럼 떠 있는 면.",
    token: "--color-surface-elevated",
    css: "var(--color-surface-elevated)",
  },
  {
    name: "Sunken",
    role: "트랙·세그먼트 홈·스켈레톤처럼 눌린 면.",
    token: "--color-surface-sunken",
    css: "var(--color-surface-sunken)",
  },
  {
    name: "Primary",
    role: "선택·진행·주요 액션에만 쓰는 신호색. 면적을 넓히지 않습니다.",
    token: "--color-primary",
    css: "var(--color-primary)",
  },
  {
    name: "Text",
    role: "본문과 타이틀. 어떤 머티리얼 위에서도 4.5:1을 확보합니다.",
    token: "--color-text-primary",
    css: "var(--color-text-primary)",
  },
  {
    name: "Text secondary",
    role: "보조 설명과 메타 정보.",
    token: "--color-text-secondary",
    css: "var(--color-text-secondary)",
  },
  {
    name: "Success",
    role: "완료·정상 상태.",
    token: "--color-success",
    css: "var(--color-success)",
  },
  {
    name: "Warning",
    role: "주의·제한 상태.",
    token: "--color-warning",
    css: "var(--color-warning)",
  },
  {
    name: "Danger",
    role: "오류와 파괴적 액션.",
    token: "--color-danger",
    css: "var(--color-danger)",
  },
] as const;

const TYPE_ROWS = [
  {
    label: "Display",
    sample: "9:41",
    meta: "44 / 600 / -4%",
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 44,
      fontWeight: 600,
      letterSpacing: "-0.04em",
    },
  },
  {
    label: "Title",
    sample: "바로가기",
    meta: "22 / 600 / -2%",
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: "-0.02em",
    },
  },
  {
    label: "Body",
    sample: "콘텐츠가 주인공이고, 크롬은 조용히 돕습니다.",
    meta: "15 / 400 / 1.55",
    style: { fontSize: 15, fontWeight: 400, lineHeight: 1.55 },
  },
  {
    label: "Label",
    sample: "MEDIA",
    meta: "11 / 600 / +8% caps",
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: "var(--color-text-secondary)",
    },
  },
] as const;

const SPACING = [4, 8, 12, 16, 24, 32, 48] as const;

const RADII = [
  { name: "sm", value: "10", token: "--radius-sm" },
  { name: "md", value: "14", token: "--radius-md" },
  { name: "lg", value: "18", token: "--radius-lg" },
  { name: "xl", value: "22", token: "--radius-xl" },
  { name: "2xl", value: "28", token: "--radius-2xl" },
  { name: "pill", value: "∞", token: "--radius-pill" },
] as const;

/**
 * Design documentation surface: tone, tokens, motion and component specimens.
 * Mounted only on the browser DEV server — never part of the shipped app.
 */
export const StyleGuidePage: React.FC = () => {
  const [section, setSection] = useState<SectionId>("overview");
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const { intensity, setIntensity } = useMaterialIntensity();

  /* Specimen-only state. Labels stay abstract — this page ships no features. */
  const [specInput, setSpecInput] = useState("");
  const [specToggle, setSpecToggle] = useState(true);
  const [specCheck, setSpecCheck] = useState(true);
  const [specSegment, setSpecSegment] = useState<"a" | "b" | "c">("a");
  const [specSlider, setSpecSlider] = useState(42);
  const [specModal, setSpecModal] = useState(false);
  const [specSheet, setSpecSheet] = useState(false);
  const [specToast, setSpecToast] = useState(false);
  const [specLoading, setSpecLoading] = useState(false);
  const [motionKey, setMotionKey] = useState(0);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const exitToApp = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="sg">
      <aside className="sg__nav" aria-label="Design documentation navigation">
        <div className="sg__nav-brand">
          <span className="sg__nav-mark">NOVUS</span>
          <span className="sg__nav-meta">Design Language · v1</span>
        </div>

        {NAV.map((group) => (
          <React.Fragment key={group.group}>
            <p className="sg__nav-group">{group.group}</p>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sg__nav-item ${section === item.id ? "sg__nav-item--active" : ""}`}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </React.Fragment>
        ))}
      </aside>

      <main className="sg__main">
        <div className="sg__main-inner">
          <header className="sg__hero">
            <p className="sg__eyebrow">Design documentation</p>
            <h1 className="sg__h1">Novus Design Language</h1>
            <p className="sg__lead">
              부팅과 동시에 열리는 미디어 콘솔을 위한 시각 언어입니다. 어두운 캔버스 위에 반투명
              머티리얼을 얹어 깊이를 만들고, 액센트는 신호로만 쓰며, 가독성이 표현보다 항상
              우선합니다.
            </p>

            <div className="sg__toolbar">
              <GlassButton variant="secondary" size="sm" onClick={toggleTheme}>
                {isDark ? "Dark" : "Light"}
              </GlassButton>
              <div className="sg__toolbar-slider">
                <GlassSlider
                  label="Material"
                  value={intensity}
                  min={0}
                  max={100}
                  step={MATERIAL_INTENSITY_STEP}
                  onChange={setIntensity}
                  formatValue={(v) => `${v} · ${describeMaterialIntensity(v)}`}
                />
              </div>
              <GlassButton variant="ghost" size="sm" onClick={exitToApp}>
                Exit
              </GlassButton>
            </div>

            <p className="sg__note">
              이 문서는 브라우저 개발 서버 <code className="font-mono">/styleguide</code>에서만
              열리며 앱 런타임에는 포함되지 않습니다. 아래 예시는 모두 스펙시먼이고 실제 기능이
              아닙니다.
            </p>
          </header>

          {section === "overview" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Overview</h2>
              <p className="sg__section-desc">
                화면은 네 겹으로 구성됩니다. 앰비언트 필드(배경 빛) 위에 머티리얼 면이 올라가고, 그
                위에 콘텐츠와 신호색이 놓입니다. 깊이는 그림자보다 투명도와 블러의 차이로 만듭니다.
              </p>
              <div className="sg__grid">
                <article className="sg__tile">
                  <h3 className="sg__tile-title">Content first</h3>
                  <p className="sg__tile-body">
                    타이틀·시계·타일이 주인공입니다. 크롬은 얇고 조용하게 유지합니다.
                  </p>
                </article>
                <article className="sg__tile">
                  <h3 className="sg__tile-title">Depth by material</h3>
                  <p className="sg__tile-body">
                    한 면 위에 다른 면이 올라갈수록 블러가 강해집니다. 순서를 뒤집지 않습니다.
                  </p>
                </article>
                <article className="sg__tile">
                  <h3 className="sg__tile-title">Legibility wins</h3>
                  <p className="sg__tile-body">
                    표현과 가독성이 충돌하면 항상 가독성을 택합니다. 틴트 알파에는 하한이 있습니다.
                  </p>
                </article>
                <article className="sg__tile">
                  <h3 className="sg__tile-title">Motion explains</h3>
                  <p className="sg__tile-body">
                    모든 움직임은 방금 무슨 일이 일어났는지 설명합니다. 장식용 모션은 없습니다.
                  </p>
                </article>
              </div>
            </section>
          )}

          {section === "principles" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Principles</h2>
              <p className="sg__section-desc">화면을 그릴 때 매번 돌아오는 판단 기준입니다.</p>
              <div className="sg__pair">
                <div className="sg__rule sg__rule--do">
                  <p className="sg__rule-label">Do</p>
                  <p className="sg__rule-body">
                    한 화면에 하나의 시각적 초점. 여백을 충분히 주고 터치 타깃은 48px 이상.
                  </p>
                </div>
                <div className="sg__rule sg__rule--dont">
                  <p className="sg__rule-label">Don’t</p>
                  <p className="sg__rule-body">
                    무지개 그라데이션, 상시 글로우, 이모지 아이콘, 카드 안의 카드.
                  </p>
                </div>
                <div className="sg__rule sg__rule--do">
                  <p className="sg__rule-label">Do</p>
                  <p className="sg__rule-body">
                    시맨틱 토큰만 사용하고, 머티리얼은 역할(control · panel · overlay)로 고릅니다.
                  </p>
                </div>
                <div className="sg__rule sg__rule--dont">
                  <p className="sg__rule-label">Don’t</p>
                  <p className="sg__rule-body">
                    컴포넌트에 hex나 임의 블러·duration 하드코딩. 토큰을 우회하는 인라인 스타일.
                  </p>
                </div>
                <div className="sg__rule sg__rule--do">
                  <p className="sg__rule-label">Do</p>
                  <p className="sg__rule-body">
                    투명도 감소·모션 감소 설정과 블러 미지원 환경에서 자동으로 안전한 상태로 전환.
                  </p>
                </div>
                <div className="sg__rule sg__rule--dont">
                  <p className="sg__rule-label">Don’t</p>
                  <p className="sg__rule-body">
                    복잡한 배경 위에 얇은 틴트만 깔고 소형 텍스트를 올리기.
                  </p>
                </div>
              </div>
            </section>
          )}

          {section === "material" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Material</h2>
              <p className="sg__section-desc">
                모든 면은 틴트 + 헤어라인 엣지 + 상단 스펙큘러로 구성되고, 여기에 역할별 블러가
                더해집니다. 블러의 총량은 0–100 단일 값 하나로 조절되며, 세 역할은 항상 14 : 26 : 40
                비율을 유지합니다.
              </p>

              <div className="sg__specimen">
                <span className="sg__specimen-label">
                  Intensity · {intensity} ({describeMaterialIntensity(intensity)})
                </span>
                <GlassSlider
                  label="Material intensity"
                  value={intensity}
                  min={0}
                  max={100}
                  step={MATERIAL_INTENSITY_STEP}
                  onChange={setIntensity}
                />
                <div className="sg__canvas">
                  {[0, 25, 50, 75, 100].map((preset) => (
                    <GlassButton
                      key={preset}
                      variant={intensity === preset ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setIntensity(preset)}
                    >
                      {preset}
                    </GlassButton>
                  ))}
                </div>
                <p className="sg__mono">
                  --material-intensity: {(intensity / 100).toFixed(2)} · blur{" "}
                  {((intensity / 100) * 14).toFixed(0)} / {((intensity / 100) * 26).toFixed(0)} /{" "}
                  {((intensity / 100) * 40).toFixed(0)}px · tint alpha{" "}
                  {(1 - (intensity / 100) * 0.38).toFixed(2)}
                </p>
              </div>

              <div className="sg__stage">
                <p className="sg__stage-caption">
                  복잡한 배경 위 검증 스테이지 — 값을 올려가며 소형 텍스트 대비를 확인합니다
                </p>
                <div className="sg__stage-panel sg__stage-panel--control">
                  <p className="sg__stage-panel-title">Control</p>
                  <p className="sg__mono">×0.14 · chips, inputs</p>
                </div>
                <div className="sg__stage-panel sg__stage-panel--panel">
                  <p className="sg__stage-panel-title">Panel</p>
                  <p className="sg__mono">×0.26 · cards, shelves</p>
                </div>
                <div className="sg__stage-panel sg__stage-panel--overlay">
                  <p className="sg__stage-panel-title">Overlay</p>
                  <p className="sg__mono">×0.40 · modals, sheets</p>
                </div>
              </div>

              <div className="sg__pair">
                <div className="sg__rule sg__rule--do">
                  <p className="sg__rule-label">Bounded by design</p>
                  <p className="sg__rule-body">
                    100에서도 틴트 알파는 0.62에서 멈추고 헤어라인 엣지는 반대로 진해집니다. 값을
                    끝까지 올려도 면이 배경에 녹아 둥둥 떠 보이지 않습니다.
                  </p>
                </div>
                <div className="sg__rule sg__rule--dont">
                  <p className="sg__rule-label">Automatic fallback</p>
                  <p className="sg__rule-body">
                    0일 때는 backdrop-filter를 한 줄도 출력하지 않습니다. 블러 미지원 환경과
                    prefers-reduced-transparency에서는 강제로 0으로 내려갑니다.
                  </p>
                </div>
              </div>
            </section>
          )}

          {section === "color" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Color</h2>
              <p className="sg__section-desc">
                뉴트럴 니어-블랙 캔버스와 톤 레이어. 색은 위계를 만들고, 액센트는 상태를 알립니다.
              </p>
              <div className="sg__swatch-list">
                {COLORS.map((c) => (
                  <div key={c.token} className="sg__swatch-row">
                    <div className="sg__swatch-chip" style={{ background: c.css }} />
                    <div className="sg__swatch-meta">
                      <span className="sg__swatch-name">{c.name}</span>
                      <span className="sg__swatch-role">{c.role}</span>
                      <span className="sg__mono">{c.token}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === "type" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Typography</h2>
              <p className="sg__section-desc">
                디스플레이는 크고 타이트하게, 본문은 여유 있는 행간으로. 반투명 면 위에서는 행간을
                1.55 이상 유지합니다.
              </p>
              <div className="sg__board">
                {TYPE_ROWS.map((row) => (
                  <div key={row.label} className="sg__row">
                    <span style={row.style}>{row.sample}</span>
                    <span className="sg__mono">
                      {row.label} · {row.meta}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === "layout" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Layout</h2>
              <p className="sg__section-desc">8px 그리드, 역할별 라디우스, 세 단계 엘리베이션.</p>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Spacing</span>
                {SPACING.map((px) => (
                  <div key={px} className="sg__space-row">
                    <span className="sg__mono">{px}px</span>
                    <div className="sg__space-bar" style={{ width: px * 2.5 }} />
                  </div>
                ))}
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Radius</span>
                <div className="sg__radius-row">
                  {RADII.map((r) => (
                    <div key={r.token} className="sg__radius-item">
                      <div className="sg__radius-box" style={{ borderRadius: `var(${r.token})` }} />
                      <span className="sg__mono">
                        {r.name} · {r.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Elevation</span>
                <div className="sg__canvas">
                  <GlassCard elevation="flat" className="p-5" style={{ width: 168 }}>
                    <span className="text-sm font-semibold">Flat</span>
                    <p className="sg__tile-body">인라인 패널</p>
                  </GlassCard>
                  <GlassCard elevation="raised" className="p-5" style={{ width: 168 }}>
                    <span className="text-sm font-semibold">Raised</span>
                    <p className="sg__tile-body">모달 · 토스트</p>
                  </GlassCard>
                  <GlassCard elevation="floating" className="p-5" style={{ width: 168 }}>
                    <span className="text-sm font-semibold">Floating</span>
                    <p className="sg__tile-body">메뉴 · 시트</p>
                  </GlassCard>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">SubpageDock (Internal Navigation)</span>
                <div
                  className="in-app-player--dock-right"
                  style={{
                    position: "relative",
                    height: "210px",
                    border: "1px dashed var(--glass-border)",
                    borderRadius: "16px",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SubpageDock
                    title="미디어 갤러리"
                    dockPosition="right"
                    onHome={() => undefined}
                    onBack={() => undefined}
                    onReload={() => undefined}
                  />
                  <span className="text-xs text-secondary">
                    모든 내부 기능에서 홈, 뒤로, 시계와 상황별 액션을 같은 위치에 제공합니다.
                  </span>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">PathNavigation (Filesystem Hierarchy)</span>
                <PathNavigation
                  items={[
                    { label: "사진", path: "/Pictures" },
                    { label: "여행", path: "/Pictures/Travel" },
                    { label: "제주", path: "/Pictures/Travel/Jeju" },
                  ]}
                  canGoUp
                  onUp={() => undefined}
                  onNavigate={() => undefined}
                />
                <p className="sg__tile-body">
                  시스템 독의 뒤로가기는 방문 기록, 위쪽 화살표는 부모 폴더, 브레드크럼은 지정한
                  조상 폴더로 이동합니다. 세 동작의 의미를 섞지 않습니다.
                </p>
              </div>
            </section>
          )}

          {section === "motion" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Motion</h2>
              <p className="sg__section-desc">
                모션은 장식이 아니라 방금 무슨 일이 일어났는지 설명하는 문법입니다. 모든 인터랙션은
                아래 여섯 개 레시피 중 하나로 정확히 대응되며, 컴포넌트는 duration을 직접 쓰지 않고
                레시피를 참조합니다.
              </p>

              <div className="sg__board">
                {MOTION_RECIPES.map((recipe) => (
                  <div key={recipe.name} className="sg__motion-row">
                    <span className="sg__motion-name">{recipe.name}</span>
                    <div className="sg__motion-meta">
                      <span className="sg__motion-trigger">{recipe.trigger}</span>
                      <span className="sg__motion-effect">{recipe.effect}</span>
                    </div>
                    <span className="sg__mono">{recipe.token}</span>
                  </div>
                ))}
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Live specimens</span>
                <div className="sg__canvas">
                  <div className="sg__state">
                    <span className="sg__mono">press</span>
                    <button type="button" className="sg__motion-chip motion-press">
                      Press me
                    </button>
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">lift</span>
                    <div className="sg__motion-chip motion-lift">Hover me</div>
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">reveal / emerge</span>
                    <div key={motionKey} className="sg__canvas">
                      <span className="sg__motion-chip animate-in motion-reveal">reveal</span>
                      <span className="sg__motion-chip animate-in motion-emerge">emerge</span>
                    </div>
                    <GlassButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setMotionKey((k) => k + 1)}
                    >
                      Replay
                    </GlassButton>
                  </div>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Icon motion catalog</span>
                <div className="sg__icon-motion-grid">
                  {ICON_MOTION_RECIPES.map((recipe) => (
                    <button
                      type="button"
                      className="sg__icon-motion-sample"
                      key={recipe.name}
                      aria-label={`${recipe.name}: ${recipe.usage}`}
                    >
                      <MotionIcon motion={recipe.motion} active={recipe.active}>
                        {recipe.icon}
                      </MotionIcon>
                      <strong>{recipe.name}</strong>
                      <span>{recipe.usage}</span>
                    </button>
                  ))}
                </div>
                <p className="sg__tile-body">
                  모든 제품 아이콘 모션은 <code className="font-mono">MotionIcon</code>의 명명된
                  프리셋을 사용합니다. Pop·Rotate·Tilt·Nudge는 상위 터치 타깃의 hover/focus에서만
                  실행하고, Spin·Pulse·Breathe는 실제 진행 상태에서만 active로 실행합니다.
                </p>
              </div>

              <div className="sg__pair">
                <div className="sg__rule sg__rule--do">
                  <p className="sg__rule-label">Do</p>
                  <p className="sg__rule-body">
                    transform과 opacity만 애니메이션합니다. 이동 거리가 클수록 긴 duration을 씁니다.
                  </p>
                </div>
                <div className="sg__rule sg__rule--dont">
                  <p className="sg__rule-label">Don’t</p>
                  <p className="sg__rule-body">
                    레이아웃 속성, 컬러 램프, 블러 반경을 애니메이션하거나 상시 반복 모션을 두는 것.
                  </p>
                </div>
              </div>

              <p className="sg__note">
                <code className="font-mono">prefers-reduced-motion: reduce</code>에서는 모든 이동이
                제거되고 상태 변화만 즉시 반영됩니다. 반복 모션(시머·무한 진행바)은 완전히
                정지합니다.
              </p>
            </section>
          )}

          {section === "actions" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Actions &amp; Inputs</h2>
              <p className="sg__section-desc">
                사용자가 직접 조작하는 컨트롤. 모든 상태(default · hover · focus · active · disabled
                · error)를 정의합니다.
              </p>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Button</span>
                <div className="sg__canvas">
                  <GlassButton variant="primary">Primary</GlassButton>
                  <GlassButton variant="secondary">Secondary</GlassButton>
                  <GlassButton variant="glass">Tertiary</GlassButton>
                  <GlassButton variant="ghost">Ghost</GlassButton>
                </div>
                <div className="sg__canvas">
                  <GlassButton size="sm" variant="secondary">
                    Small
                  </GlassButton>
                  <GlassButton size="md" variant="secondary">
                    Medium
                  </GlassButton>
                  <GlassButton size="lg" variant="secondary">
                    Large
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    isLoading={specLoading}
                    onClick={() => {
                      setSpecLoading(true);
                      window.setTimeout(() => setSpecLoading(false), 1800);
                    }}
                  >
                    Loading
                  </GlassButton>
                  <GlassButton variant="secondary" disabled>
                    Disabled
                  </GlassButton>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Text field</span>
                <div className="sg__state-grid">
                  <div className="sg__state">
                    <span className="sg__mono">default</span>
                    <GlassInput
                      label="Label"
                      placeholder="Placeholder"
                      value={specInput}
                      onChange={(e) => setSpecInput(e.target.value)}
                    />
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">error</span>
                    <GlassInput label="Label" defaultValue="Invalid value" error="Error message" />
                  </div>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Selection</span>
                <div className="sg__state-grid">
                  <div className="sg__state">
                    <span className="sg__mono">switch</span>
                    <GlassToggle
                      label="Label"
                      description="Supporting text"
                      checked={specToggle}
                      onChange={setSpecToggle}
                    />
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">checkbox</span>
                    <GlassCheckbox
                      label="Label"
                      description="Supporting text"
                      checked={specCheck}
                      onChange={setSpecCheck}
                    />
                    <GlassCheckbox
                      label="Mixed"
                      indeterminate
                      checked={false}
                      onChange={() => undefined}
                    />
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">segmented</span>
                    <GlassSegmentedControl
                      value={specSegment}
                      onChange={setSpecSegment}
                      options={[
                        { id: "a", label: "One" },
                        { id: "b", label: "Two" },
                        { id: "c", label: "Three" },
                      ]}
                    />
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">slider</span>
                    <GlassSlider label="Value" value={specSlider} onChange={setSpecSlider} />
                  </div>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Menu &amp; Tooltip</span>
                <div className="sg__canvas">
                  <GlassMenu
                    trigger={
                      <GlassButton variant="secondary" size="sm">
                        Open menu
                      </GlassButton>
                    }
                    items={[
                      { id: "one", label: "First action" },
                      { id: "two", label: "Second action" },
                      { id: "three", label: "Disabled action", disabled: true },
                      { id: "four", label: "Destructive action", tone: "danger" },
                    ]}
                  />
                  <GlassTooltip content="Short clarification">
                    <GlassButton variant="ghost" size="sm">
                      Hover for tooltip
                    </GlassButton>
                  </GlassTooltip>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">System &amp; Media Icons</span>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                    alignItems: "center",
                    padding: "12px",
                    background: "var(--glass-bg)",
                    borderRadius: "12px",
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <FolderIcon size={20} /> Folder
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ImageIcon size={20} /> Image
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <VideoIcon size={20} /> Video
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <DocumentIcon size={20} /> Document
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ArchiveIcon size={20} /> Archive
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <PlayIcon size={20} /> Play
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <GridIcon size={20} /> Grid
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ListIcon size={20} /> List
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CloseIcon size={20} /> Close
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ChevronRightIcon size={20} /> Chevron
                  </div>
                </div>
                <p className="sg__tile-body mt-2">
                  애플리케이션 전반에서 일관되게 사용되는 파일시스템 및 미디어 제어 벡터
                  아이콘입니다.
                </p>
              </div>
            </section>
          )}

          {section === "feedback" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Feedback</h2>
              <p className="sg__section-desc">
                시스템이 지금 무엇을 하고 있는지 알리는 요소. 끝을 아는 작업에는 항상 결정적
                진행률을 씁니다.
              </p>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Badge</span>
                <div className="sg__canvas">
                  <GlassBadge variant="primary">Primary</GlassBadge>
                  <GlassBadge variant="secondary">Secondary</GlassBadge>
                  <GlassBadge variant="neutral">Neutral</GlassBadge>
                  <GlassBadge variant="accent">Accent</GlassBadge>
                  <GlassBadge variant="outline">Outline</GlassBadge>
                  <GlassBadge variant="primary" pulse>
                    Live
                  </GlassBadge>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Progress</span>
                <div className="sg__state-grid">
                  <div className="sg__state">
                    <span className="sg__mono">determinate</span>
                    <GlassProgress label="Loading" value={64} showValue />
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">indeterminate</span>
                    <GlassProgress label="Working" />
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">tones</span>
                    <GlassProgress value={92} tone="success" />
                    <GlassProgress value={38} tone="warning" />
                  </div>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Skeleton</span>
                <div className="sg__state-grid">
                  <div className="sg__state">
                    <span className="sg__mono">text</span>
                    <GlassSkeleton variant="text" lines={3} />
                  </div>
                  <div className="sg__state">
                    <span className="sg__mono">block + circle</span>
                    <GlassSkeleton variant="block" height={64} />
                    <GlassSkeleton variant="circle" width={36} height={36} />
                  </div>
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Empty state</span>
                <GlassEmptyState
                  size="sm"
                  title="아직 항목이 없습니다"
                  description="빈 화면에는 반드시 다음에 할 일 하나를 제시합니다."
                  action={
                    <GlassButton variant="primary" size="sm">
                      Primary action
                    </GlassButton>
                  }
                />
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Toast</span>
                <div className="sg__canvas">
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSpecToast(false);
                      window.setTimeout(() => setSpecToast(true), 40);
                    }}
                  >
                    Toast specimen
                  </GlassButton>
                </div>
              </div>
            </section>
          )}

          {section === "surfaces" && (
            <section className="sg__section">
              <h2 className="sg__section-title">Surfaces</h2>
              <p className="sg__section-desc">
                콘텐츠를 담는 면과 그 위에 겹치는 레이어. 겹칠수록 블러와 그림자가 한 단계씩
                강해집니다.
              </p>

              <div className="sg__specimen">
                <span className="sg__specimen-label">List row</span>
                <div className="sg__board sg__board--tight">
                  <GlassListRow
                    label="Row label"
                    description="Supporting description"
                    trailing={<GlassToggle checked={specToggle} onChange={setSpecToggle} />}
                  />
                  <GlassDivider />
                  <GlassListRow label="Actionable row" trailing="Value" onClick={() => undefined} />
                  <GlassDivider />
                  <GlassListRow
                    label="Disabled row"
                    trailing="—"
                    onClick={() => undefined}
                    disabled
                  />
                </div>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Divider</span>
                <GlassDivider />
                <GlassDivider label="Section" />
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">Overlay</span>
                <div className="sg__canvas">
                  <GlassButton variant="secondary" size="sm" onClick={() => setSpecModal(true)}>
                    Modal specimen
                  </GlassButton>
                  <GlassButton variant="secondary" size="sm" onClick={() => setSpecSheet(true)}>
                    Sheet specimen
                  </GlassButton>
                </div>
                <p className="sg__tile-body">
                  뒤 맥락을 계속 보여줘야 하면 시트를, 결정을 강제해야 하면 모달을 씁니다.
                </p>
              </div>

              <div className="sg__specimen">
                <span className="sg__specimen-label">
                  GlassMediaTile (1:1 Full Cover + Bottom Tint)
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: "16px",
                    maxWidth: "600px",
                  }}
                >
                  <GlassMediaTile
                    title="vacation_photo.jpg"
                    typeLabel="JPG"
                    sizeLabel="3.4 MB"
                    category="image"
                    onClick={() => undefined}
                  />
                  <GlassMediaTile
                    title="action_cam_trailer.mp4"
                    typeLabel="MP4"
                    sizeLabel="48 MB"
                    category="video"
                    onClick={() => undefined}
                  />
                  <GlassMediaTile
                    title="Documents & Projects"
                    typeLabel="Folder"
                    category="directory"
                    onClick={() => undefined}
                  />
                </div>
                <p className="sg__tile-body mt-2">
                  사진/비디오 갤러리의 표준 타일 컴포넌트입니다. 썸네일이 1:1로 꽉 차고, 하단 반투명
                  오버레이에 파일명과 속성이 표시됩니다.
                </p>
              </div>
            </section>
          )}
        </div>
      </main>

      <GlassModal
        isOpen={specModal}
        onClose={() => setSpecModal(false)}
        title="Modal title"
        description="Supporting description for the dialog specimen."
        footer={
          <div className="flex gap-2">
            <GlassButton variant="ghost" size="md" onClick={() => setSpecModal(false)}>
              Secondary
            </GlassButton>
            <GlassButton variant="primary" size="md" onClick={() => setSpecModal(false)}>
              Primary
            </GlassButton>
          </div>
        }
      >
        <p className="text-sm text-secondary leading-relaxed">
          Body content area. Overlay uses the strongest blur tier and dismisses on Escape.
        </p>
      </GlassModal>

      <GlassSheet
        isOpen={specSheet}
        onClose={() => setSpecSheet(false)}
        title="Sheet title"
        description="Edge-docked panel for secondary flows."
        footer={
          <GlassButton variant="primary" size="md" onClick={() => setSpecSheet(false)}>
            Done
          </GlassButton>
        }
      >
        <GlassListRow label="Row label" description="Supporting description" trailing="Value" />
        <GlassDivider />
        <GlassListRow label="Another row" trailing="Value" onClick={() => undefined} />
      </GlassSheet>

      <GlassToast
        isOpen={specToast}
        onClose={() => setSpecToast(false)}
        title="Toast"
        message="Short confirmation message"
        type="success"
        duration={2600}
      />
    </div>
  );
};
