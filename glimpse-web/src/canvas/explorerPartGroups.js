/**
 * Logical groups for `case-only.glb` mesh names — drives explorer visibility toggles.
 * @typedef {{ id: string, label: string }} ExplorerPartToggle
 */

/** @type {ExplorerPartToggle[]} */
export const EXPLORER_PART_TOGGLES = [
  { id: 'case', label: 'Case' },
  { id: 'display', label: 'Display' },
  { id: 'board', label: 'Board' },
  { id: 'led', label: 'LED ring' },
  { id: 'controls', label: 'Buttons' },
  { id: 'power', label: 'Power & port' },
  { id: 'haptics', label: 'Haptics' },
  { id: 'other', label: 'Hardware' },
]

/** @param {string} meshName */
export function getExplorerPartId(meshName) {
  const n = meshName ?? ''

  if (/^case_(upper|lower)/u.test(n) || /^screws_case/u.test(n)) return 'case'
  if (/^e_ink_screen/u.test(n) || n === 'screen') return 'display'
  if (
    /^board/u.test(n)
    || n === 'proto_board'
    || /^pin/u.test(n)
    || /^screws_e_ink/u.test(n)
  ) {
    return 'board'
  }
  if (/^neopixel/u.test(n)) return 'led'
  if (
    /^tactile_switch/u.test(n)
    || n === 'button_cover'
    || /^screws_for_buttons/u.test(n)
  ) {
    return 'controls'
  }
  if (/^battery/u.test(n) || /^typeC_port/u.test(n)) return 'power'
  if (/^vibration/u.test(n)) return 'haptics'

  return 'other'
}

/** @returns {Record<string, boolean>} */
export function createDefaultExplorerVisibility() {
  return Object.fromEntries(EXPLORER_PART_TOGGLES.map((p) => [p.id, true]))
}
