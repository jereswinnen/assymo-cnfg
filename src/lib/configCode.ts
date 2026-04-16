import type {
  BuildingEntity,
  BuildingType,
  Orientation,
  RoofType,
  RoofConfig,
  RoofCoveringId,
  FloorMaterialId,
  WallConfig,
  WallId,
  WallSide,
  DoorMaterialId,
  DoorSize,
  DoorSwing,
  WallWindow,
  SnapConnection,
} from '@/types/building';
import { getDefaultWalls } from '@/lib/constants';

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

  /** Writes a lowercase ASCII slug of up to 15 chars. Format:
   *  4 bits length + length*8 bits ASCII. */
  writeSlug(slug: string): void {
    const len = Math.min(slug.length, 15);
    this.write(len, 4);
    for (let i = 0; i < len; i++) {
      this.write(slug.charCodeAt(i) & 0xff, 8);
    }
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

  readSlug(): string {
    const len = this.read(4);
    let out = '';
    for (let i = 0; i < len; i++) {
      out += String.fromCharCode(this.read(8));
    }
    return out;
  }
}

// ─── Lookup tables ───────────────────────────────────────────────────
const BUILDING_TYPES: BuildingType[] = ['overkapping', 'berging', 'paal', 'muur'];
const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];
const WALL_SLOTS: WallId[] = ['front', 'back', 'left', 'right'];
const WALL_SIDES: WallSide[] = ['left', 'right', 'front', 'back'];
const DOOR_SIZES: DoorSize[] = ['enkel', 'dubbel'];
const DOOR_SWINGS: DoorSwing[] = ['dicht', 'naar_binnen', 'naar_buiten'];

