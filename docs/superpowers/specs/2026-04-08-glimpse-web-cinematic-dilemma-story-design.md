# Glimpse Web Cinematic Dilemma Story Spec
**Date:** 2026-04-08  
**Status:** Draft for review  

---

## Overview

Replace the current homepage `DilemmaStory` section with a single pinned cinematic interaction sequence. This new sequence keeps the 3D device centered as the anchor, brings a realistic phone UI up over it, plays out a guided dilemma-and-values flow, then returns focus to the device for fortune changes, the 24-hour passage beat, and the physical reject-button glow.

This spec supersedes the current side-by-side story concept for the homepage. The new story should be vertically stacked and mobile-friendly, with the phone and device layered in the same central viewport rather than split into separate columns.

---

## Goals

- Replace the current `DilemmaStory` section entirely.
- Keep the device centered throughout the story instead of using a side-by-side desktop layout.
- Bring the phone up from below so it temporarily overlays the device.
- Make the phone UI look like a real iPhone-style app screen, not a stylized card.
- Show the on-screen keyboard only during the typing beat, with a polished iOS-like entrance/exit feel.
- Keep the device contours visible under the phone while the phone is foregrounded.
- Transition back to the device for the fortune reveal and later beats.
- Add a faint red glow to the physical reject button on the 3D device.
- Add a restrained green ring around the device to represent the passage of 24 hours.

---

## Approved Direction

### Chosen approach

Use a single pinned cinematic homepage section:

- The 3D device stays centered in the viewport throughout the sequence.
- A phone UI layer peeks from below, slides upward, then settles on top of the device.
- The device fades slightly under the phone, but its silhouette remains visible.
- The phone presents a realistic guided flow rather than explanatory copy blocks.
- The keyboard appears only during the dilemma typing beat.
- The values step is hardcoded and visually highlighted/underlined.
- The phone then slides back down, returning the stage to the 3D device.
- The device takes over for blinks, fortune changes, the 24-hour ring, and reject-button pulse.

### Rejected alternatives

- Keep the existing side-by-side phone/device composition: too awkward on mobile and visually crowded.
- Build the story as a separate route: allowed, but not chosen because the desired experience should stay in the homepage scroll.
- Keep the current post-hero interaction as a drag-only stage and leave the story mostly unchanged: not enough to match the intended cinematic sequence.

---

## Experience Flow

The section should play as one continuous narrative block.

### Phase 1: Device anchor

- The device is centered in the viewport.
- The phone is barely visible below the bottom edge, hinting that it will rise into view.
- The device is fully legible here.

### Phase 2: Phone rises over device

- As the user scrolls, the phone slides upward from below.
- The phone settles centered over the device.
- The device remains underneath as a ghosted physical object: slightly dimmed, but with visible outer silhouette and major contours.
- The composition should feel layered, not like one element simply replacing another.

### Phase 3: Dilemma entry

- The phone UI shows a real app-like screen with the prompt `What dilemma do you want to solve?`
- A large text box is visible.
- The keyboard animates in with an iOS-like motion language: smooth upward slide with a slight spring/bounce.
- A dilemma sentence is typed into the input.

### Phase 4: Values question

- The keyboard dismisses once the typing beat completes.
- The phone transitions to the next screen: `What matters to you in this decision?`
- Hardcoded values appear.
- Relevant values get highlighted and/or underlined in a deliberate sequence.

### Phase 5: Phone departs

- The phone slides back downward out of the center.
- The device beneath becomes fully visible again as the phone clears the frame.
- The handoff should feel like the story is moving from phone input into device output.

### Phase 6: First fortune reveal

- The device performs three visible blink pulses.
- A new fortune appears on the device screen.

### Phase 7: 24-hour passage

- A restrained green ring appears around the centered 3D device.
- This ring communicates a quiet elapsed-time beat rather than a loud sci-fi effect.
- The ring should feel product-like and minimal.

### Phase 8: Reject-button beat

- The physical reject button on the 3D device receives a faint red glow.
- A subtle haptic-like pulse appears above or around that button area.
- The effect should feel like physical affordance, not a game UI.

### Phase 9: Second fortune

- The reject-button beat resolves.
- Another fortune appears on the device.
- The section then hands off cleanly to the following homepage content.

---

## Visual Direction

### Phone UI

- Should look like a real phone interface, similar to the provided reference.
- Bright, clean, and product-like.
- No floating glass-card styling or abstract framing.
- The keyboard should feel recognizably iOS-inspired in rhythm and motion.
- Use realistic spacing, rounded corners, and believable app-screen proportions.

### Device underlay

