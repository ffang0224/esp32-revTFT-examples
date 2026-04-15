import styles from './MakeItYourOwn.module.css'

const PLACEHOLDER_SLOTS = [1, 2, 3, 4]

export default function MakeItYourOwn() {
  return (
    <section className={styles.section} id="make-it-your-own" aria-label="Make it your own">
      <div className={styles.inner}>
        <h2 className={styles.heading}>Make it your own</h2>
        <p className={styles.sub}>
          Room for your photos, skins, and stories — swap these placeholders when you have assets.
        </p>
        <ul className={styles.grid}>
          {PLACEHOLDER_SLOTS.map((slot) => (
            <li key={slot} className={styles.slot}>
              <span className={styles.slotLabel}>Image {slot}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
