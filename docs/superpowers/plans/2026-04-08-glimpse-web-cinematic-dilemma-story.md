# Glimpse Web Cinematic Dilemma Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current homepage `DilemmaStory` with a single pinned cinematic sequence where a realistic phone UI rises over the centered device, plays through a guided dilemma/values flow, then hands back to the device for fortune, elapsed-time, and reject-button beats.

**Architecture:** Keep the global R3F canvas and shared scroll state, but replace the current side-by-side story with a single pinned section driven by explicit cinematic phases. The phone UI remains DOM-based for realism and layout control, while the 3D model stays in the canvas and responds to section-specific visual state such as dimming, screen content, ring visibility, and reject-button emphasis. Use small helper functions to map scroll progress to phase state so the visuals remain testable and the section stays maintainable.

**Tech Stack:** React 19, Vite, CSS Modules, React Three Fiber, Drei, GSAP + ScrollTrigger, Node test runner

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `glimpse-web/src/App.jsx` | Modify | Keep section ordering, retain rotation section, and continue rendering the new cinematic story in the homepage scroll |
| `glimpse-web/src/canvas/scrollState.js` | Modify | Expand shared state with cinematic device flags such as device dimming, ring visibility, reject glow, and scripted screen state |
| `glimpse-web/src/canvas/scrollState.test.js` | Modify | Cover new shared-state helpers or defaults if helper shape changes |
| `glimpse-web/src/canvas/GlimpseModel.jsx` | Modify | Read new cinematic flags, handle screen changes, and apply visual emphasis to the device when the phone overlays it |
| `glimpse-web/src/canvas/CameraRig.jsx` | Modify | Smoothly hold or transition the camera through the cinematic section without abrupt hero/rotation/story jumps |
| `glimpse-web/src/heroConfig.js` | Modify | Add any camera/model constants needed for the cinematic story framing |
| `glimpse-web/src/heroConfig.test.js` | Modify | Validate any new config exports used by the cinematic section |
| `glimpse-web/src/sections/DilemmaStory.jsx` | Replace implementation | Own the pinned cinematic sequence and render the realistic phone overlay |
| `glimpse-web/src/sections/DilemmaStory.module.css` | Replace implementation | Define the centered stacked composition, realistic phone UI, keyboard animation, overlay layering, and responsive behavior |
| `glimpse-web/src/sections/dilemmaStoryState.js` | Replace/expand | Map scroll progress to story phases, phone state, fortunes, highlights, blink count, ring, and reject glow |
| `glimpse-web/src/sections/dilemmaStoryState.test.js` | Modify | TDD coverage for the new phase/state mapping helpers |

---

### Task 1: Replace story-state helpers with explicit cinematic phases

**Files:**
- Modify: `glimpse-web/src/sections/dilemmaStoryState.js`
- Modify: `glimpse-web/src/sections/dilemmaStoryState.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getCinematicStoryState,
  getKeyboardVisibility,
  getPhoneOverlayState,
} from './dilemmaStoryState.js'

test('phone remains peeking below device at the start', () => {
  const state = getCinematicStoryState(0.04)

  assert.equal(state.phase, 'device-peek')
  assert.equal(state.phoneVisible, true)
  assert.equal(state.keyboardVisible, false)
  assert.equal(state.deviceDimmed, false)
})

test('typing phase shows keyboard and input text growth', () => {
  const state = getCinematicStoryState(0.28)

  assert.equal(state.phase, 'typing')
  assert.equal(state.keyboardVisible, true)
  assert.ok(state.typedDilemma.length > 0)
  assert.ok(state.typedDilemma.length < state.fullDilemma.length)
})

test('values phase hides keyboard and highlights scripted values', () => {
  const state = getCinematicStoryState(0.47)

  assert.equal(state.phase, 'values')
  assert.equal(state.keyboardVisible, false)
  assert.ok(state.visibleValues.length > 0)
  assert.deepEqual(state.highlightedValueIndices, [1, 3])
})

test('device phases expose blink, ring, and reject glow states later in the timeline', () => {
  const blink = getCinematicStoryState(0.7)
  const ring = getCinematicStoryState(0.82)
  const reject = getCinematicStoryState(0.9)
  const secondFortune = getCinematicStoryState(0.97)

  assert.equal(blink.phase, 'fortune-one')
  assert.equal(blink.blinkCount, 3)

  assert.equal(ring.phase, 'day-passes')
  assert.equal(ring.greenRingVisible, true)

  assert.equal(reject.phase, 'reject-pulse')
  assert.equal(reject.rejectGlowVisible, true)

  assert.equal(secondFortune.phase, 'fortune-two')
  assert.equal(secondFortune.deviceFortuneIndex, 1)
})

test('phone overlay state keeps the phone centered while it is foregrounded', () => {
  const rise = getPhoneOverlayState(0.18)
  const values = getPhoneOverlayState(0.48)
  const depart = getPhoneOverlayState(0.62)

  assert.ok(rise.translateY > 0)
  assert.equal(values.centered, true)
  assert.ok(depart.translateY > 0)
})

test('keyboard visibility only stays true during the typing beat', () => {
  assert.equal(getKeyboardVisibility(0.1), false)
  assert.equal(getKeyboardVisibility(0.3), true)
  assert.equal(getKeyboardVisibility(0.5), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/sections/dilemmaStoryState.test.js`

