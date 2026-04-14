# Glimpse 3D Experience Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap to `casefinal.glb`, add a silhouette skeleton loader, upgrade to HDRI + contact shadow rendering, and replace instant texture swaps with an e-ink flash transition.

**Architecture:** Four self-contained changes in `glimpse-web/src/canvas/` and `App.jsx`. No new dependencies — `@react-three/drei` already ships `Environment` and `ContactShadows`. All animation runs in existing `useFrame` loops. Changes are stackable: each task leaves the app in a working state.

**Tech Stack:** React 19, React Three Fiber, Three.js 0.183, `@react-three/drei`, GSAP + ScrollTrigger, Lenis, Vite

> **Note on testing:** This is a purely visual Three.js codebase. There are no test helpers for canvas rendering. Verification is done by running `npm run dev` inside `glimpse-web/` and visually checking each change. Each task ends with a manual check list.

---

## File Map

| File | Role |
|------|------|
| `glimpse-web/src/canvas/GlimpseModel.jsx` | Main 3D model component — all canvas logic |
| `glimpse-web/src/canvas/ModelSkeleton.jsx` | **New** — silhouette box shown while GLB loads |
| `glimpse-web/src/canvas/Lights.jsx` | Directional lights — intensity tuning |
| `glimpse-web/src/App.jsx` | Canvas host — Suspense fallback, Environment, ContactShadows |
| `glimpse-web/casefinal.glb` | New model asset (already in repo) |

---

## Task 1: Model swap + mesh detection fix

**Files:**
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

### Context

The current file imports `case.glb`. The new model `casefinal.glb` uses the same `e_ink_screen.*` node naming but the nodes are now leaf meshes (not parent groups), so `isCaseEInkScreenMesh` must also check `mesh.name` directly.

- [ ] **Step 1.1: Update the GLB import and preload**

In `glimpse-web/src/canvas/GlimpseModel.jsx`, replace:

```js
import caseGltfUrl from '../../case.glb?url'
```

with:

```js
import caseGltfUrl from '../../casefinal.glb?url'
```

And at the bottom of the file, `useGLTF.preload(caseGltfUrl)` already references the variable — no change needed there.

- [ ] **Step 1.2: Fix the mesh detection function**

Replace the existing `isCaseEInkScreenMesh` function:

```js
function isCaseEInkScreenMesh(mesh) {
  const parentName = mesh.parent?.name ?? ''
  return /^e_ink_screen/u.test(parentName)
}
```

with:

```js
function isCaseEInkScreenMesh(mesh) {
  const name = mesh.name ?? ''
  const parentName = mesh.parent?.name ?? ''
  return /^e_ink_screen/u.test(name) || /^e_ink_screen/u.test(parentName)
}
```

- [ ] **Step 1.3: Verify in browser**

```bash
cd glimpse-web && npm run dev
```

Open `http://localhost:5173`. Confirm:
- The 3D model visible (new model, likely looks similar but more detailed)
- The e-ink screen area appears (blank/beige color initially, then shows textures as you scroll)
- No console errors about missing materials or mesh traversal

- [ ] **Step 1.4: Commit**

```bash
git add glimpse-web/src/canvas/GlimpseModel.jsx
git commit -m "feat: swap case.glb → casefinal.glb, fix e-ink mesh detection"
```

---

## Task 2: Reduce directional light intensities

**Files:**
- Modify: `glimpse-web/src/canvas/Lights.jsx`

### Context

We're about to add an `<Environment preset="studio" />` which contributes ambient IBL (image-based lighting). Without reducing the existing lights, the model will be over-bright. Reduce key light from 2.2 → 1.5 and rim light from 1.4 → 1.0.

- [ ] **Step 2.1: Update light intensities**

In `glimpse-web/src/canvas/Lights.jsx`, make these two changes:

