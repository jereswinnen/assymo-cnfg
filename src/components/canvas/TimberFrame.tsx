'use client';

import { useMemo } from 'react';
import { MeshStandardMaterial, TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three';
import { useConfigStore } from '@/store/useConfigStore';
import { POST_SIZE, BEAM_H, DECK_T, POST_SPACING } from '@/lib/constants';

const BEAM_W = 0.15;
const FASCIA_T = 0.025;
const FASCIA_H = 0.20;

// Height of timber structure above wall top (beams + deck)
export const TIMBER_ROOF_OFFSET = BEAM_H + DECK_T;

interface BoxData {
  pos: [number, number, number];
  size: [number, number, number];
  rot?: [number, number, number];
}

export default function TimberFrame() {
  const config = useConfigStore((s) => s.config);
  const { width, depth, height } = config.dimensions;
  const isFlat = config.roof.type === 'flat';
  const roofPitch = config.dimensions.roofPitch;
  const hasBraces = config.hasCornerBraces;

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

    // --- Posts ---
    const postPositions: [number, number][] = [];
    const postsW = Math.max(2, Math.floor(width / POST_SPACING) + 1);
    const stepW = width / (postsW - 1);
    for (let i = 0; i < postsW; i++) {
      const x = -hw + i * stepW;
      postPositions.push([x, hd]);
      postPositions.push([x, -hd]);
    }
    const postsD = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
    const stepD = depth / (postsD - 1);
    for (let i = 1; i < postsD - 1; i++) {
      const z = -hd + i * stepD;
      postPositions.push([-hw, z]);
      postPositions.push([hw, z]);
    }
    for (const [x, z] of postPositions) {
      boxes.push({ pos: [x, height / 2, z], size: [POST_SIZE, height, POST_SIZE] });
    }

    // --- Top plate beams ---
    const beamY = height + BEAM_H / 2;
    boxes.push({ pos: [0, beamY, hd], size: [width + BEAM_W, BEAM_H, BEAM_W] });
    boxes.push({ pos: [0, beamY, -hd], size: [width + BEAM_W, BEAM_H, BEAM_W] });
    boxes.push({ pos: [-hw, beamY, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });
    boxes.push({ pos: [hw, beamY, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });

    // --- Corner braces (diagonal 45° brackets) ---
    if (hasBraces) {
      const braceSpan = 0.45; // horizontal & vertical reach
      const braceDiag = Math.sqrt(2) * braceSpan;
      const braceThick = 0.10; // thinner than beams for visual clarity
      // [cx, cz, dx, dz] — dx/dz point inward toward building center
      const corners: [number, number, number, number][] = [
        [-hw, hd, 1, -1],
        [hw, hd, -1, -1],
        [-hw, -hd, 1, 1],
        [hw, -hd, -1, 1],
      ];
      for (const [cx, cz, dx, dz] of corners) {
        // Brace top meets beam bottom, brace bottom is braceSpan below
        const midY = height - braceSpan / 2;
        // Brace in X-beam plane (rotated around Z)
        boxes.push({
          pos: [cx + dx * braceSpan / 2, midY, cz],
          size: [braceDiag, braceThick, braceThick],
          rot: [0, 0, dx * Math.PI / 4],
        });
        // Brace in Z-beam plane (rotated around X)
        boxes.push({
          pos: [cx, midY, cz + dz * braceSpan / 2],
          size: [braceThick, braceThick, braceDiag],
          rot: [-dz * Math.PI / 4, 0, 0],
        });
      }
    }

    if (isFlat) {
      // --- Solid roof deck ---
      const deckY = height + BEAM_H + DECK_T / 2;
      boxes.push({ pos: [0, deckY, 0], size: [width + 0.1, DECK_T, depth + 0.1] });

      // --- Fascia ---
      const fasciaY = height + BEAM_H + DECK_T + FASCIA_H / 2;
      const ov = 0.15;
      boxes.push({ pos: [0, fasciaY, hd + ov], size: [width + 2 * ov, FASCIA_H, FASCIA_T] });
      boxes.push({ pos: [0, fasciaY, -hd - ov], size: [width + 2 * ov, FASCIA_H, FASCIA_T] });
      boxes.push({ pos: [-hw - ov, fasciaY, 0], size: [FASCIA_T, FASCIA_H, depth + 2 * ov] });
      boxes.push({ pos: [hw + ov, fasciaY, 0], size: [FASCIA_T, FASCIA_H, depth + 2 * ov] });
    } else {
      // --- Ridge beam ---
      const pitchRad = (roofPitch * Math.PI) / 180;
      const roofRise = Math.tan(pitchRad) * hw;
      boxes.push({ pos: [0, height + roofRise, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });
    }

    return boxes;
  }, [width, depth, height, isFlat, roofPitch, hasBraces]);

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
