import { Suspense, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import GlimpseExplorerModel from '../canvas/GlimpseExplorerModel'
import ModelSkeleton from '../canvas/ModelSkeleton'
import Lights from '../canvas/Lights'
import { createDefaultExplorerVisibility } from '../canvas/explorerPartGroups'
import styles from './DeviceExplorer.module.css'

function ExplorerScene({ partVisibility, caseTone, controlsEnabled }) {
  const invalidate = useThree((s) => s.invalidate)

  return (
    <>
      <Lights />
      <Environment preset="studio" environmentIntensity={0.52} />
      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
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
  const [showCase, setShowCase] = useState(true)
  const [showInternals, setShowInternals] = useState(true)

  const partVisibility = useMemo(() => {
    const visibility = createDefaultExplorerVisibility()
    Object.keys(visibility).forEach((id) => {
      visibility[id] = id === 'case' ? showCase : showInternals
    })
    return visibility
  }, [showCase, showInternals])

  return (
    <section className={styles.section} id="device-explorer" aria-label="Explore the device">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.title}>Look at it from every angle.</h2>
          <p className={styles.lede}>
            Just like the decisions it helps you make - Glimpse rewards a closer look. Turn it,
            explore it, and find the perspective that feels right.
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
              gl.toneMappingExposure = 0.66
              camera.lookAt(0, 0, 0)
            }}
          >
            <Suspense fallback={<ModelSkeleton />}>
              <ExplorerScene
                partVisibility={partVisibility}
                caseTone="light"
                controlsEnabled
              />
            </Suspense>
          </Canvas>
          <p className={styles.canvasHint}>Drag to orbit · scroll to zoom</p>
          <div
            className={styles.toolbar}
            role="group"
            aria-labelledby="explorer-visibility-label"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className={styles.toolbarRow}>
              <span className={styles.toolbarLabel} id="explorer-visibility-label">
                Visibility
              </span>
            </div>
            <div className={styles.toggles}>
              <button
                type="button"
                className={`${styles.textToggle} ${showCase ? styles.textToggleOn : styles.textToggleOff}`}
                aria-pressed={showCase}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setShowCase((prev) => !prev)
                }}
              >
                Case
              </button>
              <button
                type="button"
                className={`${styles.textToggle} ${showInternals ? styles.textToggleOn : styles.textToggleOff}`}
                aria-pressed={showInternals}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setShowInternals((prev) => !prev)
                }}
              >
                Components
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
