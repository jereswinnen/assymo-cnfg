'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import { WALL_CATALOG } from '@/domain/materials';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';

/** Building-level "Materiaal" picker — sets primaryMaterialId, which walls,
 *  doors, poles, and fascia inherit from when they have no override. */
export default function BuildingMaterialSection() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const primaryMaterialId = useConfigStore((s) =>
    selectedBuildingId
      ? s.buildings.find(b => b.id === selectedBuildingId)?.primaryMaterialId ?? null
      : null,
  );
  const setBuildingPrimaryMaterial = useConfigStore((s) => s.setBuildingPrimaryMaterial);

  if (!selectedBuildingId || !primaryMaterialId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Selecteer een gebouw
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionLabel>{t('material.primary')}</SectionLabel>
      <MaterialSelect
        catalog={WALL_CATALOG}
        value={primaryMaterialId}
        onChange={(atomId) => setBuildingPrimaryMaterial(selectedBuildingId, atomId)}
        showPrice
        ariaLabel={t('material.primary')}
      />
      <p className="text-[11px] text-muted-foreground leading-snug">
        {t('material.primary.help')}
      </p>
    </div>
  );
}
