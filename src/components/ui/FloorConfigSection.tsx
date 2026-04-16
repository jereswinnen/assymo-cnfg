'use client';

import { useConfigStore, selectSingleBuildingId } from '@/store/useConfigStore';
import { FLOOR_CATALOG, resolveCatalog } from '@/lib/materials';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';

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
      <div className="grid grid-cols-2 gap-1.5">
        {resolveCatalog(FLOOR_CATALOG).map(({ atomId, atom, isVoid }) => {
          const isSelected = floorMaterialId === atomId;
          return (
            <button
              key={atomId}
              onClick={() => updateBuildingFloor(selectedBuildingId, {
                materialId: atomId as typeof floorMaterialId,
              })}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary text-primary'
                  : 'border-border text-foreground hover:border-primary/40'
              }`}
            >
              {!isVoid && (
                <span
                  className="inline-block h-5 w-5 shrink-0 rounded-md border border-border/50"
                  style={{ backgroundColor: atom.color }}
                />
              )}
              {t(atom.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
