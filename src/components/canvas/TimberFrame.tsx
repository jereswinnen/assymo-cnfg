'use client';

import { useMemo } from 'react';
import { MeshStandardMaterial, TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore } from '@/store/useConfigStore';
import { POST_SIZE, BEAM_H, DECK_T, POST_SPACING } from '@/lib/constants';

const BEAM_W = 0.15;
const FASCIA_T = 0.025;
const FASCIA_H = 0.20;

export const TIMBER_ROOF_OFFSET = BEAM_H + DECK_T;

interface BoxData {
  pos: [number, number, number];
  size: [number, number, number];
  rot?: [number, number, number];
}

export default function TimberFrame() {
  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const roof = useConfigStore((s) => s.roof);
  const connections = useConfigStore((s) => s.connections);

  const width = building?.dimensions.width ?? 8;
  const depth = building?.dimensions.depth ?? 4;
  const height = building?.dimensions.height ?? 3;
  const isFlat = roof.type === 'flat';
  const roofPitch = roof.pitch;
  const hasBraces = building?.hasCornerBraces ?? false;

  // Determine which sides are suppressed (this building is buildingA in the connection)
  const suppressedSides = useMemo(() => {
    const sides = new Set<string>();
    for (const c of connections) {
      if (c.buildingAId === buildingId) sides.add(c.sideA);
    }
    return sides;
  }, [connections, buildingId]);

  const timberMat = useMemo(() => {
    const tex = new TextureLoader().load('/textures/wood.jpg');
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.repeat.set(2, 2);
    return new MeshStandardMaterial({ map: tex, color: '#ffffff', metalness: 0.05, roughness: 0.8 });
  }, []);

  const elements = useMemo(() => {
    const hw = width / 2;
    const hd = depth / 2;
    const boxes: BoxData[] = [];

    const suppR = suppressedSides.has('right');
    const suppL = suppressedSides.has('left');
    const suppF = suppressedSides.has('front');
    const suppB = suppressedSides.has('back');

    // Posts along width (front/back edges)
    const postsW = Math.max(2, Math.floor(width / POST_SPACING) + 1);
    const stepW = width / (postsW - 1);
    for (let i = 0; i < postsW; i++) {
      const x = -hw + i * stepW;
      const isLeftEdge = i === 0;
      const isRightEdge = i === postsW - 1;
      if (isLeftEdge && suppL) continue;
      if (isRightEdge && suppR) continue;
      if (!suppB) boxes.push({ pos: [x, height / 2, hd], size: [POST_SIZE, height, POST_SIZE] });
      if (!suppF) boxes.push({ pos: [x, height / 2, -hd], size: [POST_SIZE, height, POST_SIZE] });
    }
    // Intermediate posts along depth (left/right edges)
    const postsD = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
    const stepD = depth / (postsD - 1);
    for (let i = 1; i < postsD - 1; i++) {
      const z = -hd + i * stepD;
      if (!suppL) boxes.push({ pos: [-hw, height / 2, z], size: [POST_SIZE, height, POST_SIZE] });
      if (!suppR) boxes.push({ pos: [hw, height / 2, z], size: [POST_SIZE, height, POST_SIZE] });
    }

    // Top plate beams (skip on suppressed sides)
    const beamY = height + BEAM_H / 2;
    if (!suppB) boxes.push({ pos: [0, beamY, hd], size: [width + BEAM_W, BEAM_H, BEAM_W] });
    if (!suppF) boxes.push({ pos: [0, beamY, -hd], size: [width + BEAM_W, BEAM_H, BEAM_W] });
    if (!suppL) boxes.push({ pos: [-hw, beamY, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });
    if (!suppR) boxes.push({ pos: [hw, beamY, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });

    // Corner braces (skip corners on suppressed sides)
    if (hasBraces) {
      const braceSpan = 0.45;
      const braceDiag = Math.sqrt(2) * braceSpan;
      const braceThick = 0.10;
      const corners: [number, number, number, number, string, string][] = [
        [-hw, hd, 1, -1, 'left', 'back'],
        [hw, hd, -1, -1, 'right', 'back'],
        [-hw, -hd, 1, 1, 'left', 'front'],
        [hw, -hd, -1, 1, 'right', 'front'],
      ];
      for (const [cx, cz, dx, dz, sideX, sideZ] of corners) {
        if (suppressedSides.has(sideX) || suppressedSides.has(sideZ)) continue;
        const midY = height - braceSpan / 2;
        boxes.push({
          pos: [cx + dx * braceSpan / 2, midY, cz],
          size: [braceDiag, braceThick, braceThick],
          rot: [0, 0, dx * Math.PI / 4],
        });
        boxes.push({
          pos: [cx, midY, cz + dz * braceSpan / 2],
          size: [braceThick, braceThick, braceDiag],
          rot: [-dz * Math.PI / 4, 0, 0],
        });
      }
    }

    if (isFlat) {
      const deckY = height + BEAM_H + DECK_T / 2;
      boxes.push({ pos: [0, deckY, 0], size: [width + 0.1, DECK_T, depth + 0.1] });

      const fasciaY = height + BEAM_H + DECK_T + FASCIA_H / 2;
      const ov = 0.15;
      if (!suppB) boxes.push({ pos: [0, fasciaY, hd + ov], size: [width + 2 * ov, FASCIA_H, FASCIA_T] });
      if (!suppF) boxes.push({ pos: [0, fasciaY, -hd - ov], size: [width + 2 * ov, FASCIA_H, FASCIA_T] });
      if (!suppL) boxes.push({ pos: [-hw - ov, fasciaY, 0], size: [FASCIA_T, FASCIA_H, depth + 2 * ov] });
      if (!suppR) boxes.push({ pos: [hw + ov, fasciaY, 0], size: [FASCIA_T, FASCIA_H, depth + 2 * ov] });
    } else {
      const pitchRad = (roofPitch * Math.PI) / 180;
      const roofRise = Math.tan(pitchRad) * hw;
      boxes.push({ pos: [0, height + roofRise, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });
    }

    return boxes;
  }, [width, depth, height, isFlat, roofPitch, hasBraces, suppressedSides]);

  return (
    <group>
      {elements.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={b.rot ?? [0, 0, 0]} material={timberMat}>
          <boxGeometry args={b.size} />
        </mesh>
      ))}
    </group>
  );
}
