'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import type { FloorMaterialId } from '@/domain/building';

export default function FloorConfigSection() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId
      ? s.buildings.find(b => b.id === selectedBuildingId) ?? null
      : null,
  );
  const floorMaterialId = selectedBuilding?.floor.materialId ?? null;
  const updateBuildingFloor = useConfigStore((s) => s.updateBuildingFloor);
  const { floor: floorCatalog, sourceProduct } = useTenantCatalogs(
    { floor: floorMaterialId },
    selectedBuilding?.sourceProductId,
  );

  if (!selectedBuildingId || floorMaterialId === null) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Selecteer een gebouw
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionLabel>{t('floor.material')}</SectionLabel>
      <MaterialSelect
        catalog={floorCatalog}
        value={floorMaterialId}
        onChange={(atomId) =>
          updateBuildingFloor(selectedBuildingId, {
            materialId: atomId as FloorMaterialId,
          })
        }
        showPrice
        ariaLabel={t('floor.material')}
      />
      {sourceProduct?.constraints.allowedMaterialsBySlot?.floor?.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('configurator.picker.kitRestricted')}
        </p>
      ) : null}
    </div>
  );
}
