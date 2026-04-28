import { BUILDING_KIND_META, type BuildingKindMeta } from '@/domain/building/kinds';
import type { BuildingType } from '@/domain/building';
import type { MaterialCategory } from '@/domain/catalog';

export interface TrayEntry {
  type: BuildingType;
  meta: BuildingKindMeta;
}

export interface FilteredTrayEntries {
  primitives: readonly TrayEntry[];
  structurals: readonly TrayEntry[];
}

/** Return the tray entries the current tenant can offer.
 *  Caller MUST pass both args — no silent-empty defaults.
 *
 *  An entry survives iff every category in `meta.requiredCategories`
 *  is present in `availableCategories`. Tenants without `'gate'`
 *  materials therefore drop the poort entry; tenants without `'wall'`
 *  drop every primitive at once. */
export function filterTrayEntries(
  registry: typeof BUILDING_KIND_META,
  availableCategories: ReadonlySet<MaterialCategory>,
): FilteredTrayEntries {
  const primitives: TrayEntry[] = [];
  const structurals: TrayEntry[] = [];

  for (const [type, meta] of Object.entries(registry) as [BuildingType, BuildingKindMeta][]) {
    const ok = meta.requiredCategories.every((c) => availableCategories.has(c));
    if (!ok) continue;
    if (meta.tray === 'primitive') primitives.push({ type, meta });
    else structurals.push({ type, meta });
  }

  return { primitives, structurals };
}
