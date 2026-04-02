import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DEMO_IMAGES } from '../demoImages'

// Shared mutable state — written by GSAP (DOM), read by R3F (canvas)
export const scrollState = {
  targetX: 0,
  targetZ: 0,
  targetRotY: Math.PI,
  screenIndex: 0,
  dragOffset: 0,
  dragVelocity: 0,
}

function lerp(a, b, t) { return a + (b - a) * t }

export default function GlimpseModel() {
  const groupRef      = useRef()
  const screenMeshRef = useRef(null)
  const currentTexRef = useRef(0)

  const { gl }    = useThree()
  const { scene } = useGLTF('/glimpse_model4.glb')
  const textures  = useTexture(DEMO_IMAGES)

  // Configure textures once
  useEffect(() => {
    textures.forEach(t => {
      t.flipY = false
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = THREE.RepeatWrapping
      t.repeat.x = -1
      t.offset.x = 1
      t.generateMipmaps = false
      t.needsUpdate = true
    })
  }, [textures])

  // Find screen mesh
  useEffect(() => {
    scene.traverse(node => {
      if (!node.isMesh) return
      node.material.transparent = false
      node.material.opacity = 1
      if (node.name.toLowerCase().includes('simulation_e_ink')) {
        screenMeshRef.current = node
        node.material = new THREE.MeshBasicMaterial({ map: textures[0] })
      }
    })
  }, [scene, textures])

  // Drag-to-rotate — listens on the canvas DOM element
  useEffect(() => {
    const canvas = gl.domElement
    let dragging = false
    let lastX = 0

    const onDown = e => {
      dragging = true
      lastX = e.clientX
      scrollState.dragVelocity = 0
      canvas.style.cursor = 'grabbing'
    }

    const onMove = e => {
      if (!dragging) return
      const delta = (e.clientX - lastX) * 0.012
      scrollState.dragOffset   += delta
      scrollState.dragVelocity  = delta
      lastX = e.clientX
    }

    const onUp = () => {
      dragging = false
      canvas.style.cursor = 'grab'
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    canvas.style.cursor = 'grab'

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl])

  const mx    = useRef(0)
  const mz    = useRef(0)
  const mroty = useRef(Math.PI)

  useFrame(({ clock, invalidate }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    mx.current    = lerp(mx.current,    scrollState.targetX,    0.05)
    mz.current    = lerp(mz.current,    scrollState.targetZ,    0.05)
    mroty.current = lerp(mroty.current, scrollState.targetRotY, 0.04)

    scrollState.dragVelocity *= 0.88
    scrollState.dragOffset   += scrollState.dragVelocity
    scrollState.dragOffset   *= 0.985

    groupRef.current.position.x = mx.current
    groupRef.current.position.y = Math.sin(t * 0.55) * 0.08
    groupRef.current.position.z = mz.current
    groupRef.current.rotation.y = mroty.current + scrollState.dragOffset

    if (screenMeshRef.current && currentTexRef.current !== scrollState.screenIndex) {
      currentTexRef.current = scrollState.screenIndex
      screenMeshRef.current.material.map = textures[scrollState.screenIndex]
      screenMeshRef.current.material.needsUpdate = true
    }

    invalidate()
  })

  return (
    <primitive
      ref={groupRef}
      object={scene}
      scale={[50, 50, 50]}
      rotation={[0, Math.PI, 0]}
      position={[0, 0, 0]}
    />
  )
}

useGLTF.preload('/glimpse_model4.glb')
