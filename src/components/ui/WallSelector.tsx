'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { getAvailableWallIds, isOverkappingWall, OVERKAPPING_WALL_IDS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import type { WallId } from '@/types/building';

export default function WallSelector() {
  const buildingType = useConfigStore((s) => s.config.buildingType);
  const walls = useConfigStore((s) => s.config.walls);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);
  const addOverkappingWall = useConfigStore((s) => s.addOverkappingWall);
  const removeOverkappingWall = useConfigStore((s) => s.removeOverkappingWall);

  const wallIds = getAvailableWallIds(buildingType);

  if (wallIds.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('walls.disabled')}
      </div>
    );
  }

  const selectedWallId = selectedElement?.type === 'wall' ? selectedElement.id : null;
  const bergingWallIds = wallIds.filter((id) => !isOverkappingWall(id));
  const showOverkapping = buildingType === 'combined';

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('wall.clickToSelect')}</p>

      {/* Berging walls */}
      <div className="grid grid-cols-2 gap-1.5">
        {bergingWallIds.map((id: WallId) => (
          <button
            key={id}
            onClick={() => selectElement({ type: 'wall', id })}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${
              selectedWallId === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {t(`wall.${id}`)}
          </button>
        ))}
      </div>

      {/* Overkapping walls */}
      {showOverkapping && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Overkapping
          </Label>
          {OVERKAPPING_WALL_IDS.map((id) => {
            const exists = !!walls[id];
            const isSelected = selectedWallId === id;
            const wallLabel = t(`wall.${id}`).replace('Overkapping ', '');

            return (
              <div
                key={id}
                className={`flex items-center justify-between rounded-md px-3 py-2 transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : exists
                      ? 'bg-muted text-foreground'
                      : 'bg-muted/40 text-muted-foreground'
                }`}
              >
                <button
                  onClick={() => exists ? selectElement({ type: 'wall', id }) : addOverkappingWall(id)}
                  className="flex-1 text-left text-sm font-medium"
                >
                  {wallLabel}
                </button>
                {exists ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOverkappingWall(id);
                    }}
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary/80'
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                    }`}
                  >
                    Verwijder
                  </button>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground/50">+ Toevoegen</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
