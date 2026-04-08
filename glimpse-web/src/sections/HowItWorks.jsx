import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styles from './HowItWorks.module.css'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
  {
    icon: '📱',
    step: '01',
    title: 'Choose a thought',
    body: 'Open the app, pick a mode — a dilemma to sit with, or a prophecy to carry. Type your prompt.',
  },
  {
    icon: '📡',
    step: '02',
    title: 'Sent over BLE',
    body: 'Your phone sends the prompt wirelessly to Glimpse via Bluetooth Low Energy. No cloud, no account.',
  },
  {
    icon: '🖼',
    step: '03',
    title: 'Rendered in ink',
    body: 'The ESP32 processes the image and writes it to the e-ink display. It stays there, powerlessly, until you change it.',
  },
]

export default function HowItWorks() {
  const sectionRef = useRef()
  const cardRefs   = useRef([])

  useEffect(() => {
    cardRefs.current.forEach((card, i) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: i * 0.15,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      )
    })
  }, [])

  return (
    <section ref={sectionRef} className={styles.section} id="how-it-works">
      <p className={styles.eyebrow}>How it works</p>
      <div className={styles.grid}>
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={styles.card}
            ref={el => (cardRefs.current[i] = el)}
          >
            <div className={styles.cardTop}>
              <span className={styles.stepNum}>{s.step}</span>
              <span className={styles.icon}>{s.icon}</span>
            </div>
            <h3 className={styles.title}>{s.title}</h3>
            <p className={styles.body}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
