'use client';

import { useState } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { clampOpeningPosition, DOOR_W, DOUBLE_DOOR_W, getWallLength, WIN_W } from '@/domain/building';
import { getEffectiveDoorMaterial } from '@/domain/materials';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import { Plus, X } from 'lucide-react';
import type { WallId, DoorMaterialId } from '@/domain/building';

interface DoorConfigProps {
  wallId: WallId;
  buildingId: string;
}

export default function DoorConfig({ wallId, buildingId }: DoorConfigProps) {
  const wallCfg = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === buildingId);
    return b?.walls[wallId] ?? null;
  });
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);
  const [expanded, setExpanded] = useState(false);
  const effectiveDoor = wallCfg && building
    ? getEffectiveDoorMaterial(wallCfg, building)
    : null;
  const { door: doorCatalog, sourceProduct } = useTenantCatalogs(
    { door: effectiveDoor },
    building?.sourceProductId,
  );

  if (!wallCfg || !building) return null;

  const dimensions = building.dimensions;
  const wallLength = getWallLength(wallId, dimensions);
  const dw = wallCfg.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
  const otherOpenings = (wallCfg.windows ?? []).map(w => ({ position: w.position, width: w.width ?? WIN_W }));
  const linksPos = clampOpeningPosition(wallLength, dw, 0.0, otherOpenings);
  const rechtsPos = clampOpeningPosition(wallLength, dw, 1.0, otherOpenings);

  function handleChange(field: string, value: unknown) {
    updateBuildingWall(buildingId, wallId, { [field]: value });
  }

  const sizeLabel = wallCfg.doorSize === 'dubbel'
    ? `${(DOUBLE_DOOR_W * 100).toFixed(0)} × 210`
    : `${(DOOR_W * 100).toFixed(0)} × 210`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{t('surface.door')}</span>
        {!wallCfg.hasDoor && (
          <button
            onClick={() => handleChange('hasDoor', true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Toevoegen
          </button>
        )}
      </div>

      {wallCfg.hasDoor && (
        <div className="rounded-lg border border-border/50 bg-background overflow-hidden">
          {/* Door item row */}
          <div
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-4 rounded-sm border border-amber-600/40 bg-amber-50" />
              <span className="text-sm">{t('surface.door')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {wallCfg.doorSize === 'dubbel' ? t('surface.doorSize.dubbel') : t('surface.doorSize.enkel')} · {sizeLabel}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleChange('hasDoor', false);
                }}
                className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5 -mr-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Expanded properties */}
          {expanded && (
            <div className="border-t border-border/50 px-3 py-3 space-y-3 bg-muted/20">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <SectionLabel>{t('surface.doorMaterial')}</SectionLabel>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={wallCfg.doorMaterialId !== undefined}
                      onCheckedChange={(checked) => {
                        handleChange(
                          'doorMaterialId',
                          checked ? getEffectiveDoorMaterial(wallCfg, building) : undefined,
                        );
                      }}
                    />
                    {t('material.override')}
                  </label>
                </div>
                <MaterialSelect
                  catalog={doorCatalog}
                  value={getEffectiveDoorMaterial(wallCfg, building)}
                  disabled={wallCfg.doorMaterialId === undefined}
                  onChange={(atomId) => handleChange('doorMaterialId', atomId as DoorMaterialId)}
                  category="door"
                  ariaLabel={t('surface.doorMaterial')}
                />
                {sourceProduct?.constraints.allowedMaterialsBySlot?.door?.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('configurator.picker.kitRestricted')}
                  </p>
                ) : null}
                {wallCfg.doorMaterialId === undefined && (
                  <p className="text-[11px] text-muted-foreground italic">{t('material.inherit')}</p>
                )}
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
                    Math.abs(wallCfg.doorPosition - linksPos) < 0.01 ? 'links'
                      : Math.abs(wallCfg.doorPosition - rechtsPos) < 0.01 ? 'rechts'
                      : Math.abs(wallCfg.doorPosition - 0.5) < 0.01 ? 'midden'
                      : ''
                  }
                  onValueChange={(v) => {
                    if (v === 'links') handleChange('doorPosition', linksPos);
                    else if (v === 'midden') handleChange('doorPosition', 0.5);
                    else if (v === 'rechts') handleChange('doorPosition', rechtsPos);
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
                <label
                  htmlFor="door-mirror"
                  className="flex items-center gap-2 pt-1 cursor-pointer text-xs text-muted-foreground"
                >
                  <Checkbox
                    id="door-mirror"
                    checked={wallCfg.doorMirror ?? false}
                    onCheckedChange={(checked) => handleChange('doorMirror', !!checked)}
                  />
                  {t('surface.doorMirror')}
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {!wallCfg.hasDoor && (
        <button
          onClick={() => handleChange('hasDoor', true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Deur toevoegen
        </button>
      )}
    </div>
  );
}
