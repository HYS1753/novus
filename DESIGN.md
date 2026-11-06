---
name: Novus
description: A night-frame home hub for an old Windows tablet. The photo and the service brands carry the colour; the chrome stays neutral, opaque, and still.
colors:
  ink: "#111110"
  ink-dark: "#ffffff"
  ground: "#f3f3f1"
  ground-dark: "#0a0a0c"
  surface: "#e9e9e6"
  surface-dark: "#151518"
  surface-raised: "#dcdcd8"
  surface-raised-dark: "#222227"
  rule: "#dcdcd8"
  rule-dark: "#222227"
  rule-strong: "#c4c4bf"
  rule-strong-dark: "#34343b"
  text-2: "#3f3f3b"
  text-2-dark: "#bcbcc5"
  text-3: "#64645f"
  text-3-dark: "#8e8e99"
  text-disabled: "#9c9c97"
  text-disabled-dark: "#5c5c66"
  inverse: "#ffffff"
  inverse-dark: "#000000"
  live: "#d70015"
  live-dark: "#ff453a"
  attention: "#a15c00"
  attention-dark: "#ffb340"
  sun: "#c8102e"
  sun-dark: "#ff6b6b"
  sat: "#1f5fd1"
  sat-dark: "#7aa7ff"
  frame: "#000000"
  on-media: "#ffffff"
  on-media-2: "rgba(255, 255, 255, 0.78)"
  media-glyph-bg: "rgba(0, 0, 0, 0.38)"
  media-glyph-edge: "rgba(255, 255, 255, 0.28)"
typography:
  numeral:
    fontFamily: "Segoe UI Variable Display, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "192px"
    fontWeight: 700
    lineHeight: 0.86
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  display:
    fontFamily: "Segoe UI Variable Display, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  clock:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
  caption:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  content: "4px"
  action: "4px"
  glyph: "50%"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  space-7: "48px"
  space-8: "64px"
  gutter: "40px"
  target: "48px"
  target-glyph: "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "0 24px"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "0 24px"
    height: "48px"
  button-quiet-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  button-primary-on-media:
    backgroundColor: "{colors.on-media}"
    textColor: "{colors.frame}"
    rounded: "{rounded.action}"
    height: "48px"
  glyph:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.glyph}"
    size: "56px"
  glyph-on-media:
    backgroundColor: "{colors.media-glyph-bg}"
    textColor: "{colors.on-media}"
    rounded: "{rounded.glyph}"
    size: "56px"
  service-plate:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.content}"
  segmented-option-checked:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.action}"
    height: "40px"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "0 16px"
    height: "48px"
  list-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "12px 0"
    height: "64px"
  toast:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
    padding: "0 12px 0 24px"
    height: "48px"
---

# Design System: Novus

## Overview

**Creative North Star: "The Night Frame, the Day Page" (밤의 액자, 낮의 한 장)**

Novus v2 is a photo frame that happens to run a media console. The home opens as one full-bleed photograph with a single caption on it: whatever is still running, at display size, with one press to resume. One snap down folds that same photo up into a band, and under it sits today's page: the date with a large clock beside it and the month calendar on top, the service tiles across the full width in two rows, and a quiet explorer row at the bottom. Left alone for the ambient delay (10 minutes by default), the frame drops its chrome and keeps only the photo, the clock, and the date.

Everything Novus draws itself is neutral, opaque, and still. The ground is a near-black ramp at night and a warm off-white by day; type is ink on ground or white over the photo. Colour arrives only from the photograph and from the official brand plates of the streaming services. Four semantic hues exist, and each has exactly one job. Depth comes from the photo and its scrim, not from glass or shadows; the only animated properties are transform and opacity, so the Surface Pro 4's HD 515 never has to repaint a blurred layer.

The system runs on two axes set on the `NvRoot` element: theme (`system`, `light`, `dark`) and posture (`tablet` for the hand at 30–50 cm, `tv` for the sofa at 1–2 m). Every type size and space is authored on the 1368×912 reference frame and multiplied by `--nv-scale` = posture factor × viewport factor (window height ÷ 912, clamped 0.82–1.6), like a TV platform's density-independent units; touch targets grow with the viewport and never drop below their posture floor. Every v2 surface lives under `.nv-root`; the v1 screens that still exist (gallery, finder, viewer, video, streaming dock) are pulled into the same world by the bridge.

**Key Characteristics:**

