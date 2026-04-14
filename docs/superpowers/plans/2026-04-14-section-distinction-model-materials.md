# Device Materials & Section Transition Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every hardware group on the 3D device model a distinct realistic material, make the frosted case see-through, and eliminate the position jump the model makes when crossing between the Hero/DilemmaStory and ScrollStory sections.

**Architecture:** Task 1 consolidates the two existing `useEffect`s in `GlimpseModel.jsx` into one that assigns per-group materials via a regex-prefix map and stores all materials in `allMaterialsRef` for the fade-in loop. Tasks 2–3 remove the mount-time `scrollState` writes from `DilemmaStory.jsx` and `ScrollStory.jsx` that race against each other and cause the position jump.

**Tech Stack:** React Three Fiber, Three.js 0.183.2, GSAP ScrollTrigger, Lenis

---

## File map

| File | Change |
|---|---|
| `glimpse-web/src/canvas/GlimpseModel.jsx` | Replace two `useEffect`s with one; add `allMaterialsRef`; update fade-in loop |
| `glimpse-web/src/sections/DilemmaStory.jsx` | Remove 5 mount-time `scrollState` lines; remove position reset from `onLeave` |
| `glimpse-web/src/sections/ScrollStory.jsx` | Remove 6 mount-time `scrollState` lines |

---

## Task 1: Consolidated material system in GlimpseModel.jsx

**Files:**
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

No automated tests exist for visual 3D components in this project. Verification is manual (dev server).

- [ ] **Step 1: Start the dev server**

```bash
cd glimpse-web && npm run dev
```

Open `http://localhost:5173` in a browser. Note the current appearance of the device model — single dark material on every mesh.

- [ ] **Step 2: Replace the two useEffects and add allMaterialsRef**

Open `glimpse-web/src/canvas/GlimpseModel.jsx`. Replace the entire file with the following:

