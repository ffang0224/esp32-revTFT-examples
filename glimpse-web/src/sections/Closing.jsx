import { useEffect, useMemo, useState } from 'react'
import styles from './Closing.module.css'

const WORDS = ['CAREER', 'LOVE', 'PATH', 'FUTURE']
const TYPE_SPEED_MS = 110
const DELETE_SPEED_MS = 70
const PAUSE_AFTER_TYPE_MS = 1000
const PAUSE_AFTER_DELETE_MS = 220

export default function Closing() {
  const [wordIndex, setWordIndex] = useState(0)
  const [visibleChars, setVisibleChars] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  const activeWord = WORDS[wordIndex]
  const shownWord = useMemo(() => activeWord.slice(0, visibleChars), [activeWord, visibleChars])
  const isFinalWord = activeWord === 'FUTURE'

  useEffect(() => {
    const atWordEnd = visibleChars === activeWord.length
    const atWordStart = visibleChars === 0

    let timeoutMs = isDeleting ? DELETE_SPEED_MS : TYPE_SPEED_MS
    if (!isDeleting && atWordEnd) timeoutMs = PAUSE_AFTER_TYPE_MS
    if (isDeleting && atWordStart) timeoutMs = PAUSE_AFTER_DELETE_MS

    const timer = window.setTimeout(() => {
      if (!isDeleting && atWordEnd) {
        setIsDeleting(true)
        return
      }

      if (isDeleting && atWordStart) {
        setIsDeleting(false)
        setWordIndex((prev) => (prev + 1) % WORDS.length)
        return
      }

      setVisibleChars((prev) => prev + (isDeleting ? -1 : 1))
    }, timeoutMs)

    return () => window.clearTimeout(timer)
  }, [activeWord.length, isDeleting, visibleChars])

  return (
    <section className={styles.section} id="closing" aria-label="Closing">
      <p className={styles.line}>
        GLIMPSE YOUR {' '}
        <span className={isFinalWord ? styles.wordHighlight : styles.word}>{shownWord}</span>
        <span className={styles.cursor} aria-hidden="true">
          |
        </span>
      </p>
    </section>
  )
}
