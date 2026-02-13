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
          precision highp float;
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec3 vDir;

          void main() {
            vec3 dir = normalize(vDir);
            // Map y from [-1,1] to [0,1] with smooth transition through horizon
            float t = dir.y * 0.5 + 0.5;

            vec3 ground  = vec3(0.78, 0.84, 0.92);
            vec3 horizon = vec3(0.60, 0.78, 0.96);
            vec3 mid     = vec3(0.36, 0.56, 0.85);
            vec3 zenith  = vec3(0.18, 0.34, 0.68);

            // 4-stop gradient: ground(0) -> horizon(0.5) -> mid(0.7) -> zenith(1)
            vec3 sky;
            if (t < 0.5) {
              sky = mix(ground, horizon, smoothstep(0.0, 0.5, t));
            } else if (t < 0.7) {
              sky = mix(horizon, mid, smoothstep(0.5, 0.7, t));
            } else {
              sky = mix(mid, zenith, smoothstep(0.7, 1.0, t));
            }

            // Dither to eliminate 8-bit banding
            float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            sky += (noise - 0.5) / 255.0;

            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  );

  return (
    <mesh scale={[500, 500, 500]} material={material}>
      <sphereGeometry args={[1, 128, 128]} />
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
