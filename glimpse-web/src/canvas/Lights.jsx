export default function Lights() {
  return (
    <>
      <ambientLight color={0xfff5e6} intensity={2.5} />
      <directionalLight color={0xfff0d6} intensity={3} position={[4, 8, 6]} />
      <directionalLight color={0xc4a882} intensity={1.5} position={[-4, 2, -3]} />
      <directionalLight color={0xffeedd} intensity={1.2} position={[0, -4, -6]} />
    </>
  )
}
