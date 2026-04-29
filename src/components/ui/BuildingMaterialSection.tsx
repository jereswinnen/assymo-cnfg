'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from '@/store/useUIStore';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import { BUILDING_KIND_META, getEntityMaterial } from '@/domain/building';
import type { MaterialCategory } from '@/domain/catalog';

/** Maps `MaterialCategory` to the field name on the `useTenantCatalogs`
 *  return type. The hook camel-cases the multi-word keys (`roofCover` /
 *  `roofTrim`); the rest match category 1:1. */
const CATALOG_KEY = {
  wall: 'wall',
  'roof-cover': 'roofCover',
  'roof-trim': 'roofTrim',
  floor: 'floor',
  door: 'door',
  gate: 'gate',
} as const satisfies Record<MaterialCategory, string>;

/** Universal "Materiaal" picker — fully registry-driven. Reads
 *  `BUILDING_KIND_META[type].material.category` to choose the catalog and
 *  delegates writes to `setEntityMaterial`, which dispatches by binding kind.
 *  No per-type branches in this component. New kinds plug in by declaring
 *  their material descriptor in the registry; this file does not change. */
export default function BuildingMaterialSection() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId
      ? s.buildings.find((b) => b.id === selectedBuildingId) ?? null
      : null,
  );
  const setEntityMaterial = useConfigStore((s) => s.setEntityMaterial);

  const meta = selectedBuilding ? BUILDING_KIND_META[selectedBuilding.type] : null;
  const value = selectedBuilding ? getEntityMaterial(selectedBuilding) : '';

  // The current selection is fed to useTenantCatalogs so an archived material
  // stays visible in the trigger (existing scenes keep working). The hook
  // accepts the value under the wall/gate/floor/etc. key — same name as the
  // category, except for the two camelCased ones.
  const catalogs = useTenantCatalogs(
    meta && value
      ? ({ [CATALOG_KEY[meta.material.category]]: value } as Parameters<typeof useTenantCatalogs>[0])
      : {},
    selectedBuilding?.sourceProductId,
  );
  const catalog = meta ? catalogs[CATALOG_KEY[meta.material.category]] : null;

  if (!selectedBuildingId || !selectedBuilding || !meta || !catalog) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('sidebar.emptyState')}
      </div>
    );
  }

  // Source-product allow-list hint only applies to the wall slot today.
  // Gates don't carry product-level material allow-lists (yet); when they
  // do, the constraint shape grows a sibling slot and this conditional
  // can dispatch through it the same way.
  const showKitHint =
    meta.material.kind === 'building' &&
    !!catalogs.sourceProduct?.constraints.allowedMaterialsBySlot?.wallCladding?.length;

  return (
    <div className="space-y-2">
      <SectionLabel>{t('material.primary')}</SectionLabel>
      <MaterialSelect
        catalog={catalog}
        value={value}
        onChange={(id) => setEntityMaterial(selectedBuildingId, id)}
        category={meta.material.category}
        showPrice
        ariaLabel={t('material.primary')}
      />
      {showKitHint ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('configurator.picker.kitRestricted')}
        </p>
      ) : null}
      <p className="text-[11px] text-muted-foreground leading-snug">
        {t('material.primary.help')}
      </p>
    </div>
  );
}
