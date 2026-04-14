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
  const allMaterialsRef = useRef([])
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

  // One consolidated useEffect that assigns all materials in a single scene traversal.
  // screenMaterialRef is kept separate so the flash/texture logic can address it directly.
  // allMaterialsRef holds every material created here for the fade-in loop and disposal.
  useEffect(() => {
    // ── e-ink screen ──────────────────────────────────────────────────────────
    const screenMat = new THREE.MeshBasicMaterial({
      color: blankColor.clone(),
      transparent: true,
      opacity: 0,
    })
    screenMat.userData.targetOpacity = 1.0
    screenMaterialRef.current = screenMat

    // ── frosted case shell ────────────────────────────────────────────────────
    const caseMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#8aadcc'),
      transparent: true,
      opacity: 0,
      roughness: 0.25,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    caseMat.userData.targetOpacity = 0.55

    // ── PCB (board.*) ─────────────────────────────────────────────────────────
    const boardMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a8c42'),
      roughness: 0.55,
      metalness: 0.05,
    })

    // ── NeoPixel LEDs ─────────────────────────────────────────────────────────
    const ledMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2997ff'),
      emissive: new THREE.Color('#2997ff'),
      emissiveIntensity: 3.5,
    })

    // ── NeoPixel strip ────────────────────────────────────────────────────────
    const stripMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1a22'),
      roughness: 0.8,
    })

    // ── Brushed silver (pins, screws, USB-C port, carabiner) ──────────────────
    const metalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c8d0dc'),
      roughness: 0.3,
      metalness: 0.9,
    })

    // ── Battery (matte black) ─────────────────────────────────────────────────
    const batteryMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c1c1c'),
      roughness: 0.9,
    })

    // ── Dark fallback for everything else ─────────────────────────────────────
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#222228'),
      roughness: 0.75,
      envMapIntensity: 3.0,
    })

    // Ordered list: first regex that matches the node name wins.
    const MESH_MATERIALS = [
      [/^(case_upper|case_lower)/u, caseMat],
      [/^board/u,                   boardMat],
      [/^neopixel_LED/u,            ledMat],
      [/^neopixel_strip/u,          stripMat],
      [/^(pin|screws_|typeC_port|Carabiner_Body)/u, metalMat],
      [/^battery/u,                 batteryMat],
    ]

    function getMaterialForMesh(name) {
      for (const [regex, mat] of MESH_MATERIALS) {
        if (regex.test(name)) return mat
      }
      return fallbackMat
    }

    scene.traverse((node) => {
      if (!node.isMesh) return
      const mat = isCaseEInkScreenMesh(node)
        ? screenMat
        : getMaterialForMesh(node.name)
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m.dispose?.())
      } else {
        node.material?.dispose?.()
      }
      node.material = mat
    })

    allMaterialsRef.current = [
      screenMat, caseMat, boardMat, ledMat, stripMat, metalMat, batteryMat, fallbackMat,
    ]

    return () => {
      screenMaterialRef.current = null
      allMaterialsRef.current = []
      for (const mat of [screenMat, caseMat, boardMat, ledMat, stripMat, metalMat, batteryMat, fallbackMat]) {
        mat.dispose()
      }
    }
  }, [blankColor, scene])

  // Refs seeded to match scrollState initial values so there is no lerp
  // animation on first frame (model appears immediately in hero position).
  const mx = useRef(4.3)
  const mz = useRef(0)
  const mroty = useRef(Math.PI - 0.04)
  const flashRef = useRef({ phase: 'idle', elapsed: 0, nextUrl: null })

  useFrame(({ clock, delta, invalidate }) => {
    if (!groupRef.current) return

    // Fade-in on mount (400 ms).
    // Each transparent material fades from 0 to its userData.targetOpacity.
    if (mountOpacityRef.current < 1) {
      mountOpacityRef.current = Math.min(1, mountOpacityRef.current + delta / 0.4)
      const t = mountOpacityRef.current
      for (const mat of allMaterialsRef.current) {
        if (mat.transparent) {
          mat.opacity = t * (mat.userData.targetOpacity ?? 1.0)
        }
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
