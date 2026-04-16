import { useEffect, useLayoutEffect, useRef } from 'react'
import styles from './ModelScrub.module.css'
import { FRAME_COUNT } from '../ui/scrubFrames'

const AUTO_LOOP_MS = 2700
const END_NUDGE_PX = 430
const END_NUDGE_MS = 460

export default function ModelScrub({ frames }) {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const progressRef = useRef(null)
  const framesRef = useRef(frames)
  const contextRef = useRef(null)
  const lastIndexRef = useRef(-1)
  const previousTimeRef = useRef(0)
  const pauseAutoUntilRef = useRef(0)
  const touchYRef = useRef(null)
  const endNudgedRef = useRef(false)
  const nudgeRafRef = useRef(0)
  const nudgeStateRef = useRef(null)

  useEffect(() => {
    framesRef.current = frames
  }, [frames])

  useEffect(() => {
    const pauseAuto = () => {
      pauseAutoUntilRef.current = performance.now() + 900
    }

    const onWheel = (event) => {
      if (event.deltaY < 0) pauseAuto()
    }

    const onTouchStart = (event) => {
      touchYRef.current = event.touches[0]?.clientY ?? null
    }

    const onTouchMove = (event) => {
      const nextY = event.touches[0]?.clientY
      if (touchYRef.current !== null && typeof nextY === 'number' && nextY > touchYRef.current) {
        pauseAuto()
      }
      touchYRef.current = typeof nextY === 'number' ? nextY : touchYRef.current
    }

    const onTouchEnd = () => {
      touchYRef.current = null
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      if (nudgeRafRef.current) {
        window.cancelAnimationFrame(nudgeRafRef.current)
      }
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Draw frame 0 before paint the moment frames arrive
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !frames?.[0]) return
    canvas.width = frames[0].naturalWidth
    canvas.height = frames[0].naturalHeight
    contextRef.current = canvas.getContext('2d')
    contextRef.current?.clearRect(0, 0, canvas.width, canvas.height)
    contextRef.current?.drawImage(frames[0], 0, 0)
    lastIndexRef.current = 0
  }, [frames])

  // Autoplay by advancing the actual page scroll while the scrub section is
  // pinned, keeping the visible frame and scroll progress perfectly synced.
  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    if (!section || !canvas) return

    if (!contextRef.current) {
      contextRef.current = canvas.getContext('2d')
    }

    const viewportHeight = () =>
      window.visualViewport?.height ?? window.innerHeight

    let rafId = 0

    const stopNudge = () => {
      if (nudgeRafRef.current) {
        window.cancelAnimationFrame(nudgeRafRef.current)
        nudgeRafRef.current = 0
      }
      nudgeStateRef.current = null
    }

    const startEndNudge = (targetTop) => {
      stopNudge()
      nudgeStateRef.current = {
        from: window.scrollY,
        target: targetTop,
        start: performance.now(),
      }

      const animateNudge = (timestamp) => {
        const state = nudgeStateRef.current
        if (!state) return

        const progress = Math.min(1, (timestamp - state.start) / END_NUDGE_MS)
        const eased = 1 - ((1 - progress) ** 3)
        const nextTop = state.from + (state.target - state.from) * eased

        window.scrollTo({ top: nextTop, behavior: 'auto' })

        if (progress < 1) {
          nudgeRafRef.current = window.requestAnimationFrame(animateNudge)
        } else {
          nudgeRafRef.current = 0
          nudgeStateRef.current = null
        }
      }

      nudgeRafRef.current = window.requestAnimationFrame(animateNudge)
    }

    const getCenteredFollowupTop = () => {
      const followupSection = section.nextElementSibling
      if (!followupSection) return null

      const focusTarget = followupSection.firstElementChild ?? followupSection
      const vh = viewportHeight()
      const targetRect = focusTarget.getBoundingClientRect()
      const targetTop = window.scrollY + targetRect.top
      const centeredTop = targetTop - ((vh - targetRect.height) / 2)

      return Math.max(section.offsetTop, centeredTop)
    }

    const drawCurrentFrame = (now) => {
      const f = framesRef.current
      if (!f) {
        rafId = window.requestAnimationFrame(drawCurrentFrame)
        return
      }

      if (!previousTimeRef.current) {
        previousTimeRef.current = now
      }

      const rect = section.getBoundingClientRect()
      const vh = viewportHeight()
      const scrollable = Math.max(1, section.offsetHeight - vh)
      const scrollProgress = Math.max(0, Math.min(1, -rect.top / scrollable))
      const sectionStart = window.scrollY + rect.top
      const sectionEnd = sectionStart + scrollable
      const isActive = rect.top <= 0 && rect.bottom >= vh

      if (isActive && scrollProgress < 1 && now >= pauseAutoUntilRef.current) {
        const delta = now - previousTimeRef.current
        const autoScrollDistance = (scrollable * delta) / AUTO_LOOP_MS
        const nextScrollY = Math.min(sectionEnd, window.scrollY + autoScrollDistance)

        if (nextScrollY > window.scrollY) {
          window.scrollTo({ top: nextScrollY, behavior: 'auto' })
        }
      }

      if (
        isActive &&
        scrollProgress >= 0.995 &&
        !endNudgedRef.current &&
        now >= pauseAutoUntilRef.current
      ) {
        endNudgedRef.current = true
        const centeredFollowupTop = getCenteredFollowupTop()
        const fallbackTop = Math.min(sectionEnd + END_NUDGE_PX, window.scrollY + END_NUDGE_PX)
        startEndNudge(centeredFollowupTop ?? fallbackTop)
      } else if (scrollProgress < 0.94) {
        endNudgedRef.current = false
        stopNudge()
      }

      previousTimeRef.current = now

      const index = Math.min(Math.floor(scrollProgress * FRAME_COUNT), FRAME_COUNT - 1)

      if (index !== lastIndexRef.current) {
        lastIndexRef.current = index
        contextRef.current?.clearRect(0, 0, canvas.width, canvas.height)
        contextRef.current?.drawImage(f[index], 0, 0, canvas.width, canvas.height)
      }

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${scrollProgress})`
      }

      rafId = window.requestAnimationFrame(drawCurrentFrame)
    }

    rafId = window.requestAnimationFrame(drawCurrentFrame)
    return () => {
      stopNudge()
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, []) // empty — never re-runs, reads frames via framesRef

  return (
    <section ref={sectionRef} className={styles.section}>
      <div className={styles.sticky}>

        {/* Canvas always stays in DOM — never unmounted */}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ opacity: frames ? 1 : 0 }}
        />

        {/* Placeholder overlays until frames arrive */}
        {!frames && (
          <div className={styles.placeholder} aria-hidden="true">
            <div className={styles.orbit}><div className={styles.dot} /></div>
            <span className={styles.placeholderLabel}>loading…</span>
          </div>
        )}

      </div>
    </section>
  )
}