Expected: FAIL because the current helper exports and phase mapping do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```js
const PHASES = {
  devicePeek: [0, 0.12],
  phoneRise: [0.12, 0.24],
  typing: [0.24, 0.38],
  values: [0.38, 0.56],
  phoneDepart: [0.56, 0.66],
  fortuneOne: [0.66, 0.76],
  dayPasses: [0.76, 0.88],
  rejectPulse: [0.88, 0.94],
  fortuneTwo: [0.94, 1],
}

const SCRIPTED_DILEMMA = 'Decide where to live after graduation'
const SCRIPTED_VALUES = [
  'Feeling grounded and supported',
  'Career growth and ambition',
  'Closeness to people I love',
  'Freedom and new experiences',
]

function clamp(progress) {
  return Math.max(0, Math.min(progress, 1))
}

function between(progress, start, end) {
  const safe = clamp(progress)
  if (safe <= start) return 0
  if (safe >= end) return 1
  return (safe - start) / (end - start)
}

export function getKeyboardVisibility(progress) {
  const safe = clamp(progress)
  return safe >= PHASES.typing[0] && safe < PHASES.typing[1]
}

export function getPhoneOverlayState(progress) {
  const safe = clamp(progress)

  if (safe < PHASES.phoneRise[0]) {
    return { centered: false, translateY: 180, opacity: 1 }
  }

  if (safe < PHASES.phoneRise[1]) {
    return {
      centered: false,
      translateY: 180 * (1 - between(safe, PHASES.phoneRise[0], PHASES.phoneRise[1])),
      opacity: 1,
    }
  }

  if (safe < PHASES.phoneDepart[0]) {
    return { centered: true, translateY: 0, opacity: 1 }
  }

  if (safe < PHASES.phoneDepart[1]) {
    return {
      centered: true,
      translateY: 220 * between(safe, PHASES.phoneDepart[0], PHASES.phoneDepart[1]),
      opacity: 1 - between(safe, PHASES.phoneDepart[0], PHASES.phoneDepart[1]),
    }
  }

  return { centered: false, translateY: 240, opacity: 0 }
}

export function getCinematicStoryState(progress) {
  const safe = clamp(progress)
  const phone = getPhoneOverlayState(safe)
  const dilemmaRatio = between(safe, PHASES.typing[0], PHASES.typing[1])

  let phase = 'fortune-two'
  if (safe < PHASES.phoneRise[0]) phase = 'device-peek'
  else if (safe < PHASES.phoneRise[1]) phase = 'phone-rise'
  else if (safe < PHASES.typing[1]) phase = 'typing'
  else if (safe < PHASES.phoneDepart[0]) phase = 'values'
  else if (safe < PHASES.phoneDepart[1]) phase = 'phone-depart'
  else if (safe < PHASES.fortuneOne[1]) phase = 'fortune-one'
  else if (safe < PHASES.dayPasses[1]) phase = 'day-passes'
  else if (safe < PHASES.rejectPulse[1]) phase = 'reject-pulse'

  return {
    phase,
    fullDilemma: SCRIPTED_DILEMMA,
    typedDilemma: SCRIPTED_DILEMMA.slice(0, Math.ceil(SCRIPTED_DILEMMA.length * dilemmaRatio)),
    visibleValues: safe >= PHASES.values[0] ? SCRIPTED_VALUES : [],
    highlightedValueIndices: safe >= 0.46 ? [1, 3] : [],
    phoneVisible: phone.opacity > 0,
    keyboardVisible: getKeyboardVisibility(safe),
    deviceDimmed: safe >= PHASES.phoneRise[1] && safe < PHASES.phoneDepart[1],
    blinkCount: phase === 'fortune-one' ? 3 : 0,
    greenRingVisible: phase === 'day-passes',
    rejectGlowVisible: phase === 'reject-pulse',
    deviceFortuneIndex: phase === 'fortune-two' ? 1 : phase === 'fortune-one' ? 0 : -1,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/sections/dilemmaStoryState.test.js`

