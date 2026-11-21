---
name: AgroGuard Edge
description: Frosted Liquid Glass agronomic console floating over an aerial sunlit emerald-green landscape.
colors:
  backdrop-forest: "#111E13"
  glass-surface: "rgba(255, 255, 255, 0.14)"
  glass-border: "rgba(255, 255, 255, 0.24)"
  ink-white: "#F8FAF7"
  ink-muted: "rgba(255, 255, 255, 0.70)"
  accent-lime: "#B5F043"
  frost-coral: "#FF6B6B"
  mist-ice: "#7DD3FC"
  heater-amber: "#FBBF24"
typography:
  display:
    fontFamily: "Onest, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Onest, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  md: "16px"
  lg: "22px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "#FFFFFF"
    textColor: "#142014"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  glass-panel:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.ink-white}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

## Overview

AgroGuard Edge uses a frosted Liquid Glass aesthetic inspired by editorial agricultural reports: translucent olive-tinted glass panels with specular 1px top highlights float over a full-bleed aerial drone photograph of sunlit green crop fields (`/bg-fields.jpg`).

## Colors

- **Backdrop:** `#111E13` base with full-bleed aerial green fields photography and a soft low-key vignette for legibility.
- **Liquid Glass:** Translucent white-to-olive gradient (`rgba(255,255,255,0.14)` → `rgba(16,28,15,0.44)`), `backdrop-filter: blur(24px) saturate(140%)`, specular `1px` rim (`rgba(255,255,255,0.24)` + inner top highlight).
- **Accents:** Crisp white pills (`#FFFFFF` / `#142014`) for primary chrome, fresh lime (`#B5F043`) for healthy/active states, coral (`#FF6B6B`) for frost/disease alerts, ice-blue (`#7DD3FC`) for misting, and amber (`#FBBF24`) for heating.

## Typography

- **Primary & Large Numbers (`Onest`):** Light weight (`300`) for large tabular metrics (`+8.8°`, `0%`), medium (`500`) for headers and controls.
- **Technical Badges (`JetBrains Mono`):** Tabular clock, latencies, and chart ticks.

## Layout

- Floating top bar with white brand pill on the left, centered white title, and glass/white action pills on the right.
- 3-column Bento glass workspace (`3 / 6 / 3`):
  - Left column: vertical stack of large light-weight greenhouse metrics (`Воздух`, `Лист`, `Точка росы`, `Риск заморозка`).
  - Center column: 3D R3F Greenhouse viewport framed in Liquid Glass above the 6-hour forecast chart.
  - Right column: segmented glass tabs (`Климат`, `Болезни`, `Bot`) with auto-protection status, relay switches, crop bed health, and collapsible manual weather controls.
