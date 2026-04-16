import { useEffect, useRef, useState } from 'react'
import styles from './LoadingScreen.module.css'
import { FRAME_URLS, FRAME_COUNT } from './scrubFrames'

const MIN_DISPLAY_MS = 900

export default function LoadingScreen({ onComplete, onFramesReady }) {
  const [progress, setProgress] = useState(0)
  const [exiting, setExiting] = useState(false)
  const startTime = useRef(0)
  const doneRef = useRef(false)
  const loadedRef = useRef(0)

  useEffect(() => {
    startTime.current = Date.now()

    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      const elapsed = Date.now() - startTime.current
      const delay = Math.max(0, MIN_DISPLAY_MS - elapsed)
      setTimeout(() => {
        setProgress(1)
        setTimeout(() => {
          setExiting(true)
          setTimeout(onComplete, 700)
        }, 200)
      }, delay)
    }

    const images = FRAME_URLS.map((src) => {
      const img = new Image()
      img.decoding = 'async'

      const onFrameSettled = () => {
        loadedRef.current += 1
        setProgress(loadedRef.current / FRAME_COUNT)
        if (loadedRef.current === FRAME_COUNT) {
          onFramesReady?.(images)
          finish()
        }
      }

      img.onload = onFrameSettled
      img.onerror = onFrameSettled
      img.src = src
      return img
    })

    // Hard fallback
    const fallback = setTimeout(finish, 8000)
    return () => clearTimeout(fallback)
  }, [onComplete, onFramesReady])

  return (
    <div className={`${styles.screen} ${exiting ? styles.out : ''}`}>
      <div className={styles.inner}>
        <p className={styles.wordmark}>Glimpse</p>
        <div className={styles.track}>
          <div
            className={styles.fill}
            style={{ transform: `scaleX(${Math.min(progress, 1)})` }}
          />
        </div>
      </div>
    </div>
  )
}
