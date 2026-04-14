// Initial values match DilemmaStory MODEL_STAGES[0] so the model starts
// exactly where the first interactive section begins — no lerp drift on load.
export const scrollState = {
  targetX: 4.3,
  targetZ: 0,
  targetRotY: Math.PI - 0.04,
  screenIndex: 0,
  screenImage: null,
  screenVisible: false,
}
