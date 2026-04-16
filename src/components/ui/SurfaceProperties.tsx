'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { WALL_CATALOG, getEffectiveWallMaterial } from '@/lib/materials';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
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
        <SectionLabel>{t('surface.material')}</SectionLabel>
        <MaterialSelect
          catalog={WALL_CATALOG}
          value={effectiveMaterial}
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
      </div>

      {isGlass && (
        <p className="text-xs text-muted-foreground italic">Glaswand van zijde tot zijde</p>
      )}

      {!isGlass && <DoorConfig wallId={wallId} buildingId={buildingId} />}
      {!isGlass && <WindowConfig wallId={wallId} buildingId={buildingId} />}
    </div>
  );
}
