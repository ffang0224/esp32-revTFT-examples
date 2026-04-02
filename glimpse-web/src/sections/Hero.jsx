import styles from './Hero.module.css'

export default function Hero({ onTryIt }) {
  return (
    <section className={styles.hero} id="hero">
      <div className={styles.content}>
        <p className={styles.eyebrow}>eInk · ESP32 · Open Source</p>
        <h1 className={styles.title}>
          Carry a<br /><em>thought.</em>
        </h1>
        <p className={styles.sub}>
          Glimpse is a pocket-sized e-ink companion that shows you what matters —
          one quiet image at a time.
        </p>
        <button className={styles.tryItBtn} onClick={onTryIt}>
          Try it
        </button>
        <p className={styles.dragHint}>Drag to rotate the model →</p>
      </div>

      <div className={styles.scrollHint}>
        <span>Scroll</span>
        <div className={styles.scrollLine} />
      </div>
    </section>
  )
}