function indexOf<T>(arr: T[], val: T): number {
  const i = arr.indexOf(val);
  return i >= 0 ? i : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Encode (Version 7: per-building primaryMaterialId + override flags) ─
// Version encoding (see header emission + decode for details):
//   v1-v3: direct 2-bit write (legacy, no longer accepted by decoder)
//   v4-v7: escape `write(0,2)` + 2-bit extension → version = 4 + ext
//   v8+:   would require a nested escape (not yet defined)
const VERSION = 7;

function encodeWall(w: BitWriter, wall: WallConfig) {
  // Material override: 1 bit flag + slug if set, else inherits primary.
  if (wall.materialId !== undefined) {
    w.write(1, 1);
    w.writeSlug(wall.materialId);
  } else {
    w.write(0, 1);
  }
  w.write(wall.hasDoor ? 1 : 0, 1);
  if (wall.hasDoor) {
    if (wall.doorMaterialId !== undefined) {
      w.write(1, 1);
      w.writeSlug(wall.doorMaterialId);
    } else {
      w.write(0, 1);
    }
    w.write(indexOf(DOOR_SIZES, wall.doorSize), 1);
    w.write(wall.doorHasWindow ? 1 : 0, 1);
    w.write(Math.round((wall.doorPosition ?? 0.5) * 100), 7);
    w.write(indexOf(DOOR_SWINGS, wall.doorSwing), 2);
  }
  const winCount = (wall.windows ?? []).length;
  w.write(Math.min(winCount, 7), 3);
  for (let i = 0; i < Math.min(winCount, 7); i++) {
    const win = wall.windows![i];
    w.write(Math.round(win.position * 100), 7);
    w.write(Math.round((win.width ?? 1.2) * 10), 7);
    w.write(Math.round((win.height ?? 1.0) * 10), 7);
    w.write(Math.round((win.sillHeight ?? 1.2) * 10), 7);
  }
}

function decodeWall(r: BitReader): WallConfig {
  const hasMatOverride = r.read(1) === 1;
  const materialId = hasMatOverride ? r.readSlug() : undefined;
  const hasDoor = r.read(1) === 1;
  let doorMaterialId: string | undefined = undefined;
  let doorSize: DoorSize = 'enkel';
  let doorHasWindow = false;
  let doorPosition = 0.5;
  let doorSwing: DoorSwing = 'dicht';
  if (hasDoor) {
    const hasDoorMatOverride = r.read(1) === 1;
    doorMaterialId = hasDoorMatOverride ? r.readSlug() : undefined;
    doorSize = DOOR_SIZES[clamp(r.read(1), 0, 1)];
    doorHasWindow = r.read(1) === 1;
    doorPosition = r.read(7) / 100;
    doorSwing = DOOR_SWINGS[clamp(r.read(2), 0, 2)];
  }
  const windowCount = clamp(r.read(3), 0, 7);
  const windows: WallWindow[] = [];
  for (let i = 0; i < windowCount; i++) {
    windows.push({
      id: crypto.randomUUID(),
      position: r.read(7) / 100,
      width: r.read(7) / 10,
      height: r.read(7) / 10,
      sillHeight: r.read(7) / 10,
    });
  }

  return {
    materialId, hasDoor, doorMaterialId, doorSize,
    doorHasWindow, doorPosition, doorSwing, windows,
  };
}

export function encodeState(
  buildings: BuildingEntity[],
  connections: SnapConnection[],
  roof: RoofConfig,
  defaultHeight: number = 3,
): string {
  const w = new BitWriter();

  // Header: version uses escape code 0 in 2-bit field, then 2-bit extension
  // v7 = write(0,2) + write(3,2)  →  decoder reads 2 bits, if 0 reads 2 more → 4+ext
  w.write(0, 2); // escape: extended version
  w.write(3, 2); // extension bits: 4 + 3 = version 7

  // Shared roof (same as v3)
  w.write(roof.type === 'pitched' ? 1 : 0, 1);
  if (roof.type === 'pitched') {
    w.write(clamp(roof.pitch, 0, 55), 6);
  }
  w.writeSlug(roof.coveringId);
  w.writeSlug(roof.trimMaterialId);
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

    // Primary material (all types — drives walls/poles/fascia inheritance)
    w.writeSlug(b.primaryMaterialId);

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
      w.write(clamp(Math.round((b.dimensions.width - 1) / 0.1), 0, 390), 9);
      w.write(clamp(Math.round((b.dimensions.depth - 1) / 0.1), 0, 50), 6);
      w.write(clamp(Math.round((b.dimensions.height - 2.2) / 0.1), 0, 8), 4);

      // Position: top-left, signed, scaled by 0.5m
      w.writeSigned(clamp(Math.round(b.position[0] / 0.5), -64, 63), 7);
      w.writeSigned(clamp(Math.round(b.position[1] / 0.5), -64, 63), 7);

      w.writeSlug(b.floor.materialId);
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
    version = 4 + r.read(2);
  }
  if (version !== 7) throw new Error(`Unsupported share code version: ${version}`);

  // Shared roof
  const isPitched = r.read(1) === 1;
  const pitch = isPitched ? clamp(r.read(6), 0, 55) : 0;
  const roofType: RoofType = isPitched ? 'pitched' : 'flat';
  const coveringId = r.readSlug() as RoofCoveringId;
  const trimMaterialId = r.readSlug();
  const insulation = r.read(1) === 1;
  const insulationThickness = insulation ? clamp(r.read(5) * 10 + 50, 50, 300) : 150;
  const hasSkylight = r.read(1) === 1;

  const roof: RoofConfig = {
    type: roofType, pitch, coveringId, trimMaterialId,
    insulation, insulationThickness, hasSkylight,
  };

  // Default height: 4 bits, encodes 2.2–3.0 in 0.1 steps
  const defaultHeight = clamp(r.read(4) * 0.1 + 2.2, 2.2, 3);

  // Buildings
  const buildingCount = r.read(3) + 1;
  const buildings: BuildingEntity[] = [];

  for (let bi = 0; bi < buildingCount; bi++) {
    const typeIdx = r.read(2);
    const type = BUILDING_TYPES[clamp(typeIdx, 0, BUILDING_TYPES.length - 1)];

    // Per-building heightOverride and orientation
    let heightOverride: number | null = null;
    const hasOverride = r.read(1) === 1;
    if (hasOverride) {
      heightOverride = clamp(r.read(4) * 0.1 + 2.2, 2.2, 3);
    }
    const orientation = ORIENTATIONS[clamp(r.read(1), 0, 1)];
    const primaryMaterialId = r.readSlug();

    if (type === 'paal') {
      const height = heightOverride ?? defaultHeight;
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      buildings.push({
        id: crypto.randomUUID(),
        type: 'paal',
        position: [posX, posZ],
        dimensions: { width: 0.15, depth: 0.15, height },
        primaryMaterialId,
        walls: {},
        hasCornerBraces: false,
        floor: { materialId: 'geen' },
        orientation,
        heightOverride,
      });
      continue;
    }

    if (type === 'muur') {
      const width = clamp(r.read(5) * 0.5 + 1, 1, 16.5);
      const posX = r.readSigned(7) * 0.5;
      const posZ = r.readSigned(7) * 0.5;
      const height = heightOverride ?? defaultHeight;

      const hasFrontWall = r.read(1) === 1;
      const walls: Record<string, WallConfig> = {};
      if (hasFrontWall) {
        walls['front'] = decodeWall(r);
      }

      buildings.push({
        id: crypto.randomUUID(),
        type: 'muur',
        position: [posX, posZ],
        dimensions: { width, depth: 0.2, height },
        primaryMaterialId,
        walls,
        hasCornerBraces: false,
        floor: { materialId: 'geen' },
        orientation,
        heightOverride,
      });
      continue;
    }

    const width = clamp(r.read(9) * 0.1 + 1, 1, 40);
    const depth = clamp(r.read(6) * 0.1 + 1, 1, 7);
    const height = clamp(r.read(4) * 0.1 + 2.2, 2.2, 3);
    const posX = r.readSigned(7) * 0.5;
    const posZ = r.readSigned(7) * 0.5;
    const floorMaterialId = r.readSlug() as FloorMaterialId;
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
      position: [posX, posZ],
      dimensions: { width, depth, height },
      primaryMaterialId,
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
