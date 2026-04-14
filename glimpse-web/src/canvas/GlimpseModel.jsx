import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { scrollState } from './scrollState'
import { STORY_SCREEN_IMAGES } from '../data/dilemmas'

import caseGltfUrl from '../../casefinal.glb?url'

function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Meshes exported under groups named `e_ink_screen`, `e_ink_screen_1`, … in `casefinal.glb`. */
function isCaseEInkScreenMesh(mesh) {
  const name = mesh.name ?? ''
  const parentName = mesh.parent?.name ?? ''
  return /^e_ink_screen/u.test(name) || /^e_ink_screen/u.test(parentName)
}

export default function GlimpseModel() {
  const groupRef = useRef()
  const screenMaterialRef = useRef(null)
  const caseMaterialRef = useRef(null)
  const mountOpacityRef = useRef(0)
  const currentTexRef = useRef(STORY_SCREEN_IMAGES[0])
  const blankColor = useMemo(() => new THREE.Color('#efeee8'), [])

  const { scene } = useGLTF(caseGltfUrl)
  const textures = useTexture(STORY_SCREEN_IMAGES)
  const textureMap = useMemo(
    () => new Map(STORY_SCREEN_IMAGES.map((url, index) => [url, textures[index]])),
    [textures],
  )

  // Configure prophecy textures once
  useEffect(() => {
    textures.forEach((t) => {
      t.flipY = false
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = THREE.RepeatWrapping
      t.repeat.x = -1
      t.offset.x = 1
      t.generateMipmaps = false
      t.needsUpdate = true
    })
  }, [textures])

  // One shared material for all e-ink surface shards in `case.glb`
  useEffect(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: blankColor.clone(),
      transparent: true,
      opacity: 0,
    })
    screenMaterialRef.current = mat
    scene.traverse((node) => {
      if (!node.isMesh || !isCaseEInkScreenMesh(node)) return
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m.dispose?.())
        node.material = mat
      } else {
        node.material?.dispose?.()
        node.material = mat
      }
    })
    return () => {
      screenMaterialRef.current = null
      mat.dispose()
    }
  }, [blankColor, scene])

  // Dark matte material for all non-screen case meshes
  useEffect(() => {
    const caseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#111116'),
      roughness: 0.72,
      metalness: 0.0,
      transparent: true,
      opacity: 0,
    })
    caseMaterialRef.current = caseMat

    scene.traverse((node) => {
      if (!node.isMesh || isCaseEInkScreenMesh(node)) return
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m.dispose?.())
        node.material = caseMat
      } else {
        node.material?.dispose?.()
        node.material = caseMat
      }
    })

    return () => {
      caseMaterialRef.current = null
      caseMat.dispose()
    }
  }, [scene])

  // Refs seeded to match scrollState initial values so there is no lerp
  // animation on first frame (model appears immediately in hero position).
  const mx = useRef(4.3)
  const mz = useRef(0)
  const mroty = useRef(Math.PI - 0.04)
  const flashRef = useRef({ phase: 'idle', elapsed: 0, nextUrl: null })

  useFrame(({ clock, delta, invalidate }) => {
    if (!groupRef.current) return

    // Fade-in on mount (400ms)
    if (mountOpacityRef.current < 1) {
      mountOpacityRef.current = Math.min(1, mountOpacityRef.current + delta / 0.4)
      const opacity = mountOpacityRef.current
      if (caseMaterialRef.current) {
        caseMaterialRef.current.opacity = opacity
      }
      if (screenMaterialRef.current) {
        screenMaterialRef.current.opacity = opacity
      }
      invalidate()
    }

    const t = clock.getElapsedTime()

    mx.current = lerp(mx.current, scrollState.targetX, 0.05)
    mz.current = lerp(mz.current, scrollState.targetZ, 0.05)
    mroty.current = lerp(mroty.current, scrollState.targetRotY, 0.04)

    groupRef.current.position.x = mx.current
    groupRef.current.position.y = Math.sin(t * 0.55) * 0.08
    groupRef.current.position.z = mz.current
    groupRef.current.rotation.y = mroty.current

    const mat = screenMaterialRef.current
    if (!mat) {
      invalidate()
      return
    }

    if (!scrollState.screenVisible) {
      flashRef.current.phase = 'idle'
      flashRef.current.elapsed = 0
      flashRef.current.nextUrl = null
      mat.map = null
      mat.color.copy(blankColor)
      mat.needsUpdate = true
      currentTexRef.current = '__blank__'
      invalidate()
      return
    }

    const safeIdx = Math.max(0, Math.min(scrollState.screenIndex, STORY_SCREEN_IMAGES.length - 1))
    const targetUrl = scrollState.screenImage ?? STORY_SCREEN_IMAGES[safeIdx] ?? STORY_SCREEN_IMAGES[0]

    const flash = flashRef.current

    if (flash.phase === 'idle' && currentTexRef.current !== targetUrl) {
      // Start flash: clear screen to white, record target
      flash.phase = 'flash-in'
      flash.elapsed = 0
      flash.nextUrl = targetUrl
      mat.map = null
      mat.color.set('#ffffff')
      mat.needsUpdate = true
    }

    if (flash.phase === 'flash-in') {
      flash.elapsed += Math.min(delta, 0.1)
      if (flash.elapsed >= 0.08) {
        // Peak white reached — swap texture and finish
        currentTexRef.current = flash.nextUrl
        mat.map = textureMap.get(flash.nextUrl) ?? textures[0]
        mat.color.set('#ffffff')
        mat.needsUpdate = true
        flash.phase = 'idle'
        flash.elapsed = 0
        flash.nextUrl = null
      }
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

useGLTF.preload(caseGltfUrl)
