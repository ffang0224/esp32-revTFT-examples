# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce initial load time by converting oversized PNG assets to WebP, swapping the 20MB GLB for a 1.7MB optimized version, and splitting the JS bundle with brotli/gzip compression.

**Architecture:** Three independent changes — asset conversion (ffmpeg script + import updates), GLB import swap (two lines), and Vite build config (chunk splitting + compression plugin). Each can be committed separately with no cross-dependencies.

**Tech Stack:** React 19, Vite 8, Three.js / @react-three/fiber, ffmpeg (CLI), vite-plugin-compression

---

## File Map

| File | Change |
|------|--------|
| `scripts/optimize-images.sh` | **Create** — ffmpeg batch conversion script |
| `usecases/case1–5.webp` | **Create** — converted WebP outputs |
| `public/glimpse-hardware-list.webp` | **Create** — converted WebP output |
| `src/sections/MakeItYourOwn.jsx` | **Modify** — update 4 PNG imports to .webp |
| `src/App.jsx` | **Modify** — update case5 import to .webp |
| `src/sections/Specs.jsx` | **Modify** — update src string to .webp |
| `src/canvas/GlimpseModel.jsx` | **Modify** — swap GLB import path |
| `src/canvas/GlimpseExplorerModel.jsx` | **Modify** — swap GLB import path |
| `vite.config.js` | **Modify** — add chunk splitting + compression |

---

## Task 1: Create and run image optimization script

**Files:**
- Create: `scripts/optimize-images.sh`

- [ ] **Step 1: Create the script**

```bash
mkdir -p scripts
```

Create `scripts/optimize-images.sh` with this exact content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "Converting usecase images..."
for i in 1 2 3 4 5; do
  ffmpeg -y -i "$ROOT/usecases/case$i.png" \
    -vf "scale='min(1400,iw)':-2" \
    -c:v libwebp -quality 82 -lossless 0 \
    "$ROOT/usecases/case$i.webp"
  echo "  case$i.webp: $(du -sh "$ROOT/usecases/case$i.webp" | cut -f1)"
done

echo "Converting hardware diagram..."
ffmpeg -y -i "$ROOT/public/glimpse-hardware-list.png" \
  -vf "scale='min(2400,iw)':-2" \
  -c:v libwebp -quality 82 -lossless 0 \
  "$ROOT/public/glimpse-hardware-list.webp"
echo "  glimpse-hardware-list.webp: $(du -sh "$ROOT/public/glimpse-hardware-list.webp" | cut -f1)"

echo "All done."
```

- [ ] **Step 2: Make it executable and run it**

```bash
chmod +x scripts/optimize-images.sh
bash scripts/optimize-images.sh
```

Expected output (approximate — exact sizes will vary):
```
Converting usecase images...
  case1.webp: 300K
  case2.webp: 280K
  case3.webp: 320K
  case4.webp: 400K
  case5.webp: 80K
Converting hardware diagram...
  glimpse-hardware-list.webp: 120K
