import type {
  BuildingConfig,
  BuildingType,
  RoofType,
  RoofCoveringId,
  TrimColorId,
  FloorMaterialId,
  WallConfig,
  WallId,
  DoorMaterialId,
  DoorSize,
  DoorPosition,
  DoorSwing,
} from '@/types/building';

// ─── Base58 (Bitcoin-style, no 0/O/I/l) ─────────────────────────────
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_DECODE: Record<string, number> = {};
for (let i = 0; i < BASE58.length; i++) BASE58_DECODE[BASE58[i]] = i;

function toBase58(bytes: Uint8Array): string {
  // Count leading zero bytes → become '1' chars
  let leadingZeros = 0;
  for (const b of bytes) {
    if (b !== 0) break;
    leadingZeros++;
  }
  // Convert byte array to base58 via repeated division
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
}

// ─── Lookup tables ───────────────────────────────────────────────────
const BUILDING_TYPES: BuildingType[] = ['overkapping', 'berging', 'combined'];
const ROOF_TYPES: RoofType[] = ['flat', 'pitched'];
const COVERING_IDS: RoofCoveringId[] = ['dakpannen', 'riet', 'epdm', 'polycarbonaat', 'metaal'];
const TRIM_IDS: TrimColorId[] = ['antraciet', 'wit', 'zwart', 'bruin', 'groen'];
const FLOOR_IDS: FloorMaterialId[] = ['geen', 'tegels', 'beton', 'hout'];
const WALL_SLOTS: WallId[] = ['front', 'back', 'left', 'right', 'divider', 'ov_front', 'ov_back', 'ov_right'];
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

// ─── Encode ──────────────────────────────────────────────────────────
const VERSION = 1;

export function encodeConfig(config: BuildingConfig): string {
  const w = new BitWriter();
  const { buildingType, dimensions, roof, floor, walls, hasCornerBraces } = config;

  // Header (conditional fields save ~16 bits in common cases)
  w.write(VERSION, 2);
  const typeIdx = indexOf(BUILDING_TYPES, buildingType);
  w.write(typeIdx, 2);
  w.write(clamp(Math.round((dimensions.width - 3) / 0.5), 0, 24), 5);
  w.write(clamp(Math.round((dimensions.depth - 3) / 0.5), 0, 34), 6);
  w.write(clamp(Math.round((dimensions.height - 2) / 0.25), 0, 16), 5);

  const isPitched = roof.type === 'pitched';
  w.write(isPitched ? 1 : 0, 1);
  if (isPitched) {
    w.write(clamp(dimensions.roofPitch, 0, 55), 6);
  }

  const isCombined = buildingType === 'combined';
  if (isCombined) {
    w.write(clamp(Math.round((dimensions.bergingWidth - 2) / 0.5), 0, 22), 5);
  }

  w.write(indexOf(COVERING_IDS, roof.coveringId), 3);
  w.write(indexOf(TRIM_IDS, roof.trimColorId), 3);

  w.write(roof.insulation ? 1 : 0, 1);
  if (roof.insulation) {
    w.write(clamp(Math.round((roof.insulationThickness - 50) / 10), 0, 25), 5);
  }

  w.write(roof.hasSkylight ? 1 : 0, 1);
  w.write(indexOf(FLOOR_IDS, floor.materialId), 2);
  w.write(hasCornerBraces ? 1 : 0, 1);

  // Wall existence mask
  let mask = 0;
  for (let i = 0; i < WALL_SLOTS.length; i++) {
    if (walls[WALL_SLOTS[i]]) mask |= 1 << i;
  }
  w.write(mask, 8);

  // Per-wall data
  for (let i = 0; i < WALL_SLOTS.length; i++) {
    if (!(mask & (1 << i))) continue;
    const wall = walls[WALL_SLOTS[i]];
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

  return formatCode(toBase58(w.toBytes()));
}

// ─── Decode ──────────────────────────────────────────────────────────
export function decodeConfig(code: string): BuildingConfig {
  // Strip dashes/spaces only — Base58 is case-sensitive
  const normalized = code.replace(/[-\s]/g, '');
  const bytes = fromBase58(normalized);
  const r = new BitReader(bytes);

  const version = r.read(2);
  if (version !== VERSION) throw new Error('Unsupported version');

  const buildingType = BUILDING_TYPES[clamp(r.read(2), 0, 2)];
  const width = clamp(r.read(5) * 0.5 + 3, 3, 15);
  const depth = clamp(r.read(6) * 0.5 + 3, 3, 20);
  const height = clamp(r.read(5) * 0.25 + 2, 2, 6);

  const isPitched = r.read(1) === 1;
  const roofPitch = isPitched ? clamp(r.read(6), 0, 55) : 0;
  const roofType: RoofType = isPitched ? 'pitched' : 'flat';

  const isCombined = buildingType === 'combined';
  const bergingWidth = isCombined ? clamp(r.read(5) * 0.5 + 2, 2, 13) : 4;

  const coveringId = COVERING_IDS[clamp(r.read(3), 0, 4)];
  const trimColorId = TRIM_IDS[clamp(r.read(3), 0, 4)];

  const insulation = r.read(1) === 1;
  const insulationThickness = insulation ? clamp(r.read(5) * 10 + 50, 50, 300) : 150;

  const hasSkylight = r.read(1) === 1;
  const floorMaterialId = FLOOR_IDS[clamp(r.read(2), 0, 3)];
  const hasCornerBraces = r.read(1) === 1;

  const mask = r.read(8);
  const walls: Record<string, WallConfig> = {};

  for (let i = 0; i < WALL_SLOTS.length; i++) {
    if (!(mask & (1 << i))) continue;
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

    walls[WALL_SLOTS[i]] = {
      materialId, finish, hasDoor, doorMaterialId, doorSize,
      doorHasWindow, doorPosition, doorSwing, hasWindow, windowCount,
    };
  }

  return {
    buildingType,
    dimensions: { width, depth, height, roofPitch, bergingWidth },
    roof: { type: roofType, coveringId, trimColorId, insulation, insulationThickness, hasSkylight },
    floor: { materialId: floorMaterialId },
    walls,
    hasCornerBraces,
  };
}

// ─── Format ──────────────────────────────────────────────────────────
export function formatCode(raw: string): string {
  const clean = raw.replace(/[-\s]/g, '');
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
}
