import { DEMO_IMAGES } from '../demoImages'
import { normalizeDilemma, pickRandomStory } from './dilemmaData'

const dilemmaModules = import.meta.glob('../../dilemmas/dilemma-*.json', { eager: true })
const imageModules = import.meta.glob('../../dilemmas/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' })

function resolveImage(fileName) {
  return imageModules[`../../dilemmas/${fileName}`] ?? DEMO_IMAGES[0]
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

export const STORY_SCREEN_IMAGES = [
  ...new Set([
    ...DEMO_IMAGES,
    ...DILEMMAS.flatMap((dilemma) => dilemma.prophecies.map((prophecy) => prophecy.imageUrl)),
  ]),
]

export function getRandomStory(randomFn = Math.random) {
  return pickRandomStory(DILEMMAS, randomFn)
}
