import { useEffect, useLayoutEffect, useRef } from 'react'
import styles from './ModelScrub.module.css'
import { FRAME_COUNT } from '../ui/scrubFrames'

export default function ModelScrub({ frames }) {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const progressRef = useRef(null)
  const framesRef = useRef(frames)
  const contextRef = useRef(null)
  const lastIndexRef = useRef(-1)

  useEffect(() => {
    framesRef.current = frames
  }, [frames])

  // Draw frame 0 before paint the moment frames arrive
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !frames?.[0]) return
    canvas.width = frames[0].naturalWidth
    canvas.height = frames[0].naturalHeight
    contextRef.current = canvas.getContext('2d')
    contextRef.current?.drawImage(frames[0], 0, 0)
    lastIndexRef.current = 0
  }, [frames])

  // Scroll handler — set up once, reads frames via framesRef
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

    const drawCurrentFrame = () => {
      rafId = 0
      const f = framesRef.current
      if (!f) return

      const rect = section.getBoundingClientRect()
      const vh = viewportHeight()
      const scrollable = Math.max(1, section.offsetHeight - vh)
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable))
      const index = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1)

      if (index !== lastIndexRef.current) {
        lastIndexRef.current = index
        contextRef.current?.drawImage(f[index], 0, 0, canvas.width, canvas.height)
      }

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`
      }
    }

    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(drawCurrentFrame)
    }

    drawCurrentFrame()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.visualViewport?.addEventListener('resize', onScroll)
    window.visualViewport?.addEventListener('scroll', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.visualViewport?.removeEventListener('resize', onScroll)
      window.visualViewport?.removeEventListener('scroll', onScroll)
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

        <div className={styles.progressBar}>
          <div ref={progressRef} className={styles.progressFill} />
        </div>
        <p className={styles.hint}>
          <span className={styles.hintDesktop}>scroll to rotate</span>
          <span className={styles.hintMobile}>swipe to rotate</span>
        </p>
      </div>
    </section>
  )
}
