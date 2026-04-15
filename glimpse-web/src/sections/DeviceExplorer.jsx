import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
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
  const stageRef = useRef(null)
  const [showCase, setShowCase] = useState(true)
  const [showInternals, setShowInternals] = useState(true)
  const [controlsEnabled, setControlsEnabled] = useState(false)

  const partVisibility = useMemo(() => {
    const visibility = createDefaultExplorerVisibility()
    Object.keys(visibility).forEach((id) => {
      visibility[id] = id === 'case' ? showCase : showInternals
    })
    return visibility
  }, [showCase, showInternals])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const stopStageWheelScroll = (event) => {
      event.preventDefault()
      event.stopPropagation()
      setControlsEnabled(true)
    }

    stage.addEventListener('wheel', stopStageWheelScroll, { passive: false })
    return () => stage.removeEventListener('wheel', stopStageWheelScroll)
  }, [])

  return (
    <section className={styles.section} id="device-explorer" aria-label="Explore the device">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.kicker}>Explore</h2>
          <p className={styles.lede}>
            Twist the model and see the device.
          </p>
        </header>

        <div
          ref={stageRef}
          className={styles.stage}
          role="region"
          aria-label="Interactive 3D model — drag to rotate"
          onPointerEnter={() => setControlsEnabled(true)}
          onPointerDown={() => setControlsEnabled(true)}
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
              <ExplorerScene
                partVisibility={partVisibility}
                caseTone="dark"
                controlsEnabled={controlsEnabled}
              />
            </Suspense>
          </Canvas>
          <p className={styles.canvasHint}>Drag to orbit · scroll to zoom</p>
        </div>

        <div
          className={styles.toolbar}
          onPointerEnter={() => setControlsEnabled(false)}
          onPointerDown={() => setControlsEnabled(false)}
          onFocusCapture={() => setControlsEnabled(false)}
        >
          <div className={styles.toolbarRow}>
            <span className={styles.toolbarLabel} id="explorer-visibility-label">
              Visibility
            </span>
          </div>
          <div
            className={styles.toggles}
            role="group"
            aria-labelledby="explorer-visibility-label"
          >
            <button
              type="button"
              className={`${styles.pill} ${showCase ? styles.pillOn : styles.pillOff}`}
              aria-pressed={showCase}
              onClick={() => setShowCase((prev) => !prev)}
            >
              Case
            </button>
            <button
              type="button"
              className={`${styles.pill} ${showInternals ? styles.pillOn : styles.pillOff}`}
              aria-pressed={showInternals}
              onClick={() => setShowInternals((prev) => !prev)}
            >
              Internals
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
