import type {
  BuildingEntity,
  BuildingType,
  Orientation,
  RoofType,
  RoofConfig,
  RoofCoveringId,
  TrimColorId,
  FloorMaterialId,
  WallConfig,
  WallId,
  WallSide,
  DoorMaterialId,
  DoorSize,
  DoorPosition,
  DoorSwing,
  SnapConnection,
} from '@/types/building';
import { DEFAULT_FLOOR, getDefaultWalls } from '@/lib/constants';

// ─── Base58 (Bitcoin-style, no 0/O/I/l) ─────────────────────────────
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_DECODE: Record<string, number> = {};
for (let i = 0; i < BASE58.length; i++) BASE58_DECODE[BASE58[i]] = i;

function toBase58(bytes: Uint8Array): string {
  let leadingZeros = 0;
  for (const b of bytes) {
    if (b !== 0) break;
    leadingZeros++;
  }
  const digits: number[] = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = '1'.repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) result += BASE58[digits[i]];
  return result;
}

function fromBase58(str: string): Uint8Array {
  let leadingOnes = 0;
  for (const ch of str) {
    if (ch !== '1') break;
    leadingOnes++;
  }
  const digits: number[] = [];
  for (const ch of str) {
    const val = BASE58_DECODE[ch];
    if (val === undefined) throw new Error('Invalid character');
    let carry = val;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 58;
      digits[j] = carry % 256;
      carry = Math.floor(carry / 256);
    }
    while (carry > 0) {
      digits.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  const bytes = new Uint8Array(leadingOnes + digits.length);
  for (let i = 0; i < digits.length; i++) {
    bytes[leadingOnes + digits.length - 1 - i] = digits[i];
  }
  return bytes;
}

// ─── Bit Writer / Reader ─────────────────────────────────────────────
class BitWriter {
  private bytes: number[] = [];
  private currentByte = 0;
  private bitPos = 0;

  write(value: number, numBits: number): void {
    for (let i = numBits - 1; i >= 0; i--) {
      this.currentByte = (this.currentByte << 1) | ((value >>> i) & 1);
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bytes.push(this.currentByte);
        this.currentByte = 0;
        this.bitPos = 0;
      }
    }
  }

  writeSigned(value: number, numBits: number): void {
    // Encode signed int: offset by 2^(numBits-1)
    const offset = 1 << (numBits - 1);
    this.write(clamp(value + offset, 0, (1 << numBits) - 1), numBits);
  }

  toBytes(): Uint8Array {
    const out = [...this.bytes];
    if (this.bitPos > 0) {
      out.push(this.currentByte << (8 - this.bitPos));
    }
    return new Uint8Array(out);
  }
}

class BitReader {
  private bytes: Uint8Array;
  private bytePos = 0;
  private bitPos = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  read(numBits: number): number {
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      if (this.bytePos >= this.bytes.length) return value << (numBits - i);
      value = (value << 1) | ((this.bytes[this.bytePos] >>> (7 - this.bitPos)) & 1);
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bitPos = 0;
        this.bytePos++;
      }
    }
    return value;
  }

  readSigned(numBits: number): number {
    const offset = 1 << (numBits - 1);
    return this.read(numBits) - offset;
  }
}

// ─── Lookup tables ───────────────────────────────────────────────────
const BUILDING_TYPES: BuildingType[] = ['overkapping', 'berging', 'paal', 'muur'];
const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];
const COVERING_IDS: RoofCoveringId[] = ['dakpannen', 'riet', 'epdm', 'polycarbonaat', 'metaal'];
const TRIM_IDS: TrimColorId[] = ['antraciet', 'wit', 'zwart', 'bruin', 'groen'];
const FLOOR_IDS: FloorMaterialId[] = ['geen', 'tegels', 'beton', 'hout'];
const WALL_SLOTS: WallId[] = ['front', 'back', 'left', 'right'];
const WALL_SIDES: WallSide[] = ['left', 'right', 'front', 'back'];
const MATERIAL_IDS = ['wood', 'brick', 'render', 'metal', 'glass'];
const FINISH_IDS = ['Mat', 'Satijn', 'Glans'];
const DOOR_MATERIAL_IDS: DoorMaterialId[] = ['wood', 'aluminium', 'pvc', 'staal'];
const DOOR_SIZES: DoorSize[] = ['enkel', 'dubbel'];
const DOOR_POSITIONS: DoorPosition[] = ['links', 'midden', 'rechts'];
const DOOR_SWINGS: DoorSwing[] = ['dicht', 'naar_binnen', 'naar_buiten'];

