export default function Lights() {
  return (
    <>
      {/* Reduced ambient — dark case needs shadow depth */}
      <ambientLight color={0xfff5e6} intensity={0.9} />

      {/* Warm key light from front-right — reduced for HDRI balance */}
      <directionalLight color={0xfff0d6} intensity={1.5} position={[4, 8, 6]} />

      {/* Soft warm fill from left */}
      <directionalLight color={0xc4a882} intensity={0.8} position={[-4, 2, -3]} />

      {/* Cool blue rim from behind — reduced for HDRI balance */}
      <directionalLight color={0x2997ff} intensity={1.0} position={[-3, 1, -8]} />

      {/* Subtle warm under-bounce */}
      <directionalLight color={0xffeedd} intensity={0.5} position={[0, -4, -6]} />
    </>
  )
}
