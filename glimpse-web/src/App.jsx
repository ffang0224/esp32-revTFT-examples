import { useEffect, Suspense } from 'react'
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

import './styles/globals.css'
import styles from './App.module.css'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(time => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)

    return () => { lenis.destroy() }
  }, [])

  return (
    <>
      <Cursor />
      <Nav />

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
            gl.toneMapping = 4 // ACESFilmicToneMapping
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
      <main className={styles.main}>
        <Hero />
        <ScrollStory />
        <div className={styles.divider} />
        <HowItWorks />
        <Specs />
        <Footer />
      </main>
    </>
  )
}
