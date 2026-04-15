# Section Distinction + Model Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual section dividers + section marks to the site, fix the section debug mode, and give the 3D model a dark, styled material that reads well against the black background.

**Architecture:** Pure CSS + JSX edits for sections; a second `useEffect` traversal in `GlimpseModel.jsx` to override non-screen mesh materials; lighting rebalance in `Lights.jsx`. No new components, no new files beyond the plan doc.

**Tech Stack:** React, CSS Modules, Three.js (`MeshStandardMaterial`), `@react-three/fiber`, GSAP ScrollTrigger.

---

## File Map

| File | Change |
|---|---|
| `glimpse-web/src/App.jsx` | Insert `<div className={styles.divider}/>` + `<p className={styles.sectionMark}>` between sections |
| `glimpse-web/src/App.module.css` | Add `.sectionMark` rule |
| `glimpse-web/src/styles/globals.css` | Extend `section-debug` CSS to target sticky inner child + add `::before` labels |
| `glimpse-web/src/canvas/GlimpseModel.jsx` | Add `useEffect` to override non-screen mesh materials to dark matte |
| `glimpse-web/src/canvas/Lights.jsx` | Lower ambient, add cool blue rim light |

---

### Task 1: Section dividers + marks in App.jsx / App.module.css

**Files:**
- Modify: `glimpse-web/src/App.jsx`
- Modify: `glimpse-web/src/App.module.css`

- [ ] **Step 1: Add `.sectionMark` to `App.module.css`**

Insert after the existing `.divider` rule:

```css
.sectionMark {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 2.2rem 6vw 0;
  font-size: 0.58rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(247, 248, 251, 0.28);
  pointer-events: none;
}

.sectionMark::before {
  content: '';
  display: inline-block;
  width: 18px;
  height: 1px;
  background: rgba(247, 248, 251, 0.22);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Update `App.jsx` main to insert dividers and section marks**

Replace the `<main>` block contents:

```jsx
<main className={`${styles.main} ${isDemoOpen ? styles.mainHidden : ''}`}>
  <Hero />

  <div className={styles.divider} />
  <DilemmaStory />

  <div className={styles.divider} />
  <ScrollStory />

  <div className={styles.divider} />
  <p className={styles.sectionMark}>02 — How it works</p>
  <HowItWorks />

  <div className={styles.divider} />
  <p className={styles.sectionMark}>03 — Specs</p>
  <Specs />

  <Footer />
</main>
```

- [ ] **Step 3: Visual check**

Run `npm run dev` in `glimpse-web/`. Scroll the page. Confirm:
- A faint gradient line appears between each section
- "02 — How it works" label appears above the cards in dim white
- "03 — Specs" label appears above the spec table
- No layout shifts or z-index issues

- [ ] **Step 4: Commit**

```bash
cd glimpse-web
git add src/App.jsx src/App.module.css
git commit -m "feat: add section dividers and section marks between page sections"
```

---

### Task 2: Fix section-debug CSS

**Files:**
- Modify: `glimpse-web/src/styles/globals.css`

The GSAP `pin:true` on `DilemmaStory` and `ScrollStory` applies `position:fixed; height:100vh` inline to the section element. The existing debug background still applies (it covers the pinned viewport), but GSAP's spacer is invisible. Extend the debug rules to also target the inner sticky/labelWrap children and add `::before` text labels so the section name is visible while debugging.

- [ ] **Step 1: Replace the existing `section-debug` block in `globals.css`**

Replace everything from `/* Section scroll debug` down to the closing `}` of the `[data-stage-dots]` rule with:

```css
/*
 * Section scroll debug (tint + inset border per block).
 * - `npm run dev`: on by default (set ?debugSections=0 to turn off).
 * - Production / preview: add ?debugSections=1 to the URL.
 * Class is toggled on <html> from App.jsx.
 *
 * GSAP ScrollTrigger pin moves #dilemma-story / #scroll-story to
 * position:fixed during their scroll range, so we tint both the section
 * element AND its first sticky child so the color is always visible.
 */
html.section-debug #hero,
html.section-debug #hero .content {
  background: rgba(239, 68, 68, 0.18) !important;
  box-shadow: inset 0 0 0 3px rgb(220, 38, 38);
}

html.section-debug #dilemma-story {
  background: rgba(249, 115, 22, 0.18) !important;
  box-shadow: inset 0 0 0 3px rgb(234, 88, 12);
}

html.section-debug #dilemma-story .sticky {
  background: rgba(249, 115, 22, 0.3) !important;
  box-shadow: inset 0 0 0 3px rgb(234, 88, 12);
}

html.section-debug #scroll-story {
  background: rgba(234, 179, 8, 0.18) !important;
  box-shadow: inset 0 0 0 3px rgb(202, 138, 4);
}

html.section-debug #scroll-story .labelWrap {
  background: rgba(234, 179, 8, 0.3) !important;
  box-shadow: inset 0 0 0 3px rgb(202, 138, 4);
}

html.section-debug #how-it-works {
  background: rgba(34, 197, 94, 0.22) !important;
  box-shadow: inset 0 0 0 3px rgb(22, 163, 74);
}

