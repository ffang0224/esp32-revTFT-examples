export const FRAME_URLS = Array.from(
  { length: 80 },
  (_, i) => `/frames-alpha/f${String(i + 1).padStart(4, '0')}.webp`
)

export const FRAME_COUNT = FRAME_URLS.length