- One frame, then one page: a full-bleed photo with one caption, folding into a band over today's page.
- No colour of its own: ink, ground, and a 9-step neutral ramp; four semantic hues with one job each.
- Circle is a global action; rectangle is content and the actions that belong to it.
- Opaque everywhere. The photo scrim is the only translucency, and it never becomes blur.
- System faces only (Segoe UI Variable first, then locale CJK faces); no web fonts.
- Two postures, one layout: sizes scale by 1 (tablet) or 1.25 (TV), times the viewport factor; targets have per-posture floors.

## Colors

Restrained and achromatic: a single neutral ramp (n0–n8) in two themes, with colour reserved for photos, service brands, and four semantic marks.

### Primary

- **Ink** (light #111110 / dark #ffffff, ramp n8): body text, the filled primary button, the checked segmented option, the filled toggle, today's circle on the calendar, and the focus ring. Novus's "primary" is its text colour; there is no brand accent.

### Semantic hues (each has one job)

- **Live Red** (light #d70015 / dark #ff453a): a streaming session is running. Status dot and "실행 중" label only.
- **Attention Amber** (light #a15c00 / dark #ffb340): something needs the user: a field error, a failed load, an update ready. Never decoration.
- **Sunday Red** (light #c8102e / dark #ff6b6b): Sunday dates in the month calendar only.
- **Saturday Blue** (light #1f5fd1 / dark #7aa7ff): Saturday dates in the month calendar only.

### Neutral

The ramp, light then dark: n0 #ffffff / #000000, n1 #f3f3f1 / #0a0a0c, n2 #e9e9e6 / #151518, n3 #dcdcd8 / #222227, n4 #c4c4bf / #34343b, n5 #9c9c97 / #5c5c66, n6 #64645f / #8e8e99, n7 #3f3f3b / #bcbcc5, n8 #111110 / #ffffff. Components use only the roles derived from it:

- **Ground** (n1; #f3f3f1 / #0a0a0c): page background, sheets, dialogs, today's page.
- **Surface** (n2; #e9e9e6 / #151518): plates, glyph circles, fields, quiet-button hover.
- **Surface Raised** (n3; #dcdcd8 / #222227): toasts, hover on glyphs, disabled primary fill.
- **Rule** (n3) and **Rule Strong** (n4; #c4c4bf / #34343b): hairlines and table rules; button, field, and toggle borders.
- **Text 2** (n7; #3f3f3b / #bcbcc5), **Text 3** (n6; #64645f / #8e8e99), **Text Disabled** (n5; #9c9c97 / #5c5c66): secondary copy, hints and section labels, disabled controls.
- **Inverse** (n0): the opposite pole of the ramp.

### Over media (theme-independent)

- **Frame Black** (#000000): what sits behind a photo before it loads; the home and onboarding background.
- **On Media** (#ffffff) and **On Media 2** (rgba(255,255,255,0.78)): all chrome over a photo is white in both themes.
- **Media Glyph** (fill rgba(0,0,0,0.38), edge rgba(255,255,255,0.28); hover fill rgba(0,0,0,0.55)): glyph circles over a photo.
- **Photo Scrim**: a bottom-up gradient from black at `0.78 + material-intensity × 0.17` to 55% of that at 38% height, then clear. It covers the bottom 44% of the frame.

### Named Rules

**The No Hue Of Its Own Rule.** Novus chrome never carries a hue. Icons inherit `currentColor`, the v1 "primary" is remapped to ink, and colour on screen comes only from the photo and the official service plates.

**The One Job Rule.** Each semantic hue has exactly one job: live = a running session, attention = the user is needed, sun and sat = weekend dates on the calendar. A hue that appears anywhere else is a defect.

**The White Over Photo Rule.** Over a photograph, chrome is white (#ffffff, secondary at 78%) whatever the theme; the focus ring turns white there too.

## Typography

**Display Font:** Segoe UI Variable Display (with Segoe UI, Malgun Gothic, Apple SD Gothic Neo, Yu Gothic UI, Hiragino Sans, Microsoft YaHei UI, PingFang SC, system-ui)
**Body Font:** Segoe UI Variable Text (same fallback chain)

**Character:** The OS's own face, set heavy and tight at display size and plain at reading size. `:lang(ja)` and `:lang(zh)` reorder the chain so Yu Gothic UI / Hiragino or Microsoft YaHei UI / PingFang come before Malgun Gothic. Font synthesis is off.

### Hierarchy

Sizes are tablet posture on the 1368×912 reference frame; TV posture multiplies by 1.25 (value in parens), and every value also scales with window height ÷ 912.

- **Numeral** (700, 150px (188px), line-height 0.8, -0.04em, tabular figures): today's date on today's page, beside the weekday, month, and day-of-year stack. Capped at 19% of the frame height.
- **Display** (800, 64px (80px), line-height 1.02, -0.035em): the caption title over the photo, the onboarding title, the streaming loader title, the ambient clock.
- **Clock** (600, 36px (45px), line-height 1): the frame clock. Today's page sets its time in the numeral type (700, 84px × scale) beside the date, with the day-period marker split out above it, because the time matters as much as the day.
- **Title** (700, 28px (35px), -0.02em on sheets): sheet and dialog titles, the weekday.
- **Heading** (600, 20px (25px)): section heads ("서비스", the month), empty-state titles, large buttons.
- **Body** (400, 16px (20px), line-height 1.5): reading text, row titles at 600, field input, caption state and context lines.
- **Label** (700, 14px (17.5px), line-height 1.2): buttons, plate names, segmented options, field labels, list-section titles.
- **Caption** (700, 12px (15px), line-height 1.2): status labels, glyph labels, calendar weekday heads, hints.

### Named Rules

**The No Eyebrow Rule.** Nothing sits above a title. No kicker, no small uppercase category line: the caption starts with its display title, and section titles are plain headings.

**The System Face Rule.** Novus ships no web font. Every face is already on the device; the fallback chain exists so Korean, Japanese, and Chinese each get their own native face.

## Layout

The home is a vertical scroller with mandatory snap and two frames, each 100% of the viewport.

- **Frame one (the photo frame):** full-bleed photo, wordmark top-left and clock plus date top-right (inset 32px top, 48px sides), the caption lower-left (48px from the left, 76px from the bottom, max 720px wide), the vertical glyph rail on the right edge (32px in, vertically centred in TV posture; in tablet posture it drops to the bottom right, 76px up, within thumb reach), and a "오늘 · 서비스" hint bottom centre.
- **Frame two (today's page):** the photo band (13% of the frame height) with the logo left, search/theme/settings glyphs right, and a centred "사진 ⌃" hint at the top that mirrors frame one's "오늘 · 서비스 ⌄" hint (same chevron, same type) and snaps back to the photo. Under it, on ground, a grid of 0.82fr / 1.18fr: Row 1: the glance, one unit on a shared baseline: the date numeral beside weekday, month and day-of-year, a 1px rule, then the time set in the same numeral type a size down (84px × scale, capped at 10.5% of the frame and 6vw) with the day-period marker ("오후") small above it and the weather under it | the month calendar (row height capped at 3.4% of the frame). Row 2, full width: services as uniform 16:9 tiles in exactly two rows. The column count (4–9) is measured from the height left over after rows 1 and 3, so tiles are as large as the frame allows; services, then All apps, then dashed reserved slots fill the remaining cells so new services have a place. Row 3, full width: the explorer row (탐색기: gallery, locations, files, radio on the left; ambient and the "준비 중" remote on the right), all quiet text actions (icon + label, no box) divided by 1px rule-strong hairlines at 36% of the row height, never outlined buttons. The grid is vertically centred with `safe` alignment and fits one screen from 1280×800 to 1920×1080.
- **Ambient:** frame one only; caption, rail, and hint fade out; the clock moves to the bottom right at display size with the date at heading size.
- **Sheets** sit on the right, 480px wide (×scale), full height. **Dialogs** are centred, 520px wide, inset by the 40px gutter.

Spacing is an 8px rhythm scaled by posture: 4, 8, 12, 16, 24, 32, 48, 64 (TV: 5, 10, 15, 20, 30, 40, 60, 80), times the viewport factor, with a 40px screen gutter (viewport-scaled). Touch targets have posture floors: 48px buttons and 56px glyph circles in tablet posture, 64px and 72px in TV posture; they grow with the viewport factor.

**The Posture Rule.** One layout serves both postures. Posture changes the scale (1 or 1.25) and the targets (48/56 or 64/72), and moves the rail within thumb reach in tablet posture; it never forks the composition.

## Elevation & Depth

Novus is flat and opaque. Depth comes from the photograph and from the order of planes (photo, scrim, chrome), not from shadows or glass. Every v2 surface is a solid ramp colour; overlays dim the screen with an opaque-tone backdrop (rgba(0,0,0,0.6)) and slide a solid sheet in.

### Shadow Vocabulary

- **Clock lift** (`text-shadow: 0 1px 12px rgba(0,0,0,0.35)`): the frame clock only, for legibility over bright photos.
- **Bridge float** (`0 12px 32px rgba(0,0,0,0.32)` raised, `0 16px 40px rgba(0,0,0,0.4)` floating): kept only for v1 floating menus inside the bridge. v2 components have no box-shadow.

### Scrims (the only translucency)

- **Bottom scrim:** the photo scrim token over the bottom 44% of frame one. It stops below the photo's focal light (horizon at roughly 0.55–0.62 of the height) so the sun keeps its value.
- **Top scrim:** rgba(0,0,0,0.38) to clear over the top 160px, behind the wordmark and clock.
- **Ambient corner:** a radial rgba(0,0,0,0.55) ellipse behind the bottom-right clock; the bottom scrim fades out.
- **Band fade:** from transparent to ground over 60% of the band height, so the folded photo melts into today's page in both themes.
- **Onboarding scrim:** left-to-right from the scrim strength to 0.1.

### Named Rules

**The Opaque Rule.** No `backdrop-filter`, no glass, no frosting. Material intensity (0–100) deepens the scrim; it never turns into blur.

**The Scrim-Only Gradient Rule.** Gradients exist only as scrims over a photo (and as the slider's fill). No decorative gradient on chrome.

## Shapes

Two shapes carry meaning. Rectangles have gently squared corners (4px for content and for content actions). Circles (50%) are global actions: the glyph rail on the home and the theater rail, where home is the one filled circle.

Rectangles: buttons, service plates, fields, dialogs, segmented options (the segmented track is 7px, the option radius plus its 3px padding), toasts, the onboarding posture cards. Hairline rules (1px) separate list rows, calendar weeks, and sheet sections; controls use a 2px border.

Small circles that are not pressable are markers, not actions: the status dot (0.62em) and today's date on the calendar. The toggle is a rectangular switch (4px track, 2px thumb) under the rectangle rule; the slider thumb is a circle.

**The Circle Means Global Rule.** A circle is an action reachable from anywhere (search, gallery, files, remote, settings, home). A rectangle is content, or an action that belongs to the content it sits on (이어서 보기, 세션 종료). If a control only acts on the thing beside it, it is a rectangle.

## Components

### Buttons

Rectangular, bold, and quiet unless primary.

- **Shape:** gently squared (4px), min height = target (48px; TV 64px), 0 24px padding, label type at 700. Large variant: target + 8px, 0 32px, heading size.
- **Primary:** ink fill, ground text (light #111110 on #f3f3f1; dark #ffffff on #0a0a0c). Over a photo: white fill, black text.
- **Secondary:** transparent with a 2px rule-strong border, ink text; hover darkens the border to text-3. Over a photo the border is On Media 2 and the text white.
- **Quiet:** no border, text-2; hover fills with surface and lifts text to ink.
- **Press:** scale 0.97 over 90ms. **Disabled:** rule border, disabled text; disabled primary fills with surface-raised.

### Glyph rail (signature)

The circle grammar. Each glyph is a 56px circle (TV 72px) on surface with a 1px rule edge, a 22px icon (×scale), and a caption-size bold label under it. Hover fills surface-raised; press scales 0.97. Over a photo the circle is rgba(0,0,0,0.38) with a white 28% edge. A "준비 중" hint marks unbuilt entries and dims the circle to 60%. Rails stack vertically with 16px gaps.

### Theater rail (the dock)

The dock beside streaming, gallery, and finder (`shared/ui/nav/SubpageDock.tsx`, `dock.css`). The streaming page is a native view that nothing can float over, so the rail sits beside it like a TV bezel. Benchmarked on iPadOS Stage Manager (running apps as thumbnails), the Android tablet / DeX taskbar (no outlines; running state as a pill), and the tvOS / Google TV side nav (plain glyphs; a platter only on focus).

- Always dark (#0a0a0c, 1px #222227 rule toward the content) whatever the theme: it frames video.
- Top: the clock (label, bold, tabular) and the page name (caption, text-3, one line with ellipsis).
- Middle, filling the rest: "실행 중 N" and each running service as a 16:9 plate (the same art as its home tile). The one on screen is at full strength with a 4px ink pill at the rail's inner edge (under it on a bottom dock); the others sit at 55% and come up on hover. A 22px round × on each plate's corner ends that session (hit area +10px).
- Tools: plain glyphs (reload, fullscreen, open externally, settings) at the touch target, text-2, no platter at rest; a #222227 circle on hover, focus, or while pressed (fullscreen on).
- End: back (platter circle) and home (the one filled white circle), after a rule, within thumb reach in tablet posture.
- Width: the glyph target + 2 × 14px × scale + 12px; on a bottom dock the same groups run left to right as a taskbar.

### Launch screen

While a service connects (`widgets/in-app-player/ui/InAppLoader.tsx`): centred on ground, the service's plate at 240px × scale over a bloom of its own art (blurred once; only opacity 0.35–0.75 and scale 1.04–1.22 animate, 2.4s alternate; 0.15–0.35 on light ground so a dark plate does not read as a shadow), a soft light band sweeping across the plate every 2.2s as the progress, the name at title size, one status line, and "독립 플레이어로 열기". After the slow-load delay the DRM hint, retry, and home follow. Reduced motion holds everything still. The sheen is the one gradient outside the photo scrim, and it only exists while loading.

### Service plates (signature)

The rectangle grammar. A 4px plate on surface: a 16:9 brand field on the service's own ground (Netflix #000000, YouTube #ffffff, Disney+ #0b1d4d, TVING #000000, Wavve #1a3cff, Watcha #0d0d0f, Coupang Play #000000) showing the official asset (key art covers, wide wordmarks are contained inside a per-brand inset positioned from the field's edges), then a 36px bar with the name in label type and either the number-key shortcut (text-3, tabular) or the session state. Narrow plates (under 170px) keep the name whole and reduce the state to its dot. An ended session dims the field to 45%.

### Status

An inline dot plus label at caption size, bold. Live: live red; attention: amber; ended: text-3 with a hollow 2px ring; neutral: no dot. Over a photo the label is white and only the live dot stays red.

### Caption (signature)

The frame caption over a photo, in a fixed order: the **title** at display size first, then a **state line** (status at body size), then one **context line** in On Media 2, then actions with 12px gaps. Nothing sits above the title. Shipped examples:

- Running: title "Netflix", state "실행 중", context "확인 키로 바로 복귀", actions "이어서 보기" (primary), "{name} 열기", "세션 종료".
- Ended: state "마지막 사용 · {time}", context "세션이 끝났어요 · 다시 열면 첫 화면부터".
- Nothing running: title "좋은 저녁이에요", context "서비스를 고르면 여기서 이어서 볼 수 있어요".

### Inputs / Fields

- **Style:** surface fill, 2px rule-strong border, 4px, min height 48px, 0 16px padding, body-size input; label above in label type, hint below in caption text-3.
- **Focus:** the border turns ink (focus-within).
- **Error:** border and message in attention amber.

### Selection controls

- **Segmented:** a surface track with a 1px rule and 3px inset; options are 40px (target − 8px) rectangles in label type; the checked option is ink on ground.
- **Toggle:** 52×32px track (×scale) with a 2px rule-strong border; on, the track fills ink and the 24px thumb turns ground and travels 20px.
- **Slider:** a 6px track filled ink up to the value over rule-strong, with a 24px ink thumb ringed 3px in ground.

### Lists, sheets, dialogs, toasts

- **List rows:** min height target + 16px, 12px vertical padding, 1px rule under each row; title body 600, description label text-3, value label text-2 capped at 45% width. Pressable rows hover to surface.
- **Sheet:** ground, 1px rule left edge, title size head, slides in 32px from the right over 420ms.
- **Dialog:** ground, 1px rule, 4px, 32px padding, rises 8px over 200ms.
- **Toast:** surface-raised, 4px, target height, status at label size.
- **Empty state:** centred 40px icon in text-3, heading title, body capped at 44ch.

### Month calendar

A fixed table: weekday heads in caption text-3, weeks divided by 1px rules, dates in body 500. Sundays in Sunday red, Saturdays in Saturday blue, outside days disabled; today is a filled ink circle (1.75em on the home) with ground text at 800.

### Focus ring

One focus language everywhere: a solid 4px outline in ink (focus token = n8), offset 3px, shown on `:focus-visible` only. It never changes layout. On media the ring is white. On glyphs the ring wraps the circle, not the label. Arrow-key spatial navigation runs from `NvRoot`, so every control must be reachable and visibly ringed by keys alone.

### Motion

Three durations and two curves. Only transform and opacity animate.

- **Press** (90ms, ease-out `cubic-bezier(0.16, 1, 0.3, 1)`, scale 0.97): direct feedback with no travel.
- **Move** (200ms, ease-out): focus, colour, toggle and state changes, dialog entrance.
- **Fold** (420ms, ease-out): the photo fold, sheets, the ambient fade, onboarding steps. The one authored moment.
- **Ease-in-out** (`cubic-bezier(0.65, 0, 0.35, 1)`): indeterminate progress only.
- **Reduced motion:** every duration drops to 0.01ms and the press scale to 1.

### The photo fold (signature)

On snap from frame one to today's page, the same photo element translates up (`translate3d`, transform only, one rAF per scroll) until it becomes the band. The travel is capped so the folded band is centred on the photo's focal strip, not its bottom edge.

**The Focal Point Rule.** Every photo carries a vertical focal point (0 = top, 1 = bottom). The folded band shows that strip, and the bottom scrim stops below it. Bundled artwork records it explicitly (dawn-sea 0.58, misty-lake 0.55, ridges 0.5); user photos default to 0.5. Artwork made for Novus keeps its brightest point (the sun) inside that strip and draws it last so it stays the brightest value in the frame.

### Ambient frame

After the ambient delay (default 10 minutes, one timeout reset on input, no polling), frame one shows alone: caption, rail, hint, and scrims fade over 420ms, the clock becomes the caption at the bottom right, and a corner scrim keeps it legible. Any press or key wakes it; a hint ("화면을 누르거나 아무 키나 눌러 돌아가기") shows once and fades after 6s. Photos come from the user's Pictures folder and rotate no faster than once a minute; with none, Novus shows its bundled artwork (three procedurally generated 1600×1000 JPEGs from `scripts/design/generate-ambient-art.py`), picked stably per day.

### The bridge

Gallery, Finder, the viewer, video, and the streaming dock still run on v1 components inside `.nv-root.nv-bridge`, where v1 tokens resolve to v2 roles: primary and accent become ink, warning and danger become attention, success becomes ink, every radius becomes 4px, glass becomes plain surface with no sheen, all blur tokens are 0px and `backdrop-filter` is forced off. The dock (theater rail) and the streaming launch screen are v2 components of their own; see their sections.

## Do's and Don'ts

### Do:

- **Do** build every v2 surface inside `NvRoot` and use only the role tokens (ground, surface, rule, text, focus), never raw ramp steps or hex.
- **Do** make a control a circle only when it is a global action reachable from anywhere; everything else is a 4px rectangle.
- **Do** order every photo caption as title, then state line, then one context line, then actions.
- **Do** give every photo a vertical focal point and keep the scrim and the folded band honest to it.
- **Do** author sizes for tablet posture on the 1368×912 frame and multiply by `--nv-scale` (posture × viewport); touch targets use `--nv-target` / `--nv-target-glyph`.
- **Do** animate only transform and opacity, with the press, move, and fold tokens, and honour reduced motion.
- **Do** show the 4px ink focus ring (white on media), offset 3px, on every focusable element.
- **Do** let service brands appear on their own ground with their official assets.

### Don't:

- **Don't** use `backdrop-filter`, blur, or glass anywhere; deepen the scrim instead.
- **Don't** load web fonts; use the system face chain.
- **Don't** add a decorative accent colour, tint, or gradient to Novus chrome; the four semantic hues keep their one job.
- **Don't** put an eyebrow, kicker, or small category label above a title.
- **Don't** give v2 components a box-shadow; depth comes from the photo and the plane order.
- **Don't** make a content action round or a global action square.
- **Don't** scrim over the photo's focal light; the sun keeps its value.

## Service tiles

Services are uniform tiles, benchmarked on Google TV / Apple TV app rows: bare 16:9 art on the brand's own ground (key art covers; wide wordmarks are contained inside a per-brand optical inset, positioned with top/left/bottom percentages of the field rather than padding, because padding percentages resolve against the width and would push the art off-centre; Watcha's box drops slightly because its file carries empty space under the wordmark) and the name as plain text beneath. Focus lifts the art 6% with the ink ring and reveals the number-key shortcut; the live state is a red dot beside the name. The tile height follows its width; nothing stretches with the window height, so no logo is ever cropped by the layout. A live tile carries a close button (4px rectangle, top-right) that ends the session.
