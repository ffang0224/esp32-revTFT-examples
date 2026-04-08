import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styles from './Specs.module.css'

gsap.registerPlugin(ScrollTrigger)

const SPECS = [
  { label: 'Display',      value: '2.13" e-Ink, 250×122' },
  { label: 'MCU',          value: 'ESP32 Feather' },
  { label: 'Connectivity', value: 'BLE 5.0 + Wi-Fi' },
  { label: 'Power',        value: 'LiPo battery' },
  { label: 'Refresh',      value: '~6s full refresh' },
  { label: 'Case',         value: '3D printed PLA' },
  { label: 'Open source',  value: 'Hardware & firmware' },
]

export default function Specs() {
  const leftRef  = useRef()
  const rightRef = useRef()

  useEffect(() => {
    ;[leftRef.current, rightRef.current].forEach((el, i) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay: i * 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      )
    })
  }, [])

  return (
    <section className={styles.section} id="specs">
      <div className={styles.inner}>
        <div ref={leftRef} className={styles.left}>
          <h2 className={styles.heading}>
            Small device,<br />clear specs.
          </h2>
          <p className={styles.sub}>
            No bloat. No subscription. Open hardware doing exactly what it promises —
            a single quiet image, held in ink.
          </p>
        </div>
        <ul ref={rightRef} className={styles.list}>
          {SPECS.map(({ label, value }) => (
            <li key={label} className={styles.row}>
              <span className={styles.rowLabel}>{label}</span>
              <span className={styles.rowValue}>{value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
