# Glimpse Web Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix canvas performance lag and add an immersive "Try it" demo overlay that simulates sending a prompt from a phone to the Glimpse e-ink device.

**Architecture:** A new `DemoOverlay` component lives always in the DOM at z-index 600, invisible by default. Clicking "Try it" in Hero runs a GSAP timeline that fades `<main>` out and fades the overlay in — no second canvas, no second GLB load. The existing fixed canvas shows through the dark overlay background. `frameloop="demand"` + `invalidate()` in `useFrame` reduces wasted GPU renders from React state updates.

**Tech Stack:** React 19, @react-three/fiber, @react-three/drei, GSAP + ScrollTrigger, Lenis, CSS Modules

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/demoImages.js` | Create | Single source of truth for all image paths used in demo and ScrollStory |
| `src/DemoOverlay.jsx` | Create | Full overlay component: phone mockup, input, send flow, status states |
| `src/DemoOverlay.module.css` | Create | Phone frame, input, button, send animation, overlay layout |
| `src/canvas/GlimpseModel.jsx` | Modify | Use DEMO_IMAGES, add `invalidate()` in `useFrame` |
| `src/App.jsx` | Modify | `frameloop="demand"`, render overlay, wire `openDemo`/`closeDemo`, pass `lenisRef` to Nav |
| `src/sections/Hero.jsx` | Modify | Add "Try it" button with `onTryIt` prop |
| `src/sections/Hero.module.css` | Modify | Style "Try it" button |
| `src/sections/Nav.jsx` | Modify | Accept `lenisRef`, intercept anchor clicks to use Lenis scrollTo |

---

## Task 1: Create demoImages.js

**Files:**
- Create: `src/demoImages.js`

- [ ] **Step 1: Create the file**

```js
// src/demoImages.js
// Add more images to public/imgs/ and list them here.
// The first 3 entries are used by the scroll story stages (indices 0, 1, 2).
export const DEMO_IMAGES = [
  '/imgs/screen1.png',
  '/imgs/screen2.png',
  '/imgs/screen3.png',
]
```

- [ ] **Step 2: Verify the file exists**

Run: `ls /path/to/glimpse-web/src/demoImages.js`  
Expected: file present.

- [ ] **Step 3: Commit**

```bash
git add src/demoImages.js
git commit -m "feat: add demoImages config for e-ink screen textures"
```

---

## Task 2: Performance fix — frameloop demand + expand textures in GlimpseModel

**Files:**
- Modify: `src/canvas/GlimpseModel.jsx`

Current `GlimpseModel.jsx` hardcodes 3 texture paths and runs `useFrame` on every tick regardless of React state changes. We switch to `DEMO_IMAGES` and add `invalidate()` so R3F only re-renders when needed.

- [ ] **Step 1: Update GlimpseModel.jsx**

Replace the entire file content:

```jsx
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DEMO_IMAGES } from '../demoImages'

// Shared mutable state — written by GSAP (DOM), read by R3F (canvas)
export const scrollState = {
  targetX: 0,
  targetZ: 0,
  targetRotY: Math.PI,
  screenIndex: 0,
  dragOffset: 0,
  dragVelocity: 0,
}

function lerp(a, b, t) { return a + (b - a) * t }