```jsx
export default function Lights() {
  return (
    <>
      {/* Reduced ambient — dark case needs shadow depth */}
      <ambientLight color={0xfff5e6} intensity={0.9} />

      {/* Warm key light from front-right — reduced for HDRI balance */}
      <directionalLight color={0xfff0d6} intensity={1.5} position={[4, 8, 6]} />

      {/* Soft warm fill from left */}
      <directionalLight color={0xc4a882} intensity={0.8} position={[-4, 2, -3]} />

      {/* Cool blue rim from behind — reduced for HDRI balance */}
      <directionalLight color={0x2997ff} intensity={1.0} position={[-3, 1, -8]} />

      {/* Subtle warm under-bounce */}
      <directionalLight color={0xffeedd} intensity={0.5} position={[0, -4, -6]} />
    </>
  )
}
```

- [ ] **Step 2.2: Commit**

```bash
git add glimpse-web/src/canvas/Lights.jsx
git commit -m "feat: reduce key+rim light intensity to prepare for HDRI"
```

---

## Task 3: HDRI environment + contact shadow

**Files:**
- Modify: `glimpse-web/src/App.jsx`

### Context

`Environment` and `ContactShadows` are both in `@react-three/drei` which is already installed. `Environment preset="studio"` ships built-in (no external `.hdr` file needed). `ContactShadows` renders a soft shadow plane below the model.

The model's rest Y position is `0` (it bobs ±0.08). The contact shadow plane goes at `y = -1.2` so it sits visibly below the device with a gap that the bob makes dynamic.

- [ ] **Step 3.1: Add Environment and ContactShadows imports in App.jsx**

In `glimpse-web/src/App.jsx`, update the drei import line. Find:

```js
import GlimpseModel from './canvas/GlimpseModel'
import Lights from './canvas/Lights'
```

Add two new imports after:

```js
import GlimpseModel from './canvas/GlimpseModel'
import Lights from './canvas/Lights'
import { Environment, ContactShadows } from '@react-three/drei'
```

- [ ] **Step 3.2: Add Environment and ContactShadows inside the Canvas**

Find the Canvas children block in `App.jsx`:

```jsx
<Canvas
  ...
>
  <Lights />
  <Suspense fallback={null}>
    <GlimpseModel />
  </Suspense>
</Canvas>
```

Replace with:

```jsx
<Canvas
  frameloop="demand"
  dpr={[1, 1.5]}
  camera={{ position: [0, 12.5, 6.8], fov: 38, near: 0.1, far: 1000 }}
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
  <Environment preset="studio" />
  <ContactShadows position={[0, -1.2, 0]} opacity={0.5} blur={2.5} far={3} />
  <Suspense fallback={null}>
    <GlimpseModel />
  </Suspense>
</Canvas>
```

- [ ] **Step 3.3: Verify in browser**

Run `npm run dev` and check:
- Model has subtle ambient reflections (dark case picks up soft environment highlights)
- A soft shadow appears below the model, clearly distinct from the background
- No over-brightening — model should look premium, not blown out
- Shadow moves with the floating bob (the model bobs away and back toward the shadow plane)

- [ ] **Step 3.4: Commit**

```bash
git add glimpse-web/src/App.jsx
git commit -m "feat: add HDRI environment (studio preset) + contact shadow"
```

---

## Task 4: Silhouette skeleton loader

**Files:**
- Create: `glimpse-web/src/canvas/ModelSkeleton.jsx`
- Modify: `glimpse-web/src/App.jsx`
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

### Context

`<Suspense fallback={...}>` inside a R3F `<Canvas>` renders the fallback as a 3D scene — so `ModelSkeleton` returns Three.js JSX (meshes, not DOM elements).

The skeleton sits at position `[4.3, 0, 0]` with `rotation-y={Math.PI}` to match the model's initial position from `scrollState`. Dimensions `[3, 5, 0.8]` approximate the device bounding box (model scale is 50; the GLB device is ~0.06 × 0.1 × 0.016 model units).

`GlimpseModel` fades in from opacity 0 → 1 over 400ms on first mount. Both its materials need `transparent: true`.

- [ ] **Step 4.1: Create ModelSkeleton.jsx**

Create `glimpse-web/src/canvas/ModelSkeleton.jsx`:

