import * as THREE from 'three'

/**
 * Per-edge margins in **UV space** (0–1) — reserved for future UV tweaks; story bitmap uses
 * `E_INK_IMAGE_INSET_*` below.
 */
export const E_INK_UV_MARGIN_X = 0
export const E_INK_UV_MARGIN_Y = 0

/**
 * Fraction of texture width/height to leave as paper-colored margin around the drawn image
 * (object-fit: contain inside that inner box, centered).
 *
 * ~6% per edge shrinks the art slightly so it clears the on-mesh bezel without the old 12% crop.
 */
export const E_INK_IMAGE_INSET_X = 0.06
export const E_INK_IMAGE_INSET_Y = 0.06

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
  const innerW = Math.max(1, width * (1 - 2 * E_INK_IMAGE_INSET_X))
  const innerH = Math.max(1, height * (1 - 2 * E_INK_IMAGE_INSET_Y))
  const scale = Math.min(innerW / width, innerH / height)
  const drawW = Math.max(1, Math.round(width * scale))
  const drawH = Math.max(1, Math.round(height * scale))
  const offsetX = Math.round(width * E_INK_IMAGE_INSET_X + (innerW - drawW) / 2)
  const offsetY = Math.round(height * E_INK_IMAGE_INSET_Y + (innerH - drawH) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  ctx.fillStyle = '#f2ece4'
  ctx.fillRect(0, 0, width, height)

  ctx.drawImage(image, offsetX, offsetY, drawW, drawH)

  texture.image = canvas
  texture.userData = { ...texture.userData, eInkInsetBaked: true }
  return true
}

/**
 * Paints the source into a same-size canvas: paper fill, then the image **contained** in the
 * inset inner rect (no stretching if aspect ratios differ).
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
