'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Building from './Building';
import Ground from './Ground';
import { useConfigStore } from '@/store/useConfigStore';

export default function BuildingScene() {
  const clearSelection = useConfigStore((s) => s.clearSelection);

  return (
    <Canvas
      shadows
      camera={{ position: [12, 8, 12], fov: 45 }}
      onPointerMissed={() => clearSelection()}
      style={{ background: '#e8ecf1' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      <Building />
      <Ground />

      <OrbitControls
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={5}
        maxDistance={40}
        enablePan={false}
      />
    </Canvas>
  );
}
