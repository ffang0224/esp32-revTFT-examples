export const FRAME_COUNT = 80

export const FRAME_URLS = Array.from(
  { length: FRAME_COUNT },
  (_, i) => `/frames/f${String(i + 1).padStart(4, '0')}.jpg`
)
