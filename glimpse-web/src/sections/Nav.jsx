import styles from './Nav.module.css'

export default function Nav({ lenisRef, hidden = false, onTryIt, light = false }) {
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
      <ul className={styles.links}>
        <li>
          <a href="#device-explorer" onClick={(e) => handleClick(e, '#device-explorer')}>
            Explore
          </a>
        </li>
        <li>
          <a href="#user-experience" onClick={(e) => handleClick(e, '#user-experience')}>
            Experience
          </a>
        </li>
        <li>
          <a href="#renders" onClick={(e) => handleClick(e, '#renders')}>
            Renders
          </a>
        </li>
        <li>
          <a href="#specs" onClick={(e) => handleClick(e, '#specs')}>
            Specs
          </a>
        </li>
        <li>
          <a href="#make-it-your-own" onClick={(e) => handleClick(e, '#make-it-your-own')}>
            Yours
          </a>
        </li>
        <li>
          <button type="button" className={styles.tryItButton} onClick={onTryIt}>
            Try it
          </button>
        </li>
      </ul>
    </nav>
  )
}
