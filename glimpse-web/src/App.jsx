import { useEffect, useMemo, useRef, useState } from 'react'

import Nav from './sections/Nav'
import Hero from './sections/Hero'
import DeviceExplorer from './sections/DeviceExplorer'
import UserExperience from './sections/UserExperience'
import Renders from './sections/Renders'
import Specs from './sections/Specs'
import MakeItYourOwn from './sections/MakeItYourOwn'
import Closing from './sections/Closing'
import Footer from './sections/Footer'
import Cursor from './ui/Cursor'
import DemoOverlay from './DemoOverlay'

import './styles/globals.css'
import styles from './App.module.css'

function readSectionDebugFromUrl() {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('debugSections')
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return null
}

export default function App() {
  const lenisRef = useRef(null)
  const [navHidden, setNavHidden] = useState(false)
  const [heroNavHidden, setHeroNavHidden] = useState(true)
  const [isDemoOpen, setIsDemoOpen] = useState(false)
  const sectionDebug = useMemo(() => {
    const fromUrl = readSectionDebugFromUrl()
    if (fromUrl !== null) return fromUrl
    return import.meta.env.DEV
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('section-debug', sectionDebug)
    return () => document.documentElement.classList.remove('section-debug')
  }, [sectionDebug])

  useEffect(() => {
    const updateHeroNav = () => {
      const hidden = window.scrollY < window.innerHeight * 0.92
      setHeroNavHidden((prev) => (prev === hidden ? prev : hidden))
    }
    updateHeroNav()
    window.addEventListener('scroll', updateHeroNav, { passive: true })
    window.addEventListener('resize', updateHeroNav)
    return () => {
      window.removeEventListener('scroll', updateHeroNav)
      window.removeEventListener('resize', updateHeroNav)
    }
  }, [])

  const closeDemo = () => {
    setIsDemoOpen(false)
    setNavHidden(false)
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeDemo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeDemo])

  return (
    <>
      <Cursor />
      <Nav lenisRef={lenisRef} hidden={navHidden || heroNavHidden} light />

      <main className={`${styles.main} ${isDemoOpen ? styles.mainHidden : ''}`}>
        <Hero />

        <div className={styles.divider} />
        <UserExperience />

        <div className={styles.divider} />
        <Renders />

        <div className={styles.divider} />
        <Specs />

        <div className={styles.divider} />
        <DeviceExplorer />

        <div className={styles.divider} />
        <MakeItYourOwn />

        <div className={styles.divider} />
        <Closing />

        <Footer />
      </main>

      <DemoOverlay isOpen={isDemoOpen} onClose={closeDemo} />
    </>
  )
}
