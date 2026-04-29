'use client';

import { useEffect } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from '@/store/useUIStore';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import {
  BUILDING_KIND_META,
  type PrimaryMaterialBinding,
} from '@/domain/building';
import type { MaterialCategory } from '@/domain/catalog';
import type { BuildingEntity } from '@/domain/building';

/** Maps a domain `MaterialCategory` to the field name on the
 *  `useTenantCatalogs` return type. The hook's keys use camelCase
 *  (`roofCover` / `roofTrim`); the rest match category 1:1. */
const CATALOG_KEY: Record<MaterialCategory, 'wall' | 'roofCover' | 'roofTrim' | 'floor' | 'door' | 'gate'> = {
  wall: 'wall',
  'roof-cover': 'roofCover',
  'roof-trim': 'roofTrim',
  floor: 'floor',
  door: 'door',
  gate: 'gate',
};

function getMaterialId(building: BuildingEntity, binding: PrimaryMaterialBinding): string {
  if (binding.source === 'primaryMaterialId') {
    return building.primaryMaterialId ?? '';
  }
  return building.gateConfig?.materialId ?? '';
}

/** Universal "Materiaal" picker — reads `BUILDING_KIND_META[type].primaryMaterial`
 *  to know which catalog to show and which entity field to read/write. New
 *  kinds declare a binding in the registry; this component does not branch on
 *  type. */
export default function BuildingMaterialSection() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId
      ? s.buildings.find((b) => b.id === selectedBuildingId) ?? null
      : null,
  );
  const setBuildingPrimaryMaterial = useConfigStore((s) => s.setBuildingPrimaryMaterial);
  const updateGateConfig = useConfigStore((s) => s.updateGateConfig);

  const meta = selectedBuilding ? BUILDING_KIND_META[selectedBuilding.type] : null;
  const binding = meta?.primaryMaterial.binding ?? null;
  const category = meta?.primaryMaterial.category ?? null;
  const value = selectedBuilding && binding ? getMaterialId(selectedBuilding, binding) : '';

  const catalogs = useTenantCatalogs(
    category && value
      ? ({ [CATALOG_KEY[category]]: value } as Parameters<typeof useTenantCatalogs>[0])
      : {},
    selectedBuilding?.sourceProductId,
  );
  const catalog = category ? catalogs[CATALOG_KEY[category]] : null;

  // Bind a default when the entity has no material yet (e.g. freshly-spawned
  // poort whose factory writes `materialId: ''`). Picks the first catalog
  // entry so the trigger and pricing both resolve immediately.
  useEffect(() => {
    if (!selectedBuildingId || !binding || !catalog) return;
    if (value !== '' || catalog.length === 0) return;
    const first = catalog[0].atomId;
    if (binding.source === 'primaryMaterialId') {
      setBuildingPrimaryMaterial(selectedBuildingId, first);
    } else {
      updateGateConfig(selectedBuildingId, { materialId: first });
    }
  }, [
    selectedBuildingId,
    binding,
    catalog,
    value,
    setBuildingPrimaryMaterial,
    updateGateConfig,
  ]);

  if (!selectedBuildingId || !selectedBuilding || !meta || !binding || !category || !catalog) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('sidebar.emptyState')}
      </div>
    );
  }

  const onChange = (id: string) => {
    if (binding.source === 'primaryMaterialId') {
      setBuildingPrimaryMaterial(selectedBuildingId, id);
    } else {
      updateGateConfig(selectedBuildingId, { materialId: id });
    }
  };

  // Source-product allow-list hint only applies to the wall slot today. Gates
  // don't carry product-level material allow-lists (yet); when they do, the
  // hint can read from `meta.primaryMaterial.category`-driven slot.
  const showKitHint =
    catalogs.sourceProduct?.constraints.allowedMaterialsBySlot?.wallCladding?.length &&
    binding.source === 'primaryMaterialId';

  return (
    <div className="space-y-2">
      <SectionLabel>{t('material.primary')}</SectionLabel>
      <MaterialSelect
        catalog={catalog}
        value={value}
        onChange={onChange}
        category={category}
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
