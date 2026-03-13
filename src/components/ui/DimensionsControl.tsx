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
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const building = useConfigStore((s) => {
    if (!s.selectedBuildingId) return null;
    return s.buildings.find(b => b.id === s.selectedBuildingId) ?? null;
  });
  const roofType = useConfigStore((s) => s.roof.type);
  const roofPitch = useConfigStore((s) => s.roof.pitch);
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);
  const updateRoof = useConfigStore((s) => s.updateRoof);

  if (!building || !selectedBuildingId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Selecteer een gebouw
      </div>
    );
  }

  const { dimensions } = building;
  const isPole = building.type === 'paal';

  return (
    <div className="space-y-4">
      {!isPole && (
        <>
          <SliderRow
            label={t('dim.width')}
            value={dimensions.width}
            min={3}
            max={15}
            step={0.5}
            unit="m"
            onChange={(v) => updateBuildingDimensions(selectedBuildingId, { width: v })}
          />
          <SliderRow
            label={t('dim.depth')}
            value={dimensions.depth}
            min={3}
            max={20}
            step={0.5}
            unit="m"
            onChange={(v) => updateBuildingDimensions(selectedBuildingId, { depth: v })}
          />
        </>
      )}
      <SliderRow
        label={t('dim.height')}
        value={dimensions.height}
        min={2}
        max={6}
        step={0.25}
        unit="m"
        onChange={(v) => updateBuildingDimensions(selectedBuildingId, { height: v })}
      />
      {!isPole && roofType === 'pitched' && (
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