function indexOf<T>(arr: T[], val: T): number {
  const i = arr.indexOf(val);
  return i >= 0 ? i : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Encode (Version 5: new dimension ranges, top-left positions) ──
const VERSION = 5;

function encodeWall(w: BitWriter, wall: WallConfig) {
  w.write(indexOf(MATERIAL_IDS, wall.materialId), 3);
  w.write(indexOf(FINISH_IDS, wall.finish), 2);
  w.write(wall.hasDoor ? 1 : 0, 1);
  if (wall.hasDoor) {
    w.write(indexOf(DOOR_MATERIAL_IDS, wall.doorMaterialId), 2);
    w.write(indexOf(DOOR_SIZES, wall.doorSize), 1);
    w.write(wall.doorHasWindow ? 1 : 0, 1);
    w.write(indexOf(DOOR_POSITIONS, wall.doorPosition), 2);
    w.write(indexOf(DOOR_SWINGS, wall.doorSwing), 2);
  }
  w.write(wall.hasWindow ? 1 : 0, 1);
  if (wall.hasWindow) {
    w.write(clamp(wall.windowCount, 0, 7), 3);
  }
}

function decodeWall(r: BitReader): WallConfig {
  const materialId = MATERIAL_IDS[clamp(r.read(3), 0, 4)];
  const finish = FINISH_IDS[clamp(r.read(2), 0, 2)];
  const hasDoor = r.read(1) === 1;
  let doorMaterialId: DoorMaterialId = 'wood';
  let doorSize: DoorSize = 'enkel';
  let doorHasWindow = false;
  let doorPosition: DoorPosition = 'midden';
  let doorSwing: DoorSwing = 'dicht';
  if (hasDoor) {
    doorMaterialId = DOOR_MATERIAL_IDS[clamp(r.read(2), 0, 3)];
    doorSize = DOOR_SIZES[clamp(r.read(1), 0, 1)];
    doorHasWindow = r.read(1) === 1;
    doorPosition = DOOR_POSITIONS[clamp(r.read(2), 0, 2)];
    doorSwing = DOOR_SWINGS[clamp(r.read(2), 0, 2)];
  }
  const hasWindow = r.read(1) === 1;
  const windowCount = hasWindow ? clamp(r.read(3), 0, 7) : 0;

  return {
    materialId, finish, hasDoor, doorMaterialId, doorSize,
    doorHasWindow, doorPosition, doorSwing, hasWindow, windowCount,
  };
}

export function encodeState(
  buildings: BuildingEntity[],
  connections: SnapConnection[],
  roof: RoofConfig,
  defaultHeight: number = 3,
): string {
  const w = new BitWriter();

  // Header: version 5 uses escape code 0 in 2-bit field, then 2-bit extension
  // v5 = write(0,2) + write(1,2)  →  decoder reads 2 bits, if 0 reads 2 more → 4+ext
  w.write(0, 2); // escape: extended version
  w.write(1, 2); // extension bits: 4 + 1 = version 5

  // Shared roof (same as v3)
  w.write(roof.type === 'pitched' ? 1 : 0, 1);
  if (roof.type === 'pitched') {
    w.write(clamp(roof.pitch, 0, 55), 6);
  }
  w.write(indexOf(COVERING_IDS, roof.coveringId), 3);
  w.write(indexOf(TRIM_IDS, roof.trimColorId), 3);
  w.write(roof.insulation ? 1 : 0, 1);
  if (roof.insulation) {
    w.write(clamp(Math.round((roof.insulationThickness - 50) / 10), 0, 25), 5);
  }
  w.write(roof.hasSkylight ? 1 : 0, 1);

  // Default height: 4 bits, encodes 2.2–3.0 in 0.1 steps (v5)
  w.write(clamp(Math.round((defaultHeight - 2.2) / 0.1), 0, 8), 4);

  // Building count
  w.write(clamp(buildings.length, 1, 8) - 1, 3);

  // Per-building data
  for (const b of buildings) {
    w.write(indexOf(BUILDING_TYPES, b.type), 2);

    // Height override (all types)
    const hasOverride = b.heightOverride != null;
    w.write(hasOverride ? 1 : 0, 1);
    if (hasOverride) {
      w.write(clamp(Math.round((b.heightOverride! - 2.2) / 0.1), 0, 8), 4);
    }

    // Orientation (all types): 0=horizontal, 1=vertical
    w.write(indexOf(ORIENTATIONS, b.orientation ?? 'horizontal'), 1);

    if (b.type === 'paal') {
      // Poles: position only (height from override/default), top-left stored directly
      w.writeSigned(clamp(Math.round(b.position[0] / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(b.position[1] / 0.5), -64, 63), 7);
    } else if (b.type === 'muur') {
      // Muur: width + position + wall flag + wall data, top-left stored directly
      w.write(clamp(Math.round((b.dimensions.width - 1) / 0.5), 0, 31), 5);
      w.writeSigned(clamp(Math.round(b.position[0] / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(b.position[1] / 0.5), -64, 63), 7);

      // Single wall (front)
      const hasFrontWall = !!b.walls['front'];
      w.write(hasFrontWall ? 1 : 0, 1);
      if (hasFrontWall) {
        encodeWall(w, b.walls['front']);
      }
    } else {
      // overkapping / berging: v5 uses new ranges and top-left positions
      w.write(clamp(Math.round((b.dimensions.width - 1) / 0.1), 0, 50), 6);
      w.write(clamp(Math.round((b.dimensions.depth - 1) / 0.1), 0, 390), 9);
      w.write(clamp(Math.round((b.dimensions.height - 2.2) / 0.1), 0, 8), 4);

      // Position: top-left, signed, scaled by 0.5m
      w.writeSigned(clamp(Math.round(b.position[0] / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(b.position[1] / 0.5), -64, 63), 7);

      w.write(indexOf(FLOOR_IDS, b.floor.materialId), 2);
      w.write(b.hasCornerBraces ? 1 : 0, 1);

      // Wall mask + data
      let mask = 0;
      for (let i = 0; i < WALL_SLOTS.length; i++) {
        if (b.walls[WALL_SLOTS[i]]) mask |= 1 << i;
      }
      w.write(mask, 4);

      for (let i = 0; i < WALL_SLOTS.length; i++) {
        if (!(mask & (1 << i))) continue;
        encodeWall(w, b.walls[WALL_SLOTS[i]]);
      }
    }
  }

  // Connections
  w.write(clamp(connections.length, 0, 15), 4);
  for (const c of connections) {
    const idxA = buildings.findIndex(b => b.id === c.buildingAId);
    const idxB = buildings.findIndex(b => b.id === c.buildingBId);
    w.write(clamp(idxA, 0, 7), 3);
    w.write(indexOf(WALL_SIDES, c.sideA), 2);
    w.write(clamp(idxB, 0, 7), 3);
    w.write(indexOf(WALL_SIDES, c.sideB), 2);
    w.write(c.isOpen ? 1 : 0, 1);
  }

  return formatCode(toBase58(w.toBytes()));
}

export function decodeState(code: string): {
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  roof: RoofConfig;
  defaultHeight: number;
} {
  const normalized = code.replace(/[-\s]/g, '');
  const bytes = fromBase58(normalized);
  const r = new BitReader(bytes);

  let version = r.read(2);
  if (version === 0) {
    // Extended version: 4 + next 2 bits
    version = 4 + r.read(2);
  }
  if (version !== 2 && version !== 3 && version !== 4 && version !== 5) throw new Error('Unsupported version');

  const isV3 = version === 3;
  const isV4 = version === 4;
  const isV5 = version === 5;

  // Shared roof
  const isPitched = r.read(1) === 1;
  const pitch = isPitched ? clamp(r.read(6), 0, 55) : 0;
  const roofType: RoofType = isPitched ? 'pitched' : 'flat';
  const coveringId = COVERING_IDS[clamp(r.read(3), 0, 4)];
  const trimColorId = TRIM_IDS[clamp(r.read(3), 0, 4)];
  const insulation = r.read(1) === 1;
  const insulationThickness = insulation ? clamp(r.read(5) * 10 + 50, 50, 300) : 150;
  const hasSkylight = r.read(1) === 1;

  const roof: RoofConfig = {
    type: roofType, pitch, coveringId, trimColorId,
    insulation, insulationThickness, hasSkylight,
  };

  // Default height (v4: 5 bits, v5: 4 bits)
  const defaultHeight = isV5
    ? clamp(r.read(4) * 0.1 + 2.2, 2.2, 3)
    : isV4
    ? clamp(r.read(5) * 0.25 + 2, 2, 6)
    : 3;

  // Buildings
  const buildingCount = r.read(3) + 1;
  const buildings: BuildingEntity[] = [];

  for (let bi = 0; bi < buildingCount; bi++) {
    const typeBits = (isV3 || isV4 || isV5) ? 2 : 1;
    const typeIdx = r.read(typeBits);
    const type = BUILDING_TYPES[clamp(typeIdx, 0, BUILDING_TYPES.length - 1)];

    // V4/V5: per-building heightOverride and orientation
    let heightOverride: number | null = null;
    let orientation: Orientation = 'horizontal';
    if (isV4 || isV5) {
      const hasOverride = r.read(1) === 1;
      if (hasOverride) {
        heightOverride = isV5
          ? clamp(r.read(4) * 0.1 + 2.2, 2.2, 3)
          : clamp(r.read(5) * 0.25 + 2, 2, 6);
      }
      orientation = ORIENTATIONS[clamp(r.read(1), 0, 1)];
    }

    if ((isV3 || isV4 || isV5) && type === 'paal') {
      let height: number;
      if (isV3) {
        // v3: height encoded inline for paal
        height = clamp(r.read(5) * 0.25 + 2, 2, 6);
      } else {
        // v4/v5: height comes from override or default
        height = heightOverride ?? defaultHeight;
      }
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      buildings.push({
        id: crypto.randomUUID(),
        type: 'paal',
        // v5: position is top-left directly; v4 and earlier: was encoded as center
        position: isV5 ? [posX, posZ] : [posX - 0.15 / 2, posZ - 0.15 / 2],
        dimensions: { width: 0.15, depth: 0.15, height },
        walls: {},
        hasCornerBraces: false,
        floor: { materialId: 'geen' },
        orientation,
        heightOverride,
      });
      continue;
    }

    if ((isV4 || isV5) && type === 'muur') {
      const width = clamp(r.read(5) * 0.5 + 1, 1, 16.5);
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      const height = heightOverride ?? defaultHeight;

      const hasFrontWall = r.read(1) === 1;
      const walls: Record<string, WallConfig> = {};
      if (hasFrontWall) {
        walls['front'] = decodeWall(r);
      }

      const isVert = orientation === 'vertical';
      const visualW = isVert ? 0.2 : width;
      const visualD = isVert ? width : 0.2;
      buildings.push({
        id: crypto.randomUUID(),
        type: 'muur',
        // v5: position is top-left directly; v4: was encoded as center
        position: isV5 ? [posX, posZ] : [posX - visualW / 2, posZ - visualD / 2],
        dimensions: { width, depth: 0.2, height },
        walls,
        hasCornerBraces: false,
        floor: { materialId: 'geen' },
        orientation,
        heightOverride,
      });
      continue;
    }

    const width = isV5
      ? clamp(r.read(6) * 0.1 + 1, 1, 7)
      : clamp(r.read(5) * 0.5 + 3, 3, 15);
    const depth = isV5
      ? clamp(r.read(9) * 0.1 + 1, 1, 40)
      : clamp(r.read(6) * 0.5 + 3, 3, 20);
    const height = isV5
      ? clamp(r.read(4) * 0.1 + 2.2, 2.2, 3)
      : clamp(r.read(5) * 0.25 + 2, 2, 6);
    const posX = r.readSigned(7) * 0.5;
    const posZ = r.readSigned(7) * 0.5;
    const floorMaterialId = FLOOR_IDS[clamp(r.read(2), 0, 3)];
    const hasCornerBraces = r.read(1) === 1;

    const mask = r.read(4);
    const walls: Record<string, WallConfig> = {};
    for (let i = 0; i < WALL_SLOTS.length; i++) {
      if (!(mask & (1 << i))) continue;
      walls[WALL_SLOTS[i]] = decodeWall(r);
    }

    buildings.push({
      id: crypto.randomUUID(),
      type,
      // v5: position is top-left directly; v4 and earlier: was encoded as center
      position: isV5 ? [posX, posZ] : [posX - width / 2, posZ - depth / 2],
      dimensions: { width, depth, height },
      walls: Object.keys(walls).length > 0 ? walls : getDefaultWalls(type),
      hasCornerBraces,
      floor: { materialId: floorMaterialId },
      orientation,
      heightOverride,
    });
  }

  // Connections
  const connCount = r.read(4);
  const connections: SnapConnection[] = [];
  for (let ci = 0; ci < connCount; ci++) {
    const idxA = clamp(r.read(3), 0, buildings.length - 1);
    const sideA = WALL_SIDES[clamp(r.read(2), 0, 3)];
    const idxB = clamp(r.read(3), 0, buildings.length - 1);
    const sideB = WALL_SIDES[clamp(r.read(2), 0, 3)];
    const isOpen = r.read(1) === 1;
    connections.push({
      buildingAId: buildings[idxA].id,
      sideA,
      buildingBId: buildings[idxB].id,
      sideB,
      isOpen,
    });
  }

  return { buildings, connections, roof, defaultHeight };
}

// ─── Format ──────────────────────────────────────────────────────────
export function formatCode(raw: string): string {
  const clean = raw.replace(/[-\s]/g, '');
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
}
