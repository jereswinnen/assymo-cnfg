import type { MaterialCategory, MaterialRow } from '@/domain/catalog';
import type {
  WallCatalogEntry,
  RoofTrimCatalogEntry,
  RoofCoveringCatalogEntry,
  FloorCatalogEntry,
  DoorCatalogEntry,
  GateCatalogEntry,
} from './types';

function rowsByCategory(
  materials: MaterialRow[],
  category: MaterialCategory,
): MaterialRow[] {
  return materials.filter(
    (m) => m.categories.includes(category) && m.archivedAt === null,
  );
}

function rowToWall(m: MaterialRow): WallCatalogEntry {
  return {
    atomId: m.slug,
    pricePerSqm: m.pricing.wall?.perSqm ?? 0,
    ...(m.flags.clearsOpenings ? { clearsOpenings: true } : {}),
  };
}

function rowToRoofTrim(m: MaterialRow): RoofTrimCatalogEntry {
  return { atomId: m.slug, pricePerSqm: m.pricing['roof-trim']?.perSqm ?? 0 };
}

function rowToRoofCover(m: MaterialRow): RoofCoveringCatalogEntry {
  return { atomId: m.slug, pricePerSqm: m.pricing['roof-cover']?.perSqm ?? 0 };
}

function rowToFloor(m: MaterialRow): FloorCatalogEntry {
  return {
    atomId: m.slug,
    pricePerSqm: m.pricing.floor?.perSqm ?? 0,
    ...(m.flags.isVoid ? { isVoid: true } : {}),
  };
}

function rowToDoor(m: MaterialRow): DoorCatalogEntry {
  return { atomId: m.slug, surcharge: m.pricing.door?.surcharge ?? 0 };
}

function rowToGate(m: MaterialRow): GateCatalogEntry {
  return { atomId: m.slug, pricePerSqm: m.pricing.gate?.perSqm ?? 0 };
}

export function buildWallCatalog(materials: MaterialRow[]): WallCatalogEntry[] {
  return rowsByCategory(materials, 'wall').map(rowToWall);
}
export function buildRoofTrimCatalog(materials: MaterialRow[]): RoofTrimCatalogEntry[] {
  return rowsByCategory(materials, 'roof-trim').map(rowToRoofTrim);
}
export function buildRoofCoverCatalog(materials: MaterialRow[]): RoofCoveringCatalogEntry[] {
  return rowsByCategory(materials, 'roof-cover').map(rowToRoofCover);
}
export function buildFloorCatalog(materials: MaterialRow[]): FloorCatalogEntry[] {
  return rowsByCategory(materials, 'floor').map(rowToFloor);
}
export function buildDoorCatalog(materials: MaterialRow[]): DoorCatalogEntry[] {
  return rowsByCategory(materials, 'door').map(rowToDoor);
}
export function buildGateCatalog(materials: MaterialRow[]): GateCatalogEntry[] {
  return rowsByCategory(materials, 'gate').map(rowToGate);
}

/** Given a built catalog and the current selection, keep the current
 *  selection visible even when archived (so existing scenes still
 *  render). The catalog already excludes archived entries; this helper
 *  adds the current entry back in when missing. */
export function filterCatalogAllowing<T extends { atomId: string }>(
  catalog: readonly T[],
  fallbackSlug: string | null,
  materials: MaterialRow[],
  category: MaterialCategory,
  toView: (m: MaterialRow) => T,
): T[] {
  if (!fallbackSlug) return [...catalog];
  if (catalog.some((e) => e.atomId === fallbackSlug)) return [...catalog];
  const archivedRow = materials.find(
    (m) => m.categories.includes(category) && m.slug === fallbackSlug,
  );
  if (!archivedRow) return [...catalog];
  return [toView(archivedRow), ...catalog];
}

/** Colour lookup used by pickers + canvas — always returns something
 *  (neutral grey fallback if the slug doesn't resolve). Pass `category`
 *  to confirm the row is available in that slot; with unified materials,
 *  the category argument narrows to rows whose `categories` array
 *  contains the given value. */
export function getAtomColor(
  materials: MaterialRow[],
  slug: string,
  category?: MaterialCategory,
): string {
  const match = category
    ? materials.find((m) => m.slug === slug && m.categories.includes(category))
    : materials.find((m) => m.slug === slug);
  return match?.color ?? '#808080';
}

/** Full-row lookup used when rendering needs textures + tileSize. Pass
 *  `category` to narrow the lookup to rows available in that slot. */
export function getAtom(
  materials: MaterialRow[],
  slug: string,
  category?: MaterialCategory,
): MaterialRow | null {
  if (category) {
    return materials.find((m) => m.slug === slug && m.categories.includes(category)) ?? null;
  }
  return materials.find((m) => m.slug === slug) ?? null;
}
