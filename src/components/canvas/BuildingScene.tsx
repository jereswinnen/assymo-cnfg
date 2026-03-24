'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Vector3, BackSide, ShaderMaterial, ACESFilmicToneMapping } from 'three';
import BuildingInstance from './BuildingInstance';
import Ground from './Ground';
import { useConfigStore } from '@/store/useConfigStore';
import type { WallId } from '@/types/building';

const WALL_CAMERA_POSITIONS: Record<WallId, [number, number, number]> = {
  front: [0, 6, 15],
  back: [0, 6, -15],
  left: [-15, 6, 0],
  right: [15, 6, 0],
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
            float t = dir.y * 0.5 + 0.5;

            vec3 ground  = vec3(0.78, 0.84, 0.92);
            vec3 horizon = vec3(0.60, 0.78, 0.96);
            vec3 mid     = vec3(0.36, 0.56, 0.85);
            vec3 zenith  = vec3(0.18, 0.34, 0.68);

            vec3 sky;
            if (t < 0.5) {
              sky = mix(ground, horizon, smoothstep(0.0, 0.5, t));
            } else if (t < 0.7) {
              sky = mix(horizon, mid, smoothstep(0.5, 0.7, t));
            } else {
              sky = mix(mid, zenith, smoothstep(0.7, 1.0, t));
            }

            float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            sky += (noise - 0.5) / 255.0;

            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  );

  useEffect(() => () => { material.dispose(); }, [material]);

  return (
    <mesh scale={[500, 500, 500]} material={material}>
      <sphereGeometry args={[1, 32, 32]} />
    </mesh>
  );
}

/** Configures renderer tone mapping inside the Canvas */
function RendererConfig() {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);
  return null;
}

function CameraAnimator() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const targetPos = useRef<Vector3 | null>(null);
  const animating = useRef(false);

  const wallId = useConfigStore((s) => s.cameraTargetWallId);
  const clearTarget = useConfigStore((s) => s.clearCameraTarget);
  const draggedBuildingId = useConfigStore((s) => s.draggedBuildingId);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const buildings = useConfigStore((s) => s.buildings);

  useEffect(() => {
    if (wallId && WALL_CAMERA_POSITIONS[wallId]) {
      const base = WALL_CAMERA_POSITIONS[wallId];
      // Offset camera by selected building position
      const building = buildings.find(b => b.id === selectedBuildingId);
      const offset = building ? building.position : [0, 0];
      targetPos.current = new Vector3(base[0] + offset[0], base[1], base[2] + offset[1]);
      animating.current = true;
    }
  }, [wallId, selectedBuildingId, buildings]);

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
      target={[0, 0, 0]}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={5}
      maxDistance={60}
      enablePan={true}
      enabled={!draggedBuildingId}
    />
  );
}

export default function BuildingScene() {
  const clearSelection = useConfigStore((s) => s.clearSelection);
  const buildings = useConfigStore((s) => s.buildings);

  return (
    <Canvas
      shadows
      camera={{ position: [15, 8, 12], fov: 45 }}
      onPointerMissed={() => clearSelection()}
      style={{ background: '#6a9fd8' }}
    >
      <RendererConfig />

      {/* HDRI environment for lighting and reflections only */}
      <Environment preset="park" background={false} />

      {/* Sun light with shadows */}
      <directionalLight
        position={[10, 15, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />

      <SkyGradient />

      {buildings.map(b => (
        <BuildingInstance key={b.id} buildingId={b.id} />
      ))}

      <Ground />

      <CameraAnimator />
    </Canvas>
  );
}
