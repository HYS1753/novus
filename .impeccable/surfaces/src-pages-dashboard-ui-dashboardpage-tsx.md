---
version: 1
slug: "src-pages-dashboard-ui-dashboardpage-tsx"
primary_target: "src/pages/dashboard/ui/DashboardPage.tsx"
related_targets: ["src/widgets/quick-header/ui/QuickHeader.tsx","src/widgets/media-shelf/ui/MediaShelf.tsx"]
---

## Scope

Home hub (dashboard) of Novus v2. Visitor mode: Operate (launch or resume within seconds); its idle state, the ambient frame, behaves as Experience. Gallery viewer and in-app video are Experience surfaces that inherit this world.

## Audience, job, constraints

One household member, TV posture (1–2 m, touch + arrow keys) or tablet posture (hand, touch), chosen by the user. Job: resume the running service, open another, reach photos and files. Constraints: Surface Pro 4 m3, opaque surfaces, <500 DOM nodes, no polling under 10 s, all strings localizable.

## Direction contract

THESIS: Home is one frame, then one page. What you were doing fills the screen over today's photo; one swipe down folds that photo into a band over today's page. Refuses the category default of a hero carousel above endless equal tile rows.

OWN-WORLD: Night ground (near-black ramp), white type, no Novus colour of its own: colour comes only from the photo and from official service plates. Live red marks running sessions only; Sunday red and Saturday blue mark the calendar only. Circles are actions reachable from anywhere (the glyph rail); rectangles are content. No blur, no glass, no gradients except the photo scrim.

STORY: The visitor sees what is still running and resumes it with one press; scrolling reveals today (date, month, services, file shortcuts); left alone, the screen becomes a photo frame with a clock.

FIRST VIEWPORT: Full-bleed photo; top-left wordmark, top-right large clock and date. Lower-left caption: live state, service name at display size, primary "이어서 보기" plus secondary resume and close. Right edge: vertical rail of five circular glyph actions. Bottom centre: hint to today's page.

FORM: User-steered fusion of the vertical-feed challenger (first frame) and the wall-calendar pick (today page), list position 1 and challenger 2; seed:bfcc932f10d8a5b4.

SIGNATURE: The photo fold: on snap to today's page the same photo translates up and becomes the band, transform-only.

## Unresolved

Weather has no data source yet (header shows a fixed value today). Last-used time per streaming session is not tracked yet. Language list undecided.
