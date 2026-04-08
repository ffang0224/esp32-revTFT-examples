import { useEffect, useRef } from 'react'
import styles from './Cursor.module.css'

export default function Cursor() {
  const cursorRef = useRef()

  useEffect(() => {
    const el = cursorRef.current
    const move = e => {
      el.style.left = e.clientX + 'px'
      el.style.top  = e.clientY + 'px'
    }
    const grow = () => el.classList.add(styles.big)
    const shrink = () => el.classList.remove(styles.big)

    document.addEventListener('mousemove', move)
    document.querySelectorAll('a, button').forEach(node => {
      node.addEventListener('mouseenter', grow)
      node.addEventListener('mouseleave', shrink)
    })

    return () => {
      document.removeEventListener('mousemove', move)
    }
  }, [])

  return <div ref={cursorRef} className={styles.cursor} />
}
