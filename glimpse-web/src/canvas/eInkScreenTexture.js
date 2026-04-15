import * as THREE from 'three'

/**
 * Per-edge margins in **UV space** (0–1) so bitmap content sits inside the visually flat area of the
 * panel and doesn’t crowd rounded corners / bezel in `case-only.glb`.
 *
 * Tuned to keep more of the source image visible (less zoom) while still clearing rounded corners.
 */
export const E_INK_UV_MARGIN_X = 0
export const E_INK_UV_MARGIN_Y = 0
export const E_INK_IMAGE_INSET_X = 0.12
export const E_INK_IMAGE_INSET_Y = 0.12

function scheduleDeferredEInkConfigure(texture) {
  if (typeof window === 'undefined') return
  if (texture.userData?.eInkDeferredConfigureScheduled) return

  texture.userData = { ...texture.userData, eInkDeferredConfigureScheduled: true }

  const applyWhenReady = () => {
    const image = texture.image
    if (image?.width && image?.height) {
      texture.userData = { ...texture.userData, eInkDeferredConfigureScheduled: false }
      configureEInkStoryTexture(texture)
      return
    }
    window.requestAnimationFrame(applyWhenReady)
  }

  window.requestAnimationFrame(applyWhenReady)
}

function bakeInsetImage(texture) {
  const image = texture.image
  if (!image?.width || !image?.height) return false
  if (texture.userData?.eInkInsetBaked) return true
  if (typeof document === 'undefined') return false

  const width = image.width
  const height = image.height
  const insetX = Math.round(width * E_INK_IMAGE_INSET_X)
  const insetY = Math.round(height * E_INK_IMAGE_INSET_Y)
  const drawWidth = Math.max(1, width - insetX * 2)
  const drawHeight = Math.max(1, height - insetY * 2)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  ctx.fillStyle = '#f2ece4'
  ctx.fillRect(0, 0, width, height)

  ctx.drawImage(image, insetX, insetY, drawWidth, drawHeight)

  texture.image = canvas
  texture.userData = { ...texture.userData, eInkInsetBaked: true }
  return true
}

/**
 * Centered inset on both axes.
 *
 * Other ways to fix corner clipping (if this isn’t enough):
 * - **Authoring**: add padding inside the source artwork, or edit UVs in Blender so the active
 *   area is inset.
 * - **Separate mask mesh**: bezel in front of a full quad; quad uses rectangular UVs.
 * - **`alphaMap`**: rounded-rect mask so ink falls off before the corners (needs matching UVs).
 *
 * @param {THREE.Texture} texture
 */
export function configureEInkStoryTexture(texture) {
  const baked = bakeInsetImage(texture)

  texture.flipY = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(1, 1)
  texture.offset.set(0, 0)
  texture.generateMipmaps = false
  texture.needsUpdate = true

  if (!baked) scheduleDeferredEInkConfigure(texture)
}