export default function GlimpseModel() {
  const groupRef      = useRef()
  const screenMeshRef = useRef(null)
  const currentTexRef = useRef(0)

  const { gl }    = useThree()
  const { scene } = useGLTF('/glimpse_model4.glb')
  const textures  = useTexture(DEMO_IMAGES)

  // Configure textures once
  useEffect(() => {
    textures.forEach(t => {
      t.flipY = false
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = THREE.RepeatWrapping
      t.repeat.x = -1
      t.offset.x = 1
      t.generateMipmaps = false
      t.needsUpdate = true
    })
  }, [textures])

  // Find screen mesh
  useEffect(() => {
    scene.traverse(node => {
      if (!node.isMesh) return
      node.material.transparent = false
      node.material.opacity = 1
      if (node.name.toLowerCase().includes('simulation_e_ink')) {
        screenMeshRef.current = node
        node.material = new THREE.MeshBasicMaterial({ map: textures[0] })
      }
    })
  }, [scene, textures])

  // Drag-to-rotate — listens on the canvas DOM element
  useEffect(() => {
    const canvas = gl.domElement
    let dragging = false
    let lastX = 0

    const onDown = e => {
      dragging = true
      lastX = e.clientX
      scrollState.dragVelocity = 0
      canvas.style.cursor = 'grabbing'
    }

    const onMove = e => {
      if (!dragging) return
      const delta = (e.clientX - lastX) * 0.012
      scrollState.dragOffset   += delta
      scrollState.dragVelocity  = delta
      lastX = e.clientX
    }

    const onUp = () => {
      dragging = false
      canvas.style.cursor = 'grab'
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    canvas.style.cursor = 'grab'

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl])

  const mx    = useRef(0)
  const mz    = useRef(0)
  const mroty = useRef(Math.PI)

  useFrame(({ clock, invalidate }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    mx.current    = lerp(mx.current,    scrollState.targetX,    0.05)
    mz.current    = lerp(mz.current,    scrollState.targetZ,    0.05)
    mroty.current = lerp(mroty.current, scrollState.targetRotY, 0.04)

    scrollState.dragVelocity *= 0.88
    scrollState.dragOffset   += scrollState.dragVelocity
    scrollState.dragOffset   *= 0.985

    groupRef.current.position.x = mx.current
    groupRef.current.position.y = Math.sin(t * 0.55) * 0.08
    groupRef.current.position.z = mz.current
    groupRef.current.rotation.y = mroty.current + scrollState.dragOffset

    if (screenMeshRef.current && currentTexRef.current !== scrollState.screenIndex) {
      currentTexRef.current = scrollState.screenIndex
      screenMeshRef.current.material.map = textures[scrollState.screenIndex]
      screenMeshRef.current.material.needsUpdate = true
    }

    invalidate()
  })

  return (
    <primitive
      ref={groupRef}
      object={scene}
      scale={[50, 50, 50]}
      rotation={[0, Math.PI, 0]}
      position={[0, 0, 0]}
    />
  )
}

useGLTF.preload('/glimpse_model4.glb')
```

- [ ] **Step 2: Start dev server and verify the model still bobs and rotates**

Run: `cd glimpse-web && npm run dev`  
Expected: model visible, draggable, scroll story still animates.

- [ ] **Step 3: Commit**

```bash
git add src/canvas/GlimpseModel.jsx
git commit -m "perf: use DEMO_IMAGES for textures, add invalidate() in useFrame"
```

---

## Task 3: Add frameloop="demand" to Canvas in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `frameloop="demand"` to the Canvas element**

In `src/App.jsx`, find the `<Canvas` opening tag and add the prop:

```jsx
<Canvas
  frameloop="demand"
  dpr={[1, 1.5]}
  camera={{ position: [0, 11, 5], fov: 38, near: 0.1, far: 1000 }}
  gl={{
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  }}
  onCreated={({ gl }) => {
    gl.outputColorSpace = 'srgb'
    gl.toneMapping = 4
    gl.toneMappingExposure = 1.2
  }}
>
```

- [ ] **Step 2: Verify in browser — model still animates continuously**

Expected: bob animation and drag still work. The `invalidate()` call in `useFrame` keeps the loop alive.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "perf: add frameloop=demand to Canvas"
```

---

## Task 4: Add Lenis scrollTo to Nav

**Files:**
- Modify: `src/sections/Nav.jsx`

Nav currently uses plain `<a href="#...">` which bypasses Lenis and causes a jarring jump. We intercept clicks and call `lenis.scrollTo()` instead.

- [ ] **Step 1: Update Nav.jsx**

```jsx
import styles from './Nav.module.css'

export default function Nav({ lenisRef, hidden }) {
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
    <nav className={`${styles.nav} ${hidden ? styles.hidden : ''}`}>
      <a href="#" className={styles.logo} onClick={e => handleClick(e, '#hero')}>Glimpse</a>
      <ul className={styles.links}>
        <li><a href="#scroll-story" onClick={e => handleClick(e, '#scroll-story')}>The Device</a></li>
        <li><a href="#how-it-works" onClick={e => handleClick(e, '#how-it-works')}>How it works</a></li>
        <li><a href="#specs" onClick={e => handleClick(e, '#specs')}>Specs</a></li>
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Add `.hidden` to Nav.module.css**

Append to `src/sections/Nav.module.css`:

```css
.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}
```

- [ ] **Step 3: Verify — nav links scroll smoothly**

Click a nav link in the browser. Expected: smooth Lenis scroll, no jarring jump.

- [ ] **Step 4: Commit**

```bash
git add src/sections/Nav.jsx src/sections/Nav.module.css
git commit -m "feat: nav links use Lenis scrollTo for smooth scroll"
```

---

## Task 5: Add "Try it" button to Hero

**Files:**
- Modify: `src/sections/Hero.jsx`
- Modify: `src/sections/Hero.module.css`

- [ ] **Step 1: Update Hero.jsx to accept and wire `onTryIt` prop**

```jsx
import styles from './Hero.module.css'

