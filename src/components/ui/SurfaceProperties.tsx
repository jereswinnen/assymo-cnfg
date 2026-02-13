'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, FINISHES, DOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { WallId } from '@/types/building';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {children}
    </Label>
  );
}

export default function SurfaceProperties() {
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const config = useConfigStore((s) => s.config);
  const updateWall = useConfigStore((s) => s.updateWall);

  if (!selectedElement || selectedElement.type !== 'wall') {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>

      {/* Material selector */}
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
                    handleChange('hasWindow', false);
                    handleChange('windowCount', 0);
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

      {/* Finish */}
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

      {/* Door section */}
      {!isGlass && (
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
              {/* Door material */}
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

              {/* Door size + window toggle */}
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

              {/* Door position */}
              <div className="space-y-1.5">
                <SectionLabel>{t('surface.doorPosition')}</SectionLabel>
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
              </div>

              {/* Door swing */}
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
      )}

      {/* Windows section */}
      {!isGlass && (
        <div className={`rounded-lg transition-all ${wallCfg.hasWindow ? 'bg-muted/40 p-3 ring-1 ring-border/50' : ''}`}>
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
            <Label htmlFor="wall-windows" className="cursor-pointer font-medium">
              {t('surface.windows')}
            </Label>
          </div>
          {wallCfg.hasWindow && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between items-center">
                <SectionLabel>{t('surface.windowCount')}</SectionLabel>
                <span className="text-sm font-semibold tabular-nums">{wallCfg.windowCount}</span>
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
