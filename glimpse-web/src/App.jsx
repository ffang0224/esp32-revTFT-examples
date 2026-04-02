import { useEffect, useRef, Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import GlimpseModel from './canvas/GlimpseModel'
import Lights from './canvas/Lights'

import Nav from './sections/Nav'
import Hero from './sections/Hero'
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
  const mainRef    = useRef(null)
  const overlayRef = useRef(null)
  const tlRef      = useRef(null)
  const [navHidden, setNavHidden] = useState(false)

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
    tlRef.current?.kill()
    setNavHidden(true)
    tlRef.current = gsap.timeline()
      .to(mainRef.current,    { opacity: 0, scale: 0.97, duration: 0.4, ease: 'power2.in' })
      .to(overlayRef.current, { opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=0.1')
      .call(() => { overlayRef.current.style.pointerEvents = 'all' })
  }

  const closeDemo = () => {
    if (!overlayRef.current) return
    tlRef.current?.kill()
    overlayRef.current.style.pointerEvents = 'none'
    tlRef.current = gsap.timeline()
      .to(overlayRef.current, { opacity: 0, duration: 0.3, ease: 'power2.in' })
      .to(mainRef.current,    { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, '-=0.1')
      .call(() => setNavHidden(false))
  }

  return (
    <>
      <Cursor />
      <Nav lenisRef={lenisRef} hidden={navHidden} />

      {/* Fixed 3D canvas — receives drag events in areas not covered by main content */}
      <div className={styles.canvasWrap}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, 11, 5], fov: 38, near: 0.1, far: 1000 }}
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
      <main ref={mainRef} className={styles.main}>
        <Hero onTryIt={openDemo} />
        <ScrollStory />
        <div className={styles.divider} />
        <HowItWorks />
        <Specs />
        <Footer />
      </main>

      <DemoOverlay overlayRef={overlayRef} onClose={closeDemo} />
    </>
  )
}
