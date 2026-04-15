import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import renderFront from '../../renders/front.png'
import render45 from '../../renders/45 degrees.png'
import renderBack from '../../renders/back.png'
import renderLayered from '../../renders/layered.png'
import styles from './Renders.module.css'

const RENDERS = [
  { src: renderLayered,   alt: 'Layered exploded view', hero: true },
  { src: renderFront,     alt: 'Front view with e-ink display' },
  { src: renderBack,      alt: 'Back view through frosted shell' },
  { src: render45,        alt: '45° side view showing internals', hero: true },
]

export default function Renders() {
  const [active, setActive] = useState(null)

  const close = useCallback(() => setActive(null), [])
  const prev = useCallback(() => setActive(i => (i - 1 + RENDERS.length) % RENDERS.length), [])
  const next = useCallback(() => setActive(i => (i + 1) % RENDERS.length), [])

  useEffect(() => {
    if (active === null) {
      document.body.classList.remove('lightbox-open')
      return
    }
    document.body.classList.add('lightbox-open')
    function onKey(e) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('lightbox-open')
    }
  }, [active, close, prev, next])

  return (
    <>
      <section className={styles.section} id="renders" aria-label="Product renders">
        <div className={styles.inner}>
          <div className={styles.grid}>
            {RENDERS.map((r, i) => (
              <figure
                key={r.src}
                className={`${styles.cell}${r.hero ? ` ${styles.cellHero}` : ''}`}
                onClick={() => setActive(i)}
              >
                <img src={r.src} alt={r.alt} className={styles.img} loading="lazy" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {active !== null && createPortal(
        <div className={styles.lightbox} onClick={close} role="dialog" aria-modal="true">
          <button className={styles.lbClose} onClick={close} aria-label="Close">✕</button>
          <button className={styles.lbPrev} onClick={e => { e.stopPropagation(); prev() }} aria-label="Previous">‹</button>
          <img
            src={RENDERS[active].src}
            alt={RENDERS[active].alt}
            className={styles.lbImg}
            onClick={e => e.stopPropagation()}
          />
          <button className={styles.lbNext} onClick={e => { e.stopPropagation(); next() }} aria-label="Next">›</button>
        </div>,
        document.body
      )}
    </>
  )
}
