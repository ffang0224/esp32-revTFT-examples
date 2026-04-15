import styles from './StageDots.module.css'

export default function StageDots({ active, count = 3, visible, variant }) {
  return (
    <div
      className={`${styles.dots} ${visible ? styles.vis : ''}`}
      data-stage-dots={variant ?? undefined}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${styles.dot} ${i === active ? styles.on : ''}`} />
      ))}
    </div>
  )
}
