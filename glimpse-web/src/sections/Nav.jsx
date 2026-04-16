import styles from './Nav.module.css'

export default function Nav({ lenisRef, hidden = false, light = false }) {
  const handleClick = (e, target) => {
    e.preventDefault()
    const lenis = lenisRef?.current
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.4 })
    } else {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav className={`${styles.nav} ${light ? styles.light : ''} ${hidden ? styles.hidden : ''}`}>
      <a href="#" className={styles.logo} onClick={(e) => handleClick(e, '#hero')}>
        <img src="/logotext.svg" alt="Glimpse" className={styles.logoImage} />
      </a>
    </nav>
  )
}
