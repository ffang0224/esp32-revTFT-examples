import { useMemo } from 'react'
import * as THREE from 'three'

export default function ModelSkeleton() {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#111116',
        transparent: true,
        opacity: 0.4,
      }),
    [],
  )

  return (
    <mesh
      position={[4.3, 0, 0]}
      rotation={[0, Math.PI, 0]}
      material={material}
    >
      <boxGeometry args={[3, 5, 0.8]} />
    </mesh>
  )
}