export default function Hero({ onTryIt }) {
  return (
    <section className={styles.hero} id="hero">
      <div className={styles.content}>
        <p className={styles.eyebrow}>eInk · ESP32 · Open Source</p>
        <h1 className={styles.title}>
          Carry a<br /><em>thought.</em>
        </h1>
        <p className={styles.sub}>
          Glimpse is a pocket-sized e-ink companion that shows you what matters —
          one quiet image at a time.
        </p>
        <button className={styles.tryItBtn} onClick={onTryIt}>
          Try it
        </button>
        <p className={styles.dragHint}>Drag to rotate the model →</p>
      </div>

      <div className={styles.scrollHint}>
        <span>Scroll</span>
        <div className={styles.scrollLine} />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add tryItBtn styles to Hero.module.css**

Append to `src/sections/Hero.module.css`:

```css
.tryItBtn {
  margin-top: 2rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.6rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font-family: 'Lora', Georgia, serif;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  cursor: none;
  pointer-events: auto;
  transition: background 0.3s, color 0.3s;
  opacity: 0;
  animation: fadeUp 0.9s 1.3s forwards;
}

.tryItBtn:hover {
  background: var(--accent);
  color: #000;
}
```

- [ ] **Step 3: Verify button appears in browser, hover state works**

Expected: bordered pill button below subtitle, fills blue on hover. Clicking does nothing yet (handler wired in next task).

- [ ] **Step 4: Commit**

```bash
git add src/sections/Hero.jsx src/sections/Hero.module.css
git commit -m "feat: add Try it CTA button to Hero section"
```

---

## Task 6: Create DemoOverlay component

**Files:**
- Create: `src/DemoOverlay.jsx`
- Create: `src/DemoOverlay.module.css`

- [ ] **Step 1: Create DemoOverlay.jsx**

```jsx
import { useRef, useState } from 'react'
import { scrollState } from './canvas/GlimpseModel'
import { DEMO_IMAGES } from './demoImages'
import styles from './DemoOverlay.module.css'

export default function DemoOverlay({ overlayRef, onClose }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'sending' | 'received'
  const [prompt, setPrompt] = useState('')

  const handleSend = () => {
    if (!prompt.trim() || status !== 'idle') return
    setStatus('sending')

    setTimeout(() => {
      const idx = Math.floor(Math.random() * DEMO_IMAGES.length)
      scrollState.screenIndex = idx
      setStatus('received')

      setTimeout(() => {
        setStatus('idle')
        setPrompt('')
      }, 2000)
    }, 1200)
  }

  const handleKey = e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div ref={overlayRef} className={styles.overlay}>
      <button className={styles.close} onClick={onClose} aria-label="Close demo">×</button>

      <div className={styles.left}>
        <div className={styles.phone}>
          <div className={styles.notch} />
          <div className={styles.phoneScreen}>
            <p className={styles.modeLabel}>Dilemma</p>
            <textarea
              className={styles.input}
              placeholder="Type a thought to send to your Glimpse…"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKey}
              disabled={status !== 'idle'}
              rows={5}
            />
            <button
              className={`${styles.sendBtn} ${styles[status]}`}
              onClick={handleSend}
              disabled={status !== 'idle' || !prompt.trim()}
            >
              {status === 'idle'     && 'Send to Glimpse →'}
              {status === 'sending'  && 'Sending…'}
              {status === 'received' && 'Received on device ✓'}
            </button>
            {status === 'sending' && <div className={styles.progressBar} />}
          </div>
          <div className={styles.homeBar} />
        </div>
        <p className={styles.hint}>⌘ + Enter to send</p>
      </div>

      <div className={styles.right} />
    </div>
  )
}
```

- [ ] **Step 2: Create DemoOverlay.module.css**

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  opacity: 0;
  pointer-events: none;
}

.close {
  position: absolute;
  top: 2rem;
  right: 2.5rem;
  background: none;
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 2.4rem;
  height: 2.4rem;
  color: var(--text-dim);
  font-size: 1.3rem;
  line-height: 1;
  cursor: none;
  transition: border-color 0.2s, color 0.2s;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close:hover {
  border-color: var(--text);
  color: var(--text);
}

.left {
  width: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  pointer-events: auto;
}

.right {
  width: 50%;
  pointer-events: none;
}

/* Phone frame */
.phone {
  width: 280px;
  min-height: 520px;
  background: #111;
  border-radius: 40px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 1rem;
  box-shadow: 0 0 60px rgba(41, 151, 255, 0.08);
  position: relative;
}

.notch {
  width: 90px;
  height: 26px;
  background: #000;
  border-radius: 0 0 18px 18px;
  margin-bottom: 1.4rem;
}

.phoneScreen {
  flex: 1;
  width: 100%;
  padding: 0 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modeLabel {
  font-size: 0.65rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent-soft);
}

.input {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  color: var(--text);
  font-family: 'Lora', Georgia, serif;
  font-size: 0.82rem;
  line-height: 1.7;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  cursor: none;
}

.input:focus {
  border-color: var(--accent-soft);
}

.input:disabled {
  opacity: 0.5;
}

.sendBtn {
  padding: 0.65rem 1.2rem;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: 'Lora', Georgia, serif;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  cursor: none;
  transition: background 0.25s, color 0.25s, border-color 0.25s;
  pointer-events: auto;
}

.sendBtn:not(:disabled):hover {
  background: var(--accent);
  color: #000;
}

.sendBtn:disabled {
  opacity: 0.4;
}

.sendBtn.sending {
  border-color: var(--accent-soft);
  color: var(--accent-soft);
}

.sendBtn.received {
  border-color: #30d158;
  color: #30d158;
}

.progressBar {
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  animation: progressFill 1.2s ease-out forwards;
}

@keyframes progressFill {
  from { width: 0%; opacity: 1; }
  to   { width: 100%; opacity: 0.6; }
}

.homeBar {
  width: 100px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin-top: 1rem;
}

.hint {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/DemoOverlay.jsx src/DemoOverlay.module.css
git commit -m "feat: add DemoOverlay component with phone mockup and send flow"
```

---

## Task 7: Wire everything together in App.jsx

**Files:**
- Modify: `src/App.jsx`

This is the final integration step. We add the `lenisRef`, `mainRef`, demo open/close GSAP logic, pass props to Hero and Nav, and render DemoOverlay.

- [ ] **Step 1: Replace App.jsx with the fully wired version**

```jsx
import { useEffect, useRef, Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import GlimpseModel from './canvas/GlimpseModel'
import Lights from './canvas/Lights'

import Nav from './sections/Nav'
import Hero from './sections/Hero'
import ScrollStory from './sections/ScrollStory'
import HowItWorks from './sections/HowItWorks'
import Specs from './sections/Specs'
import Footer from './sections/Footer'
import Cursor from './ui/Cursor'
import DemoOverlay from './DemoOverlay'

import './styles/globals.css'
import styles from './App.module.css'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const lenisRef   = useRef(null)
  const mainRef    = useRef(null)
  const overlayRef = useRef(null)
  const navRef     = useRef(null)
  const [navHidden, setNavHidden] = useState(false)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(time => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)

    return () => { lenis.destroy() }
  }, [])

  const openDemo = () => {
    setNavHidden(true)
    gsap.timeline()
      .to(mainRef.current,    { opacity: 0, scale: 0.97, duration: 0.4, ease: 'power2.in' })
      .to(overlayRef.current, { opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=0.1')
      .call(() => { overlayRef.current.style.pointerEvents = 'all' })
  }

  const closeDemo = () => {
    gsap.timeline()
      .call(() => { overlayRef.current.style.pointerEvents = 'none' })
      .to(overlayRef.current, { opacity: 0, duration: 0.3, ease: 'power2.in' })
      .to(mainRef.current,    { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, '-=0.1')
      .call(() => setNavHidden(false))
  }

  return (
    <>
      <Cursor />
      <Nav lenisRef={lenisRef} hidden={navHidden} />

      <div className={styles.canvasWrap}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, 11, 5], fov: 38, near: 0.1, far: 1000 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = 'srgb'
            gl.toneMapping = 4
            gl.toneMappingExposure = 1.2
          }}
        >
          <Lights />
          <Suspense fallback={null}>
            <GlimpseModel />
          </Suspense>
        </Canvas>
      </div>

      <main ref={mainRef} className={styles.main}>
        <Hero onTryIt={openDemo} />
        <ScrollStory />
        <div className={styles.divider} />
        <HowItWorks />
        <Specs />
        <Footer />
      </main>

      <DemoOverlay overlayRef={overlayRef} onClose={closeDemo} />
    </>
  )
}
```

- [ ] **Step 2: Verify full flow in browser**

1. Landing page loads — nav, hero, 3D model all visible.
2. Nav links scroll smoothly via Lenis.
3. Click "Try it" → main fades out + scales down, overlay fades in, nav hides.
4. Type a prompt in the phone textarea. Click "Send to Glimpse →".
5. Progress bar animates for ~1.2s. Button text changes to "Received on device ✓".
6. The e-ink screen on the 3D model swaps to a random image.
7. After 2s, input resets to idle.
8. Click × → overlay fades out, main + nav restore.
9. Scroll story, HowItWorks, Specs all still work normally.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire DemoOverlay takeover with GSAP transitions"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Performance: `frameloop="demand"` + `invalidate()` (Tasks 2, 3)
- ✅ Lenis scrollTo in Nav (Task 4)
- ✅ "Try it" CTA in Hero (Task 5)
- ✅ DemoOverlay: phone mockup, text input, send button, status states (Task 6)
- ✅ GSAP takeover: main fades, overlay fades in, nav hides (Task 7)
- ✅ Random image pick from DEMO_IMAGES, updates scrollState.screenIndex (Task 6)
- ✅ Close button (×), ESC key (Task 6)
- ✅ No second canvas, no second GLB (overlay shares existing fixed canvas)

**Placeholder scan:** None found — all steps have actual code.

**Type consistency:**
- `overlayRef` passed from App → DemoOverlay ✅
- `lenisRef` passed from App → Nav ✅  
- `onTryIt` / `onClose` callbacks consistent ✅
- `scrollState.screenIndex` used in both GlimpseModel and DemoOverlay ✅
- `DEMO_IMAGES` imported in both GlimpseModel and DemoOverlay ✅
