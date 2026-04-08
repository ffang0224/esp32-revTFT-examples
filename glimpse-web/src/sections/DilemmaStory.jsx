import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { scrollState } from '../canvas/scrollState'
import { getRandomStory } from '../data/dilemmas'
import StageDots from '../ui/StageDots'
import { getStoryFrame, getStoryPresence } from './dilemmaStoryState'
import styles from './DilemmaStory.module.css'

gsap.registerPlugin(ScrollTrigger)

const HERO_X = 4
const MODEL_STAGES = [
  { modelX: 4.3, modelZ: 0.0, rotY: Math.PI - 0.04 },
  { modelX: 4.0, modelZ: 0.18, rotY: Math.PI + 0.08 },
  { modelX: 3.65, modelZ: 0.32, rotY: Math.PI + 0.2 },
  { modelX: 3.2, modelZ: 0.12, rotY: Math.PI + 0.14 },
  { modelX: 2.95, modelZ: -0.02, rotY: Math.PI + 0.04 },
]

const STAGE_LABELS = [
  'Typing dilemma',
  'Entering values',
  'Choosing pair',
  'Sending',
  'Revealing prophecy',
]

function lerp(start, end, amount) {
  return start + (end - start) * amount
}

export default function DilemmaStory() {
  const sectionRef = useRef(null)
  const story = useMemo(() => getRandomStory(), [])
  const [dotsVisible, setDotsVisible] = useState(false)
  const [storyProgress, setStoryProgress] = useState(0)
  const [frame, setFrame] = useState(() => getStoryFrame(0, story.dilemma, story.prophecy))
  const presence = getStoryPresence(storyProgress)

  useEffect(() => {
    const section = sectionRef.current

    scrollState.targetX = HERO_X
    scrollState.targetZ = 0
    scrollState.targetRotY = Math.PI
    scrollState.screenImage = null
    scrollState.screenVisible = false

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        setStoryProgress(self.progress)
        const nextFrame = getStoryFrame(self.progress, story.dilemma, story.prophecy)
        setFrame(nextFrame)

        const raw = self.progress * (MODEL_STAGES.length - 1)
        const lower = Math.floor(raw)
        const upper = Math.min(lower + 1, MODEL_STAGES.length - 1)
        const amount = raw - lower

        scrollState.targetX = lerp(MODEL_STAGES[lower].modelX, MODEL_STAGES[upper].modelX, amount)
        scrollState.targetZ = lerp(MODEL_STAGES[lower].modelZ, MODEL_STAGES[upper].modelZ, amount)
        scrollState.targetRotY = lerp(MODEL_STAGES[lower].rotY, MODEL_STAGES[upper].rotY, amount)
        scrollState.screenImage = nextFrame.showProphecy ? story.prophecy.imageUrl : null
        scrollState.screenVisible = nextFrame.showProphecy
      },
      onEnter: () => {
        setDotsVisible(true)
      },
      onLeave: () => {
        setDotsVisible(false)
        scrollState.targetX = 0
        scrollState.targetZ = 0
        scrollState.targetRotY = Math.PI
        scrollState.screenImage = null
        scrollState.screenVisible = true
      },
      onEnterBack: () => {
        setDotsVisible(true)
      },
      onLeaveBack: () => {
        setDotsVisible(false)
        setStoryProgress(0)
        setFrame(getStoryFrame(0, story.dilemma, story.prophecy))
        scrollState.targetX = HERO_X
        scrollState.targetZ = 0
        scrollState.targetRotY = Math.PI
        scrollState.screenImage = null
        scrollState.screenVisible = false
        scrollState.screenIndex = 0
      },
    })

    return () => trigger.kill()
  }, [story])

  return (
    <>
      <section ref={sectionRef} className={styles.section} id="dilemma-story">
        <div
          className={styles.sticky}
          style={{
            opacity: presence.opacity,
            transform: `translateY(${presence.translateY}px)`,
          }}
        >
          <div className={styles.phoneColumn}>
            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{story.dilemma.slug}</span>
              <span className={styles.metaText}>{STAGE_LABELS[frame.activeStage]}</span>
            </div>
            <div className={styles.stepTrack} aria-hidden="true">
              {STAGE_LABELS.map((label, index) => (
                <span
                  key={label}
                  className={`${styles.stepTick} ${index <= frame.activeStage ? styles.stepTickActive : ''}`}
                />
              ))}
            </div>
            <div className={styles.phone}>
              <div className={styles.notch} />
              <div className={styles.screen}>
                <div className={styles.screenTop}>
                  <span>Dilemma</span>
                  <span>{frame.activeStage + 1}/5</span>
                </div>
                <div className={styles.dilemmaBox}>
                  <p className={styles.dilemmaText}>
                    {frame.typedDilemma}
                    {!frame.showProphecy && <span className={styles.cursor} />}
                  </p>
                </div>

                <div className={styles.valuesHeader}>
                  <span>Values</span>
                  <span>{frame.visibleValueCount}/{story.dilemma.values.length}</span>
                </div>

                <div className={styles.values}>
                  {story.dilemma.values.map((value, index) => {
                    const isVisible = index < frame.visibleValueCount
                    const isActive = frame.highlightedValueIndices.includes(index)

                    return (
                      <div
                        key={`${index}-${value}`}
                        className={[
                          styles.valueCard,
                          isVisible ? styles.valueVisible : '',
                          isActive ? styles.valueActive : '',
                          index === frame.visibleValueCount - 1 ? styles.valueLatest : '',
                        ].join(' ')}
                        style={{
                          '--highlight-strength': String(0.35 + frame.highlightStrength * 0.65),
                        }}
                      >
                        <span className={styles.valueIndex}>0{index + 1}</span>
                        <span>{value}</span>
                      </div>
                    )
                  })}
                </div>

                <div className={styles.statusBlock}>
                  <div className={styles.statusLine}>
                    <span className={`${styles.statusDot} ${frame.isSending ? styles.statusSending : ''} ${frame.showProphecy ? styles.statusRevealed : ''}`} />
                  </div>
                  <div className={styles.progressRail}>
                    <div
                      className={styles.progressFill}
                      style={{
                        transform: `scaleX(${frame.showProphecy ? 1 : frame.isSending ? 0.82 : Math.max(0.08, frame.highlightStrength * 0.7)})`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.homeBar} />
            </div>
          </div>

          <div className={styles.deviceColumn}>
            <div className={styles.deviceStage}>
              <div className={styles.deviceFrame} />
            </div>
          </div>
        </div>
      </section>
      <StageDots active={frame.activeStage} count={5} visible={dotsVisible} />
    </>
  )
}
