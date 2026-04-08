import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeDilemma, pickRandomStory } from './dilemmaData.js'

const rawDilemma = {
  id: 'dilemma-1',
  dilemma: "I'm not sure if I should stay in my safe job or risk everything.",
  values: [
    'I want financial stability and predictable comfort',
    'I fear wasting my potential and living with regret',
    'I want to make my family proud and feel secure',
    'I crave excitement and a life that feels meaningful',
    'I fear failure and public embarrassment',
  ],
  prophecies: [
    {
      id: '1-1',
      prophecy: 'Comfort chosen now will quietly trade away future wonder.',
      values_used: [
        'I want financial stability and predictable comfort',
        'I want to make my family proud and feel secure',
      ],
      parameters: {
        urgency: 4,
        risk: 3,
        emotion: 5,
        time: 6,
        clarity: 8,
        chaos: 2,
      },
      image: '1-1.png',
    },
    {
      id: '1-2',
      prophecy: 'A bold leap will awaken meaning, but test your fear deeply.',
      values_used: [
        'I fear wasting my potential and living with regret',
        'I crave excitement and a life that feels meaningful',
      ],
      parameters: {
        urgency: 8,
        risk: 8,
        emotion: 7,
        time: 7,
        clarity: 7,
        chaos: 6,
      },
      image: '1-2.png',
    },
  ],
}

test('normalizeDilemma resolves image paths and matched value indices', () => {
  const dilemma = normalizeDilemma(rawDilemma, {
    filePath: '../../dilemmas/dilemma-1.json',
    resolveImage: (fileName) => `/assets/${fileName}`,
  })

  assert.equal(dilemma.slug, 'dilemma-1')
  assert.equal(dilemma.prophecies[0].imageUrl, '/assets/1-1.png')
  assert.deepEqual(dilemma.prophecies[0].valueIndices, [0, 2])
  assert.deepEqual(dilemma.prophecies[1].valueIndices, [1, 3])
})

test('pickRandomStory chooses one dilemma and one prophecy deterministically', () => {
  const dilemmaA = normalizeDilemma(rawDilemma, {
    filePath: '../../dilemmas/dilemma-1.json',
    resolveImage: (fileName) => `/assets/${fileName}`,
  })

  const dilemmaB = normalizeDilemma({
    ...rawDilemma,
    id: 'dilemma-2',
    prophecies: [
      {
        ...rawDilemma.prophecies[0],
        id: '2-1',
        image: '2-1.png',
      },
    ],
  }, {
    filePath: '../../dilemmas/dilemma-2.json',
    resolveImage: (fileName) => `/assets/${fileName}`,
  })

  const story = pickRandomStory([dilemmaA, dilemmaB], () => 0.99)

  assert.equal(story.dilemma.id, 'dilemma-2')
  assert.equal(story.prophecy.id, '2-1')
})

test('normalizeDilemma rejects prophecies that reference unknown values', () => {
  assert.throws(() => normalizeDilemma({
    ...rawDilemma,
    prophecies: [
      {
        ...rawDilemma.prophecies[0],
        values_used: ['A value that is not in the dilemma'],
      },
    ],
  }, {
    filePath: '../../dilemmas/dilemma-1.json',
    resolveImage: (fileName) => `/assets/${fileName}`,
  }), /unknown values/i)
})
