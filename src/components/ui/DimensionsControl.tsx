'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { FLOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';

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
  const buildingType = useConfigStore((s) => s.config.buildingType);
  const roofType = useConfigStore((s) => s.config.roof.type);
  const floorMaterialId = useConfigStore((s) => s.config.floor.materialId);
  const updateDimensions = useConfigStore((s) => s.updateDimensions);
  const updateFloor = useConfigStore((s) => s.updateFloor);

  return (
    <div className="space-y-3">
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

      {/* Floor covering */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('floor.material')}</label>
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {FLOOR_MATERIALS.map((m) => (
            <button
              key={m.id}
              onClick={() => updateFloor({ materialId: m.id })}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
                floorMaterialId === m.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
