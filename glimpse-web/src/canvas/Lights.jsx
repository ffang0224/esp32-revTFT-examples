/**
 * Product / hero lighting — soft studio reference: bright even fill, gentle top‑right key,
 * mild bounce from below. (Used only in Hero.)
 */
export default function Lights() {
  return (
    <>
      <ambientLight color={0xfff9f5} intensity={0.26} />

      <hemisphereLight color={0xffffff} groundColor={0xb8b8c0} intensity={0.24} />

      {/* Primary key — top-right (reference), kept moderate to avoid clipping whites */}
      <directionalLight color={0xfff6ee} intensity={0.52} position={[4.8, 6.2, 3.6]} />

      {/* Front fill — defines dark outer ring + text readability without blowing mid-tones */}
      <directionalLight color={0xffffff} intensity={0.22} position={[0.2, 2.0, 9.0]} />

      <directionalLight color={0xe8eef8} intensity={0.16} position={[-5.5, 3.0, -2.0]} />

      <directionalLight color={0xffeee6} intensity={0.08} position={[0.5, -4.5, 2.0]} />
    </>
  )
}
