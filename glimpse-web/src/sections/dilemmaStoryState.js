const STAGE_ENDS = {
  typing: 0.24,
  values: 0.52,
  pairing: 0.68,
  sending: 0.82,
  reveal: 1,
}

function clampProgress(progress) {
  return Math.max(0, Math.min(progress, 1))
}

function scale(progress, start, end) {
  const span = end - start
  if (span <= 0) return 1

  return clampProgress((progress - start) / span)
}

export function getStoryPresence(progress) {
  const enter = scale(progress, 0.04, 0.14)
  const exit = 1 - scale(progress, 0.92, 0.99)
  const opacity = Math.max(0, Math.min(1, Math.min(enter, exit)))

  return {
    opacity,
    translateY: (1 - opacity) * 32,
  }
}

export function getStoryFrame(progress, dilemma, prophecy) {
  const safeProgress = clampProgress(progress)
  const typedRatio = scale(safeProgress, 0, STAGE_ENDS.typing)
  const valuesRatio = scale(safeProgress, STAGE_ENDS.typing, STAGE_ENDS.values)
  const highlightRatio = scale(safeProgress, STAGE_ENDS.values, STAGE_ENDS.pairing)
  const revealRatio = scale(safeProgress, STAGE_ENDS.sending, STAGE_ENDS.reveal)

  let activeStage = 4
  if (safeProgress < STAGE_ENDS.typing) activeStage = 0
  else if (safeProgress < STAGE_ENDS.values) activeStage = 1
  else if (safeProgress < STAGE_ENDS.pairing) activeStage = 2
  else if (safeProgress < STAGE_ENDS.sending) activeStage = 3

  return {
    activeStage,
    typedDilemma: dilemma.dilemma.slice(0, Math.ceil(dilemma.dilemma.length * typedRatio)),
    visibleValueCount: Math.min(dilemma.values.length, Math.ceil(valuesRatio * dilemma.values.length)),
    highlightedValueIndices: activeStage >= 2 ? prophecy.valueIndices : [],
    highlightStrength: highlightRatio,
    isSending: activeStage === 3,
    showProphecy: activeStage === 4,
    revealProgress: revealRatio,
  }
}
