import type { MaterialCategory, MaterialRow } from '@/domain/catalog';
import type {
  WallCatalogEntry,
  RoofTrimCatalogEntry,
  RoofCoveringCatalogEntry,
  FloorCatalogEntry,
  DoorCatalogEntry,
} from './types';

function rowsByCategory(
  materials: MaterialRow[],
  category: MaterialCategory,
): MaterialRow[] {
  return materials.filter((m) => m.category === category && m.archivedAt === null);
}

function rowToWall(m: MaterialRow): WallCatalogEntry {
  return {
    atomId: m.slug,
    pricePerSqm: m.pricing.perSqm ?? 0,
    ...(m.flags.clearsOpenings ? { clearsOpenings: true } : {}),
  };
}

function rowToRoofTrim(m: MaterialRow): RoofTrimCatalogEntry {
  return { atomId: m.slug };
}

function rowToRoofCover(m: MaterialRow): RoofCoveringCatalogEntry {
  return { atomId: m.slug, pricePerSqm: m.pricing.perSqm ?? 0 };
}

function rowToFloor(m: MaterialRow): FloorCatalogEntry {
  return {
    atomId: m.slug,
    pricePerSqm: m.pricing.perSqm ?? 0,
    ...(m.flags.isVoid ? { isVoid: true } : {}),
  };
}

function rowToDoor(m: MaterialRow): DoorCatalogEntry {
  return { atomId: m.slug, surcharge: m.pricing.surcharge ?? 0 };
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
    (m) => m.category === category && m.slug === fallbackSlug,
  );
  if (!archivedRow) return [...catalog];
  return [toView(archivedRow), ...catalog];
}

/** Colour lookup used by pickers + canvas — always returns something
 *  (neutral grey fallback if the slug doesn't resolve). Pass `category`
 *  to scope the lookup; slugs are only unique per (tenant, category), so
 *  an unscoped lookup may return the wrong row (e.g. the door-category
 *  `wood` row, which has no textures, shadowing the wall-category row). */
export function getAtomColor(
  materials: MaterialRow[],
  slug: string,
  category?: MaterialCategory,
): string {
  const match = category
    ? materials.find((m) => m.slug === slug && m.category === category)
    : materials.find((m) => m.slug === slug);
  return match?.color ?? '#808080';
}

/** Full-row lookup used when rendering needs textures + tileSize. Pass
 *  `category` to scope the lookup — mandatory whenever the caller cares
 *  about textures, because slug collisions across categories are the
 *  norm (wall `wood` and door `wood` are distinct rows). */
export function getAtom(
  materials: MaterialRow[],
  slug: string,
  category?: MaterialCategory,
): MaterialRow | null {
  if (category) {
    return materials.find((m) => m.slug === slug && m.category === category) ?? null;
  }
  return materials.find((m) => m.slug === slug) ?? null;
}