Expected: PASS.

---

### Task 2: Extend shared canvas state for cinematic device effects

**Files:**
- Modify: `glimpse-web/src/canvas/scrollState.js`
- Modify: `glimpse-web/src/canvas/scrollState.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { createStoryState } from './scrollState.js'

test('createStoryState includes cinematic device effect defaults', () => {
  assert.deepEqual(createStoryState(), {
    viewMode: 'story',
    targetX: 0,
    targetZ: 0,
    targetRotY: Math.PI,
    screenIndex: 0,
    screenImage: null,
    screenVisible: false,
    dragRotationY: 0,
    dragEnabled: false,
    cueVisible: false,
    hasUserDragged: false,
    deviceDimmed: false,
    greenRingVisible: false,
    rejectGlowVisible: false,
    blinkCount: 0,
    deviceFortuneIndex: -1,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/canvas/scrollState.test.js`

Expected: FAIL because the cinematic device flags are missing.

- [ ] **Step 3: Write the minimal implementation**

```js
const BASE_STATE = {
  targetX: 0,
  targetZ: 0,
  targetRotY: Math.PI,
  screenIndex: 0,
  screenImage: null,
  screenVisible: false,
  dragRotationY: 0,
  dragEnabled: false,
  cueVisible: false,
  hasUserDragged: false,
  deviceDimmed: false,
  greenRingVisible: false,
  rejectGlowVisible: false,
  blinkCount: 0,
  deviceFortuneIndex: -1,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/canvas/scrollState.test.js`

Expected: PASS.

---

### Task 3: Add cinematic camera/model configuration

**Files:**
- Modify: `glimpse-web/src/heroConfig.js`
- Modify: `glimpse-web/src/heroConfig.test.js`
- Modify: `glimpse-web/src/canvas/CameraRig.jsx`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HERO_CAMERA,
  ROTATION_CAMERA,
  STORY_CAMERA,
  CINEMATIC_STORY_CAMERA,
  CINEMATIC_STORY_MODEL,
} from './heroConfig.js'

