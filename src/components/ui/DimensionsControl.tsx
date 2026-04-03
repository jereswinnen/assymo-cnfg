'use client';

import { useState, useRef, useEffect } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { getEffectiveHeight } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { getConstraints } from '@/lib/constants';
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
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const decimals = step < 1 ? 1 : 0;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const commitValue = () => {
    setEditing(false);
    const parsed = parseFloat(inputValue.replace(',', '.'));
    if (isNaN(parsed)) return;
    const clamped = Math.min(max, Math.max(min, parsed));
    const stepped = step > 0 ? Math.round(clamped / step) * step : clamped;
    onChange(stepped);
  };

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
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={commitValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitValue();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-14 text-sm text-right tabular-nums bg-muted border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setInputValue(value.toFixed(decimals));
                setEditing(true);
              }}
              className="text-sm text-muted-foreground tabular-nums hover:text-primary hover:underline transition-colors cursor-text"
            >
              {value.toFixed(decimals)} {unit}
            </button>
          )}
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
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingIds.length === 1 ? s.selectedBuildingIds[0] : null);
  const building = useConfigStore((s) => {
    const sid = s.selectedBuildingIds.length === 1 ? s.selectedBuildingIds[0] : null;
    if (!sid) return null;
    return s.buildings.find(b => b.id === sid) ?? null;
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
  const constraints = getConstraints(building.type);

  return (
    <div className="space-y-4">
      {(isStructural || isMuur) && (
        <SliderRow
          label={t('dim.width')}
          value={dimensions.width}
          min={constraints.width.min}
          max={constraints.width.max}
          step={constraints.width.step}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { width: v })}
        />
      )}

      {isStructural && (
        <SliderRow
          label={t('dim.depth')}
          value={dimensions.depth}
          min={constraints.depth.min}
          max={constraints.depth.max}
          step={constraints.depth.step}
          unit="m"
          onChange={(v) => updateBuildingDimensions(selectedBuildingId, { depth: v })}
        />
      )}

      {isStructural ? (
        <SliderRow
          label={t('dim.height')}
          value={effectiveHeight}
          min={constraints.height.min}
          max={constraints.height.max}
          step={constraints.height.step}
          unit="m"
          onChange={(v) => setDefaultHeight(v)}
        />
      ) : (
        <SliderRow
          label={t('dim.height')}
          value={effectiveHeight}
          min={constraints.height.min}
          max={constraints.height.max}
          step={constraints.height.step}
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
