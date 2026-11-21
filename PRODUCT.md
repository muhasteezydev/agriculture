# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two equal operating contexts share this console:
- **Greenhouse farmers and agronomists in Kyrgyzstan and Central Asia** monitoring daily microclimate, leaf health, and spring frost risk (bilingual Russian / Kyrgyz, often with unreliable internet).
- **Live demonstration presenters and technical evaluators** running quick scenario walkthroughs (e.g., 6-hour Chuy Valley April frost compressed into 15 seconds, offline Edge-CV leaf scan, two-way Telegram relay control).

## Product Purpose

AgroGuard Edge provides early frost prediction (6-hour horizon via dew-point physics + Edge-ML), local leaf disease diagnostics (Edge-CV), and automated physical protection (micro-sprinkler misting, IR heating, motorized roof vents) visualized on an interactive 3D Digital Twin greenhouse. Success means an operator can read greenhouse risk at a glance, act on or verify automated relay protection immediately, and run a convincing live scenario without fighting visual clutter.

## Positioning

Local-first Edge-AI crop protection that runs without cloud APIs or stable internet, pairing real-time leaf-surface IR frost physics and offline computer vision with a hardware-abstraction layer (HAL) ready to move from virtual twin to low-cost field hardware (RPi Zero 2W / ESP32-S3 + SHT41 + MLX90614 + relays).

## Operating Context

- Desktop and laptop browsers (including projector screens during live demos), served locally by the Python backend at `http://localhost:8000` with real-time SSE telemetry (`/api/stream`).
- Bilingual RU / KG switching across telemetry, alerts, scenarios, Edge-CV advice, and Telegram bot commands.
- Both live autonomous protection (`AUTO`) and manual overrides for relays, weather scenarios, time-scale playback, and offline-edge simulation.

## Capabilities and Constraints

- **Core capabilities:** Interactive Three.js 3D greenhouse (`Greenhouse3D`), 6-hour frost & dew-point forecast chart (`ForecastChart`), 4 Kyrgyzstan climate scenarios, manual/auto relay control (sprinkler, IR heater, roof vents), manual environment simulation sliders, Edge-CV leaf/pest scanner (sample leaves, file upload, webcam), two-way Telegram bot mirror (`TelegramPanel`), offline-edge mode toggle, time-machine playback, and RU/KG language switch.
- **Simplification constraint:** Do not overload the main viewport with every control at once; keep primary operational telemetry and the 3D scene clear and breathable, tucking secondary simulation/technical controls out of the primary view until needed.
- **Product authenticity constraint:** Remove hackathon-only marketing badges and price tags (`$0 MVP`, `Physical AI Hackathon`, `$0 API`) from the UI so it reads as a genuine agricultural instrument; keep HAL/hardware-driver info only where technically relevant.
- **Tech stack:** React 18, TypeScript, Tailwind CSS v4, Three.js, Vite (built into `frontend/dist` and served by `backend/server.py`).

## Brand Commitments

- Name: **AgroGuard Edge**
- Bilingual interface: Russian (`ru`) and Kyrgyz (`kg`).

## Evidence on Hand

- Live backend telemetry stream (`/api/stream`), 4 Kyrgyzstan climate presets (`/api/scenarios`), 5 real leaf/pest test samples with local CV inference (`/api/samples`, `/api/cv/analyze`), and interactive Telegram mirror (`/api/telegram/action`).
- Existing interactive Three.js 3D greenhouse model (`frontend/src/components/Greenhouse3D.tsx`) with day/night sky, frost glazing, 4 crop bed sectors, AgroGuard sensor node, mist particles, IR heater glow, and motorized vents.

## Product Principles

1. **Real instrument, not a pitch slide:** Present AgroGuard Edge as dependable agricultural equipment; strip promotional hackathon chrome.
2. **Scene and signal first:** Keep the 3D greenhouse and critical frost/disease signals legible without HUD or sidebar overload.
3. **Dual-mode clarity:** Support both calm daily monitoring and one-click scenario demonstrations without letting demo controls clutter normal operation.
4. **Local-first honesty:** Communicate offline Edge-AI operation, latency, and hardware-driver state matter-of-factly.
