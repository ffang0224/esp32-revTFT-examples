import * as THREE from 'three'

/**
 * Per-edge margins in **UV space** (0–1) so bitmap content sits inside the visually flat area of the
 * panel and doesn’t crowd rounded corners / bezel in `case-only.glb`.
 *
 * Tuned to keep more of the source image visible (less zoom) while still clearing rounded corners.
 */
export const E_INK_UV_MARGIN_X = 0.055
export const E_INK_UV_MARGIN_Y = 0.06

/**
 * Horizontal flip (matches previous story-texture setup) + centered inset on both axes.
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
  const mx = E_INK_UV_MARGIN_X
  const my = E_INK_UV_MARGIN_Y
  const wx = 1 - 2 * mx
  const wy = 1 - 2 * my

  texture.flipY = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(-wx, wy)
  texture.offset.set(1 - mx, my)
  texture.generateMipmaps = false
  texture.needsUpdate = true
}
