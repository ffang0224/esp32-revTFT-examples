# Glimpse Web Post-Hero Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new minimal full-viewport section after the hero where the user can drag the device horizontally with a subtle fading cue, while preserving the later story framing and choreography.

**Architecture:** Extend the shared canvas state with a dedicated `rotation` view mode and drag state so the model can switch cleanly between hero, rotation, and story behaviors. Add a new section component right after `Hero`, use it to activate drag mode and render the visual cue, and keep story sections responsible only for their own scroll-driven framing.

**Tech Stack:** React 19, Vite, CSS Modules, React Three Fiber, Drei, GSAP + ScrollTrigger, Node test runner

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `glimpse-web/src/canvas/scrollState.js` | Modify | Add explicit `rotation` view mode and drag-related shared state helpers |
| `glimpse-web/src/canvas/scrollState.test.js` | Modify | TDD coverage for hero/story/rotation state helpers |
| `glimpse-web/src/heroConfig.js` | Modify | Add rotation camera/model presets |
| `glimpse-web/src/heroConfig.test.js` | Modify | TDD coverage for rotation camera preset shape |
| `glimpse-web/src/canvas/CameraRig.jsx` | Modify | Switch camera between hero, rotation, and story presets |
| `glimpse-web/src/canvas/GlimpseModel.jsx` | Modify | Apply rotation mode offsets and drag rotation state |
| `glimpse-web/src/sections/PostHeroRotation.jsx` | Create | New post-hero full-viewport interaction section |
| `glimpse-web/src/sections/PostHeroRotation.module.css` | Create | Minimal layout and fading cue styles |
| `glimpse-web/src/App.jsx` | Modify | Insert the new section after `Hero` |
| `glimpse-web/src/sections/DilemmaStory.jsx` | Modify | Ensure later sections always opt back into story mode |
| `glimpse-web/src/sections/ScrollStory.jsx` | Modify | Ensure later sections always opt back into story mode |

---

### Task 1: Add explicit rotation view state

**Files:**
- Modify: `glimpse-web/src/canvas/scrollState.js`
- Modify: `glimpse-web/src/canvas/scrollState.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createCenteredHeroState,
  createRotationState,
  createStoryState,
} from './scrollState.js'

test('createCenteredHeroState keeps the hero model centered and screen hidden', () => {
  assert.deepEqual(createCenteredHeroState(), {
    viewMode: 'hero',
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
  })
})

test('createRotationState enables drag mode and allows overrides', () => {
  assert.deepEqual(createRotationState({ cueVisible: true }), {
    viewMode: 'rotation',
    targetX: 0,
    targetZ: 0,
    targetRotY: Math.PI,
    screenIndex: 0,
    screenImage: null,
    screenVisible: false,
    dragRotationY: 0,
    dragEnabled: true,
    cueVisible: true,
    hasUserDragged: false,
  })
})

test('createStoryState marks the model as story-framed and allows overrides', () => {
  assert.deepEqual(createStoryState({ targetX: 4, screenVisible: true }), {
    viewMode: 'story',
    targetX: 4,
    targetZ: 0,
    targetRotY: Math.PI,
    screenIndex: 0,
    screenImage: null,
    screenVisible: true,
    dragRotationY: 0,
    dragEnabled: false,
    cueVisible: false,
    hasUserDragged: false,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/canvas/scrollState.test.js`
Expected: FAIL because `createRotationState` and the new fields do not exist yet.

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
}

export function createCenteredHeroState(overrides = {}) {
  return {
    ...BASE_STATE,
    viewMode: 'hero',
    ...overrides,
  }
}

export function createRotationState(overrides = {}) {
  return {
    ...BASE_STATE,
    viewMode: 'rotation',
    dragEnabled: true,
    ...overrides,
  }
}

export function createStoryState(overrides = {}) {
  return {
    ...BASE_STATE,
    viewMode: 'story',
    ...overrides,
  }
}

