'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore } from "@/store/useUIStore";
import { WALL_CATALOG, getEffectiveWallMaterial } from '@/domain/materials';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import DoorConfig from '@/components/ui/DoorConfig';
import WindowConfig from '@/components/ui/WindowConfig';
import type { WallId } from '@/domain/building';

export default function SurfaceProperties() {
  const selectedElement = useUIStore((s) => s.selectedElement);
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
  const effectiveMaterial = building ? getEffectiveWallMaterial(wallCfg, building) : 'wood';
  const currentWallEntry = WALL_CATALOG.find(e => e.atomId === effectiveMaterial);
  const isGlass = currentWallEntry?.clearsOpenings === true;

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
        <div className="flex items-center justify-between">
          <SectionLabel>{t('surface.material')}</SectionLabel>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={wallCfg.materialId !== undefined}
              onCheckedChange={(checked) => {
                handleChange('materialId', checked ? effectiveMaterial : undefined);
              }}
            />
            {t('material.override')}
          </label>
        </div>
        <MaterialSelect
          catalog={WALL_CATALOG}
          value={effectiveMaterial}
          disabled={wallCfg.materialId === undefined}
          onChange={(atomId) => {
            handleChange('materialId', atomId);
            const entry = WALL_CATALOG.find(e => e.atomId === atomId);
            if (entry?.clearsOpenings) {
              handleChange('hasDoor', false);
              handleChange('windows', []);
            }
          }}
          showPrice
          ariaLabel={t('surface.material')}
        />
        {wallCfg.materialId === undefined && (
          <p className="text-[11px] text-muted-foreground italic">{t('material.inherit')}</p>
        )}
      </div>

      {isGlass && (
        <p className="text-xs text-muted-foreground italic">Glaswand van zijde tot zijde</p>
      )}

      {!isGlass && <DoorConfig wallId={wallId} buildingId={buildingId} />}
      {!isGlass && <WindowConfig wallId={wallId} buildingId={buildingId} />}
    </div>
  );
}
