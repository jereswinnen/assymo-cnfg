'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import SectionLabel from '@/components/ui/SectionLabel';
import type { WallId } from '@/types/building';

interface WindowConfigProps {
  wallId: WallId;
}

export default function WindowConfig({ wallId }: WindowConfigProps) {
  const wallCfg = useConfigStore((s) => s.config.walls[wallId]);
  const updateWall = useConfigStore((s) => s.updateWall);

  if (!wallCfg) return null;

  function handleChange(field: string, value: unknown) {
    updateWall(wallId, { [field]: value });
  }

  return (
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
  );
}
