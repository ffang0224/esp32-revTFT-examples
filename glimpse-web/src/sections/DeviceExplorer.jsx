import { Suspense, useCallback, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import GlimpseExplorerModel from '../canvas/GlimpseExplorerModel'
import ModelSkeleton from '../canvas/ModelSkeleton'
import Lights from '../canvas/Lights'
import {
  EXPLORER_PART_TOGGLES,
  createDefaultExplorerVisibility,
} from '../canvas/explorerPartGroups'
import styles from './DeviceExplorer.module.css'

function ExplorerScene({ partVisibility, caseTone }) {
  const invalidate = useThree((s) => s.invalidate)

  return (
    <>
      <Lights />
      <Environment preset="studio" environmentIntensity={0.84} />
      <ContactShadows
        position={[0, -1.72, 0]}
        opacity={0.28}
        scale={14}
        blur={2.2}
        far={7}
        resolution={512}
        color="#1a1a22"
      />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.88}
        enablePan={false}
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.78}
        minDistance={5}
        maxDistance={15}
        target={[0, 0, 0]}
        onChange={() => invalidate()}
      />
      <GlimpseExplorerModel partVisibility={partVisibility} caseTone={caseTone} />
    </>
  )
}

export default function DeviceExplorer() {
  const defaultVis = useMemo(() => createDefaultExplorerVisibility(), [])
  const [partVisibility, setPartVisibility] = useState(defaultVis)
  const [caseTone, setCaseTone] = useState('dark')

  const togglePart = useCallback((id) => {
    setPartVisibility((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const showAll = useCallback(() => {
    setPartVisibility(createDefaultExplorerVisibility())
  }, [])

  const anyHidden = useMemo(
    () => EXPLORER_PART_TOGGLES.some((p) => partVisibility[p.id] === false),
    [partVisibility],
  )

  return (
    <section className={styles.section} id="device-explorer" aria-label="Explore the device">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.kicker}>Explore</h2>
          <p className={styles.lede}>
            Twist the model and peel layers — same hardware as the rest of the page.
          </p>
        </header>

        <div
          className={styles.stage}
          role="region"
          aria-label="Interactive 3D model — drag to rotate"
        >
          <Canvas
            className={styles.canvas}
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 8.2], fov: 32, near: 0.1, far: 1000 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
            onCreated={({ gl, camera }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 0.82
              camera.lookAt(0, 0, 0)
            }}
          >
            <Suspense fallback={<ModelSkeleton />}>
              <ExplorerScene partVisibility={partVisibility} caseTone={caseTone} />
            </Suspense>
          </Canvas>
          <p className={styles.canvasHint}>Drag to orbit · scroll to zoom</p>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            <span className={styles.toolbarLabel} id="explorer-tone-label">
              Case tone
            </span>
          </div>
          <div className={styles.toggles} role="group" aria-labelledby="explorer-tone-label">
            <button
              type="button"
              className={`${styles.pill} ${caseTone === 'light' ? styles.pillOn : styles.pillOff}`}
              aria-pressed={caseTone === 'light'}
              onClick={() => setCaseTone('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={`${styles.pill} ${caseTone === 'dark' ? styles.pillOn : styles.pillOff}`}
              aria-pressed={caseTone === 'dark'}
              onClick={() => setCaseTone('dark')}
            >
              Dark
            </button>
          </div>

          <div className={styles.toolbarRow}>
            <span className={styles.toolbarLabel} id="explorer-parts-label">
              Parts
            </span>
            {anyHidden ? (
              <button type="button" className={styles.textAction} onClick={showAll}>
                Show all
              </button>
            ) : (
              <span className={styles.textSpacer} aria-hidden="true" />
            )}
          </div>
          <div
            className={styles.toggles}
            role="group"
            aria-labelledby="explorer-parts-label"
          >
            {EXPLORER_PART_TOGGLES.map(({ id, label }) => {
              const on = partVisibility[id] !== false
              return (
                <button
                  key={id}
                  type="button"
                  className={`${styles.pill} ${on ? styles.pillOn : styles.pillOff}`}
                  aria-pressed={on}
                  onClick={() => togglePart(id)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
