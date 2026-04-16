export const FRAME_URLS = Array.from(
  { length: 79 },
  (_, i) => `/frames/f${String(i + 1).padStart(4, '0')}.jpg`
)

export const FRAME_COUNT = FRAME_URLS.length
