import { normalizeDilemma, pickRandomStory } from './dilemmaData'

const dilemmaModules = import.meta.glob('../../dilemmas/dilemma-*.json', { eager: true })
const imageModules = import.meta.glob('../../dilemmas/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' })

/** JSON `image` value: pick any `fortune*.png` in dilemmas/ at load time (see resolveImage). */
const RANDOM_FORTUNE_IMAGE = '__random_fortune__'

const fortuneImageUrls = Object.entries(imageModules)
  .filter(([path]) => /^fortune.*\.png$/iu.test(path.split('/').pop() ?? ''))
  .map(([, url]) => url)

function pickRandomFortuneUrl() {
  if (!fortuneImageUrls.length) {
    throw new Error(
      'No fortune *.png files under glimpse-web/dilemmas/. Add files like "fortune 2.png" or remove __random_fortune__ from JSON.',
    )
  }
  const i = Math.floor(Math.random() * fortuneImageUrls.length)
  return fortuneImageUrls[i]
}

function resolveImage(fileName) {
  if (fileName === RANDOM_FORTUNE_IMAGE) {
    return pickRandomFortuneUrl()
  }
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

/** URLs for e-ink textures: prophecy art plus every fortune image (for __random_fortune__ preload). */
export const STORY_SCREEN_IMAGES = [
  ...new Set([
    ...DILEMMAS.flatMap((dilemma) => dilemma.prophecies.map((prophecy) => prophecy.imageUrl)),
    ...fortuneImageUrls,
  ]),
]

export function getRandomStory(randomFn = Math.random) {
  return pickRandomStory(DILEMMAS, randomFn)
}
