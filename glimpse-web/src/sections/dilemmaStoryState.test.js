import test from 'node:test'
import assert from 'node:assert/strict'

import { getStoryFrame, getStoryPresence } from './dilemmaStoryState.js'

const dilemma = {
  dilemma: "I'm not sure if I should stay in my safe job or risk everything.",
  values: [
    'I want financial stability and predictable comfort',
    'I fear wasting my potential and living with regret',
    'I want to make my family proud and feel secure',
    'I crave excitement and a life that feels meaningful',
    'I fear failure and public embarrassment',
  ],
}

const prophecy = {
  prophecy: 'Comfort chosen now will quietly trade away future wonder.',
  valueIndices: [0, 2],
}

test('getStoryFrame types the dilemma first', () => {
  const frame = getStoryFrame(0.12, dilemma, prophecy)

  assert.equal(frame.activeStage, 0)
  assert.ok(frame.typedDilemma.length > 0)
  assert.ok(frame.typedDilemma.length < dilemma.dilemma.length)
  assert.equal(frame.visibleValueCount, 0)
  assert.equal(frame.showProphecy, false)
})

test('getStoryFrame reveals values and highlights the prophecy pair before sending', () => {
  const frame = getStoryFrame(0.63, dilemma, prophecy)

  assert.equal(frame.activeStage, 2)
  assert.equal(frame.visibleValueCount, dilemma.values.length)
  assert.deepEqual(frame.highlightedValueIndices, [0, 2])
  assert.equal(frame.isSending, false)
})

test('getStoryFrame enters sending and reveal stages near the end', () => {
  const sending = getStoryFrame(0.8, dilemma, prophecy)
  const reveal = getStoryFrame(0.94, dilemma, prophecy)

  assert.equal(sending.activeStage, 3)
  assert.equal(sending.isSending, true)
  assert.equal(sending.showProphecy, false)

  assert.equal(reveal.activeStage, 4)
  assert.equal(reveal.showProphecy, true)
  assert.equal(reveal.typedDilemma, dilemma.dilemma)
})

test('getStoryPresence fades section in and out around boundaries', () => {
  const entering = getStoryPresence(0.03)
  const steady = getStoryPresence(0.5)
  const leaving = getStoryPresence(0.98)

  assert.ok(entering.opacity < 1)
  assert.ok(entering.translateY > 0)
  assert.equal(steady.opacity, 1)
  assert.equal(steady.translateY, 0)
  assert.ok(leaving.opacity < 1)
  assert.ok(leaving.translateY > 0)
})
