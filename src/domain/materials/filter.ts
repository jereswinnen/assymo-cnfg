import type { MaterialCategory, MaterialRow } from '@/domain/catalog';
import type {
  WallCatalogEntry,
  RoofTrimCatalogEntry,
  RoofCoveringCatalogEntry,
  FloorCatalogEntry,
  DoorCatalogEntry,
} from './types';

/** Slugs that must always be available regardless of admin choices.
 *  Today only `geen` (the void-floor sentinel), because hiding it would
 *  leave the configurator with no "no floor" option. */
export const ALWAYS_ENABLED_SLUGS: readonly string[] = ['geen'];

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
 *  (neutral grey fallback if the slug doesn't resolve). */
export function getAtomColor(materials: MaterialRow[], slug: string): string {
  return materials.find((m) => m.slug === slug)?.color ?? '#808080';
}

/** Full-row lookup used when rendering needs textures + tileSize. */
export function getAtom(materials: MaterialRow[], slug: string): MaterialRow | null {
  return materials.find((m) => m.slug === slug) ?? null;
}
