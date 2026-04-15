import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <img src="/logotext.svg" alt="Glimpse" className={styles.logo} />
      <span className={styles.right}>
        Open Source · 2025 ·{' '}
        <a
          href="https://github.com/ffang0224/esp32-revTFT-examples"
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          GitHub ↗
        </a>
      </span>
    </footer>
  )
}
