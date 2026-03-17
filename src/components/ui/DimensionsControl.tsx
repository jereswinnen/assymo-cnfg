'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { getEffectiveHeight } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Orientation } from '@/types/building';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  badge?: string;
  onReset?: () => void;
}

function SliderRow({ label, value, min, max, step, unit, onChange, badge, onReset }: SliderRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          {badge && (
            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {value.toFixed(step < 1 ? 1 : 0)} {unit}
          </span>
          {onReset && (
            <button
              onClick={onReset}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
              title={t('dim.height.reset')}
            >
              ↺
            </button>
          )}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export default function DimensionsControl() {
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const building = useConfigStore((s) => {
    if (!s.selectedBuildingId) return null;
    return s.buildings.find(b => b.id === s.selectedBuildingId) ?? null;
  });
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const roofType = useConfigStore((s) => s.roof.type);
  const roofPitch = useConfigStore((s) => s.roof.pitch);
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);
  const updateRoof = useConfigStore((s) => s.updateRoof);
  const setDefaultHeight = useConfigStore((s) => s.setDefaultHeight);
  const setHeightOverride = useConfigStore((s) => s.setHeightOverride);
  const setOrientation = useConfigStore((s) => s.setOrientation);

  if (!building || !selectedBuildingId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Selecteer een gebouw
      </div>
    );
  }

  const { dimensions } = building;
  const isPole = building.type === 'paal';
  const isMuur = building.type === 'muur';
  const isStructural = !isPole && !isMuur;
  const effectiveHeight = getEffectiveHeight(building, defaultHeight);
  const hasHeightOverride = building.heightOverride !== null;

  return (
    <div className="space-y-4">
      {isStructural && (
        <SliderRow
          label={t('dim.width')}
          value={dimensions.width}
          min={3}
          max={15}
          step={0.5}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { width: v })}
        />
      )}
      {isMuur && (
        <SliderRow
          label={t('dim.width')}
          value={dimensions.width}
          min={1}
          max={10}
          step={0.5}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { width: v })}
        />
      )}

      {isStructural && (
        <SliderRow
          label={t('dim.depth')}
          value={dimensions.depth}
          min={3}
          max={20}
          step={0.5}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { depth: v })}
        />
      )}

      {isStructural ? (
        <SliderRow
          label={t('dim.height')}
          value={effectiveHeight}
          min={2}
          max={6}
          step={0.25}
          unit="m"
          onChange={(v) => setDefaultHeight(v)}
        />
      ) : (
        <SliderRow
          label={t('dim.height')}
          value={effectiveHeight}
          min={2}
          max={6}
          step={0.25}
          unit="m"
          onChange={(v) => setHeightOverride(selectedBuildingId, v)}
          badge={hasHeightOverride ? t('dim.height.override') : t('dim.height.default')}
          onReset={hasHeightOverride ? () => setHeightOverride(selectedBuildingId, null) : undefined}
        />
      )}

      {isMuur && (
        <div className="space-y-2">
          <Label>{t('dim.orientation')}</Label>
          <ToggleGroup
            type="single"
            value={building.orientation}
            onValueChange={(v) => { if (v) setOrientation(selectedBuildingId, v as Orientation); }}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="horizontal" className="flex-1 text-xs">
              {t('dim.orientation.horizontal')}
            </ToggleGroupItem>
            <ToggleGroupItem value="vertical" className="flex-1 text-xs">
              {t('dim.orientation.vertical')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {isStructural && roofType === 'pitched' && (
        <SliderRow
          label={t('dim.roofPitch')}
          value={roofPitch}
          min={5}
          max={55}
          step={1}
          unit="°"
          onChange={(v) => updateRoof({ pitch: v })}
        />
      )}
    </div>
  );
}
