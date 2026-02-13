'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, FINISHES, DOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import type { WallId } from '@/types/building';

export default function SurfaceProperties() {
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const config = useConfigStore((s) => s.config);
  const updateWall = useConfigStore((s) => s.updateWall);

  if (!selectedElement || selectedElement.type !== 'wall') {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('wall.select')}
      </div>
    );
  }

  const wallId = selectedElement.id as WallId;
  const wallCfg = config.walls[wallId];
  if (!wallCfg) return null;

  const label = t(`wall.${wallId}`);
  const isGlass = wallCfg.materialId === 'glass';

  function handleChange(field: string, value: unknown) {
    updateWall(wallId, { [field]: value });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
        <Label className="text-sm font-semibold">{label}</Label>
      </div>

      {/* Material selector */}
      <div>
        <Label className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t('surface.material')}
        </Label>
        <div className="grid grid-cols-5 gap-1.5">
          {WALL_MATERIALS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                handleChange('materialId', m.id);
                if (m.id === 'glass') {
                  handleChange('hasDoor', false);
                  handleChange('hasWindow', false);
                  handleChange('windowCount', 0);
                }
              }}
              className={`flex flex-col items-center gap-1 rounded-md p-2 transition-all ${
                wallCfg.materialId === m.id
                  ? 'bg-primary/10 ring-1 ring-primary'
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <span
                className="h-6 w-6 rounded border border-border"
                style={{
                  backgroundColor: m.id === 'glass' ? '#B8D4E3' : m.color,
                  opacity: m.id === 'glass' ? 0.5 : 1,
                }}
              />
              <span className="text-[10px] font-medium text-muted-foreground leading-tight">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Finish */}
      {!isGlass && (
        <div>
          <Label className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t('surface.finish')}
          </Label>
          <ToggleGroup
            type="single"
            value={wallCfg.finish}
            onValueChange={(v) => { if (v) handleChange('finish', v); }}
            className="w-full"
            variant="outline"
            size="sm"
          >
            {FINISHES.map((f) => (
              <ToggleGroupItem key={f} value={f} className="flex-1">
                {f}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {isGlass && (
        <p className="text-xs text-muted-foreground italic">Glaswand van zijde tot zijde</p>
      )}

      {/* Door section */}
      {!isGlass && (
        <div className={`rounded-md transition-all ${wallCfg.hasDoor ? 'bg-muted/50 p-3' : ''}`}>
          <div className="flex items-center gap-2">
            <Checkbox
              id="wall-door"
              checked={wallCfg.hasDoor}
              onCheckedChange={(checked) => handleChange('hasDoor', !!checked)}
            />
            <Label htmlFor="wall-door" className="cursor-pointer">
              {t('surface.door')}
            </Label>
          </div>
          {wallCfg.hasDoor && (
            <div className="mt-3 space-y-3">
              {/* Door material */}
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

              {/* Door size + window toggle */}
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

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1.5">
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

              {/* Door position */}
              <ToggleGroup
                type="single"
                value={wallCfg.doorPosition}
                onValueChange={(v) => { if (v) handleChange('doorPosition', v); }}
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

              {/* Door swing */}
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
          )}
        </div>
      )}

      {/* Windows section */}
      {!isGlass && (
        <div className={`rounded-md transition-all ${wallCfg.hasWindow ? 'bg-muted/50 p-3' : ''}`}>
          <div className="flex items-center gap-2">
            <Checkbox
              id="wall-windows"
              checked={wallCfg.hasWindow}
              onCheckedChange={(checked) => {
                handleChange('hasWindow', !!checked);
                if (!checked) handleChange('windowCount', 0);
                else if (wallCfg.windowCount === 0) handleChange('windowCount', 1);
              }}
            />
            <Label htmlFor="wall-windows" className="cursor-pointer">
              {t('surface.windows')}
            </Label>
          </div>
          {wallCfg.hasWindow && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{t('surface.windowCount')}</span>
                <span className="text-sm font-medium tabular-nums">{wallCfg.windowCount}</span>
              </div>
              <Slider
                min={1}
                max={6}
                step={1}
                value={[wallCfg.windowCount]}
                onValueChange={([v]) => handleChange('windowCount', v)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
