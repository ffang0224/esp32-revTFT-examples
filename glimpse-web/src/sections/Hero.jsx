import styles from './Hero.module.css'

export default function Hero() {
  return (
    <section className={styles.hero} id="hero">
      <div className={styles.content}>
        <h1 className={styles.title}>Glimpse</h1>
        <p className={styles.sub}>
          Glimpse is for moments of choice, when logic alone isn&apos;t enough. Take a glimpse into a
          possible future and feel which one is right.
        </p>
      </div>
    </section>
  )
}
