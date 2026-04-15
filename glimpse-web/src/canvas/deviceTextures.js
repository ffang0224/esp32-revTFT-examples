import * as THREE from 'three'

import copperBase from '../../textures/Base Color_Clean copper.jpg?url'
import copperMetal from '../../textures/METALLIC_clean copper.jpg?url'
import copperRough from '../../textures/ROUGHNESS_clean copper.jpg?url'

import brushedBase from '../../textures/BrushedAluminum_BaseColor.jpg?url'
import brushedNormal from '../../textures/BrushedAluminum_Normal.jpg?url'
import brushedMetal from '../../textures/BrushedAluminum_Metalness.jpg?url'
import brushedRough from '../../textures/BrushedAluminum_Roughness.jpg?url'

import grayDiffuse from '../../textures/Diffuse.jpg?url'
import grayNormal from '../../textures/Normal.jpg?url'
import grayRough from '../../textures/Roughness.jpg?url'

import plastic07Diffuse from '../../textures/plastic07_diffuse.jpg?url'

import recycledBase from '../../textures/recycled plastic_BaseColor.jpg?url'
import recycledNormal from '../../textures/recycled plastic_Normal.jpg?url'
import recycledRough from '../../textures/recycled plastic_Roughness.jpg?url'

import untitledBase from '../../textures/Untitled materialeg_BaseColor.jpg?url'
import untitledNormal from '../../textures/Untitled materialeg_Normal.jpg?url'
import untitledRough from '../../textures/Untitled materialeg_Roughness.jpg?url'
import untitledMetal from '../../textures/Untitled materialeg_Metallic.jpg?url'

import mat6 from '../../textures/6-1.png?url'

/** Keys must match `useTexture` object keys in GlimpseModel. */
export const DEVICE_TEXTURE_URLS = {
  copperBase,
  copperMetal,
  copperRough,
  brushedBase,
  brushedNormal,
  brushedMetal,
  brushedRough,
  grayDiffuse,
  grayNormal,
  grayRough,
  plastic07Diffuse,
  recycledBase,
  recycledNormal,
  recycledRough,
  untitledBase,
  untitledNormal,
  untitledRough,
  untitledMetal,
  mat6,
}

const loggedUnmatchedMaterialNames = new Set()
let frostedDetailTexture = null

