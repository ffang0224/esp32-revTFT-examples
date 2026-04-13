# Glimpse Web Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `glimpse-web` first viewport to match the approved white editorial hero while keeping the live 3D model and preserving downstream behavior.

**Architecture:** Add a small hero configuration module so the approved copy and hero interaction rules are testable without introducing JSX test infrastructure. Then retheme the hero, nav, and app framing around the white inset frame, and finally retune the canvas/model composition so the 3D device sits low and centered with quieter hero behavior.

**Tech Stack:** React 19, Vite, CSS Modules, React Three Fiber, Drei, Node test runner

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `glimpse-web/src/heroConfig.js` | Create | Source of truth for approved hero copy, frame color, camera values, and hero interaction lock threshold |
| `glimpse-web/src/heroConfig.test.js` | Create | TDD coverage for exact approved hero copy and hero interaction behavior |
| `glimpse-web/src/sections/Hero.jsx` | Modify | Render the centered minimal hero using `heroConfig` |
| `glimpse-web/src/sections/Hero.module.css` | Modify | Hero layout, centered typography, white stage spacing |
| `glimpse-web/src/sections/Nav.jsx` | Modify | Keep current nav behavior while supporting a light hero theme |
| `glimpse-web/src/sections/Nav.module.css` | Modify | Restyle nav for the white framed hero and preserve the existing hidden/demo states |
| `glimpse-web/src/App.jsx` | Modify | Use hero camera config and pass any light-hero state needed by nav or canvas |
| `glimpse-web/src/App.module.css` | Modify | Add the inset blue frame and keep the shared canvas/content layering intact |
| `glimpse-web/src/canvas/GlimpseModel.jsx` | Modify | Retune hero pose and suppress drag while the page is still in the hero zone |
| `glimpse-web/src/styles/globals.css` | Modify | Shift base tokens to support the hero-first white background without breaking later sections |

---

### Task 1: Add testable hero configuration

**Files:**
- Create: `glimpse-web/src/heroConfig.js`
- Create: `glimpse-web/src/heroConfig.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HERO_COPY,
  HERO_FRAME_COLOR,
  HERO_CAMERA,
  isHeroInteractionLocked,
} from './heroConfig.js'

test('hero config exports the approved title and paragraph copy', () => {
  assert.equal(HERO_COPY.title, 'Glimpse')
  assert.equal(
    HERO_COPY.body,
    "Glimpse is for moments of choice, when logic alone isn't enough. Take a glimpse into a possible future and feel which one is right."
  )
})

test('hero config keeps the bright blue frame and a three-value camera position', () => {
  assert.equal(HERO_FRAME_COLOR, '#2997ff')
  assert.equal(HERO_CAMERA.position.length, 3)
  assert.equal(typeof HERO_CAMERA.fov, 'number')
})

test('hero interaction lock is enabled in the first viewport and released after it', () => {
  assert.equal(isHeroInteractionLocked(0, 1000), true)
  assert.equal(isHeroInteractionLocked(650, 1000), true)
  assert.equal(isHeroInteractionLocked(980, 1000), false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/heroConfig.test.js`
Expected: FAIL with module-not-found or missing export errors because `src/heroConfig.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```js
export const HERO_COPY = {
  title: 'Glimpse',
  body: "Glimpse is for moments of choice, when logic alone isn't enough. Take a glimpse into a possible future and feel which one is right.",
}

export const HERO_FRAME_COLOR = '#2997ff'

export const HERO_CAMERA = {
  position: [0, 12.25, 6.35],
  fov: 35,
}

export const HERO_MODEL = {
  idleAmplitude: 0.03,
  dragUnlockRatio: 0.98,
}