All done.
```

Total for usecase images should be well under 2MB (down from ~33MB). If any output is larger than 1MB, re-run with `-quality 75` for that file only.

- [ ] **Step 3: Verify output files exist**

```bash
ls -lh usecases/*.webp public/glimpse-hardware-list.webp
```

Expected: 6 .webp files present with sizes matching Step 2 output.

- [ ] **Step 4: Commit the script and generated assets**

```bash
git add scripts/optimize-images.sh usecases/case1.webp usecases/case2.webp usecases/case3.webp usecases/case4.webp usecases/case5.webp public/glimpse-hardware-list.webp
git commit -m "feat: add image optimization script and WebP outputs"
```

---

## Task 2: Update JSX to reference WebP images

**Files:**
- Modify: `src/sections/MakeItYourOwn.jsx:1-4`
- Modify: `src/App.jsx:16`
- Modify: `src/sections/Specs.jsx:9`

- [ ] **Step 1: Update MakeItYourOwn.jsx imports**

In `src/sections/MakeItYourOwn.jsx`, replace lines 1–4:

```js
// Before
import case1 from '../../usecases/case1.png'
import case2 from '../../usecases/case2.png'
import case3 from '../../usecases/case3.png'
import case4 from '../../usecases/case4.png'
```

```js
// After
import case1 from '../../usecases/case1.webp'
import case2 from '../../usecases/case2.webp'
import case3 from '../../usecases/case3.webp'
import case4 from '../../usecases/case4.webp'
```

- [ ] **Step 2: Update App.jsx import**

In `src/App.jsx`, replace line 16:

```js
// Before
import case5 from '../usecases/case5.png'
```

```js
// After
import case5 from '../usecases/case5.webp'
```

- [ ] **Step 3: Update Specs.jsx src path**

In `src/sections/Specs.jsx`, replace line 9:

```jsx
// Before
src="/glimpse-hardware-list.png"
```

```jsx
// After
src="/glimpse-hardware-list.webp"
```

- [ ] **Step 4: Start dev server and verify images load**

```bash
npm run dev
```

Open the browser at the local dev URL. Scroll to:
- The "Make it your own" section — all 4 case images should render correctly
- The closing section — case5 image should render correctly
- The Specs section — hardware diagram should render correctly

No broken images, no layout shifts. If an image appears broken, check the browser console for 404s — the `.webp` file likely wasn't generated in Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/sections/MakeItYourOwn.jsx src/App.jsx src/sections/Specs.jsx
git commit -m "feat: use WebP images in MakeItYourOwn, App, and Specs"
```

---

## Task 3: Swap the GLB to optimized version

**Files:**
- Modify: `src/canvas/GlimpseModel.jsx:23`
- Modify: `src/canvas/GlimpseExplorerModel.jsx:17`

- [ ] **Step 1: Update GlimpseModel.jsx**

In `src/canvas/GlimpseModel.jsx`, replace line 23:

```js
// Before
import caseGltfUrl from '../../case-only.glb?url'
```

```js
// After
import caseGltfUrl from '../../case-only-optimized.glb?url'
```

(The `useGLTF.preload(caseGltfUrl)` at the bottom of the file uses the same variable — no other change needed.)

- [ ] **Step 2: Update GlimpseExplorerModel.jsx**

In `src/canvas/GlimpseExplorerModel.jsx`, replace line 17:

```js
// Before
import caseGltfUrl from '../../case-only.glb?url'
```

```js
// After
import caseGltfUrl from '../../case-only-optimized.glb?url'
```

- [ ] **Step 3: Visual QA**

With the dev server still running (`npm run dev`), open the app and verify:

1. **Hero section** — 3D model renders and floats correctly
2. **ModelScrub** — scroll through the scrub section, canvas frames play correctly
3. **DeviceExplorer section** — part labels and visibility toggles work; toggling parts on/off shows the correct meshes
4. **AssemblyStory section** — scroll through the assembly animation; parts explode and reassemble correctly
5. No console errors referencing mesh names or material warnings

If the model renders incorrectly (wrong mesh names, missing parts, broken animation), revert the import and report — the optimized GLB may have a different structure. Revert command:
```bash
git checkout src/canvas/GlimpseModel.jsx src/canvas/GlimpseExplorerModel.jsx
```

- [ ] **Step 4: Commit**

```bash
git add src/canvas/GlimpseModel.jsx src/canvas/GlimpseExplorerModel.jsx
git commit -m "feat: swap to case-only-optimized.glb (20MB → 1.7MB)"
```

---

## Task 4: Vite build optimization

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Install vite-plugin-compression**

```bash
npm install -D vite-plugin-compression
```

Expected: package added to `devDependencies` in `package.json`.

- [ ] **Step 2: Update vite.config.js**

Replace the entire contents of `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
    compression({ algorithm: 'gzip', ext: '.gz' }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-gsap': ['gsap'],
          'vendor-lenis': ['lenis'],
        },
      },
    },
  },
})
```

- [ ] **Step 3: Run a production build and verify output**

```bash
npm run build
```

Expected output includes separate chunks:
```
dist/assets/vendor-three-[hash].js   ~600KB
dist/assets/vendor-gsap-[hash].js    ~70KB
dist/assets/vendor-lenis-[hash].js   ~20KB
dist/assets/index-[hash].js          <100KB
```

And for each JS file, compressed sidecars:
```
dist/assets/vendor-three-[hash].js.br
dist/assets/vendor-three-[hash].js.gz
```

If the build fails with `Cannot find module 'vite-plugin-compression'`, re-run `npm install`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js package.json package-lock.json
git commit -m "feat: add chunk splitting and brotli/gzip compression to Vite build"
```

---

## Success Criteria Checklist

- [ ] `usecases/case1–5.webp` exist and total < 2MB
- [ ] `public/glimpse-hardware-list.webp` exists and < 200KB
- [ ] No broken images in browser across all sections
- [ ] `case-only-optimized.glb` loads; 3D model, DeviceExplorer, and AssemblyStory all work correctly
- [ ] `npm run build` produces `vendor-three`, `vendor-gsap`, `vendor-lenis` chunks
- [ ] `dist/assets/` contains `.br` and `.gz` sidecar files