export const scrollState = createCenteredHeroState()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/canvas/scrollState.test.js`
Expected: PASS.

---

### Task 2: Add rotation camera/model presets

**Files:**
- Modify: `glimpse-web/src/heroConfig.js`
- Modify: `glimpse-web/src/heroConfig.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HERO_COPY,
  HERO_FRAME_COLOR,
  HERO_CAMERA,
  STORY_CAMERA,
  ROTATION_CAMERA,
  ROTATION_MODEL,
} from './heroConfig.js'

test('hero config exports the approved title and paragraph copy', () => {
  assert.equal(HERO_COPY.title, 'Glimpse')
  assert.equal(
    HERO_COPY.body,
    "Glimpse is for moments of choice, when logic alone isn't enough. Take a glimpse into a possible future and feel which one is right."
  )
})

test('hero config keeps frame color and camera presets well formed', () => {
  assert.equal(HERO_FRAME_COLOR, '#2997ff')
  assert.equal(HERO_CAMERA.position.length, 3)
  assert.equal(HERO_CAMERA.target.length, 3)
  assert.equal(STORY_CAMERA.position.length, 3)
  assert.equal(STORY_CAMERA.target.length, 3)
  assert.equal(ROTATION_CAMERA.position.length, 3)
  assert.equal(ROTATION_CAMERA.target.length, 3)
  assert.equal(typeof ROTATION_MODEL.baseY, 'number')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/heroConfig.test.js`
Expected: FAIL because `ROTATION_CAMERA` and `ROTATION_MODEL` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```js
export const ROTATION_CAMERA = {
  position: [0, 11.2, 5.2],
  target: [0, -0.6, 0.7],
  fov: 32,
}

export const ROTATION_MODEL = {
  idleAmplitude: 0.05,
  baseY: -0.9,
  baseZ: 0.45,
  maxDragRadians: 1.15,
  dragSensitivity: 0.0048,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/heroConfig.test.js`
Expected: PASS.

---

### Task 3: Make camera and model honor rotation mode

**Files:**
- Modify: `glimpse-web/src/canvas/CameraRig.jsx`
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

- [ ] **Step 1: Update camera rig to switch between hero, rotation, and story**

```jsx
import { HERO_CAMERA, ROTATION_CAMERA, STORY_CAMERA } from '../heroConfig'

// inside useFrame
const preset =
  scrollState.viewMode === 'story'
    ? STORY_CAMERA
    : scrollState.viewMode === 'rotation'
      ? ROTATION_CAMERA
      : HERO_CAMERA
```

- [ ] **Step 2: Add drag-rotation support in `GlimpseModel.jsx`**

```jsx
import { HERO_MODEL, ROTATION_MODEL, STORY_MODEL } from '../heroConfig'

// inside useFrame
const framing =
  scrollState.viewMode === 'story'
    ? STORY_MODEL
    : scrollState.viewMode === 'rotation'
      ? ROTATION_MODEL
      : HERO_MODEL

groupRef.current.rotation.y = mroty.current + scrollState.dragRotationY
```

- [ ] **Step 3: Clamp drag state to the rotation range**

```jsx
const clampedDrag = Math.max(
  -ROTATION_MODEL.maxDragRadians,
  Math.min(ROTATION_MODEL.maxDragRadians, scrollState.dragRotationY)
)
scrollState.dragRotationY = scrollState.viewMode === 'rotation' ? clampedDrag : 0
```

- [ ] **Step 4: Verify build still succeeds**

Run: `npm run build`
Expected: PASS.

---

### Task 4: Add the post-hero rotation section

**Files:**
- Create: `glimpse-web/src/sections/PostHeroRotation.jsx`
- Create: `glimpse-web/src/sections/PostHeroRotation.module.css`
- Modify: `glimpse-web/src/App.jsx`

- [ ] **Step 1: Create the section component**

```jsx
import { useEffect, useRef } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'

import { createRotationState, scrollState } from '../canvas/scrollState'
import styles from './PostHeroRotation.module.css'

gsap.registerPlugin(ScrollTrigger)

export default function PostHeroRotation() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top center',
      end: 'bottom center',
      onEnter: () => Object.assign(scrollState, createRotationState({ cueVisible: true })),
      onEnterBack: () => Object.assign(scrollState, createRotationState({ cueVisible: true })),
      onLeave: () => {
        scrollState.dragEnabled = false
        scrollState.cueVisible = false
      },
      onLeaveBack: () => {
        Object.assign(scrollState, createCenteredHeroState())
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <section ref={sectionRef} className={styles.section} id="post-hero-rotation">
      <div className={`${styles.cue} ${scrollState.cueVisible ? styles.cueVisible : ''}`} aria-hidden="true">
        <span className={styles.arc} />
        <span className={styles.arcMirror} />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create minimal section styles**

```css
.section {
  position: relative;
  min-height: 100vh;
  z-index: 2;
  pointer-events: none;
}

.cue {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.35s ease;
}

.cueVisible {
  opacity: 1;
  animation: cuePulse 2.4s ease-in-out infinite;
}

.arc,
.arcMirror {
  position: absolute;
  width: min(74vw, 760px);
  height: min(12vw, 110px);
  border: 4px solid rgba(239, 24, 18, 0.9);
  border-color: rgba(239, 24, 18, 0.9) transparent transparent transparent;
  border-radius: 50%;
  transform: translateY(3rem);
}

.arcMirror {
  transform: translateY(3rem) scaleX(-1);
}

@keyframes cuePulse {
  0%, 100% { opacity: 0.28; }
  50% { opacity: 0.8; }
}
```

- [ ] **Step 3: Insert the section after `Hero`**

```jsx
import PostHeroRotation from './sections/PostHeroRotation'

// inside <main>
<Hero />
<PostHeroRotation />
<DilemmaStory />
```

- [ ] **Step 4: Run build to verify the new section compiles**

Run: `npm run build`
Expected: PASS.

---

### Task 5: Wire actual horizontal drag behavior

**Files:**
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`
- Modify: `glimpse-web/src/sections/PostHeroRotation.jsx`

- [ ] **Step 1: Add pointer tracking in `GlimpseModel.jsx`**

```jsx
useEffect(() => {
  const onPointerMove = (event) => {
    if (!scrollState.dragEnabled || !(event.buttons & 1)) return

    scrollState.dragRotationY += event.movementX * ROTATION_MODEL.dragSensitivity
    scrollState.hasUserDragged = true
    scrollState.cueVisible = false
  }

  window.addEventListener('pointermove', onPointerMove)
  return () => window.removeEventListener('pointermove', onPointerMove)
}, [])
```

- [ ] **Step 2: Reset drag on entry to the rotation section**

```jsx
onEnter: () => Object.assign(scrollState, createRotationState({
  cueVisible: true,
  dragRotationY: 0,
  hasUserDragged: false,
}))
```

- [ ] **Step 3: Keep the cue visible only before the first drag**

```jsx
const showCue = scrollState.cueVisible && !scrollState.hasUserDragged
```

- [ ] **Step 4: Verify the interaction and run all checks**

Run: `node --test src/heroConfig.test.js src/canvas/scrollState.test.js src/data/dilemmaData.test.js src/sections/dilemmaStoryState.test.js && npm run build && npm run lint`
Expected: PASS. In the browser, the new section appears after the hero, the device is front-facing, horizontal drag rotates it widely, the cue fades away once drag begins, and later sections regain story framing.

---

## Self-Review

**Spec coverage:**
- New section immediately after hero: Task 4
- Minimal layout and subtle cue: Task 4
- Horizontal drag as the main interaction: Task 5
- Wide left-right rotation range: Task 2 and Task 5
- Cue fades when the user drags: Task 5
- Later sections restore story framing: Tasks 1, 3, and 5

**Placeholder scan:** No TODO/TBD placeholders remain.

**Type consistency:** `createCenteredHeroState`, `createRotationState`, `createStoryState`, `ROTATION_CAMERA`, `ROTATION_MODEL`, `dragRotationY`, `dragEnabled`, `cueVisible`, and `hasUserDragged` are introduced once and reused consistently throughout the plan.
