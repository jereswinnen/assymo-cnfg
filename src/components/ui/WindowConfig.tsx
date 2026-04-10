'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { WIN_W, getWallLength, findBestNewPosition, DOOR_W, DOUBLE_DOOR_W } from '@/lib/constants';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import SectionLabel from '@/components/ui/SectionLabel';
import type { WallId, WallWindow } from '@/types/building';

interface WindowConfigProps {
  wallId: WallId;
  buildingId: string;
}

export default function WindowConfig({ wallId, buildingId }: WindowConfigProps) {
  const wallCfg = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === buildingId);
    return b?.walls[wallId] ?? null;
  });
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);

  if (!wallCfg || !building) return null;

  const windows = wallCfg.windows ?? [];
  const hasWindows = windows.length > 0;
  const wallLength = getWallLength(wallId, building.dimensions);

  function handleChange(field: string, value: unknown) {
    updateBuildingWall(buildingId, wallId, { [field]: value });
  }

  function setWindowCount(count: number) {
    const current = wallCfg!.windows ?? [];
    if (count <= 0) {
      handleChange('windows', []);
      return;
    }
    if (count < current.length) {
      handleChange('windows', current.slice(0, count));
      return;
    }
    // Add windows with auto-positioned placement
    const newWindows = [...current];
    const existingOpenings: { position: number; width: number }[] = current.map(w => ({
      position: w.position,
      width: WIN_W,
    }));
    if (wallCfg!.hasDoor) {
      const dw = wallCfg!.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
      existingOpenings.push({ position: wallCfg!.doorPosition ?? 0.5, width: dw });
    }
    for (let i = current.length; i < count; i++) {
      const pos = findBestNewPosition(wallLength, WIN_W, existingOpenings);
      const win: WallWindow = { id: crypto.randomUUID(), position: pos };
      newWindows.push(win);
      existingOpenings.push({ position: pos, width: WIN_W });
    }
    handleChange('windows', newWindows);
  }

  return (
    <div className={`rounded-lg transition-all ${hasWindows ? 'bg-muted/40 p-3 ring-1 ring-border/50' : ''}`}>
      <div className="flex items-center gap-2">
        <Checkbox
          id="wall-windows"
          checked={hasWindows}
          onCheckedChange={(checked) => {
            if (checked) {
              setWindowCount(1);
            } else {
              handleChange('windows', []);
            }
          }}
        />
        <Label htmlFor="wall-windows" className="cursor-pointer font-medium">
          {t('surface.windows')}
        </Label>
      </div>
      {hasWindows && (
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <SectionLabel>{t('surface.windowCount')}</SectionLabel>
            <span className="text-sm font-semibold tabular-nums">{windows.length}</span>
          </div>
          <Slider
            min={1}
            max={6}
            step={1}
            value={[windows.length]}
            onValueChange={([v]) => setWindowCount(v)}
          />
        </div>
      )}
    </div>
  );
}
