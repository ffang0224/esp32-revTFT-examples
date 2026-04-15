import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { scrollState } from '../canvas/scrollState'
import styles from './AssemblyStory.module.css'

gsap.registerPlugin(ScrollTrigger)

export default function AssemblyStory() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      pin: true,
      scrub: true,
      onUpdate: () => {
        scrollState.screenImage = null
        scrollState.screenVisible = false
        scrollState.assemblyVisible = false
        scrollState.assemblyProgress = 0
        scrollState.assemblyActiveStage = 0
        scrollState.modelVisible = false
      },
      onEnter: () => {
        scrollState.assemblyVisible = false
        scrollState.assemblyProgress = 0
        scrollState.modelVisible = false
      },
      onLeave: () => {
        scrollState.assemblyVisible = false
        scrollState.assemblyProgress = 0
        scrollState.targetX = 0
        scrollState.targetY = -0.2
        scrollState.targetZ = 0
        scrollState.targetRotY = 0.14
        scrollState.screenVisible = false
        scrollState.modelVisible = true
      },
      onEnterBack: () => {
        scrollState.assemblyVisible = false
        scrollState.assemblyProgress = 0
        scrollState.modelVisible = false
      },
      onLeaveBack: () => {
        scrollState.assemblyVisible = false
        scrollState.assemblyProgress = 0
        scrollState.assemblyActiveStage = 0
        scrollState.targetX = 0
        scrollState.targetY = -0.2
        scrollState.targetZ = 0
        scrollState.targetRotY = 0.14
        scrollState.screenIndex = 0
        scrollState.screenImage = null
        scrollState.screenVisible = true
        scrollState.modelVisible = true
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <section ref={sectionRef} className={styles.section} id="inside-glimpse">
      <div className={styles.viewport}>
        <img
          className={styles.diagram}
          src="/glimpse-hardware-list.png"
          alt="Glimpse hardware list exploded view"
        />
      </div>
    </section>
  )
}
