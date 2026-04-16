import case1 from '../../usecases/case1.png'
import case2 from '../../usecases/case2.png'
import case3 from '../../usecases/case3.png'
import case4 from '../../usecases/case4.png'
import styles from './MakeItYourOwn.module.css'

const USE_CASE_IMAGES = [
  { src: case1, alt: 'Glimpse customization use case 1' },
  { src: case2, alt: 'Glimpse customization use case 2' },
  { src: case3, alt: 'Glimpse customization use case 3' },
  { src: case4, alt: 'Glimpse customization use case 4' },
]

export default function MakeItYourOwn() {
  return (
    <section className={styles.section} id="make-it-your-own" aria-label="Make it your own">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h2 className={styles.title}>Make it your own.</h2>
          <p className={styles.subtitle}>
            Because the way you make decisions is uniquely yours. Glimpse gives you the space to
            make it feel that way - styled to your taste, ready for charms, attachments, and
            decorations that make it your own, inside and out.
          </p>
        </div>
        <ul className={styles.grid}>
          {USE_CASE_IMAGES.map((image, index) => (
            <li key={image.src} className={styles.card}>
              <img
                className={styles.image}
                src={image.src}
                alt={image.alt}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