html.section-debug #specs {
  background: rgba(59, 130, 246, 0.22) !important;
  box-shadow: inset 0 0 0 3px rgb(37, 99, 235);
}

html.section-debug main > footer {
  background: rgba(168, 85, 247, 0.28) !important;
  box-shadow: inset 0 0 0 3px rgb(147, 51, 234);
}

/* Floating section-name label in top-left of each debug block */
html.section-debug #hero::before          { content: '#hero'; }
html.section-debug #dilemma-story::before { content: '#dilemma-story'; }
html.section-debug #scroll-story::before  { content: '#scroll-story'; }
html.section-debug #how-it-works::before  { content: '#how-it-works'; }
html.section-debug #specs::before         { content: '#specs'; }

html.section-debug #hero::before,
html.section-debug #dilemma-story::before,
html.section-debug #scroll-story::before,
html.section-debug #how-it-works::before,
html.section-debug #specs::before {
  position: absolute;
  top: 6px;
  left: 10px;
  z-index: 9999;
  font-family: monospace;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.55);
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
}

html.section-debug [data-stage-dots] {
  outline: 3px dashed fuchsia;
  outline-offset: 4px;
}
```

Note: the `::before` labels on the pinned sections (`#dilemma-story`, `#scroll-story`) will only appear when GSAP has the element in `position:fixed` during scroll — that's expected. `#hero`, `#how-it-works`, `#specs` will show their labels in normal document flow.

- [ ] **Step 2: Visual check**

In dev: visit `http://localhost:5173` — confirm colored tints on Hero, HowItWorks, Specs without needing URL param. Scroll into DilemmaStory and ScrollStory — confirm tinted overlay appears in viewport during those sections.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "fix: extend section-debug CSS to cover GSAP-pinned inner children"
```

---

### Task 3: Dark matte case material in GlimpseModel.jsx

**Files:**
- Modify: `glimpse-web/src/canvas/GlimpseModel.jsx`

All non-screen meshes currently use the GLB's baked materials (light gray/white). Override every non-screen mesh with a `MeshStandardMaterial` that looks like a premium matte 3D-printed case.

- [ ] **Step 1: Add the case material `useEffect` after the existing screen-material effect**

In `GlimpseModel.jsx`, after the closing `}, [blankColor, scene])` of the screen material effect, add:

```js
// Dark matte material for all non-screen case meshes
useEffect(() => {
  const caseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#111116'),
    roughness: 0.72,
    metalness: 0.0,
  })

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
  }
}, [scene])
```

- [ ] **Step 2: Visual check**

In the running dev server, confirm the case body is now a deep near-black/charcoal, not white, and the e-ink screen area still shows the paper-white/texture correctly.

- [ ] **Step 3: Commit**

```bash
git add src/canvas/GlimpseModel.jsx
git commit -m "feat: apply dark matte MeshStandardMaterial to non-screen case meshes"
```

---

### Task 4: Rebalance lighting in Lights.jsx

**Files:**
- Modify: `glimpse-web/src/canvas/Lights.jsx`

Current ambient at intensity 2.5 washes out any dark material. Lower it, keep the warm key light, and add a cool blue rim from behind-left to give the dark case depth and tie it to the site's `--accent` blue.

- [ ] **Step 1: Replace `Lights.jsx` contents**

```jsx
export default function Lights() {
  return (
    <>
      {/* Reduced ambient — dark case needs shadow depth */}
      <ambientLight color={0xfff5e6} intensity={0.9} />

      {/* Warm key light from front-right */}
      <directionalLight color={0xfff0d6} intensity={2.2} position={[4, 8, 6]} />

      {/* Soft warm fill from left */}
      <directionalLight color={0xc4a882} intensity={0.8} position={[-4, 2, -3]} />

      {/* Cool blue rim from behind — ties to site accent #2997ff */}
      <directionalLight color={0x2997ff} intensity={1.4} position={[-3, 1, -8]} />

      {/* Subtle warm under-bounce */}
      <directionalLight color={0xffeedd} intensity={0.5} position={[0, -4, -6]} />
    </>
  )
}
```

- [ ] **Step 2: Visual check**

Confirm the dark case now has:
- Warm highlights on the lit face (key light)
- A visible blue edge glow on the back/rim (rim light)
- Shadow depth — no longer flat white

Adjust `intensity` values ±0.2 if needed until it looks crisp and not muddy.

- [ ] **Step 3: Commit**

```bash
git add src/canvas/Lights.jsx
git commit -m "feat: rebalance lights — lower ambient, add blue rim to complement dark case"
```

---

## Self-Review

**Spec coverage:**
- Section dividers inserted ✓ (Task 1)
- Section marks above HowItWorks + Specs ✓ (Task 1)
- Debug mode covers GSAP-pinned sticky children ✓ (Task 2)
- 3D model dark matte case material ✓ (Task 3)
- Lighting rebalance with blue rim ✓ (Task 4)

**Placeholder scan:** None found — all steps include concrete code.

**Type consistency:** `isCaseEInkScreenMesh` reused (not redefined) in Task 3. `THREE.MeshStandardMaterial` and `THREE.Color` both already imported in `GlimpseModel.jsx`. `Lights.jsx` has no imports to worry about.