export function isHeroInteractionLocked(scrollY, viewportHeight) {
  if (!viewportHeight) return true
  return scrollY < viewportHeight * HERO_MODEL.dragUnlockRatio
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/heroConfig.test.js`
Expected: PASS with 3 passing tests and 0 failures.

---

### Task 2: Rebuild the hero markup around the approved copy

**Files:**
- Modify: `glimpse-web/src/sections/Hero.jsx`
- Modify: `glimpse-web/src/sections/Nav.jsx`

- [ ] **Step 1: Update `Hero.jsx` to use the approved copy and remove old hero-only elements**

```jsx
import { HERO_COPY } from '../heroConfig'
import styles from './Hero.module.css'

export default function Hero() {
  return (
    <section className={styles.hero} id="hero">
      <div className={styles.content}>
        <h1 className={styles.title}>{HERO_COPY.title}</h1>
        <p className={styles.sub}>{HERO_COPY.body}</p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Keep the nav but mark it as a light-hero navigation**

```jsx
import styles from './Nav.module.css'

export default function Nav({ lenisRef, hidden = false, onTryIt, light = false }) {
  const handleClick = (e, target) => {
    e.preventDefault()
    const lenis = lenisRef?.current
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.4 })
    } else {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav className={`${styles.nav} ${light ? styles.light : ''} ${hidden ? styles.hidden : ''}`}>
      <a href="#" className={styles.logo} onClick={e => handleClick(e, '#hero')}>Glimpse</a>
      <ul className={styles.links}>
        <li><a href="#scroll-story" onClick={e => handleClick(e, '#scroll-story')}>The Device</a></li>
        <li><a href="#how-it-works" onClick={e => handleClick(e, '#how-it-works')}>How it works</a></li>
        <li><a href="#specs" onClick={e => handleClick(e, '#specs')}>Specs</a></li>
        <li>
          <button className={styles.tryItButton} onClick={onTryIt}>
            Try it
          </button>
        </li>
      </ul>
    </nav>
  )
}
```

- [ ] **Step 3: Verify the hero markup compiles**

Run: `npm run build`
Expected: PASS. The hero now renders only the centered title and paragraph, and the nav still builds with the new `light` prop.

---

### Task 3: Restyle the hero, nav, and frame

**Files:**
- Modify: `glimpse-web/src/sections/Hero.module.css`
- Modify: `glimpse-web/src/sections/Nav.module.css`
- Modify: `glimpse-web/src/App.module.css`
- Modify: `glimpse-web/src/styles/globals.css`

- [ ] **Step 1: Rewrite `Hero.module.css` for the centered editorial layout**

```css
.hero {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: start center;
  padding: 18vh 2rem 10rem;
  z-index: 2;
  pointer-events: none;
}

.content {
  width: min(100%, 32rem);
  display: grid;
  justify-items: center;
  gap: 1.2rem;
  text-align: center;
}

.title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(3.5rem, 6vw, 5rem);
  line-height: 0.95;
  font-weight: 700;
  color: #111111;
}

.sub {
  max-width: 24rem;
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  line-height: 1.35;
  color: #222222;
}
```

- [ ] **Step 2: Restyle `Nav.module.css` for the white framed hero**

```css
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 500;
  padding: 2rem 2.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: auto;
  transition: opacity 0.3s, color 0.3s;
}

.light .logo {
  color: #111111;
}

.light .links a {
  color: rgba(17, 17, 17, 0.72);
}

.light .links a:hover {
  color: #111111;
}

.light .tryItButton {
  background: rgba(255, 255, 255, 0.82);
  color: #111111;
  border-color: #2997ff;
}
```

- [ ] **Step 3: Add the inset frame and white first-screen feel in `App.module.css`**

```css
.main {
  pointer-events: none;
  position: relative;
  z-index: 2;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.main::before {
  content: '';
  position: fixed;
  inset: 16px;
  border: 3px solid #2997ff;
  z-index: 40;
  pointer-events: none;
}
```

- [ ] **Step 4: Update `globals.css` tokens for the new hero-first palette**

```css
:root {
  --bg: #ffffff;
  --bg-mid: #f6f7fb;
  --text: #111111;
  --text-dim: rgba(17, 17, 17, 0.82);
  --text-muted: rgba(17, 17, 17, 0.6);
  --accent: #2997ff;
  --accent-soft: rgba(41, 151, 255, 0.78);
  --border: rgba(17, 17, 17, 0.18);
  --border-dim: rgba(17, 17, 17, 0.12);
}
```

- [ ] **Step 5: Verify the layout visually and with a production build**

Run: `npm run build`
Expected: PASS. The hero is white, framed, centered, and the nav reads clearly on the lighter background.

---

### Task 4: Retune the 3D hero framing and suppress hero drag

**Files:**
- Modify: `glimpse-web/src/App.jsx`
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

- [ ] **Step 1: Use the hero camera config in `App.jsx`**

```jsx
import { HERO_CAMERA } from './heroConfig'

// inside the component return
<Nav lenisRef={lenisRef} hidden={navHidden} onTryIt={openDemo} light />

<Canvas
  frameloop="demand"
  dpr={[1, 1.5]}
  camera={{ position: HERO_CAMERA.position, fov: HERO_CAMERA.fov, near: 0.1, far: 1000 }}
  gl={{
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  }}
>
```

- [ ] **Step 2: Retune `GlimpseModel.jsx` for a quieter hero pose and scroll-aware drag locking**

```jsx
import { HERO_MODEL, isHeroInteractionLocked } from '../heroConfig'

// inside pointerdown
const onDown = e => {
  if (isHeroInteractionLocked(window.scrollY, window.innerHeight)) return
  dragging = true
  lastX = e.clientX
  canvas.style.cursor = 'grabbing'
}

// inside useFrame
groupRef.current.position.x = mx.current
groupRef.current.position.y = Math.sin(t * 0.55) * HERO_MODEL.idleAmplitude
groupRef.current.position.z = mz.current - 0.2
groupRef.current.rotation.y = mroty.current
```

- [ ] **Step 3: Set the default hero scroll-state values so the device sits low and centered**

```jsx
// near module scope or initial state setup
scrollState.targetX = 0
scrollState.targetZ = 0
scrollState.targetRotY = Math.PI
```

- [ ] **Step 4: Verify the hero visually and run all automated checks**

Run: `node --test src/heroConfig.test.js src/data/dilemmaData.test.js src/sections/dilemmaStoryState.test.js && npm run build && npm run lint`
Expected: PASS on all tests, build, and lint. In the browser, the model stays live, sits low and centered, and does not feel draggable while the page is still in the hero viewport.

---

## Self-Review

**Spec coverage:**
- Approved centered copy and minimal hero: Task 2 and Task 3
- Thin bright-blue inset frame on white background: Task 3
- Keep and restyle nav for the hero: Task 2 and Task 3
- Keep live 3D model with quieter hero staging: Task 4
- Suppress hero interactivity without removing later behavior: Task 1 and Task 4
- Preserve downstream behavior: Task 4 verification

**Placeholder scan:** No TODO/TBD markers or missing commands remain.

**Type consistency:** `HERO_COPY`, `HERO_CAMERA`, `HERO_MODEL`, and `isHeroInteractionLocked()` are defined in Task 1 and then reused consistently in Tasks 2 and 4.
