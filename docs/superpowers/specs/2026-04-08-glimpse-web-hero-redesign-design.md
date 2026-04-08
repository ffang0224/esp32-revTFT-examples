# Glimpse Web Hero Redesign Spec
**Date:** 2026-04-08  
**Status:** Draft for review  

---

## Overview

Redesign only the first viewport of `glimpse-web/` to match the provided Figma hero direction before changing the rest of the landing page. The hero should shift from the current dark, left-aligned product showcase to a minimal white editorial composition with centered typography, a thin blue inset frame, and the live 3D device cropped up from the bottom center.

This is a hero-first sub-project. The broader site redesign will follow later from additional screenshots and may revise downstream sections case by case.

---

## Goals

- Match the approved hero screenshot closely in layout, spacing, text hierarchy, and overall tone.
- Keep the existing live 3D model in the hero rather than replacing it with a static image.
- Retune the 3D framing so the device reads as a sculptural cropped object, not an interactive viewer.
- Preserve existing downstream scroll and demo behavior unless a hero change requires a small compatibility adjustment.

---

## Approved Direction

### Chosen approach

Use a hero-tuned 3D approach:

- Keep the shared canvas and live 3D model.
- Rebuild the hero overlay and app framing around the Figma composition.
- Retune the hero camera/model staging so the first viewport matches the screenshot more closely.
- Handle future conflicts between Figma and current mechanics case by case.

### Rejected alternatives

- Overlay-only restyle without 3D retuning: lower risk, but too likely to retain the current side-biased composition.
- Pixel-match shell that ignores existing model behavior: higher fidelity in isolation, but more likely to create rework once the rest of the page is redesigned.

---

## Hero Composition

The first viewport should feel quiet, centered, and editorial.

- Background: clean white.
- Frame: a thin bright-blue rectangular border inset from the browser edges, visible across the hero viewport.
- Headline: `Glimpse`, centered, bold, black.
- Paragraph: use the exact approved copy from the screenshot, centered beneath the headline in a narrow column.
- Device: the live 3D model appears from the bottom center, cropped so the upper arc/top silhouette is visible and the object feels partially revealed.
- Motion: minimal. The viewport should feel mostly static, with only subtle model life.

### Approved copy

Headline:

`Glimpse`

Body:

`Glimpse is for moments of choice, when logic alone isn't enough. Take a glimpse into a possible future and feel which one is right.`

### Elements removed from the current hero

- Eyebrow text
- Scroll hint
- Visible CTA button

---

## 3D Behavior

The hero keeps the existing shared 3D canvas, but the first viewport should no longer read like a product viewer.

- Retune the initial camera and model framing so the device sits low and centered.
- Keep only very subtle idle motion in the hero.
- Reduce or suppress drag-driven interaction in the hero so it does not compete with the typography.
- Preserve deeper scroll/demo mechanics under the hood for now unless later Figma references require change.

### Interaction policy for this phase

- Prioritize the hero's visual composition over making the top viewport feel overtly interactive.
- Do not remove the 3D model.
- Do not redesign later sections yet.

---

## Implementation Boundaries

This first pass should stay intentionally narrow.

### Files expected to change

- `glimpse-web/src/sections/Hero.jsx`
- `glimpse-web/src/sections/Hero.module.css`
- `glimpse-web/src/App.module.css`
- `glimpse-web/src/App.jsx` if app-level framing or hero prop flow needs adjustment
- `glimpse-web/src/canvas/GlimpseModel.jsx` and/or related canvas setup if hero framing requires camera/model retuning
- Shared global style files only if needed for background or framing tokens

### Files intentionally out of scope

- Content and layout of non-hero sections
- Redesign of the demo overlay
- Replacing the live 3D model with a static asset
- Broad architecture refactors unrelated to hero fidelity

---

## Validation

This hero pass is successful when:

- The first viewport closely matches the screenshot's spacing, hierarchy, and framing.
- The 3D model still renders correctly and feels quieter, lower, and more sculptural in the hero.
- Existing downstream behavior is not broken by the hero restyle.
- Verification is done with targeted visual inspection plus existing build, lint, and test flows as appropriate.

### Testing expectations

- Prefer verification through `build`, `lint`, and focused visual inspection.
- Add automated tests only if a small, meaningful behavior change is introduced that benefits from coverage.
- Avoid low-value tests that only restate styling.

---

## Risks And Decisions

- Exact Figma matching may require some iteration on camera position, model scale, and crop.
- A white hero may expose assumptions in current global colors or section transitions.
- Later screenshots may require revisiting hero details once the whole-page system is clearer.

These are acceptable for this phase because the hero is being treated as the first approved redesign slice, not the final global system.