- The 3D device remains the physical anchor of the section.
- When the phone overlays it, the device should reduce in prominence but remain visibly present.
- The screen and outer shell should still read underneath the phone layer.
- The return from dimmed-under-phone to fully visible device must be gradual, not abrupt.

### Status effects

- Reject button: faint restrained red glow, not a saturated warning beacon.
- 24-hour ring: subtle green circle/ring with a quiet product-status feel.
- Blink pulses: clean and readable, not strobe-like or harsh.

---

## Layout And Mobile Behavior

- This section should be designed primarily around a centered stacked composition.
- No side-by-side phone/device layout on desktop.
- The same central composition should scale down to mobile instead of rethinking the structure.
- The phone overlay should remain visually centered on smaller screens.
- The device should still be readable beneath the phone, but the phone remains the foreground layer during its phases.

---

## Interaction Model

This section is scroll-driven, not free-drag-driven.

- The sequence progresses by scroll through a pinned section timeline.
- The phone motion, keyboard entrance, highlighted values, blink pulses, ring, and button glow should all be scrubbed or staged along that unified timeline.
- The user should not have to perform taps or clicks in this section.
- The earlier post-hero rotation stage can remain before this section, but once this story begins, free drag should be disabled.

---

## State And Architecture

The implementation should move away from the current side-by-side story framing and toward explicit cinematic phases.

### Required story phases

- `device-peek`
- `phone-rise`
- `typing`
- `values`
- `phone-depart`
- `fortune-one`
- `day-passes`
- `reject-pulse`
- `fortune-two`

### Responsibilities

- The section owns a single pinned scroll timeline.
- Shared 3D canvas state controls device framing, screen content, dimming, ring visibility, and button-glow state.
- A DOM phone overlay handles the realistic app UI and keyboard animation.
- Small helper functions can map scroll progress to phase-specific UI/device state.
- The old stage-dot and side-column story model should be removed from this section.

---

## Data And Content

This slice can stay partially hardcoded.

- Dilemma prompt text can be scripted for the cinematic sequence.
- The values shown in the values phase can be hardcoded.
- The highlighted values can be hardcoded.
- The first and second fortunes can be hardcoded for now if needed.
- The goal of this phase is motion and storytelling quality, not dynamic content architecture.

---

## Implementation Boundaries

### Files likely to change

- `glimpse-web/src/App.jsx`
- `glimpse-web/src/canvas/scrollState.js`
- `glimpse-web/src/canvas/GlimpseModel.jsx`
- `glimpse-web/src/canvas/CameraRig.jsx`
- `glimpse-web/src/heroConfig.js`
- `glimpse-web/src/sections/DilemmaStory.jsx`
- `glimpse-web/src/sections/DilemmaStory.module.css`
- `glimpse-web/src/sections/dilemmaStoryState.js`
- `glimpse-web/src/sections/dilemmaStoryState.test.js`

### Likely additional files

- A small helper for scripted story content if the section becomes too large
- Updated model asset hooks if the screen node, reject button, or later `case.glb` integration require clearer targeting

### Out of scope

- Reworking hero copy or hero layout again
- Rewriting the demo overlay
- Building a fully functional phone app
- Integrating the raw `case.glb` replacement in the same step unless it is needed for button targeting
- Implementing a tornado/separated-parts model sequence in this phase

---

## Verification

This section is successful when:

- The old side-by-side `DilemmaStory` presentation is gone.
- The phone rises from below and overlays the device in a centered composition.
- The keyboard appears only during the dilemma typing beat.
- The keyboard animation feels recognizably iOS-like and polished.
- The values phase feels clear and intentional.
- The phone slides away and reveals the device again without a visual jump.
- The device blinks three times before the first fortune.
- The 24-hour beat reads through a subtle green ring around the device.
- The physical reject button gets a faint red glow and a restrained haptic-like emphasis.
- The second fortune appears after that beat.
- The whole sequence works cleanly on mobile without degrading into side-by-side composition.

### Testing expectations

- Add focused tests only for helper/state logic that maps progress to phases or visual state.
- Prefer browser verification for animation quality, layering, keyboard timing, blink count, and visual affordances.
- Re-run existing build, lint, and relevant test suites after implementation.

---

## Risks And Decisions

- The phone overlay can easily feel fake if the keyboard motion or app proportions are too stylized.
- The device-under-phone layering can become muddy if dimming is too strong or too weak.
- The handoff from phone foreground back to device foreground must feel intentional, not like a z-index glitch.
- The reject-button highlight can easily become too loud if the red glow is overdone.
- If the current runtime model does not expose a clean reject-button target, that may need a temporary approximation until a better source asset is integrated.

These are acceptable risks because the sequence is replacing a discrete section and can be iterated in isolation.
