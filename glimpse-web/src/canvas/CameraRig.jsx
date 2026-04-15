import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import { scrollState } from './scrollState'

function lerp(a, b, t) {
  return a + (b - a) * t
}

export default function CameraRig() {
  const { camera } = useThree()
  const posX = useRef(camera.position.x)
  const posY = useRef(camera.position.y)
  const posZ = useRef(camera.position.z)
  const lookX = useRef(0)
  const lookY = useRef(0.55)
  const lookZ = useRef(0)
  const fov = useRef(camera.fov)

  useFrame(() => {
    const target = scrollState.assemblyVisible
      ? {
          x: 0.08,
          y: 1.16,
          z: 9.2,
          fov: 26,
          lookX: 0.12,
          lookY: 0.58,
          lookZ: 0,
        }
      : {
          x: 0,
          y: 1.05,
          z: 8.2,
          fov: 32,
          lookX: 0,
          lookY: 0.55,
          lookZ: 0,
        }

    posX.current = lerp(posX.current, target.x, 0.06)
    posY.current = lerp(posY.current, target.y, 0.06)
    posZ.current = lerp(posZ.current, target.z, 0.06)
    fov.current = lerp(fov.current, target.fov, 0.08)
    lookX.current = lerp(lookX.current, target.lookX, 0.08)
    lookY.current = lerp(lookY.current, target.lookY, 0.08)
    lookZ.current = lerp(lookZ.current, target.lookZ, 0.08)

    camera.position.set(posX.current, posY.current, posZ.current)
    // eslint-disable-next-line react-hooks/immutability -- Three.js camera state is updated imperatively during the render loop.
    camera.fov = fov.current
    camera.lookAt(lookX.current, lookY.current, lookZ.current)
    camera.updateProjectionMatrix()
  })

  return null
}