```jsx
import { useMemo } from 'react'
import * as THREE from 'three'

export default function ModelSkeleton() {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#111116',
        transparent: true,
        opacity: 0.4,
      }),
    [],
  )

  return (
    <mesh
      position={[4.3, 0, 0]}
      rotation={[0, Math.PI, 0]}
      material={material}
    >
      <boxGeometry args={[3, 5, 0.8]} />
    </mesh>
  )
}
```

- [ ] **Step 4.2: Wire Suspense fallback in App.jsx**

In `glimpse-web/src/App.jsx`, replace:

```jsx
<Suspense fallback={null}>
  <GlimpseModel />
</Suspense>
```

with:

```jsx
<Suspense fallback={<ModelSkeleton />}>
  <GlimpseModel />
</Suspense>
```

And add the import at the top with the other canvas imports:

```js
import ModelSkeleton from './canvas/ModelSkeleton'
```

- [ ] **Step 4.3: Add fade-in to GlimpseModel**

The model needs to start invisible and lerp to fully opaque over 400ms. This requires:
1. Both materials to have `transparent: true`
2. A `mountOpacityRef` tracking the 0→1 progress
3. A `caseMaterialRef` so `useFrame` can reach the case material

In `glimpse-web/src/canvas/GlimpseModel.jsx`, add two refs after the existing refs:

```js
const caseMaterialRef = useRef(null)
const mountOpacityRef = useRef(0)
```

In the `useEffect` that creates the screen material (the one that sets `screenMaterialRef.current`), add `transparent: true` and `opacity: 0`:

```js
useEffect(() => {
  const mat = new THREE.MeshBasicMaterial({
    color: blankColor.clone(),
    transparent: true,
    opacity: 0,
  })
  screenMaterialRef.current = mat
  scene.traverse((node) => {
    if (!node.isMesh || !isCaseEInkScreenMesh(node)) return
    if (Array.isArray(node.material)) {
      node.material.forEach((m) => m.dispose?.())
      node.material = mat
    } else {
      node.material?.dispose?.()
      node.material = mat
    }
  })
  return () => {
    mat.dispose()
    screenMaterialRef.current = null
  }
}, [blankColor, scene])
```

In the `useEffect` that creates the case material, add `transparent: true`, `opacity: 0`, and store to `caseMaterialRef`:

```js
useEffect(() => {
  const caseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#111116'),
    roughness: 0.72,
    metalness: 0.0,
    transparent: true,
    opacity: 0,
  })
  caseMaterialRef.current = caseMat

  scene.traverse((node) => {
    if (!node.isMesh || isCaseEInkScreenMesh(node)) return
    if (Array.isArray(node.material)) {
      node.material.forEach((m) => m.dispose?.())
      node.material = caseMat
    } else {
      node.material?.dispose?.()
      node.material = caseMat
    }
  })

  return () => {
    caseMat.dispose()
    caseMaterialRef.current = null
  }
}, [scene])
```

In `useFrame`, add the fade-in block at the very top of the callback (before the position lerp), using the `delta` parameter:

```js
useFrame(({ clock, delta, invalidate }) => {
  if (!groupRef.current) return

  // Fade-in on mount (400ms)
  if (mountOpacityRef.current < 1) {
    mountOpacityRef.current = Math.min(1, mountOpacityRef.current + delta / 0.4)
    const opacity = mountOpacityRef.current
    if (caseMaterialRef.current) {
      caseMaterialRef.current.opacity = opacity
      caseMaterialRef.current.needsUpdate = true
    }
    if (screenMaterialRef.current) {
      screenMaterialRef.current.opacity = opacity
      screenMaterialRef.current.needsUpdate = true
    }
    invalidate()
  }

  // ... rest of existing useFrame code unchanged ...
```

- [ ] **Step 4.4: Verify in browser**

Hard-refresh the page (Cmd+Shift+R). On load you should see:
- A faint dark box silhouette in the hero position while the GLB loads
- The box crossfades into the real model smoothly (~400ms fade-in) once loaded
- No flash of invisible content between skeleton and model

> **Tip:** On a fast machine the GLB may load instantly from cache. Open DevTools → Network → throttle to "Slow 3G" to see the skeleton clearly.

- [ ] **Step 4.5: Commit**

