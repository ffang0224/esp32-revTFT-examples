import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scrollState } from '../canvas/scrollState'
import StageDots from '../ui/StageDots'
import styles from './ScrollStory.module.css'

gsap.registerPlugin(ScrollTrigger)

const HERO_X    = 4.0
const STAGES = [
  { modelX: -3.5, modelZ: 0,    rotY: Math.PI,        tex: 0 },
  { modelX: -3.0, modelZ: 0.3,  rotY: Math.PI + 0.25, tex: 1 },
  { modelX: -4.0, modelZ: -0.3, rotY: Math.PI - 0.25, tex: 2 },
]

const LABELS = [
  {
    num: '01',
    title: 'Your Perspective',
    body: 'Your personality shapes everything around you. Glimpse reminds you of that, daily.',
  },
  {
    num: '02',
    title: 'Patient Wisdom',
    body: "Some truths need time. Glimpse holds them quietly until you're ready to hear them.",
  },
  {
    num: '03',
    title: 'Chosen Suffering',
    body: 'A gentle nudge for the days you forget that most pain is optional.',
  },
]

export default function ScrollStory() {
  const sectionRef  = useRef()
  const [activeStage, setActiveStage] = useState(0)
  const [dotsVisible, setDotsVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      pin: true,
      scrub: true,
      onUpdate: self => {
        const progress = self.progress

        // Stage index for labels / texture
        const stageIdx = progress < 0.38 ? 0 : progress < 0.72 ? 1 : 2
        setActiveStage(stageIdx)
        scrollState.screenIndex = STAGES[stageIdx].tex
        scrollState.screenImage = null
        scrollState.screenVisible = true

        // Interpolate model position & rotation through stages
        const raw = progress * (STAGES.length - 1)
        const lo  = Math.floor(raw)
        const hi  = Math.min(lo + 1, STAGES.length - 1)
        const t   = raw - lo

        const stageX    = STAGES[lo].modelX + (STAGES[hi].modelX - STAGES[lo].modelX) * t
        const stageZ    = STAGES[lo].modelZ + (STAGES[hi].modelZ - STAGES[lo].modelZ) * t
        const stageRotY = STAGES[lo].rotY   + (STAGES[hi].rotY   - STAGES[lo].rotY)   * t

        // Entry blend: fast over first 25%
        const entry = Math.min(1, progress * 4)

        scrollState.targetX    = HERO_X + (stageX    - HERO_X) * entry
        scrollState.targetZ    = stageZ * entry
        scrollState.targetRotY = Math.PI + (stageRotY - Math.PI) * entry
      },
      onEnter: () => {
        setDotsVisible(true)
        scrollState.targetX = HERO_X
      },
      onLeave: () => {
        setDotsVisible(false)
        // Return model toward center
        scrollState.targetX    = 0
        scrollState.targetZ    = 0
        scrollState.targetRotY = Math.PI
      },
      onEnterBack: () => setDotsVisible(true),
      onLeaveBack: () => {
        setDotsVisible(false)
        scrollState.targetX    = HERO_X
        scrollState.targetZ    = 0
        scrollState.targetRotY = Math.PI
        scrollState.screenIndex = 0
        scrollState.screenImage = null
        scrollState.screenVisible = true
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <>
      <section ref={sectionRef} className={styles.section} id="scroll-story">
        <div className={styles.labelWrap}>
          {LABELS.map((lbl, i) => (
            <div
              key={i}
              className={`${styles.label} ${i === activeStage ? styles.active : ''}`}
            >
              <div className={styles.num}>{lbl.num}</div>
              <div className={styles.title}>{lbl.title}</div>
              <div className={styles.body}>{lbl.body}</div>
            </div>
          ))}
        </div>
      </section>
      <StageDots active={activeStage} count={3} visible={dotsVisible} variant="scroll" />
    </>
  )
}
