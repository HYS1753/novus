# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Tauri v2 desktop shell rendering React in the OS system webview (Windows Edge WebView2 primary, macOS WebKit for development). The design language is the product's own, not native Windows or macOS chrome.

## Users

A household member who keeps a low-spec Windows tablet (reference: Surface Pro 4 m3, 4 GB RAM, Intel HD 515) running Novus as an always-on home hub. The same person uses it in two postures:

- **TV posture (lean-back):** the tablet stands or hangs in the living room, viewed from roughly 1–2 m, operated by walking up and touching or by a keyboard or remote's arrow keys.
- **Tablet posture (handheld):** the tablet is picked up and used at 30–50 cm with direct touch.

The job is the same in both: get back to what they were watching, start a streaming service, browse local photos and videos, or find a file, with no friction and no stutter.

## Product Purpose

Novus boots with the OS and turns an old tablet into a TV-style media console. It launches streaming services in-app, keeps their sessions alive between visits, plays local media with hardware acceleration, and browses the file system with touch-first controls. Success is a hub that feels instant on 4 GB hardware: about 30 MB idle RAM for the hub, 60 fps touch response, and no lost login sessions.

## Positioning

Streaming services open as pages inside one long-lived browser process. Going home hides a service instead of destroying it, so returning resumes exactly where the user left off with the session cookie intact; backing out of the first page discards it and frees memory. Novus pairs that with native libmpv playback and a persistent thumbnail cache, all inside a hub light enough for hardware other media OSes have abandoned.

## Operating Context

- Starts automatically at boot and often stays on screen for hours when idle.
- Shared household device; living-room lighting varies from daylight to a dark room at night.
- Input: touch, plus keyboard or remote arrow keys (D-pad focus navigation). Mouse and trackpad are secondary.
- Streaming services render their own web UI inside the native child view; Novus only owns the hub, the dock around a running service, and its own local media and file screens.

## Capabilities and Constraints

Existing capabilities v2 must keep:

- Streaming launcher: Netflix, YouTube, Disney+, TVING, Wavve, Watcha, Coupang Play. Lazy creation, hide-not-destroy, smart back (history back, then discard and return home), running-apps list with close.
- Smart tools: Google Calendar, web radio, Quick Search, plus internal Gallery and Finder.
- Quick controls: Ambient Display and Mobile Remote.
- Gallery: virtualized 1:1 grid, persistent thumbnail cache, search and sort, location menu, fullscreen viewer (tap zones, immersive mode, zoom and pan, slideshow at 10/15/30 s), in-app video with libmpv and a `<video>` fallback, video controls with keyboard shortcuts.
- Finder: whole-file-system browsing, list and grid views, filter, sort, open with the OS default app.
- Shared navigation: SubpageDock (home, history back, clock, refresh, tool slot), PathNavigation (back, parent, breadcrumb).
- Settings: material intensity 0–100, device profile, update preferences and manual install, app fullscreen.
- Header: clock, date, weather, search, theme, fullscreen, settings.

New in v2 (decided, not yet built):

- **Viewing mode setting:** the user picks TV posture or tablet posture, in Settings and during first-run onboarding. The choice changes scale, density, and focus behaviour.
- **Language setting:** Korean (reference), English, Japanese, and Simplified Chinese, selectable in Settings and during first-run onboarding.
- **First-run onboarding:** language, then viewing mode, on the first launch after install.
- **Theme:** follows the OS light/dark setting by default; the user can pin light or dark in Settings.
- **Weather:** live weather from Open-Meteo (no API key) for a city chosen in Settings, refreshed no more often than every 30 minutes; hidden when offline or unset. The current header value is a fixed placeholder.
- **Ambient photos:** the home's full-bleed photo and the ambient frame draw from the OS Pictures folder by default; the folder is changeable in Settings and onboarding. When no photo is available, Novus shows bundled artwork shipped with the app.

Hard technical constraints:

- No heavy runtime packages (no UI kits, Tailwind, Lodash, Moment).
- No `backdrop-filter` at the default material intensity; surfaces stay opaque.
- Fewer than 500 DOM nodes on the dashboard; virtualize long lists.
- Clock and status polling no faster than every 10 s.
- Frontend calls Rust only through typed wrappers in `src/shared/api/tauri/`.

## Brand Commitments

- The name **novus** and the existing NovusLogo (N mark and wordmark) stay.
- Streaming services appear with their official logos and brand colours, as the user expects to recognize them at a glance.
- UI copy is localizable; service proper names stay in their original form.

## Evidence on Hand

- Brand logo assets for streaming services: `src/shared/lib/brandAssets.ts`, `src/shared/ui/icons/BrandIcons.tsx`.
- Real local media comes from the user's own folders at runtime; there is no bundled sample library. Design work must label any placeholder imagery as synthetic.
- No usage analytics, testimonials, or benchmarks exist; do not invent them. Surface Pro 4 field measurements are still pending.

## Product Principles

1. **Resume beats launch.** What the user was just doing comes first; starting something new comes second.
2. **Instant on old hardware.** If a design choice costs frames or memory on a Surface Pro 4, it loses.
3. **One device, two postures.** Every screen works from the sofa and in the hand; the user chooses, Novus doesn't guess.
4. **The content is the colour.** Service brands, photos, and videos carry the colour; Novus' own chrome stays quiet and stable.
5. **Every path leads home.** Home and back behave the same on every screen and never lose a session.

## Accessibility & Inclusion

- Touch targets at least 48 px in tablet posture and larger in TV posture.
- Every interactive element is reachable and visibly focused with arrow keys alone.
- Legible from 2 m in TV posture; respect `prefers-reduced-motion`.
- All UI strings localizable; layouts must tolerate longer translated labels.
