// Initial values match DilemmaStory MODEL_STAGES[0] so the model starts
// exactly where the first interactive section begins — no lerp drift on load.
export const scrollState = {
  targetX: 0,
  targetY: -1.9,
  targetZ: 0.08,
  targetRotY: Math.PI,
  screenIndex: 0,
  screenImage: null,
  screenVisible: false,
  assemblyVisible: false,
  assemblyProgress: 0,
  assemblyActiveStage: 0,
  modelVisible: true,
}
