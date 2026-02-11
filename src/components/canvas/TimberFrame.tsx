'use client';

import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { useConfigStore } from '@/store/useConfigStore';

const TIMBER_COLOR = '#C4A060';
const POST_SIZE = 0.15;
const BEAM_W = 0.15;
const BEAM_H = 0.20;
const BRACE_SIZE = 0.08;
const BRACE_REACH = 0.5;
const BRACE_LEN = BRACE_REACH * Math.SQRT2;
const RAFTER_W = 0.07;
const RAFTER_H = 0.15;
const RAFTER_SPACING = 0.6;
const DECK_T = 0.04; // roof deck/sheathing thickness
const FASCIA_T = 0.025;
const FASCIA_H = 0.20;
const POST_SPACING = 3;

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

  const timberMat = useMemo(
    () => new MeshStandardMaterial({ color: TIMBER_COLOR, metalness: 0.05, roughness: 0.8 }),
    [],
  );

  const elements = useMemo(() => {
    const hw = width / 2;
    const hd = depth / 2;
    const posts: BoxData[] = [];
    const beams: BoxData[] = [];
    const braces: BoxData[] = [];
    const rafters: BoxData[] = [];
    const fascia: BoxData[] = [];

    // --- Posts ---
    // Generate unique post positions as [x, z]
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
      posts.push({ pos: [x, height / 2, z], size: [POST_SIZE, height, POST_SIZE] });
    }

    // --- Top plate beams ---
    beams.push({ pos: [0, height + BEAM_H / 2, hd], size: [width + BEAM_W, BEAM_H, BEAM_W] });
    beams.push({ pos: [0, height + BEAM_H / 2, -hd], size: [width + BEAM_W, BEAM_H, BEAM_W] });
    beams.push({ pos: [-hw, height + BEAM_H / 2, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });
    beams.push({ pos: [hw, height + BEAM_H / 2, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });

    // --- Corner braces ---
    const corners = [
      { x: -hw, z: hd, dx: 1, dz: -1 },
      { x: hw, z: hd, dx: -1, dz: -1 },
      { x: -hw, z: -hd, dx: 1, dz: 1 },
      { x: hw, z: -hd, dx: -1, dz: 1 },
    ];
    for (const { x, z, dx, dz } of corners) {
      const half = BRACE_REACH / 2;
      const cy = height - half;
      // Brace along X beam
      braces.push({
        pos: [x + dx * half, cy, z],
        size: [BRACE_LEN, BRACE_SIZE, BRACE_SIZE],
        rot: [0, 0, dx * Math.PI / 4],
      });
      // Brace along Z beam
      braces.push({
        pos: [x, cy, z + dz * half],
        size: [BRACE_SIZE, BRACE_LEN, BRACE_SIZE],
        rot: [dz * Math.PI / 4, 0, 0],
      });
    }

    if (isFlat) {
      // --- Flat roof rafters ---
      const rafterY = height + BEAM_H + RAFTER_H / 2;
      const rafterCount = Math.max(2, Math.floor(depth / RAFTER_SPACING) + 1);
      const rStep = depth / (rafterCount - 1);
      for (let i = 0; i < rafterCount; i++) {
        const z = -hd + i * rStep;
        rafters.push({ pos: [0, rafterY, z], size: [width + 0.1, RAFTER_H, RAFTER_W] });
      }

      // --- Solid roof deck (sheathing) ---
      const deckY = height + BEAM_H + RAFTER_H + DECK_T / 2;
      rafters.push({ pos: [0, deckY, 0], size: [width + 0.1, DECK_T, depth + 0.1] });

      // --- Flat roof fascia ---
      const fasciaY = height + BEAM_H + RAFTER_H + DECK_T + FASCIA_H / 2;
      const overhang = 0.15;
      fascia.push({ pos: [0, fasciaY, hd + overhang], size: [width + 2 * overhang + FASCIA_T, FASCIA_H, FASCIA_T] });
      fascia.push({ pos: [0, fasciaY, -hd - overhang], size: [width + 2 * overhang + FASCIA_T, FASCIA_H, FASCIA_T] });
      fascia.push({ pos: [-hw - overhang, fasciaY, 0], size: [FASCIA_T, FASCIA_H, depth + 2 * overhang] });
      fascia.push({ pos: [hw + overhang, fasciaY, 0], size: [FASCIA_T, FASCIA_H, depth + 2 * overhang] });
    } else {
      // --- Pitched roof: ridge beam ---
      const pitchRad = (roofPitch * Math.PI) / 180;
      const roofRise = Math.tan(pitchRad) * hw;
      const ridgeY = height + roofRise;
      beams.push({ pos: [0, ridgeY, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });

      // Angled rafters (simplified: a few visible ones)
      const slantLen = hw / Math.cos(pitchRad);
      const rafterCount = Math.max(2, Math.floor(depth / RAFTER_SPACING) + 1);
      const rStep = depth / (rafterCount - 1);
      const midY = (height + BEAM_H + ridgeY) / 2;
      const midX = hw / 2;
      for (let i = 0; i < rafterCount; i++) {
        const z = -hd + i * rStep;
        // Left rafter
        rafters.push({
          pos: [-midX, midY, z],
          size: [slantLen, RAFTER_H, RAFTER_W],
          rot: [0, 0, pitchRad],
        });
        // Right rafter
        rafters.push({
          pos: [midX, midY, z],
          size: [slantLen, RAFTER_H, RAFTER_W],
          rot: [0, 0, -pitchRad],
        });
      }
    }

    return { posts, beams, braces, rafters, fascia };
  }, [width, depth, height, isFlat, roofPitch]);

  const renderBoxes = (items: BoxData[], prefix: string) =>
    items.map((b, i) => (
      <mesh key={`${prefix}-${i}`} position={b.pos} rotation={b.rot ?? [0, 0, 0]} material={timberMat}>
        <boxGeometry args={b.size} />
      </mesh>
    ));

  return (
    <group>
      {renderBoxes(elements.posts, 'post')}
      {renderBoxes(elements.beams, 'beam')}
      {renderBoxes(elements.braces, 'brace')}
      {renderBoxes(elements.rafters, 'rafter')}
      {renderBoxes(elements.fascia, 'fascia')}
    </group>
  );
}
