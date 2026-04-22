# Performance Optimization — Design Spec

**Date:** 2026-04-22  
**Scope:** Initial load time reduction  
**Deployment target:** Static hosting (Netlify/Vercel/equivalent)

---

## Problem

Initial load time is the primary pain point. Two root causes:

1. **Oversized image assets** — `usecases/case1–4.png` total ~33MB (7–10MB each). `glimpse-hardware-list.png` is 844KB. All are PNG; none have been converted to WebP. Lazy loading is already in place so these don't block the loading screen, but they cause large mid-page downloads.

2. **Unoptimized JS bundle** — `vite.config.js` has no chunk splitting or compression. Three.js + `@react-three/*` (~600KB+ minified) lands in the same bundle as app code, preventing long-term caching of the heavy 3D runtime.

---

## Section 1 — Image Conversion

### What

Convert the following assets to WebP at quality 82, resized to their actual display dimensions:

| File | Current size | Target format |
|------|-------------|---------------|
| `usecases/case1.png` | 7.1MB | WebP q82 |
| `usecases/case2.png` | 6.9MB | WebP q82 |
| `usecases/case3.png` | 7.9MB | WebP q82 |
| `usecases/case4.png` | 10MB | WebP q82 |
| `usecases/case5.png` | 1.3MB | WebP q82 |
| `public/glimpse-hardware-list.png` | 844KB | WebP q82 |

Expected outcome: ~85–90% reduction, ~33MB → ~3–4MB across the usecase images.

### How

- A `scripts/optimize-images.sh` script using ffmpeg handles the batch conversion.
- Output files replace the originals in-place (same path, `.webp` extension).
- `usecases/case*.png` are ES module imports — update the `import` statements in JSX.
- `public/glimpse-hardware-list.png` is referenced by URL path — update the `src` string in JSX (no import statement).
- The `loading="lazy"` attributes already present on these images are preserved.

### Display dimensions (ffmpeg resize targets)

Display dimensions are determined by the CSS and viewport. Since exact render sizes depend on viewport, we resize to a conservative max-width that covers all breakpoints at 2x:

- `case1–4`: max 2400px wide (full-bleed gallery images)
- `case5`: max 1400px wide (centered inline image)
- `glimpse-hardware-list`: max 1600px wide

---

## Section 2 — Vite Build Optimization

### Chunk splitting

Add `build.rollupOptions.output.manualChunks` to `vite.config.js` to isolate the Three.js ecosystem into its own chunk:

```js
manualChunks: {
  'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
  'vendor-gsap': ['gsap'],
  'vendor-lenis': ['lenis'],
}
```

**Why:** Three.js + R3F alone is ~600KB+ minified. Splitting it out means:
- Returning visitors get a cache hit on `vendor-three` even when app code changes.
- The browser can parse chunks in parallel.
- App code chunk is smaller, faster to evaluate on first load.

### Compression

Add `vite-plugin-compression` to emit `.gz` and `.br` sidecar files at build time. Static hosts (Netlify, Vercel, Cloudflare Pages) serve these automatically when the client sends `Accept-Encoding: br` or `gzip`.

Brotli typically yields 15–25% smaller output than gzip on JS. No runtime cost — files are pre-compressed at build time.

Install: `npm install -D vite-plugin-compression`

---

## Out of Scope

- Scrub frame optimization (frames are already lean at 1.7MB / 80 frames)
- GLB compression (Draco) — deferred
- React.lazy / code splitting of sections — deferred
- Service worker / offline caching — deferred

---

## Success Criteria

- Usecase images total < 4MB (down from ~33MB)
- JS bundle produces separate `vendor-three` chunk in `dist/assets/`
- Build output includes `.br` and `.gz` sidecar files
- Visual output is unchanged — images pass eyeball check at full resolution
