---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: ["frontend/src/components/Greenhouse3D.tsx","frontend/src/components/ForecastChart.tsx","frontend/src/components/DiseaseScanner.tsx","frontend/src/components/TelegramPanel.tsx"]
---

# Surface Brief: AgroGuard Edge Console

- **Scope:** Primary web operational console (`frontend/src/App.tsx` and child components: `Greenhouse3D.tsx`, `ForecastChart.tsx`, `DiseaseScanner.tsx`, `TelegramPanel.tsx`)
- **Mode:** `operate`
- **Audience & Job:** Greenhouse farmers/agronomists in Kyrgyzstan (daily climate, frost, and leaf-health monitoring) and live demo presenters (quick 6-hour frost walkthrough, Edge-CV leaf scan, two-way Telegram control).
- **Constraints:** Bilingual RU/KG; remove hackathon badges (`$0 MVP`, `Physical AI Hackathon`, `$0 API`); declutter main viewport by collapsing manual simulation sliders & HAL details into an on-demand disclosure; preserve Three.js 3D greenhouse scene while replacing its floating HUD with clean docked telemetry.

## Direction contract

- **THESIS:** AgroGuard Edge is a calm, daylight-legible agronomic instrument modeled on botanical seasonal folios, refusing the dark-navy neon-glowing glassmorphic AI dashboard trope.
- **OWN-WORLD:** Warm botanical plate cream (`#F5EFE2`) and lifted parchment (`#FBF8F0`) divided by 1px sepia hairlines (`#D4C9B3`), iron-gall charcoal ink (`#1F1D1A`), and muted umber secondary type (`#5E5548`). Saturated pigment is reserved strictly for live state: botanical green (`#245C43`) for active protection and healthy status, scarlet (`#B92B27`) for frost/disease alerts and sub-zero thresholds, slate-blue (`#1E5C84`) for misting/air telemetry, and terracotta (`#B85A1E`) for IR heating and warnings. Typography pairs `Literata` (brand & botanical specimen titles), `Golos Text` (Cyrillic-native UI), and `JetBrains Mono` (`tabular-nums` telemetry).
- **STORY:** Within two seconds an operator reads greenhouse health, leaf vs. air temperature, and 6-hour frost risk, sees which physical relays are active on both the 3D scene and control rail, and can trigger the 6-hour frost demo, inspect a leaf specimen via Edge-CV, or dispatch a Telegram command without hunting through visual noise.
- **FIRST VIEWPORT:** A single 56px flat header bar holds the AgroGuard Edge wordmark, a compact scenario selector, the primary "Демо заморозка 6ч" button, time-scale toggle, offline-edge indicator, and RU/KG switch. Below, an asymmetric 2-column split (roughly 68% / 32% divided by a 1px sepia seam) places the uncluttered 3D greenhouse bay above a docked 4-column baseline-aligned telemetry ribbon (Air, Leaf IR, Dew Point, 6h Frost Risk) and the 6-hour forecast chart on the left, while the right operational rail holds 3 crisp tabs (Климат и реле, Edge-CV, Telegram) with protection status, 3 flat mechanical relay toggles, and a collapsed disclosure for manual sliders & HAL info.
- **FORM:** Challenger `editorial-sequence-montage-botanical-folio-season` (competitive alternate chosen by the user), adapted to `operate` mode discipline; seed:04ca96fa054df7a6.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
