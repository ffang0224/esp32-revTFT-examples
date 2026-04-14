# Device Materials & Section Transition Design

## Scope

Two problems solved in one plan:

1. **Material system** — the 3D model (`casefinal.glb`) currently uses a single dark matte material for every mesh. Each hardware group needs its own distinct material so the device reads as a real physical object.

2. **Section jump fix** — when scrolling between the Hero and DilemmaStory sections, the model position jumps because both sections write to `scrollState` on React mount, racing against each other and setting wrong target positions.

---

## 1. Material System

### Architecture: single `getMaterialForMesh` traversal

Replace the two existing `useEffect`s in `GlimpseModel.jsx` with one consolidated `useEffect([scene])` that:

1. Creates all 7 materials upfront.
2. Calls `getMaterialForMesh(node)` inside `scene.traverse` to assign the correct material per mesh.
3. Collects all materials into `allMaterialsRef.current` (array) for the fade-in loop and cleanup.
4. Keeps `screenMaterialRef` separate — the flash/texture logic already depends on it.

The `useFrame` fade-in block iterates `allMaterialsRef.current`. For each material with `transparent: true`, it drives opacity from 0 to its target value over 400ms. Non-transparent materials (LEDs, PCB, metal) start at full opacity and skip the fade.

### Material map

Mesh assignment is driven by an ordered list of `[regex, material]` pairs. First match wins.

| Node name prefix | Material type | Key properties |
|---|---|---|
| `e_ink_screen` | `MeshBasicMaterial` | color `#efeee8`, transparent, starts opacity 0 |
| `case_upper`, `case_lower` | `MeshPhysicalMaterial` | color `#8aadcc`, opacity **0.55**, roughness 0.25, metalness 0.1, `depthWrite: false`, `side: DoubleSide` — smoked-glass look with visible specularity |
| `board` | `MeshStandardMaterial` | color `#1a8c42`, roughness 0.55, metalness 0.05 — bright PCB green |
| `neopixel_LED` | `MeshStandardMaterial` | color `#2997ff`, emissive `#2997ff`, emissiveIntensity **3.5** — visibly glowing blue |
| `neopixel_strip` | `MeshStandardMaterial` | color `#1a1a22`, roughness 0.8 |
| `pin`, `screws_`, `typeC_port`, `Carabiner_Body` | `MeshStandardMaterial` | color `#c8d0dc`, roughness 0.3, metalness 0.9 — bright brushed silver |
| `battery` | `MeshStandardMaterial` | color `#1c1c1c`, roughness 0.9 — matte black |
| everything else | `MeshStandardMaterial` | color `#222228`, roughness 0.75, `envMapIntensity: 3.0` — dark fallback |

### Transparent case rendering

The `MeshPhysicalMaterial` for `case_upper`/`case_lower` uses `depthWrite: false` so interior meshes always render through it regardless of Three.js sort order. `side: THREE.DoubleSide` ensures inside shell faces are visible when viewed from close angles.

Both the case and the screen fade in from opacity 0 to their target values (case: 0.55, screen: 1.0) over the same 400ms window. The fade-in loop checks each material's `userData.targetOpacity` to know when to stop advancing. The case starts at 0 so interior components are briefly fully visible during the mount animation — a nice reveal effect.

### Visibility — "make it notorious"

To ensure the material change reads clearly against the dark site background:
- Case opacity **0.55** (lower than 0.65 in initial design — more interior visible)
- Case roughness **0.25** (lower — more specularity, more glass-like)
- NeoPixel `emissiveIntensity: 3.5` (strong glow, visible even without bloom)
- PCB green `#1a8c42` (brighter than `#1a7a3c`)
- Metal silver `#c8d0dc` (brighter than `#b0b8c4`)

---

## 2. Section Transition Jump Fix

### Root cause

Both `DilemmaStory.jsx` and `ScrollStory.jsx` write to `scrollState` at the top of their `useEffect` (i.e., on React mount, not on scroll). Because both components mount at page load, the last one to run wins.

Mount order (matches JSX order in `App.jsx`): DilemmaStory first, then ScrollStory.

ScrollStory's mount assignment overwrites `scrollState.targetX` to `4.0` (HERO_X) and `screenVisible: true`. This means:

- On load, the model's lerp target starts at 4.0 (not 4.3 as seeded).
- As the user scrolls into DilemmaStory, `onUpdate` fires and sets targetX → 4.3. The model visibly snaps right.

A secondary jump occurs when leaving DilemmaStory: `onLeave` sets `targetX = 0`, then ScrollStory's `onUpdate` at `progress = 0` immediately sets `targetX = 4.0`. The model lurches left then right.

### Fix: scroll-driven only, no mount writes

**DilemmaStory.jsx:**
- Remove the 5 `scrollState.*` assignments at the top of `useEffect` (lines 44–49). These are redundant — `scrollState.js` already seeds the correct initial values, and `onUpdate` fires at the correct time.
- In `onLeave`: remove `targetX = 0 / targetZ = 0 / targetRotY = Math.PI`. Leave model where it is; ScrollStory's scrub will take over.

**ScrollStory.jsx:**
- Remove the 6 `scrollState.*` assignments at the top of `useEffect` (lines 44–50). Same reason — they race against DilemmaStory and set wrong state on mount.

The `scrollState.js` initial values (`targetX: 4.3`, `screenVisible: false`) are already correct for the page-load state. No mount writes needed.

`onLeaveBack` and `onEnterBack` callbacks remain unchanged — they fire at the right time and are not part of the jump problem.

---

## Files changed

| File | Change |
|---|---|
| `glimpse-web/src/canvas/GlimpseModel.jsx` | Replace two `useEffect`s with one consolidated material `useEffect`; update fade-in to iterate `allMaterialsRef` |
| `glimpse-web/src/sections/DilemmaStory.jsx` | Remove mount scrollState writes; remove position reset from `onLeave` |
| `glimpse-web/src/sections/ScrollStory.jsx` | Remove mount scrollState writes |
