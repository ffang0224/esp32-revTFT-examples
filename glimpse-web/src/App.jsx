import { useEffect, useMemo, useRef, useState } from 'react'

import Nav from './sections/Nav'
import Hero from './sections/Hero'
import ModelScrub from './sections/ModelScrub'
import DeviceExplorer from './sections/DeviceExplorer'
import UserExperience from './sections/UserExperience'
import Renders from './sections/Renders'
import Specs from './sections/Specs'
import MakeItYourOwn from './sections/MakeItYourOwn'
import Closing from './sections/Closing'
import Footer from './sections/Footer'
import Cursor from './ui/Cursor'
import LoadingScreen from './ui/LoadingScreen'
import DemoOverlay from './DemoOverlay'
import case5 from '../usecases/case5.png'

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
  const [appReady, setAppReady] = useState(false)
  const [scrubFrames, setScrubFrames] = useState(null)
  const [navHidden, setNavHidden] = useState(false)
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
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
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
      {!appReady && (
        <LoadingScreen
          onComplete={() => setAppReady(true)}
          onFramesReady={(imgs) => setScrubFrames(imgs)}
        />
      )}
      <Cursor />
      <Nav lenisRef={lenisRef} hidden={navHidden} light />

      <main className={`${styles.main} ${isDemoOpen ? styles.mainHidden : ''}`}>
        <Hero />

        <ModelScrub frames={scrubFrames} />
        <section className={styles.bridgeCopy} aria-label="Decision making introduction">
          <div className={styles.bridgeCopyInner}>
            <p className={styles.bridgeCopyLead}>
              Decisions rarely come easy. We overthink, hesitate, and slowly lose touch with
              what we actually feel. Standing at a crossroads, unsure of what any direction
              really holds.
            </p>
            <p className={styles.bridgeCopyBody}>
              Glimpse meets you in that uncertainty - turning the decision-making process into
              something tangible, offering a way to step briefly into what each choice could
              become.
            </p>
          </div>
        </section>
        <UserExperience />
        <Renders />
        <section className={styles.bridgeCopy} aria-label="Product positioning">
          <div className={styles.bridgeCopyInner}>
            <p className={styles.bridgeCopyLead}>
              Lightweight and portable, Glimpse is designed to fit naturally into the rhythm
              of your life - and adapt to it. Customizable to the way you dress, the way you
              feel, the way you decide.
            </p>
          </div>
        </section>
        <Specs />
        <DeviceExplorer />
        <MakeItYourOwn />
        <section className={styles.closingStatement} aria-label="Closing statement">
          <div className={styles.closingStatementInner}>
            <p className={styles.closingStatementText}>
              Good decisions don't come from pressure or guesswork - they come from listening to
              yourself. Every choice is a step toward the person you're becoming.
            </p>
            <p className={styles.closingStatementText}>
              Glimpse is there for all of them - personal, portable, and entirely your own.
            </p>
            <img
              className={styles.closingStatementImage}
              src={case5}
              alt="Glimpse personalization example"
              loading="lazy"
            />
          </div>
        </section>
        <Closing />

        <Footer />
      </main>

      <DemoOverlay isOpen={isDemoOpen} onClose={closeDemo} />
    </>
  )
}
