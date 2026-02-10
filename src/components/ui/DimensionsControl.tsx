'use client';

import { useConfigStore } from '@/store/useConfigStore';

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
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500 tabular-nums">
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

export default function DimensionsControl() {
  const dimensions = useConfigStore((s) => s.config.dimensions);
  const updateDimensions = useConfigStore((s) => s.updateDimensions);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Building Dimensions
      </h3>
      <SliderRow
        label="Width"
        value={dimensions.width}
        min={3}
        max={15}
        step={0.5}
        unit="m"
        onChange={(v) => updateDimensions({ width: v })}
      />
      <SliderRow
        label="Depth"
        value={dimensions.depth}
        min={3}
        max={20}
        step={0.5}
        unit="m"
        onChange={(v) => updateDimensions({ depth: v })}
      />
      <SliderRow
        label="Height"
        value={dimensions.height}
        min={2}
        max={6}
        step={0.25}
        unit="m"
        onChange={(v) => updateDimensions({ height: v })}
      />
      <SliderRow
        label="Roof Pitch"
        value={dimensions.roofPitch}
        min={5}
        max={55}
        step={1}
        unit="°"
        onChange={(v) => updateDimensions({ roofPitch: v })}
      />
    </div>
  );
}
