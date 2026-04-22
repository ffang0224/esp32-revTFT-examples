import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture, Center } from '@react-three/drei'
import * as THREE from 'three'

import { scrollState } from './scrollState'
import {
  ASSEMBLY_GROUP_COUNT,
  ASSEMBLY_PARTS,
  ASSEMBLY_STAGES,
  getAssemblyPartId,
} from './assemblyConfig'
import { STORY_SCREEN_IMAGES } from '../data/dilemmas'
import {
  DEVICE_TEXTURE_URLS,
  applyDeviceTextureProfile,
  configureLoadedDeviceTextures,
  getDeviceTextureProfile,
  getForcedMeshTextureProfile,
} from './deviceTextures'
import { configureEInkStoryTexture } from './eInkScreenTexture'

import caseGltfUrl from '../../case-only-optimized.glb?url'

const TARGET_MODEL_MAX_DIMENSION = 10.4
/** Y rotation (rad) after centering so the e-ink screen faces the camera (+Z). */
const STATIC_SCREEN_YAW = Math.PI
const DEFAULT_FLOAT_AMPLITUDE = 0.028
const ASSEMBLY_FLOAT_AMPLITUDE = 0.014

const tmpBox = new THREE.Box3()
const tmpVecA = new THREE.Vector3()
const tmpVecC = new THREE.Vector3()
const tmpEuler = new THREE.Euler()
const tmpQuat = new THREE.Quaternion()
const tmpQuatB = new THREE.Quaternion()

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function getStagedProgress(order, progress) {
  const stageSpan = 1 / ASSEMBLY_GROUP_COUNT
  const start = Math.max(0, order * stageSpan * 0.86)
  const end = Math.min(1, start + stageSpan * 1.7)
  return clamp01((progress - start) / Math.max(end - start, 0.0001))
}

function getAssemblyOffset(partId, config, progress, activeFocusIds) {
  const staged = easeInOutCubic(getStagedProgress(config.order, progress))
  const reveal = easeInOutCubic(clamp01(progress * 1.25 + 0.08))
  if (reveal === 0 && staged === 0) return null

  const focusBoost = activeFocusIds.includes(partId) ? 0.08 : 0
  const explode = clamp01(Math.max(reveal * 0.82, staged + focusBoost))

  tmpVecA.set(
    config.offset[0] * explode,
    config.offset[1] * explode,
    config.offset[2] * explode,
  )

  return {
    offset: tmpVecC.copy(tmpVecA).clone(),
    rotation: [
      config.rotation[0] * explode,
      config.rotation[1] * explode,
      config.rotation[2] * explode,
    ],
  }
}

function getAssemblyGroupId(node) {
  let current = node
  while (current) {
    const partId = getAssemblyPartId(current.name ?? '')
    if (partId) return partId
    current = current.parent
  }
  return null
}

function isExcludedFitNode(node) {
  const name = node.name ?? ''
  const parentName = node.parent?.name ?? ''
  return (
    name.startsWith('asm_carabiner') ||
    parentName.startsWith('asm_carabiner') ||
    name.startsWith('Carabiner_') ||
    parentName.startsWith('Carabiner_')
  )
}

/** Meshes exported under groups named `e_ink_screen`, `e_ink_screen.001`, … in the organized GLB. */
function isCaseEInkScreenMesh(mesh) {
  const name = (mesh.name ?? '').toLowerCase()
  const parentName = (mesh.parent?.name ?? '').toLowerCase()
  return name === 'screen' || parentName === 'screen'
}

function applyDirectVibrationOverride(material, meshName) {
  const n = (meshName ?? '').trim().toLowerCase()
  if (!n.startsWith('vibration_')) return false

  material.map = null
  material.bumpMap = null
  material.normalMap = null
  material.roughnessMap = null
  material.metalnessMap = null
  material.alphaMap = null
  material.aoMap = null
  material.emissiveMap = null
  const isDisk = n === 'vibration_disk'
  material.color = isDisk
    ? new THREE.Color('#b8bcc3')
    : new THREE.Color('#000000')
  material.emissive = new THREE.Color('#000000')
  material.emissiveIntensity = 0
  material.metalness = isDisk ? 1 : 0
  material.roughness = isDisk ? 0.34 : 0.5
  material.transparent = false
  material.opacity = 1
  material.depthWrite = true
  material.depthTest = true
  material.side = THREE.FrontSide
  material.envMapIntensity = isDisk ? 0.45 : 0.18
  if ('specularIntensity' in material) material.specularIntensity = isDisk ? 0.5 : 0.2727
  if (material.isMeshPhysicalMaterial) {
    material.transmission = 0
    material.transmissionMap = null
    material.thickness = 0
    material.thicknessMap = null
    material.clearcoat = 0
    material.clearcoatRoughness = isDisk ? 0 : 0.03
    material.ior = isDisk ? 1.5 : 1.45
    material.sheen = 0
  }
  material.needsUpdate = true
  return true
}

