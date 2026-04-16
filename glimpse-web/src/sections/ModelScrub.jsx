import { useEffect, useLayoutEffect, useRef } from 'react'
import styles from './ModelScrub.module.css'
import { FRAME_COUNT } from '../ui/scrubFrames'

export default function ModelScrub({ frames }) {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const progressRef = useRef(null)
  const framesRef = useRef(frames)
  const lastIndexRef = useRef(-1)

  // Keep framesRef current without re-running effects
  framesRef.current = frames

  // Draw frame 0 before paint the moment frames arrive
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !frames?.[0]) return
    canvas.width = frames[0].naturalWidth
    canvas.height = frames[0].naturalHeight
    canvas.getContext('2d').drawImage(frames[0], 0, 0)
    lastIndexRef.current = 0
  }, [frames])

  // Scroll handler — set up once, reads frames via ref
  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    if (!section || !canvas) return

    const onScroll = () => {
      const f = framesRef.current
      if (!f) return

      const rect = section.getBoundingClientRect()
      const scrollable = section.offsetHeight - window.innerHeight
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable))
      const index = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1)

      if (index !== lastIndexRef.current) {
        lastIndexRef.current = index
        canvas.getContext('2d').drawImage(f[index], 0, 0, canvas.width, canvas.height)
      }

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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
        <p className={styles.hint}>scroll to rotate</p>
      </div>
    </section>
  )
}
