import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { scrollState } from '../canvas/scrollState'
import { getRandomStory } from '../data/dilemmas'
import StageDots from '../ui/StageDots'
import { getStoryFrame, getStoryPresence } from './dilemmaStoryState'
import styles from './DilemmaStory.module.css'

gsap.registerPlugin(ScrollTrigger)

const HIDDEN_MODEL_POSE = {
  modelX: 0.6,
  modelY: -9.8,
  modelZ: -0.5,
  rotY: Math.PI + 0.08,
}

const REVEAL_MODEL_POSE = {
  modelX: 0,
  modelY: -0.7,
  modelZ: 0.08,
  rotY: Math.PI,
}

const STAGE_LABELS = [
  'Typing dilemma',
  'Entering values',
  'Choosing pair',
  'Sending',
  'Revealing prophecy',
]

export default function DilemmaStory() {
  const sectionRef = useRef(null)
  const story = useMemo(() => getRandomStory(), [])
  const [dotsVisible, setDotsVisible] = useState(false)
  const [storyProgress, setStoryProgress] = useState(0)
  const [frame, setFrame] = useState(() => getStoryFrame(0, story.dilemma, story.prophecy))
  const presence = getStoryPresence(storyProgress)

  useEffect(() => {
    const section = sectionRef.current

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

        scrollState.targetX = HIDDEN_MODEL_POSE.modelX
        scrollState.targetY = HIDDEN_MODEL_POSE.modelY
        scrollState.targetZ = HIDDEN_MODEL_POSE.modelZ
        scrollState.targetRotY = HIDDEN_MODEL_POSE.rotY
        scrollState.screenImage = null
        scrollState.screenVisible = false
        scrollState.modelVisible = false
      },
      onEnter: () => {
        setDotsVisible(true)
        scrollState.targetX = HIDDEN_MODEL_POSE.modelX
        scrollState.targetY = HIDDEN_MODEL_POSE.modelY
        scrollState.targetZ = HIDDEN_MODEL_POSE.modelZ
        scrollState.targetRotY = HIDDEN_MODEL_POSE.rotY
        scrollState.screenVisible = false
        scrollState.modelVisible = false
      },
      onLeave: () => {
        setDotsVisible(false)
        scrollState.screenImage = null
        scrollState.screenVisible = true
        scrollState.screenIndex = 0
        scrollState.targetX = REVEAL_MODEL_POSE.modelX
        scrollState.targetY = REVEAL_MODEL_POSE.modelY
        scrollState.targetZ = REVEAL_MODEL_POSE.modelZ
        scrollState.targetRotY = REVEAL_MODEL_POSE.rotY
        scrollState.modelVisible = true
      },
      onEnterBack: () => {
        setDotsVisible(true)
      },
      onLeaveBack: () => {
        setDotsVisible(false)
        setStoryProgress(0)
        setFrame(getStoryFrame(0, story.dilemma, story.prophecy))
        scrollState.targetX = 0
        scrollState.targetY = -1.9
        scrollState.targetZ = 0.08
        scrollState.targetRotY = Math.PI
        scrollState.screenImage = null
        scrollState.screenVisible = false
        scrollState.screenIndex = 0
        scrollState.modelVisible = true
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

        </div>
      </section>
      <StageDots active={frame.activeStage} count={5} visible={dotsVisible} variant="dilemma" />
    </>
  )
}