/**
 * Hero “internals only”: hide outer shells + clip (everything else stays).
 * `case-only-optimized.glb` uses mesh names `case_upper` / `case_lower` (with suffixes); other exports may use
 * `asm_*` assembly roots from `assemblyConfig`.
 */
const INTERNALS_ONLY_HIDDEN_PARTS = new Set([
  'asm_upper_shell',
  'asm_lower_shell',
  'asm_carabiner',
])

function isHeroExternCasePartNodeName(name = '') {
  const n = name ?? ''
  if (/^case_upper/u.test(n) || /^case_lower/u.test(n)) return true
  const rootId = getAssemblyPartId(n)
  return Boolean(rootId && INTERNALS_ONLY_HIDDEN_PARTS.has(rootId))
}

export default function GlimpseModel({ staticOnly = false, internalsOnly = false }) {
  const invalidate = useThree((s) => s.invalidate)
  const groupRef = useRef()
  const screenMaterialRef = useRef(null)
  const animatedGroupsRef = useRef([])
  const assemblyMaterialsRef = useRef([])
  const mountOpacityRef = useRef(0)
  const currentTexRef = useRef(STORY_SCREEN_IMAGES[0])
  const blankColor = useMemo(() => new THREE.Color('#f2ece4'), [])

  const { scene } = useGLTF(caseGltfUrl)
  const modelScene = useMemo(() => scene.clone(true), [scene])
  const textures = useTexture(STORY_SCREEN_IMAGES)
  const deviceTextures = useTexture(DEVICE_TEXTURE_URLS)
  const textureMap = useMemo(
    () => new Map(STORY_SCREEN_IMAGES.map((url, index) => [url, textures[index]])),
    [textures],
  )

  const modelTransform = useMemo(() => {
    modelScene.updateMatrixWorld(true)

    const box = new THREE.Box3().makeEmpty()
    modelScene.traverse((node) => {
      if (!node.isMesh) return
      if (isExcludedFitNode(node)) return
      node.geometry?.computeBoundingBox?.()
      if (!node.geometry?.boundingBox) return
      tmpBox.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld)
      box.union(tmpBox)
    })

    if (box.isEmpty()) box.setFromObject(modelScene)

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const scale = TARGET_MODEL_MAX_DIMENSION / maxDimension /2.5

    return {
      offsetX: -center.x * scale,
      offsetY: -box.min.y * scale,
      offsetZ: -center.z * scale,
      scale,
    }
  }, [modelScene])

  useEffect(() => {
    textures.forEach((texture) => {
      configureEInkStoryTexture(texture)
    })
  }, [textures])

  useEffect(() => {
    configureLoadedDeviceTextures(deviceTextures)

    const screenMat = new THREE.MeshBasicMaterial({
      color: blankColor.clone(),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false,
    })
    screenMat.userData.targetOpacity = 1.0
    screenMaterialRef.current = screenMat

    const animatedGroups = []
    const assemblyMaterials = []
    const clonedMaterials = []

    function cloneMaterial(material, partId, meshName) {
      const cloned = material.clone()
      if (cloned.map) cloned.map.colorSpace = THREE.SRGBColorSpace
      if (cloned.emissiveMap) cloned.emissiveMap.colorSpace = THREE.SRGBColorSpace
      if (applyDirectVibrationOverride(cloned, meshName)) {
        clonedMaterials.push(cloned)
        assemblyMaterials.push({
          partId,
          material: cloned,
          baseOpacity: cloned.opacity ?? 1,
          baseTransparent: cloned.transparent ?? false,
        })
        return cloned
      }
      const forcedProfile = getForcedMeshTextureProfile(meshName)
      const profile = forcedProfile ?? getDeviceTextureProfile(material.name)
      if (profile) applyDeviceTextureProfile(cloned, profile, deviceTextures, material.name)
      cloned.needsUpdate = true
      clonedMaterials.push(cloned)
      assemblyMaterials.push({
        partId,
        material: cloned,
        baseOpacity: cloned.opacity ?? 1,
        baseTransparent: cloned.transparent ?? false,
      })
      return cloned
    }

    modelScene.traverse((node) => {
      const partId = getAssemblyPartId(node.name ?? '')
      if (partId) {
        animatedGroups.push({
          node,
          partId,
          basePosition: node.position.clone(),
          baseQuaternion: node.quaternion.clone(),
        })
      }

      if (!node.isMesh) return

      const meshPartId = getAssemblyGroupId(node)

      if (isCaseEInkScreenMesh(node)) {
        node.renderOrder = 10
        node.material = screenMat
      } else if (Array.isArray(node.material)) {
        node.material = node.material.map((material) => cloneMaterial(material, meshPartId, node.name))
      } else if (node.material) {
        node.material = cloneMaterial(node.material, meshPartId, node.name)
      }
    })

    animatedGroupsRef.current = animatedGroups
    assemblyMaterialsRef.current = assemblyMaterials

    invalidate()

    return () => {
      screenMaterialRef.current = null
      animatedGroupsRef.current = []
      assemblyMaterialsRef.current = []
      clonedMaterials.forEach((material) => material.dispose())
      screenMat.dispose()
    }
  }, [blankColor, deviceTextures, invalidate, modelScene])

  useEffect(() => {
    modelScene.traverse((node) => {
      if (!isHeroExternCasePartNodeName(node.name ?? '')) return
      node.visible = !internalsOnly
    })
    invalidate()
  }, [internalsOnly, invalidate, modelScene])

  const mx = useRef(scrollState.targetX)
  const my = useRef(scrollState.targetY)
  const mz = useRef(scrollState.targetZ)
  const mscale = useRef(1)
  const mrotx = useRef(0)
  const mroty = useRef(scrollState.targetRotY)
  const mrotz = useRef(0)
  const flashRef = useRef({ phase: 'idle', elapsed: 0, nextUrl: null })

  useFrame(({ clock, delta, invalidate }) => {
    if (!groupRef.current) return

    if (staticOnly) {
      groupRef.current.visible = true
      groupRef.current.position.set(0, 0, 0)
      groupRef.current.scale.setScalar(1)
      groupRef.current.rotation.set(0, 0, 0)

      const screenMaterial = screenMaterialRef.current
      if (screenMaterial) {
        screenMaterial.opacity = 1
        if (screenMaterial.map !== null) {
          screenMaterial.map = null
          screenMaterial.color.copy(blankColor)
          screenMaterial.needsUpdate = true
        }
      }
      return
    }

    if (mountOpacityRef.current < 1) {
      mountOpacityRef.current = Math.min(1, mountOpacityRef.current + delta / 0.4)
      const screenMaterial = screenMaterialRef.current
      if (screenMaterial) {
        screenMaterial.opacity = mountOpacityRef.current * (screenMaterial.userData.targetOpacity ?? 1)
      }
      invalidate()
    }

    const time = clock.getElapsedTime()

    mx.current = lerp(mx.current, scrollState.targetX, 0.05)
    my.current = lerp(my.current, scrollState.targetY, 0.06)
    mz.current = lerp(mz.current, scrollState.targetZ, 0.05)
    mscale.current = lerp(mscale.current, scrollState.assemblyVisible ? 0.94 : 1, 0.08)
    mroty.current = lerp(mroty.current, scrollState.targetRotY, 0.04)
    mrotx.current = lerp(mrotx.current, scrollState.assemblyVisible ? 0.5 : 0, 0.08)
    mrotz.current = lerp(mrotz.current, scrollState.assemblyVisible ? -0.12 : 0, 0.08)

    groupRef.current.visible = scrollState.modelVisible

    const floatAmplitude = scrollState.assemblyVisible
      ? ASSEMBLY_FLOAT_AMPLITUDE
      : scrollState.modelVisible
        ? DEFAULT_FLOAT_AMPLITUDE
        : 0

    groupRef.current.position.x = mx.current
    groupRef.current.position.y = my.current + Math.sin(time * 0.55) * floatAmplitude
    groupRef.current.position.z = mz.current
    groupRef.current.scale.setScalar(mscale.current)
    groupRef.current.rotation.x = mrotx.current
    groupRef.current.rotation.y = mroty.current
    groupRef.current.rotation.z = mrotz.current

    const assemblyProgress = scrollState.assemblyVisible ? scrollState.assemblyProgress : 0
    const activeStage = scrollState.assemblyVisible ? scrollState.assemblyActiveStage : -1
    const activeFocusIds =
      activeStage >= 0 && activeStage < ASSEMBLY_STAGES.length
        ? ASSEMBLY_STAGES[activeStage].focusIds ?? []
        : []

    for (const entry of assemblyMaterialsRef.current) {
      let targetOpacity = entry.baseOpacity

      if (scrollState.assemblyVisible && entry.partId) {
        if (entry.partId === 'asm_upper_shell') {
          targetOpacity = Math.min(entry.baseOpacity, 0.18)
        } else if (entry.partId === 'asm_lower_shell') {
          targetOpacity = Math.min(entry.baseOpacity, 0.12)
        } else if (entry.partId === 'asm_light_ring') {
          targetOpacity = Math.min(entry.baseOpacity, 0.9)
        } else if (entry.partId === 'asm_carabiner') {
          targetOpacity = Math.min(entry.baseOpacity, 0.92)
        }

        if (
          activeFocusIds.length > 0 &&
          !activeFocusIds.includes(entry.partId) &&
          entry.partId !== 'asm_upper_shell' &&
          entry.partId !== 'asm_lower_shell'
        ) {
          targetOpacity *= 0.9
        }
      }

      // eslint-disable-next-line react-hooks/immutability -- Three.js materials are updated imperatively during the render loop.
      entry.material.transparent = targetOpacity < 0.999 || entry.baseTransparent
      entry.material.opacity = lerp(entry.material.opacity, targetOpacity, 0.16)
    }

    for (const item of animatedGroupsRef.current) {
      const config = ASSEMBLY_PARTS[item.partId]
      if (!config) continue

      const effect = getAssemblyOffset(item.partId, config, assemblyProgress, activeFocusIds)
      if (effect) {
        item.node.position.lerp(tmpVecA.copy(item.basePosition).add(effect.offset), 0.12)
        tmpEuler.set(...effect.rotation)
        item.node.quaternion.slerp(
          tmpQuat.copy(item.baseQuaternion).multiply(tmpQuatB.setFromEuler(tmpEuler)),
          0.12,
        )
      } else {
        item.node.position.lerp(item.basePosition, 0.16)
        item.node.quaternion.slerp(item.baseQuaternion, 0.16)
      }
    }

    const screenMaterial = screenMaterialRef.current
    if (!screenMaterial) {
      invalidate()
      return
    }

    if (!scrollState.screenVisible) {
      flashRef.current.phase = 'idle'
      flashRef.current.elapsed = 0
      flashRef.current.nextUrl = null
      screenMaterial.map = null
      screenMaterial.color.copy(blankColor)
      screenMaterial.needsUpdate = true
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
      screenMaterial.map = null
      screenMaterial.color.set('#ffffff')
      screenMaterial.needsUpdate = true
    }

    if (flash.phase === 'flash-in') {
      flash.elapsed += Math.min(delta, 0.1)
      if (flash.elapsed >= 0.08) {
        currentTexRef.current = flash.nextUrl
        screenMaterial.map = textureMap.get(flash.nextUrl) ?? textures[0]
        if (screenMaterial.map) configureEInkStoryTexture(screenMaterial.map)
        screenMaterial.color.set('#ffffff')
        screenMaterial.needsUpdate = true
        flash.phase = 'idle'
        flash.elapsed = 0
        flash.nextUrl = null
      }
    }

    invalidate()
  })

  const caseContent = (
    <group rotation={[0, 0, Math.PI / 2]}>
      <primitive
        object={modelScene}
        scale={[modelTransform.scale, modelTransform.scale, modelTransform.scale]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[modelTransform.offsetX, modelTransform.offsetY, modelTransform.offsetZ]}
      />
    </group>
  )

  return (
    <group ref={groupRef}>
      {staticOnly ? (
        <Center onCentered={() => invalidate()}>
          <group rotation={[0, STATIC_SCREEN_YAW, 0]}>{caseContent}</group>
        </Center>
      ) : (
        caseContent
      )}
    </group>
  )
}

useGLTF.preload(caseGltfUrl)
