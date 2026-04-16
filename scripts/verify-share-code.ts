import { encodeState, decodeState } from '../src/domain/config';
import { DEFAULT_ROOF, DEFAULT_WALL } from '../src/domain/building';
import type { BuildingEntity } from '../src/domain/building';

const buildings: BuildingEntity[] = [
  {
    id: 'b1',
    type: 'berging',
    position: [0, 0],
    dimensions: { width: 4, depth: 4, height: 2.6 },
    primaryMaterialId: 'zwartvuren',
    walls: {
      // front overrides to glass; back inherits primary; rest mix overrides + inherit
      front: { ...DEFAULT_WALL, materialId: 'glass' },
      back:  { ...DEFAULT_WALL },
      left:  { ...DEFAULT_WALL, materialId: 'polycarbonaat' },
      right: { ...DEFAULT_WALL, materialId: 'wood', hasDoor: true, doorMaterialId: 'aluminium' },
    },
    hasCornerBraces: false,
    floor: { materialId: 'hout' },
    orientation: 'horizontal',
    heightOverride: null,
  },
];

const code = encodeState(
  buildings,
  [],
  { ...DEFAULT_ROOF, coveringId: 'dakpannen', trimMaterialId: 'metal' },
  2.6,
);
console.log('Encoded:', code);

const decoded = decodeState(code);
const b = decoded.buildings[0];
console.log('Decoded:', {
  primary: b.primaryMaterialId,
  frontWall: b.walls.front?.materialId,
  backWall: b.walls.back?.materialId, // expected: undefined → inherits
  leftWall: b.walls.left?.materialId,
  rightWall: b.walls.right?.materialId,
  rightDoorMat: b.walls.right?.doorMaterialId,
  floor: b.floor.materialId,
  coveringId: decoded.roof.coveringId,
  trim: decoded.roof.trimMaterialId,
});

const ok =
  b.primaryMaterialId === 'zwartvuren' &&
  b.walls.front?.materialId === 'glass' &&
  b.walls.back?.materialId === undefined &&
  b.walls.left?.materialId === 'polycarbonaat' &&
  b.walls.right?.materialId === 'wood' &&
  b.walls.right?.doorMaterialId === 'aluminium' &&
  b.floor.materialId === 'hout' &&
  decoded.roof.coveringId === 'dakpannen' &&
  decoded.roof.trimMaterialId === 'metal';

if (!ok) { console.error('ROUNDTRIP FAIL'); process.exit(1); }
console.log('ROUNDTRIP OK');
