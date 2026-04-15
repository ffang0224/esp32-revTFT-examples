import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF, useTexture, Center } from '@react-three/drei'
import * as THREE from 'three'

import { STORY_SCREEN_IMAGES } from '../data/dilemmas'
import {
  DEVICE_TEXTURE_URLS,
  applyDeviceTextureProfile,
  configureLoadedDeviceTextures,
  getDeviceTextureProfile,
  getForcedMeshTextureProfile,
} from './deviceTextures'
import { configureEInkStoryTexture } from './eInkScreenTexture'
import { getExplorerPartId } from './explorerPartGroups'

import caseGltfUrl from '../../case-only.glb?url'

const TARGET_MODEL_MAX_DIMENSION = 10.4
/** Y rotation after Center + upright pitch — π faces opposite direction from 0. */
const EXPLORER_SCREEN_YAW = Math.PI
/** 180° on X — fixes upside-down orientation for this export in explorer. */
const EXPLORER_UPRIGHT_PITCH = Math.PI

const tmpBox = new THREE.Box3()
const tmpLedBox = new THREE.Box3()

function isExcludedFitNode(node) {
  const name = node.name ?? ''
  const parentName = node.parent?.name ?? ''
  return (
    name.startsWith('asm_carabiner')
    || parentName.startsWith('asm_carabiner')
    || name.startsWith('Carabiner_')
    || parentName.startsWith('Carabiner_')
  )
}

function isCaseEInkScreenMesh(mesh) {
  const name = (mesh.name ?? '').toLowerCase()
  const parentName = (mesh.parent?.name ?? '').toLowerCase()
  return name === 'screen' || parentName === 'screen'
}

function isLedNodeName(name = '') {
  return /^neopixel_(strip|led)/u.test(name)
}

function getLedLightPosition(modelScene) {
  modelScene.updateMatrixWorld(true)

  const ledBounds = new THREE.Box3().makeEmpty()
  modelScene.traverse((node) => {
    if (!node.isMesh || !isLedNodeName(node.name ?? '')) return
    node.geometry?.computeBoundingBox?.()
    if (!node.geometry?.boundingBox) return
    tmpLedBox.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld)
    ledBounds.union(tmpLedBox)
  })

  if (ledBounds.isEmpty()) return null
  return ledBounds.getCenter(new THREE.Vector3())
}

function applyExplorerVisibility(modelScene, partVisibility) {
  modelScene.traverse((node) => {
    if (!node.isMesh && !node.isLight) return
    const id = node.userData.explorerPartId ?? 'other'
    node.visible = partVisibility[id] !== false
  })
}

/**
 * @param {{ partVisibility: Record<string, boolean>, caseTone?: 'light' | 'dark' | 'auto' }} props
 */
export default function GlimpseExplorerModel({ partVisibility, caseTone = 'dark' }) {
  const invalidate = useThree((s) => s.invalidate)

  const { scene } = useGLTF(caseGltfUrl)
  const modelScene = useMemo(() => scene.clone(true), [scene])
  const deviceTextures = useTexture(DEVICE_TEXTURE_URLS)
  const screenTexture = useTexture(STORY_SCREEN_IMAGES[0])

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
    const scale = TARGET_MODEL_MAX_DIMENSION / maxDimension / 2.5

    return {
      offsetX: -center.x * scale,
      offsetY: -box.min.y * scale,
      offsetZ: -center.z * scale,
      scale,
    }
  }, [modelScene])

  useEffect(() => {
    configureEInkStoryTexture(screenTexture)
  }, [screenTexture])

  useEffect(() => {
    configureLoadedDeviceTextures(deviceTextures)

    const screenMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      map: screenTexture,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false,
    })
    screenMat.needsUpdate = true

    const clonedMaterials = []
    const ledLight = new THREE.PointLight('#ffd39a', 4.8, 2.8, 2)
    const ledLightPosition = getLedLightPosition(modelScene)
    if (ledLightPosition) {
      ledLight.position.copy(ledLightPosition)
      ledLight.userData.explorerPartId = 'led'
      modelScene.add(ledLight)
    }

    function cloneMaterial(material, meshName) {
      const cloned = material.clone()
      if (cloned.map) cloned.map.colorSpace = THREE.SRGBColorSpace
      if (cloned.emissiveMap) cloned.emissiveMap.colorSpace = THREE.SRGBColorSpace
      const forcedProfile = getForcedMeshTextureProfile(meshName)
      const profile = forcedProfile ?? getDeviceTextureProfile(material.name)
      if (profile) {
        applyDeviceTextureProfile(cloned, profile, deviceTextures, material.name, caseTone)
      }
      cloned.needsUpdate = true
      clonedMaterials.push(cloned)
      return cloned
    }

    modelScene.traverse((node) => {
      if (!node.isMesh) return

      node.userData.explorerPartId = getExplorerPartId(node.name ?? '')

      if (isCaseEInkScreenMesh(node)) {
        node.renderOrder = 10
        node.material = screenMat
      } else if (Array.isArray(node.material)) {
        node.material = node.material.map((material) => cloneMaterial(material, node.name))
      } else if (node.material) {
        node.material = cloneMaterial(node.material, node.name)
      }
    })

    invalidate()

    return () => {
      if (ledLight.parent) ledLight.parent.remove(ledLight)
      clonedMaterials.forEach((material) => material.dispose())
      screenMat.dispose()
    }
  }, [caseTone, deviceTextures, invalidate, modelScene, screenTexture])

  useEffect(() => {
    applyExplorerVisibility(modelScene, partVisibility)
    invalidate()
  }, [invalidate, modelScene, partVisibility])

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
    <Center onCentered={() => invalidate()}>
      <group rotation={[EXPLORER_UPRIGHT_PITCH, 0, 0]}>
        <group rotation={[0, EXPLORER_SCREEN_YAW, 0]}>{caseContent}</group>
      </group>
    </Center>
  )
}

useGLTF.preload(caseGltfUrl)