```bash
git add glimpse-web/src/canvas/ModelSkeleton.jsx glimpse-web/src/canvas/GlimpseModel.jsx glimpse-web/src/App.jsx
git commit -m "feat: add silhouette skeleton loader + model fade-in on mount"
```

---

## Task 5: E-ink flash transition

**Files:**
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

### Context

The current code in `useFrame` does an instant texture swap:

```js
if (currentTexRef.current !== targetUrl) {
  currentTexRef.current = targetUrl
  mat.map = textureMap.get(targetUrl) ?? textures[0]
  mat.color.set('#ffffff')
  mat.needsUpdate = true
}
```

Replace this with a flash state machine. The machine has two phases:
- `flash-in` (80ms): clear the map and lerp color toward white
- At 80ms: swap the texture and return to `idle`

The `flashRef` tracks phase and elapsed time. `currentTexRef` keeps its old value during `flash-in` so the detection condition doesn't re-fire.

- [ ] **Step 5.1: Add flashRef**

In `GlimpseModel`, add after the existing refs (near `mx`, `mz`, `mroty`):

```js
const flashRef = useRef({ phase: 'idle', elapsed: 0, nextUrl: null })
```

- [ ] **Step 5.2: Replace the instant texture swap block in useFrame**

Find this block inside `useFrame` (it's inside the `if (scrollState.screenVisible)` branch):

```js
if (currentTexRef.current !== targetUrl) {
  currentTexRef.current = targetUrl
  mat.map = textureMap.get(targetUrl) ?? textures[0]
  mat.color.set('#ffffff')
  mat.needsUpdate = true
}

invalidate()
```

Replace it with:

```js
const flash = flashRef.current

if (flash.phase === 'idle' && currentTexRef.current !== targetUrl) {
  // Start flash: clear screen to white, record target
  flash.phase = 'flash-in'
  flash.elapsed = 0
  flash.nextUrl = targetUrl
  mat.map = null
  mat.color.set('#ffffff')
  mat.needsUpdate = true
}

if (flash.phase === 'flash-in') {
  flash.elapsed += delta
  if (flash.elapsed >= 0.08) {
    // Peak white reached — swap texture and finish
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
```

Also ensure `delta` is destructured in the `useFrame` callback signature. The signature should now be:

```js
useFrame(({ clock, delta, invalidate }) => {
```

(You already added `delta` in Task 4 — confirm it's there.)

- [ ] **Step 5.3: Handle screen-visible → blank transition cleanly**

The existing blank-screen branch runs before the texture logic:

```js
if (!scrollState.screenVisible) {
  mat.map = null
  mat.color.copy(blankColor)
  mat.needsUpdate = true
  currentTexRef.current = '__blank__'
  invalidate()
  return
}
```

When going from visible → blank mid-flash, the flash ref should be reset so it doesn't resume on re-entry. Add a reset at the top of the `!screenVisible` branch:

```js
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
```

- [ ] **Step 5.4: Verify in browser**

Scroll through the ScrollStory section (the one with three stages and e-ink images). As the stage changes:
- The screen should briefly flash white (~80ms)
- The new image appears immediately after
- No jarring instant swap

Also verify the DilemmaStory section works: the screen shows a prophecy image on the final stage, and returning back blanks cleanly.

- [ ] **Step 5.5: Commit**

```bash
git add glimpse-web/src/canvas/GlimpseModel.jsx
git commit -m "feat: e-ink flash transition on screen texture swap"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ Model swap: Task 1
  - ✅ Mesh detection fix: Task 1.2
  - ✅ Silhouette skeleton: Task 4.1–4.2
  - ✅ Model fade-in: Task 4.3
  - ✅ Light intensity reduction: Task 2
  - ✅ HDRI Environment: Task 3.2
  - ✅ Contact shadow: Task 3.2
  - ✅ E-ink flash transition: Task 5
  - ✅ Flash reset on blank: Task 5.3
- **Placeholder scan:** No TBDs or vague steps. All code blocks are complete.
- **Type consistency:** `flashRef`, `caseMaterialRef`, `mountOpacityRef` defined once and used consistently. `delta` added to `useFrame` signature in Task 4 and referenced in Task 5.
