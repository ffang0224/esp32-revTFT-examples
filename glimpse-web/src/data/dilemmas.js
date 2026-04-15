import { normalizeDilemma, pickRandomStory } from './dilemmaData'

const dilemmaModules = import.meta.glob('../../dilemmas/dilemma-*.json', { eager: true })
const imageModules = import.meta.glob('../../dilemmas/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' })

function resolveImage(fileName) {
  const key = `../../dilemmas/${fileName}`
  const resolved = imageModules[key]
  if (!resolved) {
    throw new Error(
      `Missing dilemma image "${fileName}". Add it under glimpse-web/dilemmas/ (referenced from JSON).`,
    )
  }
  return resolved
}

export const DILEMMAS = Object.entries(dilemmaModules)
  .flatMap(([filePath, module]) => {
    try {
      return [normalizeDilemma(module.default, { filePath, resolveImage })]
    } catch (error) {
      console.warn(`Skipping invalid dilemma file ${filePath}: ${error.message}`)
      return []
    }
  })
  .sort((left, right) => left.id.localeCompare(right.id))

/** URLs for e-ink textures: only art shipped under glimpse-web/dilemmas/ (see JSON `image` fields). */
export const STORY_SCREEN_IMAGES = [
  ...new Set(DILEMMAS.flatMap((dilemma) => dilemma.prophecies.map((prophecy) => prophecy.imageUrl))),
]

export function getRandomStory(randomFn = Math.random) {
  return pickRandomStory(DILEMMAS, randomFn)
}
