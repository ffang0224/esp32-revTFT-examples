# Glimpse Web Post-Hero Rotation Section Spec
**Date:** 2026-04-08  
**Status:** Draft for review  

---

## Overview

Add a new full-viewport section immediately after the hero in `glimpse-web/`. This section is a minimal interaction stage focused only on the device itself: the model rests in a front-facing view and the user can drag horizontally to rotate it left and right over a much wider range than the hero.

This is a small, focused follow-on redesign slice. The goal is to create a calm transition between the static editorial hero and the more narrative story sections that follow.

---

## Goals

- Insert a new section directly after the hero.
- Keep the section visually minimal: mostly the device and a subtle interaction cue.
- Allow the user to drag horizontally to rotate the device around its vertical axis.
- Make the cue feel ultra-subtle: more atmospheric than instructional, with a gentle fade in/out feel.
- Keep the hero framing intact and restore the later story framing/choreography after this section.

---

## Approved Direction

### Chosen approach

Use a free-drag stage:

- New short full-viewport section after the hero.
- Device centered and front-facing at rest.
- No supporting copy.
- A very soft ambient cue behind the device rather than explicit directional graphics.
- Horizontal drag is the primary interaction.
- Rotation range should be much wider than a small showroom wobble.

### Rejected alternatives

- Guided autoplay teaching motion before drag: clearer but heavier than desired.
- Pinned interaction window with stronger scroll choreography: too forceful for the minimal mood.
- Folding the interaction into the hero: would blur the distinction between static hero presentation and interactive exploration.

---

## Section Composition

The section should feel like a clean pause right after the hero.

- Full viewport height.
- Same light overall page language used by the redesigned hero.
- Device centered in the viewport.
- Front-facing default pose, easier to read than the hero’s bottom crop.
- No body copy, labels, or cards.
- A single diffuse halo behind the device that reads as a quiet presence cue rather than a literal drag icon.

### Cue behavior

- Cue fades in and out gently while the section is idle.
- Cue uses only very soft opacity and slight scale drift, like a slow breath.
- Cue should sit behind the device and stay low-contrast against the off-white background.
- Cue should become less prominent or disappear after the user starts dragging.
- Cue should not use arrows, text, arc outlines, or any other graphic marks that feel like UI chrome.
- Cue returns only if needed after inactivity, and should not feel distracting.

---

## Interaction Behavior

This section owns drag interaction while it is active.

- Horizontal pointer drag rotates the device on its vertical axis.
- Rotation range is intentionally broad, allowing the user to swing the device much farther left and right.
- Rotation should feel smooth, direct, and slightly inertial rather than stiff.
- On release, the device should stay near the user’s final angle rather than snapping hard back to center.
- This drag interaction is local to this section only.

### Section boundaries

- Hero remains a composed presentation state, not a drag interaction zone.
- This post-hero section enables the drag mode.
- Scrolling into later sections restores the existing story-driven choreography and disables free drag.

---

## State And Architecture

The shared 3D canvas should support multiple view modes cleanly.

### Required view modes

- `hero`: front-view hero framing already tuned for the redesigned first screen
- `rotation`: centered post-hero drag stage with free horizontal rotation
- `story`: later sections with existing scroll-driven model choreography

### Responsibilities

- App-level section ordering determines when the new section appears.
- Shared canvas state determines which view mode is active.
- Rotation section controls whether drag is enabled and whether the cue is visible.
- Story sections continue to control their own scroll choreography without inheriting hero or rotation framing.

---

## Implementation Boundaries

This slice should stay narrowly focused.

### Files likely to change

- `glimpse-web/src/App.jsx`
- `glimpse-web/src/canvas/scrollState.js`
- `glimpse-web/src/canvas/GlimpseModel.jsx`
- `glimpse-web/src/canvas/CameraRig.jsx`
- `glimpse-web/src/heroConfig.js`
- A new section component for the post-hero rotation stage
- A new CSS module for that section and/or its cue styling
- Small related tests for state helpers if useful

### Out of scope

- Redesigning hero copy or hero layout again
- Reworking the demo overlay
- Rewriting later story content
- Adding explanatory text to the new section

---

## Verification

This section is successful when:

- It appears directly after the hero.
- The device is front-facing and visually centered at rest.
- Dragging horizontally rotates it widely and smoothly.
- The cue reads as a calm atmospheric glow and stays subtle.
- The cue fades once the interaction begins.
- Scrolling onward restores the later section framing and choreography correctly.

### Testing expectations

- Add focused tests only for meaningful shared-state helpers or view-mode transitions.
- Prefer visual verification for the interaction quality and cue timing.
- Re-run existing build, lint, and relevant test suites after implementation.

---

## Risks And Decisions

- Drag sensitivity may need iteration to feel expressive without becoming loose.
- The transition from hero to rotation section must feel intentional rather than like a camera glitch.
- The cue can easily become too visible or too graphic if contrast and scale are not kept restrained.
- The handoff from free-drag to story mode must not preserve a bad rotation state into later sections.

These are acceptable risks for this phase because the section is intentionally isolated and the shared canvas architecture already exists.
