'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3, BackSide, ShaderMaterial } from 'three';
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

function SkyGradient() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vDir;

          // Dithering to eliminate color banding
          float dither(vec2 co) {
            return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453) / 255.0;
          }

          void main() {
            vec3 dir = normalize(vDir);
            float h = dir.y;
            vec3 zenith  = vec3(0.22, 0.42, 0.75);
            vec3 horizon = vec3(0.55, 0.75, 0.95);
            vec3 ground  = vec3(0.82, 0.86, 0.90);
            vec3 sky = h > 0.0
              ? mix(horizon, zenith, pow(h, 0.4))
              : mix(horizon, ground, pow(-h, 0.3));
            sky += dither(gl_FragCoord.xy);
            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  );

  return (
    <mesh scale={[500, 500, 500]} material={material}>
      <sphereGeometry args={[1, 128, 64]} />
    </mesh>
  );
}

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
      style={{ background: '#6a9fd8' }}
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

      <SkyGradient />

      <Building />
      <Ground />

      <CameraAnimator />
    </Canvas>
  );
}
