function getSlug(filePath, id) {
  const fileName = filePath.split('/').pop()
  return fileName ? fileName.replace(/\.json$/u, '') : id
}

function toValueIndices(values, valuesUsed) {
  if (!Array.isArray(valuesUsed)) return []

  return valuesUsed
    .map((value) => values.indexOf(value))
    .filter((index) => index >= 0)
}

function validateProphecy(rawDilemma, prophecy, valueIndices) {
  if (!prophecy.image) {
    throw new Error(`Dilemma "${rawDilemma.id}" has a prophecy without an image.`)
  }

  if (!Array.isArray(prophecy.values_used) || prophecy.values_used.length !== valueIndices.length) {
    throw new Error(`Dilemma "${rawDilemma.id}" references unknown values in prophecy "${prophecy.id ?? 'unknown'}".`)
  }
}

function pickByRandom(items, randomFn) {
  if (!items.length) {
    throw new Error('Cannot choose from an empty list.')
  }

  const index = Math.min(items.length - 1, Math.floor(randomFn() * items.length))
  return items[index]
}

export function normalizeDilemma(rawDilemma, { filePath = '', resolveImage = (fileName) => fileName } = {}) {
  const values = Array.isArray(rawDilemma.values) ? rawDilemma.values : []
  const prophecies = Array.isArray(rawDilemma.prophecies) ? rawDilemma.prophecies : []

  if (!prophecies.length) {
    throw new Error(`Dilemma "${rawDilemma.id}" must define at least one prophecy.`)
  }

  return {
    ...rawDilemma,
    slug: getSlug(filePath, rawDilemma.id),
    values,
    prophecies: prophecies.map((prophecy, index) => {
      const valueIndices = toValueIndices(values, prophecy.values_used)
      validateProphecy(rawDilemma, prophecy, valueIndices)

      return {
        ...prophecy,
        id: prophecy.id ?? `${rawDilemma.id}-${index + 1}`,
        imageUrl: resolveImage(prophecy.image),
        valueIndices,
      }
    }),
  }
}

export function pickRandomStory(dilemmas, randomFn = Math.random) {
  const dilemma = pickByRandom(dilemmas, randomFn)
  const prophecy = pickByRandom(dilemma.prophecies, randomFn)

  return { dilemma, prophecy }
}
