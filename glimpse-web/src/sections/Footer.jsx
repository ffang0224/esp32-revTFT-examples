import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <img src="/logotext.svg" alt="Glimpse" className={styles.logo} />
        <p className={styles.statement}>
          Glimpse is a concept exploration in decision-making, examining the internal process as
          a tactile, personal experience. A study in form, feeling, and the objects we reach for
          when we do not know what comes next.
        </p>
        <p className={styles.meta}>
          Developed by Lukrecija Paulikaite, Fausto Fang, and Victor Alves Gomes Nadu
        </p>
        <p className={styles.date}>April, 2026</p>
      </div>
    </footer>
  )
}
