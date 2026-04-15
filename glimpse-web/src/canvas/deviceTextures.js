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

import ledBase from '../../textures/Led_strip_BaseColor.png?url'
import ledNormal from '../../textures/Led_strip_Normal.png?url'
import ledMetal from '../../textures/Led_strip_Metallic.png?url'
import ledRough from '../../textures/Led_strip_Roughness.png?url'
import ledAlpha from '../../textures/Led_strip_Alpha.png?url'

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
  ledBase,
  ledNormal,
  ledMetal,
  ledRough,
  ledAlpha,
  mat6,
}

/** Outer shell / case plastics (frosted acrylic look + translucency). */
export function isCaseShellMaterial(materialName) {
  const n = (materialName ?? '').trim()
  return (
    n === 'White Opaque Plastic'
    || n === 'White Plastic'
    || n === 'Black Plastic'
    || n === 'Frosted Acrylic'
  )
}

/**
 * @param {string} materialName
 * @returns {string | null} profile id for applyDeviceTextureProfile
 */
export function getDeviceTextureProfile(materialName) {
  const n = (materialName ?? '').trim()
  if (n === 'Screen') return null
  if (isCaseShellMaterial(n)) return 'frostedAcrylic'
  if (n === 'Copper') return 'copper'
  if (n === 'AR3DMat PBR Brushed Aluminum') return 'brushedAluminum'
  if (n.includes('Stainless Steel')) return 'brushedAluminum'
  if (n === 'Gray Plastic (Plastic)') return 'grayPlastic'
  if (n === 'Led strip') return 'ledStrip'
  if (n === 'Material') return 'material6'
  if (n === 'Material_4' || n === 'Material_5' || n === 'Material_9') return 'untitledPlastic'
  if (n === 'Solder') return 'grayPlastic'
  if (n === 'Lamp') return 'ledStrip'
  if (n === 'Nylon' || n === 'Rubber') return 'recycledPlastic'
  if (n === 'Neon Plexi Orange by LP') return 'recycledPlastic'
  return 'recycledPlastic'
}

function isPbrMaterial(material) {
  return Boolean(
    material
 && (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial),
  )
}

/**
 * Hero case shell: **see-through frosted plastic** via alpha only (`transparent` + `opacity`).
 * We keep **`transmission = 0`** so we don’t hit thin-shell transmissive shader issues (black
 * rings head-on). Internals show through normal alpha blending; `depthWrite: false` helps
 * stacking with geometry behind the wall.
 */
function applyCaseShellTranslucency(material, materialName, caseTone = 'auto') {
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
    material.color = new THREE.Color('#bfbbb4')
  }

  if (material.isMeshPhysicalMaterial) {
    material.transmission = 0
    material.thickness = 0
    material.transmissionMap = null
    material.thicknessMap = null
    material.attenuationColor = new THREE.Color('#ffffff')
    material.attenuationDistance = Infinity

    material.metalness = 0
    /* Black shell: a bit more rough + softer spec than white — smoked frosted, not glossy gray */
    material.roughness = isDarkShell ? 0.58 : 0.5
    material.specularIntensity = isDarkShell ? 0.42 : 0.5
    material.ior = 1.5
    material.clearcoat = 0
    material.clearcoatRoughness = 0
    material.sheen = 0

    material.transparent = true
    /* Light frosted: lower opacity = more see-through. Black “smoked”: darker base + ~0.38–0.48
       opacity reads translucent without turning muddy like mid-gray + alpha. */
    material.opacity = isDarkShell ? 0.44 : 0.52
    material.depthWrite = false
    material.depthTest = true
    material.alphaMap = null
    material.envMapIntensity = isDarkShell ? 0.68 : 0.72
  } else {
    material.transparent = true
    material.opacity = isDarkShell ? 0.46 : 0.55
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
  prepTexture(textures.ledBase, 'srgb')
  prepTexture(textures.ledNormal, 'linear')
  prepTexture(textures.ledMetal, 'data')
  prepTexture(textures.ledRough, 'data')
  prepTexture(textures.ledAlpha, 'data')
  prepTexture(textures.mat6, 'srgb')
}

/**
 * @param {THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial} material
 * @param {string} profile from getDeviceTextureProfile
 * @param {Record<string, THREE.Texture>} textures loaded via useTexture(DEVICE_TEXTURE_URLS)
 * @param {string} [sourceMaterialName] original GLTF material name (for case translucency)
 */
export function applyDeviceTextureProfile(material, profile, textures, sourceMaterialName = '', caseTone = 'auto') {
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
      /* Solid frosted acrylic: texture maps here were adding dark scratches/grunge
         (plastic07 + recycled normal/roughness) that read as black lines under transmission. */
      material.map = null
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
      material.map = textures.ledBase
      material.normalMap = textures.ledNormal
      material.metalnessMap = textures.ledMetal
      material.roughnessMap = textures.ledRough
      material.alphaMap = textures.ledAlpha
      material.metalness = 1
      material.roughness = 1
      material.transparent = true
      material.depthWrite = true
      material.alphaTest = 0.02
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
  applyCaseShellTranslucency(material, sourceMaterialName, caseTone)
}
