import { useState, useRef, useEffect } from 'react'
import { scrollState } from './canvas/GlimpseModel'
import { DEMO_IMAGES } from './demoImages'
import styles from './DemoOverlay.module.css'

export default function DemoOverlay({ overlayRef, onClose }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'sending' | 'received'
  const [prompt, setPrompt] = useState('')
  const t1 = useRef(null)
  const t2 = useRef(null)

  // Clear any pending timeouts on unmount
  useEffect(() => () => {
    clearTimeout(t1.current)
    clearTimeout(t2.current)
  }, [])

  const handleClose = () => {
    clearTimeout(t1.current)
    clearTimeout(t2.current)
    setStatus('idle')
    setPrompt('')
    onClose()
  }

  const handleSend = () => {
    if (!prompt.trim() || status !== 'idle') return
    setStatus('sending')

    t1.current = setTimeout(() => {
      const idx = Math.floor(Math.random() * DEMO_IMAGES.length)
      scrollState.screenIndex = idx
      setStatus('received')

      t2.current = setTimeout(() => {
        setStatus('idle')
        setPrompt('')
      }, 2000)
    }, 1200)
  }

  const handleKey = e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
    if (e.key === 'Escape') handleClose()
  }

  return (
    <div ref={overlayRef} className={styles.overlay}>
      <button className={styles.close} onClick={handleClose} aria-label="Close demo">×</button>

      <div className={styles.left}>
        <div className={styles.phone}>
          <div className={styles.notch} />
          <div className={styles.phoneScreen}>
            <p className={styles.modeLabel}>Dilemma</p>
            <textarea
              className={styles.input}
              placeholder="Type a thought to send to your Glimpse…"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKey}
              disabled={status !== 'idle'}
              rows={5}
            />
            <button
              className={`${styles.sendBtn} ${styles[status] || ''}`}
              onClick={handleSend}
              disabled={status !== 'idle' || !prompt.trim()}
            >
              {status === 'idle'     && 'Send to Glimpse →'}
              {status === 'sending'  && 'Sending…'}
              {status === 'received' && 'Received on device ✓'}
            </button>
            {status === 'sending' && <div className={styles.progressBar} />}
          </div>
          <div className={styles.homeBar} />
        </div>
        <p className={styles.hint}>⌘ / Ctrl + Enter to send</p>
      </div>

      <div className={styles.right} />
    </div>
  )
}
