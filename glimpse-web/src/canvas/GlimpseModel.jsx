import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { scrollState } from './scrollState'
import { STORY_SCREEN_IMAGES } from '../data/dilemmas'

function lerp(a, b, t) { return a + (b - a) * t }

export default function GlimpseModel() {
  const groupRef      = useRef()
  const screenMeshRef = useRef(null)
  const currentTexRef = useRef(STORY_SCREEN_IMAGES[0])
  const blankColor = useMemo(() => new THREE.Color('#efeee8'), [])

  const { scene } = useGLTF('/glimpse_model4.glb')
  const textures  = useTexture(STORY_SCREEN_IMAGES)
  const textureMap = useMemo(
    () => new Map(STORY_SCREEN_IMAGES.map((url, index) => [url, textures[index]])),
    [textures]
  )

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
        node.material = new THREE.MeshBasicMaterial({ color: blankColor })
      }
    })
  }, [blankColor, scene, textures])

  const mx    = useRef(0)
  const mz    = useRef(0)
  const mroty = useRef(Math.PI)

  useFrame(({ clock, invalidate }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    mx.current    = lerp(mx.current,    scrollState.targetX,    0.05)
    mz.current    = lerp(mz.current,    scrollState.targetZ,    0.05)
    mroty.current = lerp(mroty.current, scrollState.targetRotY, 0.04)

    groupRef.current.position.x = mx.current
    groupRef.current.position.y = Math.sin(t * 0.55) * 0.08
    groupRef.current.position.z = mz.current
    groupRef.current.rotation.y = mroty.current

    if (screenMeshRef.current && !scrollState.screenVisible) {
      screenMeshRef.current.material.map = null
      screenMeshRef.current.material.color = blankColor
      screenMeshRef.current.material.needsUpdate = true
      currentTexRef.current = '__blank__'
      invalidate()
      return
    }

    const safeIdx = Math.max(0, Math.min(scrollState.screenIndex, STORY_SCREEN_IMAGES.length - 1))
    const targetUrl = scrollState.screenImage ?? STORY_SCREEN_IMAGES[safeIdx] ?? STORY_SCREEN_IMAGES[0]

    if (screenMeshRef.current && currentTexRef.current !== targetUrl) {
      currentTexRef.current = targetUrl
      screenMeshRef.current.material.map = textureMap.get(targetUrl) ?? textures[0]
      screenMeshRef.current.material.color = new THREE.Color('#ffffff')
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
