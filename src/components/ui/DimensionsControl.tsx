'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, unit, onChange }: SliderRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground tabular-nums">
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
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
  const dimensions = useConfigStore((s) => s.config.dimensions);
  const buildingType = useConfigStore((s) => s.config.buildingType);
  const roofType = useConfigStore((s) => s.config.roof.type);
  const updateDimensions = useConfigStore((s) => s.updateDimensions);

  return (
    <div className="space-y-4">
      <SliderRow
        label={t('dim.width')}
        value={dimensions.width}
        min={3}
        max={15}
        step={0.5}
        unit="m"
        onChange={(v) => updateDimensions({ width: v })}
      />
      <SliderRow
        label={t('dim.depth')}
        value={dimensions.depth}
        min={3}
        max={20}
        step={0.5}
        unit="m"
        onChange={(v) => updateDimensions({ depth: v })}
      />
      <SliderRow
        label={t('dim.height')}
        value={dimensions.height}
        min={2}
        max={6}
        step={0.25}
        unit="m"
        onChange={(v) => updateDimensions({ height: v })}
      />
      {buildingType === 'combined' && (
        <SliderRow
          label={t('dim.bergingWidth')}
          value={dimensions.bergingWidth}
          min={2}
          max={dimensions.width - 2}
          step={0.5}
          unit="m"
          onChange={(v) => updateDimensions({ bergingWidth: v })}
        />
      )}
      {roofType === 'pitched' && (
        <SliderRow
          label={t('dim.roofPitch')}
          value={dimensions.roofPitch}
          min={5}
          max={55}
          step={1}
          unit="°"
          onChange={(v) => updateDimensions({ roofPitch: v })}
        />
      )}
    </div>
  );
}
