# Glimpse 3D Experience Polish

**Date:** 2026-04-14  
**Scope:** `glimpse-web/src/canvas/GlimpseModel.jsx`, `glimpse-web/src/App.jsx`, new `ModelSkeleton` component  
**Approach:** Targeted polish (Approach A) — four self-contained changes

---

## Problem

The current 3D experience has three rough edges:

1. **Abrupt model pop-in** — `Suspense fallback={null}` means the canvas is empty until the GLB finishes loading, then the model appears with no transition.
2. **Instant texture swaps** — when the e-ink screen changes image, it cuts immediately with no transition, breaking immersion.
3. **Flat render quality** — purely directional lighting gives no ambient reflection depth; no grounding shadow makes the floating model feel disconnected from the page.

Additionally, `casefinal.glb` (the final asset from the hardware partner) needs to replace `case.glb`.

---

## Model: casefinal.glb

The new model has the same `e_ink_screen.*` node naming convention as `case.glb`, so the material assignment system carries over with a small fix.

**Key difference:** In `case.glb`, e-ink nodes were parent groups containing mesh children — `isCaseEInkScreenMesh` checked `mesh.parent?.name`. In `casefinal.glb`, the `e_ink_screen.*` nodes are leaf meshes themselves. The detection function must check `mesh.name` directly in addition to `mesh.parent?.name`.

**New mesh groups** (board, pin, neopixel_*, vibration_*, typeC_port, screws_*, button_cover, case_lower, case_upper, Carabiner_Body): all fall through to the dark matte fallback material. No special treatment in this phase.

---

## Change 1: Model Swap + Mesh Detection Fix

**File:** `glimpse-web/src/canvas/GlimpseModel.jsx`

- Change import: `case.glb?url` → `casefinal.glb?url`
- Update `isCaseEInkScreenMesh`:

```js
function isCaseEInkScreenMesh(mesh) {
  const name = mesh.name ?? ''
  const parentName = mesh.parent?.name ?? ''
  return /^e_ink_screen/u.test(name) || /^e_ink_screen/u.test(parentName)
}
```

- Update `useGLTF.preload` to reference `casefinalGltfUrl`.

---

## Change 2: Silhouette Skeleton Loader

**New file:** `glimpse-web/src/canvas/ModelSkeleton.jsx`  
**Modified:** `glimpse-web/src/App.jsx`

A `ModelSkeleton` component renders inside the Canvas as a `Suspense` fallback. It displays a box geometry approximating the device's proportions with a semi-transparent dark material. When `GlimpseModel` suspends during load, the skeleton is visible. When the real model is ready, the skeleton is simply replaced by the model.

To avoid a hard cut, `GlimpseModel` fades in: it starts with `opacity = 0` on its materials and lerps to `1` over ~400ms on first mount using a `useRef` + `useFrame` fade-in loop. The skeleton geometry dimensions should match the device's approximate bounding box (roughly 0.12 × 0.06 × 0.02 in model-space units at scale 50, so ~6 × 3 × 1 world units).

**Skeleton material:** `MeshBasicMaterial` with `color: '#111116'`, `transparent: true`, `opacity: 0.4`.

**App.jsx change:**
```jsx
<Suspense fallback={<ModelSkeleton />}>
  <GlimpseModel />
</Suspense>
```

---

## Change 3: HDRI Environment + Contact Shadow

**File:** `glimpse-web/src/App.jsx` (Canvas children)  
**Imports:** `Environment`, `ContactShadows` from `@react-three/drei`

### Environment
Add `<Environment preset="studio" />` inside the Canvas. This provides a physically-based environment map without loading an external `.hdr` file. The dark matte case picks up subtle ambient reflections.

Reduce existing directional light intensities by ~30% to compensate:
- Key light: `2.2` → `1.5`
- Rim light: `1.4` → `1.0`
- Fill + under-bounce: unchanged (already subtle)

### Contact Shadow
Add `<ContactShadows position={[0, -1.2, 0]} opacity={0.5} blur={2.5} far={3} />` below the model's rest Y position. The floating bob animation (±0.08 units) moves the model slightly away from the shadow plane, naturally reinforcing the float effect.

---

## Change 4: E-ink Flash Transition

**File:** `glimpse-web/src/canvas/GlimpseModel.jsx`

Replace the instant texture swap with a three-phase flash animation driven entirely in `useFrame`. No new dependencies.

### State machine (via refs)
```
idle → flash-in → swap → flash-out → idle
```

**Refs needed:**
- `flashRef` — `{ phase: 'idle', progress: 0, nextUrl: null }`

### Timing
- `flash-in`: 80ms — lerp screen material color toward `#ffffff`
- `swap`: 0ms — at peak white, set new texture and color to `#ffffff`
- `flash-out`: 120ms — lerp screen material color back to normal (`#ffffff` → stays white since texture provides color, just fade opacity if needed, or just cut since white-on-texture is invisible)

**Implementation:** The screen material's `color` tint acts as the flash control. When the texture itself is set, the color tint is already `#ffffff` (neutral), so the image shows through. The flash sequence is:

1. Detect texture change → store `nextUrl` in `flashRef`, enter `flash-in` phase
2. `flash-in` (80ms): lerp `mat.color` from current toward `#ffffff`; `mat.map = null` so the screen goes blank-white
3. At 80ms: swap `mat.map` to the new texture; enter `flash-out` phase (no-op visually since texture + white tint = normal display)
4. `flash-out` phase ends immediately — transition complete

Phase timing driven by accumulating `clock.getDelta()` in `flashRef.elapsed`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/canvas/GlimpseModel.jsx` | Model import, mesh detection, e-ink flash transition |
| `src/canvas/ModelSkeleton.jsx` | New file — skeleton fallback component |
| `src/canvas/Lights.jsx` | Reduce key + rim light intensity by ~30% |
| `src/App.jsx` | Suspense fallback, Environment, ContactShadows |

---

## Out of Scope

- Rich per-group materials (NeoPixels, PCB, metallic pins) — deferred to Phase B
- Custom GLSL e-ink scan-line shader — deferred, not needed for this phase
- Scroll animation tuning — current lerp feel is acceptable
