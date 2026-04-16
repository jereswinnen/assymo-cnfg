'use client';

import { useMemo, useEffect } from 'react';
import { MeshStandardMaterial, TextureLoader, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { POST_SIZE, BEAM_H, DECK_T, autoPoleLayout } from '@/lib/constants';
import { getAtom, getAtomColor, getEffectivePoleMaterial } from '@/lib/materials';

const BEAM_W = 0.15;

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

  const defaultHeight = useConfigStore((s) => s.defaultHeight);

  const width = building?.dimensions.width ?? 8;
  const depth = building?.dimensions.depth ?? 4;
  const height = building ? getEffectiveHeight(building, defaultHeight) : 3;
  const isFlat = roof.type === 'flat';
  const roofPitch = roof.pitch;
  const hasBraces = building?.hasCornerBraces ?? false;
  const poles = useMemo(
    () => building?.poles ?? autoPoleLayout(width, depth),
    [building?.poles, width, depth],
  );

  // Determine which sides are suppressed (this building is buildingA in the connection)
  const suppressedSides = useMemo(() => {
    const sides = new Set<string>();
    for (const c of connections) {
      if (c.buildingAId === buildingId) sides.add(c.sideA);
    }
    return sides;
  }, [connections, buildingId]);

  const poleMaterialId = building ? getEffectivePoleMaterial(building) : 'wood';
  const poleAtom = getAtom(poleMaterialId);

  const timberMat = useMemo(() => {
    const loader = new TextureLoader();
    const paths = poleAtom?.textures ?? null;
    const tile = poleAtom?.tileSize ?? [2, 2];
    const baseColor = getAtomColor(poleMaterialId);

    if (!paths) {
      return new MeshStandardMaterial({
        color: baseColor,
        metalness: 0.05,
        roughness: 1,
        envMapIntensity: 0.2,
      });
    }

    const colorTex = loader.load(paths.color);
    colorTex.wrapS = RepeatWrapping;
    colorTex.wrapT = RepeatWrapping;
    colorTex.colorSpace = SRGBColorSpace;
    colorTex.repeat.set(2 / tile[0], 2 / tile[1]);

    const normalTex = loader.load(paths.normal);
    normalTex.wrapS = RepeatWrapping;
    normalTex.wrapT = RepeatWrapping;
    normalTex.colorSpace = LinearSRGBColorSpace;
    normalTex.repeat.set(2 / tile[0], 2 / tile[1]);

    const roughTex = loader.load(paths.roughness);
    roughTex.wrapS = RepeatWrapping;
    roughTex.wrapT = RepeatWrapping;
    roughTex.colorSpace = LinearSRGBColorSpace;
    roughTex.repeat.set(2 / tile[0], 2 / tile[1]);

    return new MeshStandardMaterial({
      map: colorTex,
      normalMap: normalTex,
      roughnessMap: roughTex,
      color: poleMaterialId === 'wood' ? '#C4955A' : '#ffffff',
      metalness: 0.05,
      roughness: 1,
      envMapIntensity: 0.2,
    });
  }, [poleMaterialId, poleAtom]);

  useEffect(() => () => {
    timberMat.map?.dispose();
    timberMat.normalMap?.dispose();
    timberMat.roughnessMap?.dispose();
    timberMat.dispose();
  }, [timberMat]);

  const elements = useMemo(() => {
    const hw = width / 2;
    const hd = depth / 2;
    const boxes: BoxData[] = [];

    const suppR = suppressedSides.has('right');
    const suppL = suppressedSides.has('left');
    const suppF = suppressedSides.has('front');
    const suppB = suppressedSides.has('back');

    // Corner posts (always present unless the adjacent sides are suppressed)
    if (!suppB && !suppL) boxes.push({ pos: [-hw, height / 2, hd], size: [POST_SIZE, height, POST_SIZE] });
    if (!suppB && !suppR) boxes.push({ pos: [hw, height / 2, hd], size: [POST_SIZE, height, POST_SIZE] });
    if (!suppF && !suppL) boxes.push({ pos: [-hw, height / 2, -hd], size: [POST_SIZE, height, POST_SIZE] });
    if (!suppF && !suppR) boxes.push({ pos: [hw, height / 2, -hd], size: [POST_SIZE, height, POST_SIZE] });

    // Intermediate posts from the building's (possibly user-edited) pole layout
    if (!suppB) for (const f of poles.back)   boxes.push({ pos: [-hw + f * width, height / 2,  hd], size: [POST_SIZE, height, POST_SIZE] });
    if (!suppF) for (const f of poles.front)  boxes.push({ pos: [-hw + f * width, height / 2, -hd], size: [POST_SIZE, height, POST_SIZE] });
    if (!suppL) for (const f of poles.left)   boxes.push({ pos: [-hw, height / 2, -hd + f * depth], size: [POST_SIZE, height, POST_SIZE] });
    if (!suppR) for (const f of poles.right)  boxes.push({ pos: [ hw, height / 2, -hd + f * depth], size: [POST_SIZE, height, POST_SIZE] });

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
      // Tall deck = visible wood edge of the roof
      const ROOF_EDGE = 0.12;
      const deckY = height + BEAM_H + ROOF_EDGE / 2;
      boxes.push({ pos: [0, deckY, 0], size: [width, ROOF_EDGE, depth] });
    } else {
      const pitchRad = (roofPitch * Math.PI) / 180;
      const roofRise = Math.tan(pitchRad) * hw;
      boxes.push({ pos: [0, height + roofRise, 0], size: [BEAM_W, BEAM_H, depth + BEAM_W] });
    }

    return boxes;
  }, [width, depth, height, isFlat, roofPitch, hasBraces, suppressedSides, poles]);

  return (
    <group>
      {elements.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={b.rot ?? [0, 0, 0]} material={timberMat} castShadow>
          <boxGeometry args={b.size} />
        </mesh>
      ))}
    </group>
  );
}
