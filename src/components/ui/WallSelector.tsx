'use client';

import { useConfigStore, selectSingleBuildingId } from '@/store/useConfigStore';
import { getAvailableWallIds } from '@/domain/building';
import { t } from '@/lib/i18n';
import type { WallId } from '@/domain/building';

export default function WallSelector() {
  const selectedBuilding = useConfigStore((s) => {
    const sid = selectSingleBuildingId(s);
    if (!sid) return null;
    return s.buildings.find(b => b.id === sid) ?? null;
  });
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);
  const isWallHiddenByConnection = useConfigStore((s) => s.isWallHiddenByConnection);

  if (!selectedBuilding) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Selecteer een gebouw
      </div>
    );
  }

  const wallIds = getAvailableWallIds(selectedBuilding.type);

  if (wallIds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('walls.disabled')}
      </div>
    );
  }

  const selectedWallId = selectedElement?.type === 'wall' && selectedElement.buildingId === selectedBuilding.id
    ? selectedElement.id
    : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('wall.clickToSelect')}</p>

      <div className="grid grid-cols-2 gap-1.5">
        {wallIds.map((id: WallId) => {
          const isOpen = isWallHiddenByConnection(selectedBuilding.id, id);
          const isSelected = selectedWallId === id;
          return (
            <button
              key={id}
              onClick={() => !isOpen && selectElement({ type: 'wall', id, buildingId: selectedBuilding.id })}
              disabled={isOpen}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                isOpen
                  ? 'border-dashed border-border bg-muted/30 text-muted-foreground cursor-not-allowed'
                  : isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-muted/50 text-foreground'
              }`}
            >
              {t(`wall.${id}`)}
              {isOpen && <span className="block text-[10px] opacity-70">{t('connection.open')}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
