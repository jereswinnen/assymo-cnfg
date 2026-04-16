'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import { FLOOR_CATALOG } from '@/domain/materials';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import type { FloorMaterialId } from '@/domain/building';

export default function FloorConfigSection() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const floorMaterialId = useConfigStore((s) =>
    selectedBuildingId
      ? s.buildings.find(b => b.id === selectedBuildingId)?.floor.materialId ?? null
      : null,
  );
  const updateBuildingFloor = useConfigStore((s) => s.updateBuildingFloor);

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
        catalog={FLOOR_CATALOG}
        value={floorMaterialId}
        onChange={(atomId) =>
          updateBuildingFloor(selectedBuildingId, {
            materialId: atomId as FloorMaterialId,
          })
        }
        showPrice
        ariaLabel={t('floor.material')}
      />
    </div>
  );
}