```jsx
import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { scrollState } from './scrollState'
import { STORY_SCREEN_IMAGES } from '../data/dilemmas'

import caseGltfUrl from '../../casefinal.glb?url'

function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Meshes exported under groups named `e_ink_screen`, `e_ink_screen_1`, … in `casefinal.glb`. */
function isCaseEInkScreenMesh(mesh) {
  const name = mesh.name ?? ''
  const parentName = mesh.parent?.name ?? ''
  return /^e_ink_screen/u.test(name) || /^e_ink_screen/u.test(parentName)
}

export default function GlimpseModel() {
  const groupRef = useRef()
  const screenMaterialRef = useRef(null)
  const allMaterialsRef = useRef([])
  const mountOpacityRef = useRef(0)
  const currentTexRef = useRef(STORY_SCREEN_IMAGES[0])
  const blankColor = useMemo(() => new THREE.Color('#efeee8'), [])

  const { scene } = useGLTF(caseGltfUrl)
  const textures = useTexture(STORY_SCREEN_IMAGES)
  const textureMap = useMemo(
    () => new Map(STORY_SCREEN_IMAGES.map((url, index) => [url, textures[index]])),
    [textures],
  )

  // Configure prophecy textures once
  useEffect(() => {
    textures.forEach((t) => {
      t.flipY = false
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = THREE.RepeatWrapping
      t.repeat.x = -1
      t.offset.x = 1
      t.generateMipmaps = false
      t.needsUpdate = true
    })
  }, [textures])

  // One consolidated useEffect that assigns all materials in a single scene traversal.
  // screenMaterialRef is kept separate so the flash/texture logic can address it directly.
  // allMaterialsRef holds every material created here for the fade-in loop and disposal.
  useEffect(() => {
    // ── e-ink screen ──────────────────────────────────────────────────────────
    const screenMat = new THREE.MeshBasicMaterial({
      color: blankColor.clone(),
      transparent: true,
      opacity: 0,
    })
    screenMat.userData.targetOpacity = 1.0
    screenMaterialRef.current = screenMat

    // ── frosted case shell ────────────────────────────────────────────────────
    const caseMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#8aadcc'),
      transparent: true,
      opacity: 0,
      roughness: 0.25,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    caseMat.userData.targetOpacity = 0.55

    // ── PCB (board.*) ─────────────────────────────────────────────────────────
    const boardMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a8c42'),
      roughness: 0.55,
      metalness: 0.05,
    })

    // ── NeoPixel LEDs ─────────────────────────────────────────────────────────
    const ledMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2997ff'),
      emissive: new THREE.Color('#2997ff'),
      emissiveIntensity: 3.5,
    })

    // ── NeoPixel strip ────────────────────────────────────────────────────────
    const stripMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1a22'),
      roughness: 0.8,
    })

    // ── Brushed silver (pins, screws, USB-C port, carabiner) ──────────────────
    const metalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c8d0dc'),
      roughness: 0.3,
      metalness: 0.9,
    })

    // ── Battery (matte black) ─────────────────────────────────────────────────
    const batteryMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c1c1c'),
      roughness: 0.9,
    })

    // ── Dark fallback for everything else ─────────────────────────────────────
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#222228'),
      roughness: 0.75,
      envMapIntensity: 3.0,
    })

    // Ordered list: first regex that matches the node name wins.
    const MESH_MATERIALS = [
      [/^(case_upper|case_lower)/u, caseMat],
      [/^board/u,                   boardMat],
      [/^neopixel_LED/u,            ledMat],
      [/^neopixel_strip/u,          stripMat],
      [/^(pin|screws_|typeC_port|Carabiner_Body)/u, metalMat],
      [/^battery/u,                 batteryMat],
    ]

    function getMaterialForMesh(name) {
      for (const [regex, mat] of MESH_MATERIALS) {
        if (regex.test(name)) return mat
      }
      return fallbackMat
    }

    scene.traverse((node) => {
      if (!node.isMesh) return
      const mat = isCaseEInkScreenMesh(node)
        ? screenMat
        : getMaterialForMesh(node.name)
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m.dispose?.())
      } else {
        node.material?.dispose?.()
      }
      node.material = mat
    })

    allMaterialsRef.current = [
      screenMat, caseMat, boardMat, ledMat, stripMat, metalMat, batteryMat, fallbackMat,
    ]

    return () => {
      screenMaterialRef.current = null
      allMaterialsRef.current = []
      for (const mat of [screenMat, caseMat, boardMat, ledMat, stripMat, metalMat, batteryMat, fallbackMat]) {
        mat.dispose()
      }
    }
  }, [blankColor, scene])

  // Refs seeded to match scrollState initial values so there is no lerp
  // animation on first frame (model appears immediately in hero position).
  const mx = useRef(4.3)
  const mz = useRef(0)
  const mroty = useRef(Math.PI - 0.04)
  const flashRef = useRef({ phase: 'idle', elapsed: 0, nextUrl: null })

  useFrame(({ clock, delta, invalidate }) => {
    if (!groupRef.current) return

    // Fade-in on mount (400 ms).
    // Each transparent material fades from 0 to its userData.targetOpacity.
    if (mountOpacityRef.current < 1) {
      mountOpacityRef.current = Math.min(1, mountOpacityRef.current + delta / 0.4)
      const t = mountOpacityRef.current
      for (const mat of allMaterialsRef.current) {
        if (mat.transparent) {
          mat.opacity = t * (mat.userData.targetOpacity ?? 1.0)
        }
      }
      invalidate()
    }

    const t = clock.getElapsedTime()

    mx.current = lerp(mx.current, scrollState.targetX, 0.05)
    mz.current = lerp(mz.current, scrollState.targetZ, 0.05)
    mroty.current = lerp(mroty.current, scrollState.targetRotY, 0.04)

    groupRef.current.position.x = mx.current
    groupRef.current.position.y = Math.sin(t * 0.55) * 0.08
    groupRef.current.position.z = mz.current
    groupRef.current.rotation.y = mroty.current

    const mat = screenMaterialRef.current
    if (!mat) {
      invalidate()
      return
    }

    if (!scrollState.screenVisible) {
      flashRef.current.phase = 'idle'
      flashRef.current.elapsed = 0
      flashRef.current.nextUrl = null
      mat.map = null
      mat.color.copy(blankColor)
      mat.needsUpdate = true
      currentTexRef.current = '__blank__'
      invalidate()
      return
    }

    const safeIdx = Math.max(0, Math.min(scrollState.screenIndex, STORY_SCREEN_IMAGES.length - 1))
    const targetUrl = scrollState.screenImage ?? STORY_SCREEN_IMAGES[safeIdx] ?? STORY_SCREEN_IMAGES[0]

    const flash = flashRef.current

    if (flash.phase === 'idle' && currentTexRef.current !== targetUrl) {
      flash.phase = 'flash-in'
      flash.elapsed = 0
      flash.nextUrl = targetUrl
      mat.map = null
      mat.color.set('#ffffff')
      mat.needsUpdate = true
    }

    if (flash.phase === 'flash-in') {
      flash.elapsed += Math.min(delta, 0.1)
      if (flash.elapsed >= 0.08) {
        currentTexRef.current = flash.nextUrl
        mat.map = textureMap.get(flash.nextUrl) ?? textures[0]
        mat.color.set('#ffffff')
        mat.needsUpdate = true
        flash.phase = 'idle'
        flash.elapsed = 0
        flash.nextUrl = null
      }
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

useGLTF.preload(caseGltfUrl)
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:5173`. Expected visual result:
- Device case is semi-transparent blue-tinted frosted glass — interior components visible through it
- PCB is bright green (`#1a8c42`)
- NeoPixel LEDs glow bright blue (emissive glow visible without bloom post-processing)
- Carabiner, screws, pins are bright silver/metallic
- Battery is matte black
- Everything fades in from 0 opacity on page load (400ms animation)

If the page shows only a dark shape or nothing changes, open browser DevTools console and check for Three.js errors.

- [ ] **Step 4: Commit**