test('cinematic story config exposes camera and model presets', () => {
  assert.equal(HERO_CAMERA.position.length, 3)
  assert.equal(ROTATION_CAMERA.position.length, 3)
  assert.equal(STORY_CAMERA.position.length, 3)
  assert.equal(CINEMATIC_STORY_CAMERA.position.length, 3)
  assert.equal(CINEMATIC_STORY_CAMERA.target.length, 3)
  assert.equal(typeof CINEMATIC_STORY_MODEL.baseY, 'number')
  assert.equal(typeof CINEMATIC_STORY_MODEL.baseZ, 'number')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/heroConfig.test.js`

Expected: FAIL because the cinematic story config exports do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```js
export const CINEMATIC_STORY_CAMERA = {
  position: [0, 10.4, 5.35],
  target: [0, -0.65, 0.72],
  fov: 31,
}

export const CINEMATIC_STORY_MODEL = {
  idleAmplitude: 0.04,
  baseY: -0.88,
  baseZ: 0.38,
}
```

Then update `CameraRig.jsx` so `story` mode uses `CINEMATIC_STORY_CAMERA` during the new cinematic section rather than jumping to the old side-story framing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/heroConfig.test.js`

Expected: PASS.

---

### Task 4: Rebuild `DilemmaStory` as a single pinned cinematic section

**Files:**
- Modify: `glimpse-web/src/sections/DilemmaStory.jsx`
- Modify: `glimpse-web/src/sections/DilemmaStory.module.css`

- [ ] **Step 1: Replace the section structure**

Write the section so it has:

- one pinned `section`
- one centered phone overlay layer
- one underlay/device-presence layer
- no side-by-side columns
- no stage-dot UI

Core structure:

```jsx
<section ref={sectionRef} className={styles.section} id="dilemma-story">
  <div className={styles.sticky}>
    <div className={styles.deviceUnderlay} aria-hidden="true" />

    <div
      className={styles.phoneShell}
      style={{
        opacity: phoneOverlay.opacity,
        transform: `translateY(${phoneOverlay.translateY}px)`,
      }}
    >
      <div className={styles.phoneHeader}>
        <div className={styles.grabber} />
        <button className={styles.closeMock} type="button" tabIndex={-1} aria-hidden="true">
          ×
        </button>
      </div>

      <div className={styles.phoneScreen}>
        {storyState.phase === 'typing' || storyState.phase === 'phone-rise' ? (
          <TypingScreen ... />
        ) : (
          <ValuesScreen ... />
        )}
      </div>

      <div className={`${styles.keyboard} ${storyState.keyboardVisible ? styles.keyboardVisible : ''}`}>
        {/* iOS-like keyboard rows */}
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Wire the timeline to shared canvas state**

Inside `onUpdate`, map the cinematic state to `scrollState`:

```jsx
const storyState = getCinematicStoryState(self.progress)
const phoneOverlay = getPhoneOverlayState(self.progress)

setPhoneOverlay(phoneOverlay)
setStoryState(storyState)

Object.assign(scrollState, createStoryState({
  targetX: 0,
  targetZ: 0,
  targetRotY: Math.PI,
  screenVisible: storyState.deviceFortuneIndex >= 0,
  screenIndex: storyState.deviceFortuneIndex >= 0 ? storyState.deviceFortuneIndex : 0,
  screenImage: null,
  deviceDimmed: storyState.deviceDimmed,
  greenRingVisible: storyState.greenRingVisible,
  rejectGlowVisible: storyState.rejectGlowVisible,
  blinkCount: storyState.blinkCount,
  deviceFortuneIndex: storyState.deviceFortuneIndex,
}))
```

- [ ] **Step 3: Replace the CSS with a centered stacked composition**

The new CSS should:

- pin the section
- center the phone
- let the phone rise from below
- keep the device underlay visible
- include a realistic keyboard panel with spring-like feel
- stay mobile-safe without side-by-side columns

Required direction:

```css
.sticky {
  position: sticky;
  top: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 0 4vw;
}

.phoneShell {
  position: relative;
  width: min(92vw, 420px);
  min-height: min(78vh, 760px);
  border-radius: 34px 34px 0 0;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 30px 90px rgba(12, 16, 22, 0.14);
  z-index: 3;
}

.keyboard {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -320px;
  transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease;
}

.keyboardVisible {
  transform: translateY(-320px);
  opacity: 1;
}
```

- [ ] **Step 4: Remove the old side-story artifacts**

Delete or stop using:

- side columns
- meta pills
- step track
- stage dots
- old phone mock shell
- device frame panel used only for the side-by-side layout

- [ ] **Step 5: Run build to verify the section compiles**

Run: `npm run build`

Expected: PASS.

---

### Task 5: Make the 3D device react to cinematic state

**Files:**
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

- [ ] **Step 1: Add device dimming support**

When `scrollState.deviceDimmed` is true:

- slightly lower material opacity/brightness perception
- keep silhouette visible
- do not fully hide the object

Implementation direction:

```jsx
scene.traverse(node => {
  if (!node.isMesh) return

  const targetOpacity = scrollState.deviceDimmed ? 0.42 : 1
  node.material.transparent = targetOpacity < 1
  node.material.opacity = targetOpacity
})
```

- [ ] **Step 2: Add a green ring overlay and reject-button glow hooks**

Locate or approximate:

- the reject button mesh by name if available
- otherwise attach a small helper glow mesh near the expected button position

Also add a faint green ring mesh around the device that is toggled by `scrollState.greenRingVisible`.

- [ ] **Step 3: Add blink pulse handling**

Use `scrollState.blinkCount` to briefly pulse the screen/material visibility during the `fortune-one` beat. Keep the pulses readable and spaced rather than flickery.

- [ ] **Step 4: Keep performance under control**

Avoid per-frame object recreation:

- cache traversed meshes in refs
- reuse materials/helpers
- only mutate existing properties inside `useFrame`

- [ ] **Step 5: Run build to verify the canvas still renders**

Run: `npm run build`

Expected: PASS.

---

### Task 6: Improve load/performance around the capstone interaction

**Files:**
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`
- Modify: `glimpse-web/src/App.jsx`

- [ ] **Step 1: Preload and cache aggressively**

Keep:

```jsx
useGLTF.preload('/glimpse_model4.glb')
```

Also ensure the section code does not trigger avoidable re-renders by:

- deriving timeline state in helpers
- avoiding large inline arrays/objects inside render

- [ ] **Step 2: Reduce avoidable frame churn**

Only call `invalidate()` when animated values or screen content actually change.

Target structure:

```jsx
const lastVisualStateRef = useRef('')
const visualStateKey = `${scrollState.screenVisible}-${scrollState.screenIndex}-${scrollState.deviceDimmed}-${scrollState.greenRingVisible}-${scrollState.rejectGlowVisible}-${scrollState.blinkCount}`

if (lastVisualStateRef.current !== visualStateKey) {
  lastVisualStateRef.current = visualStateKey
  invalidate()
}
```

- [ ] **Step 3: Keep mobile layout lightweight**

Ensure the DOM phone overlay:

- does not mount duplicate large trees unnecessarily
- uses CSS transitions/transforms instead of layout-thrashing properties
- avoids expensive blur stacks beyond what is visually needed

- [ ] **Step 4: Run browser-oriented verification commands**

Run:

```bash
npm run build
npm run lint
node --test src/canvas/scrollState.test.js src/heroConfig.test.js src/sections/dilemmaStoryState.test.js
```

Expected: all PASS.

---

### Task 7: Verify cinematic UX end-to-end

**Files:**
- No new files required

- [ ] **Step 1: Verify the top of the sequence in-browser**

Confirm:

- device centered
- phone peeking from below
- no side-by-side layout

- [ ] **Step 2: Verify typing beat**

Confirm:

- phone rises smoothly
- prompt reads `What dilemma do you want to solve?`
- keyboard appears only here
- keyboard motion feels iOS-like and polished

- [ ] **Step 3: Verify values beat**

Confirm:

- keyboard dismisses
- `What matters to you in this decision?` appears
- values reveal in sequence
- selected values are visibly highlighted or underlined

- [ ] **Step 4: Verify device beats**

Confirm:

- phone slides away without a jump
- device blinks exactly three times
- first fortune appears
- green ring appears for 24-hour beat
- reject button gets faint red glow with restrained pulse
- second fortune appears

- [ ] **Step 5: Verify mobile layout**

Confirm:

- centered stacked composition survives narrower widths
- no desktop-only side columns remain
- phone still feels foregrounded and readable on small screens

---

## Self-Review

**Spec coverage:**
- Replace side-by-side story entirely: Task 4
- Phone peeks, rises, overlays device: Tasks 1 and 4
- Realistic phone UI and keyboard only during typing: Tasks 1 and 4
- Hardcoded values with highlights: Tasks 1 and 4
- Phone slides down and device returns: Tasks 1 and 4
- Three blinks and first fortune: Tasks 1 and 5
- 24-hour ring: Tasks 1 and 5
- Reject-button glow and haptic-like emphasis: Tasks 1 and 5
- Second fortune: Tasks 1 and 5
- Mobile-first stacked composition: Task 4 and Task 7
- Performance and capstone polish: Tasks 5, 6, and 7

**Placeholder scan:**
- No `TODO`, `TBD`, or “similar to above” placeholders remain.

**Type consistency:**
- Shared names are consistent across the plan: `getCinematicStoryState`, `getKeyboardVisibility`, `getPhoneOverlayState`, `deviceDimmed`, `greenRingVisible`, `rejectGlowVisible`, `blinkCount`, and `deviceFortuneIndex`.
