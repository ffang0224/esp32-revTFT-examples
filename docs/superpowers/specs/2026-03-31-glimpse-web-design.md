# Glimpse Web Showcase — Design Spec
**Date:** 2026-03-31  
**Status:** Approved  

---

## Overview

A polished, Apple-style project showcase landing page for the Glimpse device — a pocket-sized ESP32 + e-ink display that shows AI-generated images over BLE. The site is a **demo/portfolio showcase**, not a sales funnel. No live AI calls; all screen content is pre-made static images.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Build tool | Vite |
| UI framework | React |
| 3D | React Three Fiber (R3F) + `@react-three/drei` |
| Scroll animation | GSAP + ScrollTrigger |
| Smooth scroll | Lenis |
| Styling | CSS Modules or plain CSS (no Tailwind) |
| Fonts | Playfair Display + Lora (Google Fonts) |

**Project location:** `glimpse-web/` — sibling directory to `rn-ble-test/` inside the repo root.

---

## Project Structure

```
glimpse-web/
├── public/
│   ├── glimpse_model4.glb       # copied from repo root
│   └── imgs/
│       ├── screen1.png
│       ├── screen2.png
│       └── screen3.png
├── src/
│   ├── canvas/
│   │   ├── GlimpseModel.jsx     # R3F mesh, exposes screenIndex prop
│   │   └── Lights.jsx
│   ├── sections/
│   │   ├── Hero.jsx
│   │   ├── ScrollStory.jsx
│   │   ├── HowItWorks.jsx
│   │   ├── Specs.jsx
│   │   └── Footer.jsx
│   ├── ui/
│   │   ├── Cursor.jsx
│   │   └── StageDots.jsx
│   ├── App.jsx                  # Lenis init, R3F Canvas (fixed), section stack
│   ├── main.jsx
│   └── styles/
│       ├── globals.css          # CSS vars, reset, keyframes
│       └── *.module.css         # per-component styles
├── index.html
├── vite.config.js
└── package.json
```

---

## Sections

### 1. Hero
- Full viewport (`100vh`), dark ink background.
- R3F Canvas is fixed full-screen and shared across all sections.
- In hero: model is centered, large, with a gentle idle float (`sin(t * 0.55) * 0.08`).
- HTML overlay: eyebrow label ("eInk · ESP32 · Open Source"), headline *"Carry a thought."* (Playfair Display), one-liner subtext, scroll-down hint.
- All text elements stagger in with `fadeUp` keyframes on load.
- No CTA button.

### 2. ScrollStory (Pinned)
- Section height: `300vh`. GSAP `ScrollTrigger.pin` keeps it in view while scroll travels through all three stages.
- Three stages, driven by scroll progress (0→1):

| Stage | Screen | Label | Body |
|---|---|---|---|
| 0 | screen1.png | Your Perspective | Your personality shapes everything around you. Glimpse reminds you of that, daily. |
| 1 | screen2.png | Patient Wisdom | Some truths need time. Glimpse holds them quietly until you're ready to hear them. |
| 2 | screen3.png | Chosen Suffering | A gentle nudge for the days you forget that most pain is optional. |

- Model animates left as scroll enters; rotates subtly between stages.
- Screen texture swaps at 33% / 66% progress breakpoints.
- Stage label fades in/out on the right side (text) while model sits on the left.
- Side progress dots (`StageDots`) show current stage.

### 3. HowItWorks
- Three-step horizontal flow: **Phone app → BLE → Device renders**.
- Each step card fades + slides up on ScrollTrigger enter.
- Icon-level visuals (no complex diagrams). Clean, minimal.

### 4. Specs
- Two-column layout: left = short project description paragraph, right = hardware table.
- Hardware rows: Display, MCU, Connectivity, Power, Refresh, Case, Open Source.
- Fades in on scroll enter.

### 5. Footer
- Minimal: project name (Playfair Display), "Open Source · 2025", GitHub link.

---

## Visual Language

- **Palette:** `--cream: #f5f0e8`, `--ink: #1a1612`, `--ink-mid: #221e19`, `--sepia: #8b7355`, `--sepia-light: #c4a882`, `--rust: #9b4a2c`
- **Typography:** Playfair Display (headings, logo), Lora (body)
- **Grain overlay:** SVG fractalNoise texture at 4% opacity, fixed, `pointer-events: none`
- **Cursor:** custom dot, `mix-blend-mode: difference`, grows on hover

---

## Animation Contracts

| Trigger | What animates | How |
|---|---|---|
| Page load | Model, hero text | R3F fade-in + CSS `fadeUp` keyframes |
| Scroll into ScrollStory | Model slides left | GSAP ScrollTrigger progress → R3F `lerp` |
| Scroll stage 0→1 | Model rotation, screen1→screen2 | GSAP progress threshold |
| Scroll stage 1→2 | Model rotation, screen2→screen3 | GSAP progress threshold |
| Scroll exit from story | Model returns to center | GSAP reverse |
| Section enter (all others) | Text/cards fade+translateY | ScrollTrigger `fadeUp` |
| Hover on links/buttons | Cursor grows | CSS class toggle |

Model idle: `gadget.position.y = Math.sin(t * 0.55) * 0.08` when not scroll-driven.

---

## Camera & Lighting

Carried over from `victortest.html` (already working well):
- `PerspectiveCamera` at `(0, 11, 5)`, `lookAt(0, 0, 0)` — elevated 3/4 view
- Ambient: `0xfff5e6` at intensity 2.5
- Key: `DirectionalLight 0xfff0d6` at `(4, 8, 6)`
- Fill: `DirectionalLight 0xc4a882` at `(-4, 2, -3)`
- Rim: `DirectionalLight 0xffeedd` at `(0, -4, -6)`

---

## Out of Scope

- Live AI image generation
- BLE connectivity in the browser
- Mobile-specific breakpoints (desktop-first, basic responsive)
- Internationalization
- Analytics
