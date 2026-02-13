'use client';

import { frameMat, glassMat } from './DoorMesh';
import { WIN_W, WIN_H, WIN_DEPTH, WIN_SILL, FRAME_T, FRAME_D } from './wallGeometry';

interface WindowMeshProps {
  x: number;
}

export default function WindowMesh({ x }: WindowMeshProps) {
  const winY = WIN_SILL + WIN_H / 2;

  return (
    <group position={[x, winY, 0]}>
      {/* Glass pane */}
      <mesh material={glassMat}>
        <boxGeometry args={[WIN_W, WIN_H, WIN_DEPTH]} />
      </mesh>
      {/* Top */}
      <mesh position={[0, WIN_H / 2 + FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[WIN_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -WIN_H / 2 - FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[WIN_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
      </mesh>
      {/* Left */}
      <mesh position={[-WIN_W / 2 - FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, WIN_H + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Right */}
      <mesh position={[WIN_W / 2 + FRAME_T / 2, 0, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, WIN_H + FRAME_T * 2, FRAME_D]} />
      </mesh>
      {/* Cross dividers - vertical */}
      <mesh material={frameMat}>
        <boxGeometry args={[FRAME_T * 0.7, WIN_H, FRAME_D]} />
      </mesh>
      {/* Cross dividers - horizontal */}
      <mesh material={frameMat}>
        <boxGeometry args={[WIN_W, FRAME_T * 0.7, FRAME_D]} />
      </mesh>
    </group>
  );
}
