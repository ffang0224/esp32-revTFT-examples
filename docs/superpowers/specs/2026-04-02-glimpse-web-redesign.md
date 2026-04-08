# Glimpse Web — Performance + Demo Overlay Design

**Date:** 2026-04-02  
**Status:** Approved

---

## Overview

Improve the `glimpse-web` landing page performance and add an immersive "Try it" demo that simulates the real Glimpse device interaction: a phone mockup where the user types a prompt and the e-ink screen on the 3D model updates with a random image.

---

## 1. Performance Fixes

**Problem:** The page feels laggy due to the R3F canvas rendering every frame even when nothing changes.

**Changes:**

- Add `frameloop="demand"` to the `<Canvas>` component. R3F will only re-render when `invalidate()` is called.
- In `GlimpseModel`'s `useFrame`, call `invalidate()` each tick so the idle bob animation and lerp continue to run smoothly. This keeps animation working while eliminating wasted renders when the canvas is truly idle.
- No changes to DPR cap (`[1, 1.5]`) — already appropriate.
- Lenis + ScrollTrigger coupling stays as-is (already correct).

---

## 2. Landing Page Polish

**Changes:**

- Add a "Try it" pill button to `Hero.jsx`, below the existing subtitle text. Styled with a bordered pill + fill-on-hover GSAP animation.
- Nav links use Lenis `scrollTo` instead of native anchor jumps for consistent smooth behavior.
- Scroll hint animation in Hero loops cleanly (CSS keyframe, no change to logic).
- No new scroll sections. Existing structure: Hero → ScrollStory → HowItWorks → Specs → Footer is unchanged.

---

## 3. Demo Overlay

### Components

**`src/DemoOverlay.jsx`** — new component, rendered at top level in `App.jsx`.  
**`src/DemoOverlay.module.css`** — styles for overlay, phone frame, input, button, states.  
**`src/demoImages.js`** — exports an array of image paths from `public/imgs/`. Random selection happens here.

### Layout

- Always in the DOM, initially `opacity: 0; pointer-events: none`.
- Left half: phone frame (CSS-only, no image asset needed). Contains:
  - Mode label (e.g., "Dilemma")
  - `<textarea>` for user prompt input
  - "Send to Glimpse →" button
  - Status area: idle → "Sending..." (pulse animation) → "Received on device ✓"
- Right half: empty — the fixed 3D canvas shows through naturally since the overlay background is dark/semi-transparent.
- Close button (×) top-right, hidden when overlay is inactive.

### Takeover Flow

1. User clicks "Try it" in Hero.
2. GSAP timeline (~600ms):
   - `main` element: `opacity → 0`, `scale → 0.97`
   - Nav: `opacity → 0`
   - Overlay: `opacity → 1`, `pointer-events → all`
   - Close button fades in
3. User types in phone input, clicks "Send to Glimpse →".
4. Status changes to "Sending..." with a 1.2s pulse animation.
5. After pulse: pick a random image path from `demoImages.js`, update `scrollState.screenIndex` to the corresponding index (same mechanism as ScrollStory).
6. Status changes to "Received on device ✓" for 2s then resets.
7. User clicks ×: reverse GSAP timeline, overlay hides, landing restores.

### Image Config

```js
// src/demoImages.js
export const DEMO_IMAGES = [
  '/imgs/screen1.png',
  '/imgs/screen2.png',
  // add more here — user points to public/imgs/
]
```

`scrollState.screenIndex` is set to `Math.floor(Math.random() * DEMO_IMAGES.length)`. The existing texture array in `GlimpseModel` must be updated to load all demo images, not just the 3 hardcoded ScrollStory ones.

### No Second Canvas

The overlay uses the existing fixed canvas. The 3D model remains loaded and animated throughout. Overlay background: `rgba(0,0,0,0.85)` or similar dark tone so the model is visible on the right.

---

## 4. File Changes Summary

| File | Change |
|------|--------|
| `src/App.jsx` | Add `frameloop="demand"` to Canvas; render `<DemoOverlay>`; pass `onTryIt` callback to Hero |
| `src/canvas/GlimpseModel.jsx` | Add `invalidate()` call in `useFrame`; expand texture array to cover all demo images |
| `src/sections/Hero.jsx` | Add "Try it" button with `onTryIt` prop |
| `src/sections/Hero.module.css` | Style for "Try it" button |
| `src/sections/Nav.jsx` | Use Lenis `scrollTo` for anchor links |
| `src/DemoOverlay.jsx` | New — full overlay component |
| `src/DemoOverlay.module.css` | New — overlay styles |
| `src/demoImages.js` | New — image path config |

---

## Out of Scope

- No backend / real BLE communication
- No actual AI-generated images (images are pre-provided by user in `public/imgs/`)
- No routing changes
- No changes to ScrollStory, HowItWorks, Specs, or Footer