```bash
git add glimpse-web/src/canvas/GlimpseModel.jsx
git commit -m "feat: consolidated material system with per-group hardware materials

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Remove mount-time scrollState writes from DilemmaStory

**Files:**
- Modify: `glimpse-web/src/sections/DilemmaStory.jsx`

These lines (44–49 in the current file) write to `scrollState` on every React mount — before any ScrollTrigger fires. Because ScrollStory also mounts and writes its own values, the two fight each other and leave `scrollState` in the wrong state for whichever mounts first.

- [ ] **Step 1: Remove mount scrollState assignments**

In `glimpse-web/src/sections/DilemmaStory.jsx`, find the `useEffect` that creates the ScrollTrigger. At the very top of that effect body (before `ScrollTrigger.create`), remove these 5 lines:

```js
scrollState.targetX = MODEL_STAGES[0].modelX
scrollState.targetZ = MODEL_STAGES[0].modelZ
scrollState.targetRotY = MODEL_STAGES[0].rotY
scrollState.screenImage = null
scrollState.screenVisible = false
```

After removal, the top of the `useEffect` body should jump straight to `const trigger = ScrollTrigger.create({`.

- [ ] **Step 2: Remove position reset from onLeave**

Still in the same `useEffect`, find the `onLeave` callback:

```js
onLeave: () => {
  setDotsVisible(false)
  scrollState.targetX = 0
  scrollState.targetZ = 0
  scrollState.targetRotY = Math.PI
  scrollState.screenImage = null
  scrollState.screenVisible = true
},
```

Remove only the three position lines (keep the screen lines intact):

```js
onLeave: () => {
  setDotsVisible(false)
  scrollState.screenImage = null
  scrollState.screenVisible = true
},
```

The position lines were causing the model to lurch toward x=0 when leaving DilemmaStory, before ScrollStory's scrub could take over.

- [ ] **Step 3: Verify scrollState.js initial values are correct**

Read `glimpse-web/src/canvas/scrollState.js`. It must contain:

```js
export const scrollState = {
  targetX: 4.3,
  targetZ: 0,
  targetRotY: Math.PI - 0.04,
  screenIndex: 0,
  screenImage: null,
  screenVisible: false,
}
```

These match `DilemmaStory`'s `MODEL_STAGES[0]` exactly. No change needed here — this file is the source of truth for initial values.

- [ ] **Step 4: Commit**

```bash
git add glimpse-web/src/sections/DilemmaStory.jsx
git commit -m "fix: remove mount-time scrollState writes and onLeave position reset in DilemmaStory

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Remove mount-time scrollState writes from ScrollStory

**Files:**
- Modify: `glimpse-web/src/sections/ScrollStory.jsx`

ScrollStory's `useEffect` writes 6 values to `scrollState` on mount, overwriting whatever DilemmaStory set and putting the model at `targetX = 4.0` and `screenVisible = true` before the user has scrolled anywhere near this section.

- [ ] **Step 1: Remove mount scrollState assignments**

In `glimpse-web/src/sections/ScrollStory.jsx`, find the `useEffect` (around line 40). At the very top of that effect body (before `ScrollTrigger.create`), remove these 6 lines:

```js
// Set initial hero position
scrollState.targetX    = HERO_X
scrollState.targetZ    = 0
scrollState.targetRotY = Math.PI
scrollState.screenIndex = 0
scrollState.screenImage = null
scrollState.screenVisible = true
```

Also remove the comment above them (`// Set initial hero position`).

After removal, the top of the `useEffect` body should jump straight to `const trigger = ScrollTrigger.create({`.

- [ ] **Step 2: Verify in browser — scroll between sections**

With the dev server running at `http://localhost:5173`:

1. Load the page. Model should appear at x ≈ 4.3 (right side), e-ink screen blank.
2. Scroll down into DilemmaStory. Model should smoothly transition through `MODEL_STAGES` positions.
3. Continue scrolling into ScrollStory. Model should smoothly move from its last DilemmaStory position toward `HERO_X = 4.0` — **no leftward lurch or position snap**.
4. Scroll back up through ScrollStory → DilemmaStory. Transition should be smooth in both directions.

- [ ] **Step 3: Commit**

```bash
git add glimpse-web/src/sections/ScrollStory.jsx
git commit -m "fix: remove mount-time scrollState writes from ScrollStory — fixes model position jump

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Verification checklist (after all tasks)

Run through the full page once in the browser:

- [ ] Model fades in on load (not a hard pop)
- [ ] Case shell is visibly translucent — blue-tinted, interior hardware visible through it
- [ ] PCB is bright green, NeoPixels glow blue, carabiner/screws are silver
- [ ] E-ink screen flashes white then shows texture when entering ScrollStory
- [ ] Scrolling Hero → DilemmaStory: model stays right side, no jump
- [ ] Scrolling DilemmaStory → ScrollStory: model moves smoothly, no leftward lurch
- [ ] Scrolling back ScrollStory → DilemmaStory: smooth in both directions
