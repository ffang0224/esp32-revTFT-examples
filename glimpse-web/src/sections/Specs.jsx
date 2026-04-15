import styles from './Specs.module.css'

export default function Specs() {
  return (
    <section className={styles.section} id="specs" aria-label="Hardware diagram">
      <div className={styles.inner}>
        <figure className={styles.diagram}>
          <img
            src="/glimpse-hardware-list.png"
            alt="Exploded hardware diagram: Glimpse components and assembly"
            className={styles.diagramImg}
            loading="lazy"
          />
        </figure>
      </div>
    </section>
  )
}
