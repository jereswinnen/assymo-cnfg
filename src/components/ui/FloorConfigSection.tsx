'use client';

import { useConfigStore, selectSingleBuildingId } from '@/store/useConfigStore';
import { FLOOR_CATALOG } from '@/domain/materials';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import type { FloorMaterialId } from '@/domain/building';

export default function FloorConfigSection() {
  const selectedBuildingId = useConfigStore(selectSingleBuildingId);
  const floorMaterialId = useConfigStore((s) => {
    const sid = selectSingleBuildingId(s);
    if (!sid) return null;
    const b = s.buildings.find(b => b.id === sid);
    return b?.floor.materialId ?? null;
  });
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
