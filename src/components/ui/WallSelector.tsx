'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { getAvailableWallIds, isOverkappingWall, OVERKAPPING_WALL_IDS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('walls.disabled')}
      </div>
    );
  }

  const selectedWallId = selectedElement?.type === 'wall' ? selectedElement.id : null;
  const bergingWallIds = wallIds.filter((id) => !isOverkappingWall(id));
  const showOverkapping = buildingType === 'combined';

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('wall.clickToSelect')}</p>

      {/* Berging walls */}
      <div className="grid grid-cols-2 gap-1.5">
        {bergingWallIds.map((id: WallId) => {
          const isSelected = selectedWallId === id;
          return (
            <button
              key={id}
              onClick={() => selectElement({ type: 'wall', id })}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-muted/50 text-foreground'
              }`}
            >
              {t(`wall.${id}`)}
            </button>
          );
        })}
      </div>

      {/* Overkapping walls */}
      {showOverkapping && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Overkapping
          </Label>
          <div className="space-y-1">
            {OVERKAPPING_WALL_IDS.map((id) => {
              const exists = !!walls[id];
              const isSelected = selectedWallId === id;
              const wallLabel = t(`wall.${id}`).replace('Overkapping ', '');

              return (
                <div
                  key={id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <button
                    onClick={() => exists ? selectElement({ type: 'wall', id }) : addOverkappingWall(id)}
                    className={`flex-1 text-left text-sm font-medium ${
                      isSelected ? 'text-primary' : exists ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {wallLabel}
                  </button>
                  <Switch
                    checked={exists}
                    onCheckedChange={(checked) => {
                      if (checked) addOverkappingWall(id);
                      else removeOverkappingWall(id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
