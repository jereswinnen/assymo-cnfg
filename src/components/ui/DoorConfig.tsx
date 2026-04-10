'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { DOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import SectionLabel from '@/components/ui/SectionLabel';
import type { WallId } from '@/types/building';

interface DoorConfigProps {
  wallId: WallId;
  buildingId: string;
}

export default function DoorConfig({ wallId, buildingId }: DoorConfigProps) {
  const wallCfg = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === buildingId);
    return b?.walls[wallId] ?? null;
  });
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);

  if (!wallCfg) return null;

  function handleChange(field: string, value: unknown) {
    updateBuildingWall(buildingId, wallId, { [field]: value });
  }

  return (
    <div className={`rounded-lg transition-all ${wallCfg.hasDoor ? 'bg-muted/40 p-3 ring-1 ring-border/50' : ''}`}>
      <div className="flex items-center gap-2">
        <Checkbox
          id="wall-door"
          checked={wallCfg.hasDoor}
          onCheckedChange={(checked) => handleChange('hasDoor', !!checked)}
        />
        <Label htmlFor="wall-door" className="cursor-pointer font-medium">
          {t('surface.door')}
        </Label>
      </div>
      {wallCfg.hasDoor && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <SectionLabel>{t('surface.doorMaterial')}</SectionLabel>
            <ToggleGroup
              type="single"
              value={wallCfg.doorMaterialId}
              onValueChange={(v) => { if (v) handleChange('doorMaterialId', v); }}
              className="w-full"
              variant="outline"
              size="sm"
            >
              {DOOR_MATERIALS.map((m) => (
                <ToggleGroupItem key={m.id} value={m.id} className="flex-1 text-xs">
                  {t(`surface.doorMaterial.${m.id}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <SectionLabel>{t('surface.doorSize')}</SectionLabel>
            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={wallCfg.doorSize}
                onValueChange={(v) => { if (v) handleChange('doorSize', v); }}
                className="flex-1"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="enkel" className="flex-1 text-xs">
                  {t('surface.doorSize.enkel')}
                </ToggleGroupItem>
                <ToggleGroupItem value="dubbel" className="flex-1 text-xs">
                  {t('surface.doorSize.dubbel')}
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
                <Checkbox
                  id="door-window"
                  checked={wallCfg.doorHasWindow}
                  onCheckedChange={(checked) => handleChange('doorHasWindow', !!checked)}
                />
                <Label htmlFor="door-window" className="cursor-pointer text-xs text-muted-foreground whitespace-nowrap">
                  Raam
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <SectionLabel>{t('surface.doorPosition')}</SectionLabel>
            <ToggleGroup
              type="single"
              value={
                Math.abs(wallCfg.doorPosition - 0.0) < 0.01 ? 'links'
                  : Math.abs(wallCfg.doorPosition - 1.0) < 0.01 ? 'rechts'
                  : Math.abs(wallCfg.doorPosition - 0.5) < 0.01 ? 'midden'
                  : ''
              }
              onValueChange={(v) => {
                if (!v) return;
                const pos = v === 'links' ? 0.0 : v === 'rechts' ? 1.0 : 0.5;
                handleChange('doorPosition', pos);
              }}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="links" className="flex-1 text-xs">
                {t('surface.doorPosition.links')}
              </ToggleGroupItem>
              <ToggleGroupItem value="midden" className="flex-1 text-xs">
                {t('surface.doorPosition.midden')}
              </ToggleGroupItem>
              <ToggleGroupItem value="rechts" className="flex-1 text-xs">
                {t('surface.doorPosition.rechts')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <SectionLabel>{t('surface.doorSwing')}</SectionLabel>
            <ToggleGroup
              type="single"
              value={wallCfg.doorSwing}
              onValueChange={(v) => { if (v) handleChange('doorSwing', v); }}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="dicht" className="flex-1 text-xs">
                {t('surface.doorSwing.dicht')}
              </ToggleGroupItem>
              <ToggleGroupItem value="naar_binnen" className="flex-1 text-xs">
                {t('surface.doorSwing.naar_binnen')}
              </ToggleGroupItem>
              <ToggleGroupItem value="naar_buiten" className="flex-1 text-xs">
                {t('surface.doorSwing.naar_buiten')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      )}
    </div>
  );
}
