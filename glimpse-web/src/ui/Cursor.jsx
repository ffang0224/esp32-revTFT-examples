import { useEffect, useRef } from 'react'
import styles from './Cursor.module.css'

export default function Cursor() {
  const dotRef = useRef()
  const ringRef = useRef()

  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let ringX = mouseX
    let ringY = mouseY
    let hovering = false
    let raf

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.left = mouseX + 'px'
      dot.style.top  = mouseY + 'px'
    }

    // Event delegation — works for all elements including dynamically mounted ones
    const onOver = (e) => {
      if (e.target.closest('a, button, [data-cursor-grow]')) {
        hovering = true
        ring.classList.add(styles.ringBig)
        dot.classList.add(styles.dotHidden)
      }
    }
    const onOut = (e) => {
      if (e.target.closest('a, button, [data-cursor-grow]')) {
        hovering = false
        ring.classList.remove(styles.ringBig)
        dot.classList.remove(styles.dotHidden)
      }
    }

    const tick = () => {
      const ease = hovering ? 0.09 : 0.13
      ringX += (mouseX - ringX) * ease
      ringY += (mouseY - ringY) * ease
      ring.style.left = ringX + 'px'
      ring.style.top  = ringY + 'px'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout',  onOut)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout',  onOut)
    }
  }, [])

  return (
    <>
      <div ref={dotRef}  className={styles.dot}  />
      <div ref={ringRef} className={styles.ring} />
    </>
  )
}
