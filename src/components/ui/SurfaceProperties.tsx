'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, FINISHES } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import SectionLabel from '@/components/ui/SectionLabel';
import DoorConfig from '@/components/ui/DoorConfig';
import WindowConfig from '@/components/ui/WindowConfig';
import type { WallId } from '@/types/building';

export default function SurfaceProperties() {
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const buildings = useConfigStore((s) => s.buildings);
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);

  if (!selectedElement || selectedElement.type !== 'wall') {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('wall.select')}
      </div>
    );
  }

  const wallId = selectedElement.id as WallId;
  const buildingId = selectedElement.buildingId;
  const building = buildings.find(b => b.id === buildingId);
  const wallCfg = building?.walls[wallId];
  if (!wallCfg) return null;

  const label = t(`wall.${wallId}`);
  const isGlass = wallCfg.materialId === 'glass';

  function handleChange(field: string, value: unknown) {
    updateBuildingWall(buildingId, wallId, { [field]: value });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>

      <div className="space-y-2">
        <SectionLabel>{t('surface.material')}</SectionLabel>
        <div className="grid grid-cols-5 gap-1.5">
          {WALL_MATERIALS.map((m) => {
            const isSelected = wallCfg.materialId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  handleChange('materialId', m.id);
                  if (m.id === 'glass') {
                    handleChange('hasDoor', false);
                    handleChange('windows', []);
                  }
                }}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span
                  className="h-7 w-7 rounded-md border border-border/50"
                  style={{
                    backgroundColor: m.id === 'glass' ? '#B8D4E3' : m.color,
                    opacity: m.id === 'glass' ? 0.6 : 1,
                  }}
                />
                <span className={`text-[10px] font-medium leading-tight ${
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!isGlass && (
        <div className="space-y-2">
          <SectionLabel>{t('surface.finish')}</SectionLabel>
          <ToggleGroup
            type="single"
            value={wallCfg.finish}
            onValueChange={(v) => { if (v) handleChange('finish', v); }}
            className="w-full"
            variant="outline"
            size="sm"
          >
            {FINISHES.map((f) => (
              <ToggleGroupItem key={f} value={f} className="flex-1 text-xs">
                {f}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {isGlass && (
        <p className="text-xs text-muted-foreground italic">Glaswand van zijde tot zijde</p>
      )}

      {!isGlass && <DoorConfig wallId={wallId} buildingId={buildingId} />}
      {!isGlass && <WindowConfig wallId={wallId} buildingId={buildingId} />}
    </div>
  );
}
