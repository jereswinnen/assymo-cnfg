import type { BaseCatalogEntry } from './types';

/** Slugs that must always show in pickers regardless of tenant filtering.
 *  `geen` is the "no floor" sentinel — hiding it would break the floor
 *  picker when a building has no floor (isVoid). */
export const ALWAYS_ENABLED_SLUGS = ['geen'] as const satisfies readonly string[];

/** Pure predicate: can this tenant use this material slug?
 *  `enabled === null` means unrestricted — all slugs allowed. */
export function isMaterialEnabled(
  slug: string,
  enabled: readonly string[] | null,
): boolean {
  if (enabled === null) return true;
  if ((ALWAYS_ENABLED_SLUGS as readonly string[]).includes(slug)) return true;
  return enabled.includes(slug);
}

/** Filter a per-category catalog against a tenant's enabled list.
 *  Null input returns the catalog reference verbatim (useful for
 *  memoisation in the browser). Sentinels in ALWAYS_ENABLED_SLUGS
 *  are preserved even when absent from the enabled list. */
export function filterCatalog<T extends BaseCatalogEntry>(
  catalog: readonly T[],
  enabled: readonly string[] | null,
): readonly T[] {
  if (enabled === null) return catalog;
  const allowed = new Set<string>(enabled);
  for (const s of ALWAYS_ENABLED_SLUGS) allowed.add(s);
  return catalog.filter((entry) => allowed.has(entry.atomId));
}

/** Like filterCatalog, but always keeps the currently-selected slug
 *  visible in the picker (even if it has been disabled for the tenant
 *  after the scene was created). Lets existing scenes stay editable
 *  without being forced onto a different material. */
export function filterCatalogAllowing<T extends BaseCatalogEntry>(
  catalog: readonly T[],
  enabled: readonly string[] | null,
  currentAtomId: string | null,
): readonly T[] {
  if (enabled === null) return catalog;
  const allowed = new Set<string>(enabled);
  for (const s of ALWAYS_ENABLED_SLUGS) allowed.add(s);
  if (currentAtomId) allowed.add(currentAtomId);
  return catalog.filter((entry) => allowed.has(entry.atomId));
}
