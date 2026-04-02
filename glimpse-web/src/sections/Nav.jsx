import styles from './Nav.module.css'

export default function Nav({ lenisRef, hidden = false }) {
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
    <nav className={`${styles.nav} ${hidden ? styles.hidden : ''}`}>
      <a href="#" className={styles.logo} onClick={e => handleClick(e, '#hero')}>Glimpse</a>
      <ul className={styles.links}>
        <li><a href="#scroll-story" onClick={e => handleClick(e, '#scroll-story')}>The Device</a></li>
        <li><a href="#how-it-works" onClick={e => handleClick(e, '#how-it-works')}>How it works</a></li>
        <li><a href="#specs" onClick={e => handleClick(e, '#specs')}>Specs</a></li>
      </ul>
    </nav>
  )
}