function createProceduralFrostTexture(size = 256) {
  const data = new Uint8Array(size * size)
  const rand = (x, y) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
    return value - Math.floor(value)
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const base = rand(x * 0.73, y * 0.73)
      const medium = rand(x * 1.91 + 17.0, y * 1.91 + 29.0) * 0.55
      const fine = rand(x * 4.87 + 101.0, y * 4.87 + 53.0) * 0.2
      const value = Math.max(0, Math.min(1, base * 0.45 + medium + fine))
      data[y * size + x] = Math.round(value * 255)
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(28, 28)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

function getProceduralFrostTexture() {
  if (!frostedDetailTexture) frostedDetailTexture = createProceduralFrostTexture()
  return frostedDetailTexture
}

function logUnmatchedMaterialName(materialName) {
  if (!import.meta.env.DEV) return
  const normalized = (materialName ?? '').trim()
  if (!normalized || loggedUnmatchedMaterialNames.has(normalized)) return
  loggedUnmatchedMaterialNames.add(normalized)
  console.debug('[deviceTextures] Unmatched material name, defaulting to recycledPlastic:', normalized)
}

/** Outer shell / case plastics (frosted acrylic look + translucency). */
export function isCaseShellMaterial(materialName) {
  const n = (materialName ?? '').trim()
  return n === 'Frosted Acrylic'
}

/**
 * @param {string} materialName
 * @returns {string | null} profile id for applyDeviceTextureProfile
 */
export function getDeviceTextureProfile(materialName) {
  const n = (materialName ?? '').trim()
  const isNeoPixelLedMaterial = /^neopixel[_\s-]*led(?:\.\d+)?$/i.test(n)
  const isLampMaterial = /^lamp(?:\.\d+)?$/i.test(n)
  if (n === 'Screen') return null
  if (isCaseShellMaterial(n)) return 'frostedAcrylic'
  if (n === 'Black Plastic') return 'blackPlastic'
  if (n === 'White Plastic' || n === 'White Opaque Plastic') return 'whitePlastic'
  if (n === 'Copper') return 'copper'
  if (n === 'AR3DMat PBR Brushed Aluminum') return 'brushedAluminum'
  if (n.includes('Stainless Steel')) return 'brushedAluminum'
  if (n === 'Gray Plastic (Plastic)') return 'grayPlastic'
  if (n === 'Led strip') return 'ledStrip'
  if (isNeoPixelLedMaterial) return 'ledStrip'
  if (isLampMaterial) return 'ledStrip'
  if (n === 'Material') return 'material6'
  if (n === 'Material_4' || n === 'Material_5' || n === 'Material_9') return 'untitledPlastic'
  if (n === 'Solder') return 'grayPlastic'
  if (n === 'Nylon' || n === 'Rubber') return 'recycledPlastic'
  if (n === 'Neon Plexi Orange by LP') return 'recycledPlastic'
  logUnmatchedMaterialName(n)
  return 'recycledPlastic'
}

/**
 * Force specific mesh groups onto known profiles regardless of source material.
 * This is useful for GLB exports where screws share inconsistent material names.
 *
 * @param {string} meshName
 * @returns {string | null}
 */
export function getForcedMeshTextureProfile(meshName) {
  console.log('getForcedMeshTextureProfile', meshName)
  const n = (meshName ?? '').trim().toLowerCase()
  if (!n) return null
  if (n === 'e_ink_screen038' || n === 'e_ink_screen039') return 'blackBoard'
  if (n.startsWith('vibration_')) return 'brushedAluminum'
  if (n === 'typeC_port003' || n === 'typec_port_003') return 'whitePlastic'
  if (/^case_(upper|lower)(?:\.\d+)?$/u.test(n)) return 'frostedAcrylic'
  if (n === 'board171') return 'whitePlastic'
  if (n === 'proto_board' || /^board(?:\.\d+)?$/u.test(n)) return 'blackBoard'
  if (n.startsWith('neopixel_strip')) return 'ledDiffuser'
  if (n.startsWith('neopixel_led')) return 'ledEmitter'
  if (n.includes('screw')) return 'blackPlastic'
  if (n.includes('pin')) return 'brushedAluminum'
  return null
}

function isPbrMaterial(material) {
  return Boolean(
    material
 && (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial),
  )
}

/**
 * Hero case shell: frosted translucent plastic via alpha blending. This is less physically
 * accurate than transmission, but it behaves much more reliably on the thin exported shell.
 */
function applyCaseShellTranslucency(material, materialName, caseTone = 'light') {
  if (!isPbrMaterial(material) || !isCaseShellMaterial(materialName)) return

  material.userData.heroSeeThroughCase = true
  material.side = THREE.DoubleSide

  const n = (materialName ?? '').trim()
  const inferredDark = n === 'Black Plastic' || n === 'Frosted Acrylic'
  const isDarkShell = caseTone === 'dark' ? true : caseTone === 'light' ? false : inferredDark
  if (isDarkShell) {
    /* Dark, neutral “smoked” base — reads black in the mass but still tints what’s behind when translucent */
    material.color = new THREE.Color('#141518')
  } else {
    material.color = new THREE.Color('#d7dbe1')
  }

  if (material.isMeshPhysicalMaterial) {
    material.transmission = 0
    material.thickness = 0
    material.transmissionMap = null
    material.thicknessMap = null
    material.attenuationColor = new THREE.Color('#ffffff')
    material.attenuationDistance = Infinity

    material.metalness = 0
    material.roughness = isDarkShell ? 0.58 : 0.68
    material.specularIntensity = isDarkShell ? 0.42 : 0.44
    material.ior = 1.491
    material.clearcoat = 0
    material.clearcoatRoughness = 0
    material.sheen = 0

    material.transparent = true
    material.opacity = isDarkShell ? 1 : 0.78
    material.depthWrite = false
    material.depthTest = true
    material.alphaMap = null
    material.envMapIntensity = isDarkShell ? 0.68 : 0.38
  } else {
    material.transparent = true
    material.opacity = isDarkShell ? 0.46 : 0.76
    material.depthWrite = false
  }

  material.needsUpdate = true
}

/**
 * @param {THREE.Texture} texture
 * @param {'srgb' | 'linear' | 'data'} colorSpace
 */
function prepTexture(texture, colorSpace) {
  texture.flipY = false
  texture.generateMipmaps = true
  if (colorSpace === 'srgb') texture.colorSpace = THREE.SRGBColorSpace
  else if (colorSpace === 'linear') texture.colorSpace = THREE.LinearSRGBColorSpace
  else texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
}

/** Call once after `useTexture` resolves. */
export function configureLoadedDeviceTextures(textures) {
  prepTexture(textures.copperBase, 'srgb')
  prepTexture(textures.copperMetal, 'data')
  prepTexture(textures.copperRough, 'data')
  prepTexture(textures.brushedBase, 'srgb')
  prepTexture(textures.brushedNormal, 'linear')
  prepTexture(textures.brushedMetal, 'data')
  prepTexture(textures.brushedRough, 'data')
  prepTexture(textures.grayDiffuse, 'srgb')
  prepTexture(textures.grayNormal, 'linear')
  prepTexture(textures.grayRough, 'data')
  prepTexture(textures.plastic07Diffuse, 'srgb')
  prepTexture(textures.recycledBase, 'srgb')
  prepTexture(textures.recycledNormal, 'linear')
  prepTexture(textures.recycledRough, 'data')
  prepTexture(textures.untitledBase, 'srgb')
  prepTexture(textures.untitledNormal, 'linear')
  prepTexture(textures.untitledRough, 'data')
  prepTexture(textures.untitledMetal, 'data')
  prepTexture(textures.mat6, 'srgb')
}

/**
 * @param {THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial} material
 * @param {string} profile from getDeviceTextureProfile
 * @param {Record<string, THREE.Texture>} textures loaded via useTexture(DEVICE_TEXTURE_URLS)
 * @param {string} [sourceMaterialName] original GLTF material name (for case translucency)
 */
export function applyDeviceTextureProfile(material, profile, textures, sourceMaterialName = '', caseTone = 'light') {
  if (!isPbrMaterial(material) || !profile || !textures) return

  switch (profile) {
    case 'copper': {
      material.map = textures.copperBase
      material.metalnessMap = textures.copperMetal
      material.roughnessMap = textures.copperRough
      material.metalness = 1
      material.roughness = 1
      material.normalMap = null
      break
    }
    case 'brushedAluminum': {
      material.map = textures.brushedBase
      material.normalMap = textures.brushedNormal
      material.metalnessMap = textures.brushedMetal
      material.roughnessMap = textures.brushedRough
      material.metalness = 1
      material.roughness = 1
      break
    }
    case 'grayPlastic': {
      material.map = textures.grayDiffuse
      material.normalMap = textures.grayNormal
      material.roughnessMap = textures.grayRough
      material.metalnessMap = null
      material.metalness = 0.15
      material.roughness = 1
      break
    }
    case 'blackBoard': {
      material.map = null
      material.bumpMap = null
      material.normalMap = null
      material.roughnessMap = null
      material.metalnessMap = null
      material.alphaMap = null
      material.aoMap = null
      material.emissiveMap = null
      material.color = new THREE.Color('#000000')
      material.emissive = new THREE.Color('#000000')
      material.emissiveIntensity = 0
      material.metalness = 0
      material.roughness = 1
      material.envMapIntensity = 0.04
      if ('specularIntensity' in material) material.specularIntensity = 0.05
      material.transparent = false
      material.opacity = 1
      material.depthWrite = true
      material.depthTest = true
      material.side = THREE.FrontSide
      if (material.isMeshPhysicalMaterial) {
        material.transmission = 0
        material.transmissionMap = null
        material.thickness = 0
        material.thicknessMap = null
        material.attenuationColor = new THREE.Color('#000000')
        material.attenuationDistance = Infinity
        material.clearcoat = 0
        material.clearcoatRoughness = 0
        material.ior = 1.3
        material.sheen = 0
      }
      break
    }
    case 'blackPlastic': {
      material.map = null
      material.bumpMap = null
      material.normalMap = null
      material.roughnessMap = null
      material.metalnessMap = null
      material.alphaMap = null
      material.aoMap = null
      material.color = new THREE.Color('#000000')
      material.emissive = new THREE.Color('#000000')
      material.emissiveMap = null
      material.emissiveIntensity = 0
      material.metalness = 0
      material.roughness = 0.5
      material.transparent = false
      material.opacity = 1
      material.depthWrite = true
      material.depthTest = true
      material.envMapIntensity = 0.18
      if ('specularIntensity' in material) material.specularIntensity = 0.2727
      if (material.isMeshPhysicalMaterial) {
        material.transmission = 0
        material.transmissionMap = null
        material.thickness = 0
        material.thicknessMap = null
        material.attenuationColor = new THREE.Color('#000000')
        material.attenuationDistance = Infinity
        material.clearcoat = 0
        material.clearcoatRoughness = 0.03
        material.ior = 1.45
        material.sheen = 0
      }
      break
    }
    case 'whitePlastic': {
      material.map = textures.plastic07Diffuse
      material.normalMap = textures.recycledNormal
      material.roughnessMap = textures.recycledRough
      material.metalnessMap = null
      material.metalness = 0.02
      material.roughness = 0.88
      material.envMapIntensity = 0.52
      if ('specularIntensity' in material) material.specularIntensity = 0.38
      break
    }
    case 'frostedAcrylic': {
      material.map = null
      material.bumpMap = getProceduralFrostTexture()
      material.bumpScale = 0.015
      material.normalMap = null
      material.roughnessMap = null
      material.metalnessMap = null
      material.aoMap = null
      material.alphaMap = null
      material.metalness = 0
      material.roughness = 0.52
      break
    }
    case 'recycledPlastic': {
      material.map = textures.recycledBase
      material.normalMap = textures.recycledNormal
      material.roughnessMap = textures.recycledRough
      material.metalnessMap = null
      material.metalness = 0
      material.roughness = 0.9
      material.envMapIntensity = 0.5
      if ('specularIntensity' in material) material.specularIntensity = 0.35
      break
    }
    case 'untitledPlastic': {
      material.map = textures.untitledBase
      material.normalMap = textures.untitledNormal
      material.roughnessMap = textures.untitledRough
      material.metalnessMap = textures.untitledMetal
      material.metalness = 1
      material.roughness = 1
      break
    }
    case 'ledStrip': {
      material.map = null
      material.normalMap = null
      material.metalnessMap = null
      material.roughnessMap = null
      material.alphaMap = null
      material.aoMap = null
      material.color = new THREE.Color('#ffe8bf')
      material.emissive = new THREE.Color('#ffbf69')
      material.emissiveMap = null
      material.emissiveIntensity = 2.1
      material.metalness = 0.04
      material.roughness = 0.3
      material.transparent = false
      material.depthWrite = true
      material.alphaTest = 0
      material.envMapIntensity = 0.35
      break
    }
    case 'ledDiffuser': {
      material.map = null
      material.normalMap = null
      material.metalnessMap = null
      material.roughnessMap = null
      material.alphaMap = null
      material.aoMap = null
      material.color = new THREE.Color('#fff7eb')
      material.emissive = new THREE.Color('#ffd19a')
      material.emissiveMap = null
      material.emissiveIntensity = 0.18
      material.metalness = 0
      material.roughness = 0.22
      material.envMapIntensity = 0.5
      material.transparent = false
      material.depthWrite = true
      material.alphaTest = 0
      if (material.isMeshPhysicalMaterial) {
        material.transmission = 0.18
        material.thickness = 0.08
        material.ior = 1.46
        material.attenuationColor = new THREE.Color('#ffe4bd')
        material.attenuationDistance = 0.45
        material.specularIntensity = 0.8
        material.clearcoat = 0.08
        material.clearcoatRoughness = 0.3
      }
      break
    }
    case 'ledEmitter': {
      material.map = null
      material.normalMap = null
      material.metalnessMap = null
      material.roughnessMap = null
      material.alphaMap = null
      material.aoMap = null
      material.color = new THREE.Color('#ffebc9')
      material.emissive = new THREE.Color('#ffc978')
      material.emissiveMap = null
      material.emissiveIntensity = 1.35
      material.metalness = 0
      material.roughness = 0.1
      material.envMapIntensity = 0.2
      material.transparent = false
      material.depthWrite = true
      material.alphaTest = 0
      if ('toneMapped' in material) material.toneMapped = false
      if (material.isMeshPhysicalMaterial) {
        material.transmission = 0
        material.thickness = 0
        material.specularIntensity = 0.45
        material.clearcoat = 0
      }
      break
    }
    case 'material6': {
      material.map = textures.mat6
      material.normalMap = null
      material.metalnessMap = null
      material.roughnessMap = null
      material.metalness = 0.1
      material.roughness = 0.65
      break
    }
    default:
      return
  }

  material.needsUpdate = true
  if (profile === 'frostedAcrylic') {
    applyCaseShellTranslucency(material, sourceMaterialName, caseTone)
  }
}
