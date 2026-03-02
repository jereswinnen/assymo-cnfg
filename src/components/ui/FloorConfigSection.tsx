'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { FLOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';

export default function FloorConfigSection() {
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const floorMaterialId = useConfigStore((s) => {
    if (!s.selectedBuildingId) return null;
    const b = s.buildings.find(b => b.id === s.selectedBuildingId);
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
      <div className="grid grid-cols-2 gap-1.5">
        {FLOOR_MATERIALS.map((m) => {
          const isSelected = floorMaterialId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => updateBuildingFloor(selectedBuildingId, { materialId: m.id })}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary text-primary'
                  : 'border-border text-foreground hover:border-primary/40'
              }`}
            >
              {m.id !== 'geen' && (
                <span
                  className="inline-block h-5 w-5 shrink-0 rounded-md border border-border/50"
                  style={{ backgroundColor: m.color }}
                />
              )}
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
