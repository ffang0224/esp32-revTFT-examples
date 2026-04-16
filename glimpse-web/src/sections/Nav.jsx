import { useEffect, useState } from 'react'
import styles from './Nav.module.css'

export default function Nav({ lenisRef, hidden = false, light = false }) {
  const [showHeroLogo, setShowHeroLogo] = useState(true)

  useEffect(() => {
    const hero = document.getElementById('hero')
    if (!hero) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowHeroLogo(entry.isIntersecting)
      },
      {
        threshold: 0.35,
      }
    )

    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

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
        <img
          src="/logotext.svg"
          alt="Glimpse"
          className={`${styles.logoImage} ${styles.logoText} ${showHeroLogo ? styles.logoVisible : styles.logoHidden}`}
        />
        <img
          src="/logo.svg"
          alt="Glimpse"
          className={`${styles.logoImage} ${styles.logoMark} ${showHeroLogo ? styles.logoHidden : styles.logoVisible}`}
        />
      </a>
    </nav>
  )
}
