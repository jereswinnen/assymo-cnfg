'use client';

import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Clouds, Cloud } from '@react-three/drei';
import { Vector3 } from 'three';
import Building from './Building';
import Ground from './Ground';
import { useConfigStore } from '@/store/useConfigStore';
import type { WallId } from '@/types/building';

const WALL_CAMERA_POSITIONS: Record<WallId, [number, number, number]> = {
  front: [0, 6, 15],
  back: [0, 6, -15],
  left: [-15, 6, 0],
  right: [15, 6, 0],
  divider: [8, 6, 10],
  ov_front: [8, 6, 15],
  ov_back: [8, 6, -15],
  ov_right: [15, 6, 0],
};

function CameraAnimator() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const targetPos = useRef<Vector3 | null>(null);
  const animating = useRef(false);

  const wallId = useConfigStore((s) => s.cameraTargetWallId);
  const clearTarget = useConfigStore((s) => s.clearCameraTarget);

  useEffect(() => {
    if (wallId && WALL_CAMERA_POSITIONS[wallId]) {
      targetPos.current = new Vector3(...WALL_CAMERA_POSITIONS[wallId]);
      animating.current = true;
    }
  }, [wallId]);

  // Cancel animation if user starts orbiting manually
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handleStart = () => {
      if (animating.current) {
        animating.current = false;
        targetPos.current = null;
        clearTarget();
      }
    };
    controls.addEventListener('start', handleStart);
    return () => controls.removeEventListener('start', handleStart);
  }, [clearTarget]);

  useFrame(({ camera }) => {
    if (!animating.current || !targetPos.current || !controlsRef.current) return;

    camera.position.lerp(targetPos.current, 0.07);
    controlsRef.current.update();

    if (camera.position.distanceTo(targetPos.current) < 0.1) {
      camera.position.copy(targetPos.current);
      controlsRef.current.update();
      animating.current = false;
      targetPos.current = null;
      clearTarget();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={5}
      maxDistance={40}
      enablePan={true}
    />
  );
}

export default function BuildingScene() {
  const clearSelection = useConfigStore((s) => s.clearSelection);

  return (
    <Canvas
      shadows
      camera={{ position: [12, 8, 12], fov: 45 }}
      onPointerMissed={() => clearSelection()}
      style={{ background: '#87CEEB' }}
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

      <Sky
        distance={450000}
        sunPosition={[100, 60, 100]}
        inclination={0.52}
        azimuth={0.25}
        rayleigh={0.5}
        turbidity={8}
      />
      <Clouds material={undefined}>
        <Cloud position={[-20, 25, -30]} speed={0.2} opacity={0.4} bounds={[30, 5, 8]} segments={20} />
        <Cloud position={[25, 22, -20]} speed={0.15} opacity={0.35} bounds={[25, 4, 6]} segments={16} />
        <Cloud position={[0, 28, -40]} speed={0.1} opacity={0.3} bounds={[35, 6, 10]} segments={18} />
      </Clouds>

      <Building />
      <Ground />

      <CameraAnimator />
    </Canvas>
  );
}
