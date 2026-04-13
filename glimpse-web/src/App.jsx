import { useEffect, useRef, Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import GlimpseModel from './canvas/GlimpseModel'
import Lights from './canvas/Lights'

import Nav from './sections/Nav'
import Hero from './sections/Hero'
import DilemmaStory from './sections/DilemmaStory'
import ScrollStory from './sections/ScrollStory'
import HowItWorks from './sections/HowItWorks'
import Specs from './sections/Specs'
import Footer from './sections/Footer'
import Cursor from './ui/Cursor'
import DemoOverlay from './DemoOverlay'

import './styles/globals.css'
import styles from './App.module.css'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const lenisRef   = useRef(null)
  const [navHidden, setNavHidden] = useState(false)
  const [isDemoOpen, setIsDemoOpen] = useState(false)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const rafCallback = time => lenis.raf(time * 1000)
    gsap.ticker.add(rafCallback)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(rafCallback)
      lenis.destroy()
    }
  }, [])

  const openDemo = () => {
    setNavHidden(true)
    setIsDemoOpen(true)
  }

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
  }, [])

  return (
    <>
      <Cursor />
      <Nav lenisRef={lenisRef} hidden={navHidden} onTryIt={openDemo} />

      {/* Fixed 3D canvas — receives drag events in areas not covered by main content */}
      <div className={`${styles.canvasWrap} ${isDemoOpen ? styles.canvasDisabled : ''}`}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, 12.5, 6.8], fov: 38, near: 0.1, far: 1000 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = 'srgb'
            gl.toneMapping = 4
            gl.toneMappingExposure = 1.2
          }}
        >
          <Lights />
          <Suspense fallback={null}>
            <GlimpseModel />
          </Suspense>
        </Canvas>
      </div>

      {/* pointer-events:none on main lets canvas receive drag events in empty areas */}
      <main className={`${styles.main} ${isDemoOpen ? styles.mainHidden : ''}`}>
        <Hero />
        <DilemmaStory />
        <ScrollStory />
        <HowItWorks />
        <Specs />
        <Footer />
      </main>

      <DemoOverlay isOpen={isDemoOpen} onClose={closeDemo} />
    </>
  )
}
