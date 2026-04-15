import render7 from '../../renders/render7.png'
import render9 from '../../renders/render9.png'
import styles from './Renders.module.css'

export default function Renders() {
  return (
    <section className={styles.section} id="renders" aria-label="Product renders">
      <div className={styles.inner}>
        <h2 className={styles.heading}>Renders</h2>
        <div className={styles.grid}>
          <figure className={styles.cell}>
            <img
              src={render7}
              alt="Glimpse device product render — top view with e-ink display"
              className={styles.img}
              loading="lazy"
            />
          </figure>
          <figure className={styles.cell}>
            <img
              src={render9}
              alt="Glimpse device product render — in hand with warm internal light"
              className={styles.img}
              loading="lazy"
            />
          </figure>
        </div>
      </div>
    </section>
  )
}
