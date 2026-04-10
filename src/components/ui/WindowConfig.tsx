'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import {
  WIN_W, WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT,
  getWallLength, findBestNewPosition, DOOR_W, DOUBLE_DOOR_W,
  EDGE_CLEARANCE, OPENING_GAP,
} from '@/lib/constants';
import { Plus, X } from 'lucide-react';
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

  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  const maxWindows = Math.max(0, Math.floor(usableLen / (WIN_W + OPENING_GAP)));

  function addWindow() {
    const existingOpenings: { position: number; width: number }[] = windows.map(w => ({
      position: w.position,
      width: w.width ?? WIN_W,
    }));
    if (wallCfg!.hasDoor) {
      const dw = wallCfg!.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
      existingOpenings.push({ position: wallCfg!.doorPosition ?? 0.5, width: dw });
    }
    const pos = findBestNewPosition(wallLength, WIN_W, existingOpenings);
    const win: WallWindow = {
      id: crypto.randomUUID(),
      position: pos,
      width: WIN_W_DEFAULT,
      height: WIN_H_DEFAULT,
      sillHeight: WIN_SILL_DEFAULT,
    };
    updateBuildingWall(buildingId, wallId, { windows: [...windows, win] });
  }

  function removeWindow(id: string) {
    updateBuildingWall(buildingId, wallId, {
      windows: windows.filter(w => w.id !== id),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{t('surface.windows')}</span>
        {windows.length < maxWindows && (
          <button
            onClick={addWindow}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Toevoegen
          </button>
        )}
      </div>
      {hasWindows && (
        <div className="space-y-1">
          {windows.map((win, i) => {
            const w = win.width ?? WIN_W_DEFAULT;
            const h = win.height ?? WIN_H_DEFAULT;
            return (
              <div
                key={win.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm border border-sky-300 bg-sky-50" />
                  <span className="text-sm">Raam {i + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(w * 100).toFixed(0)} × {(h * 100).toFixed(0)}
                  </span>
                  <button
                    onClick={() => removeWindow(win.id)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5 -mr-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!hasWindows && (
        <button
          onClick={addWindow}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Raam toevoegen
        </button>
      )}
    </div>
  );
}
