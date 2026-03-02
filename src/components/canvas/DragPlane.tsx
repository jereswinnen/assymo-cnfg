'use client';

import { useRef } from 'react';
import { Mesh } from 'three';

export default function DragPlane() {
  const ref = useRef<Mesh>(null);
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} visible={false} name="drag-plane">
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}
