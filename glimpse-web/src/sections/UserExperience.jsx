import { useCallback, useState } from 'react'
import styles from './UserExperience.module.css'

/** Drop `public/ux-seamless.mp4` (or WebM) when ready — plays muted, looped, no controls. */
const UX_VIDEO_SRC = '/Glimpse-video.mov'

export default function UserExperience() {
  const [videoFailed, setVideoFailed] = useState(false)

  const onVideoError = useCallback(() => {
    setVideoFailed(true)
  }, [])

  const showVideo = Boolean(UX_VIDEO_SRC) && !videoFailed

  return (
    <section className={styles.section} id="user-experience" aria-label="User experience">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h2 className={styles.title}>Your decisions follow where you go.
            Glimpse does too.</h2>
          <p className={styles.subtitle}>
            Glimpse moves with you, with a companion app that deepens your decision-making process. 
            Share what's weighing on you, and watch the different outcomes of your decision take shape - each possibility made vivid, so nothing stays abstract for long.
          </p>
        </div>
        <div className={styles.frame}>
          {showVideo ? (
            <video
              className={styles.video}
              src={UX_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onError={onVideoError}
            />
          ) : null}
          {!showVideo ? (
            <div className={styles.placeholder} aria-hidden="true">
              <span className={styles.placeholderLabel}>Video — add public/ux-seamless.mp4</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
