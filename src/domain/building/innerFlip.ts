import type { BuildingEntity } from './types';
import { WALL_THICKNESS } from './constants';

/** Radius (m) within which we look for structural neighbours when deciding
 *  whether a muur's default outer/inner face assignment needs flipping.
 *  Walls beyond this radius are treated as unrelated to the muur's
 *  placement. */
export const INNER_FLIP_DETECT_RADIUS = 5;

function buildingCentre(b: BuildingEntity): [number, number] {
  return [
    b.position[0] + b.dimensions.width / 2,
    b.position[1] + b.dimensions.depth / 2,
  ];
}

/** Default-outward direction (unit vector in the XZ plane) for a muur,
 *  derived from its `orientation`. Mirrors the `outerSign` convention used
 *  by `SchematicWalls.tsx`: a horizontal muur's `'front'` wall faces -z
 *  by default, a vertical muur's faces -x. */
function defaultOutwardDir(b: BuildingEntity): [number, number] {
  return b.orientation === 'horizontal' ? [0, -1] : [-1, 0];
}

function distance(a: [number, number], c: [number, number]): number {
  const dx = a[0] - c[0];
  const dy = a[1] - c[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Whether the muur's default outer/inner face assignment should be flipped
 *  so the "inner" face points toward the centroid of nearby structural
 *  buildings. Returns false for non-muur types, for muurs with no nearby
 *  structural neighbours, and when the default-inner face is already closer
 *  to the neighbour centroid. */
export function detectInnerFlip(
  building: BuildingEntity,
  buildings: BuildingEntity[],
): boolean {
  if (building.type !== 'muur') return false;

  const muurCentre = buildingCentre(building);

  const neighbours = buildings.filter(b => {
    if (b.id === building.id) return false;
    if (b.type !== 'overkapping' && b.type !== 'berging') return false;
    return distance(buildingCentre(b), muurCentre) <= INNER_FLIP_DETECT_RADIUS;
  });

  if (neighbours.length === 0) return false;

  const sumX = neighbours.reduce((acc, b) => acc + buildingCentre(b)[0], 0);
  const sumY = neighbours.reduce((acc, b) => acc + buildingCentre(b)[1], 0);
  const centroid: [number, number] = [
    sumX / neighbours.length,
    sumY / neighbours.length,
  ];

  const [ox, oy] = defaultOutwardDir(building);
  const half = WALL_THICKNESS / 2;
  const defaultOuterFace: [number, number] = [
    muurCentre[0] + half * ox,
    muurCentre[1] + half * oy,
  ];
  const defaultInnerFace: [number, number] = [
    muurCentre[0] - half * ox,
    muurCentre[1] - half * oy,
  ];

  return distance(defaultOuterFace, centroid) < distance(defaultInnerFace, centroid);
}
