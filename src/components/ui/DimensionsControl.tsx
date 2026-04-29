'use client';

import { useState, useRef, useEffect } from 'react';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import { useTenant } from '@/lib/TenantProvider';
import { t } from '@/lib/i18n';
import { BUILDING_KIND_META, getConstraints } from '@/domain/building';
import { clampDimensions } from '@/domain/catalog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Orientation } from '@/domain/building';

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
    // Typed input clamps to [min, max] only; the slider keeps its `step`
    // for tactile dragging. Matches canvas-drag behaviour, which also
    // bypasses step (e.g. muur width step is 0.5 but 0.8 is a valid value).
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
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
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const building = useConfigStore((s) =>
    selectedBuildingId ? s.buildings.find(b => b.id === selectedBuildingId) ?? null : null,
  );
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const roofType = useConfigStore((s) => s.roof.type);
  const roofPitch = useConfigStore((s) => s.roof.pitch);
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);
  const updateRoof = useConfigStore((s) => s.updateRoof);
  const setDefaultHeight = useConfigStore((s) => s.setDefaultHeight);
  const setHeightOverride = useConfigStore((s) => s.setHeightOverride);
  const setOrientation = useConfigStore((s) => s.setOrientation);
  const { catalog } = useTenant();

  if (!building || !selectedBuildingId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Selecteer een gebouw
      </div>
    );
  }

  const { dimensions } = building;
  const meta = BUILDING_KIND_META[building.type];
  const dim = meta.dimensions;
  // Roof-pitch slider only applies to kinds that share the scene-level height
  // (the same kinds that own the roof). Today: 'overkapping' + 'berging'.
  const showRoofPitch = dim.heightSource === 'default';
  const effectiveHeight = getEffectiveHeight(building, defaultHeight);
  const hasHeightOverride = building.heightOverride !== null;
  const constraints = getConstraints(building.type);

  // Resolve product constraints when a sourceProductId is set.
  const product = building.sourceProductId
    ? catalog.products.find((p) => p.id === building.sourceProductId) ?? null
    : null;

  // Effective slider bounds: product constraint takes priority over global defaults.
  const widthMin  = product?.constraints.minWidth  ?? constraints.width.min;
  const widthMax  = product?.constraints.maxWidth  ?? constraints.width.max;
  const depthMin  = product?.constraints.minDepth  ?? constraints.depth.min;
  const depthMax  = product?.constraints.maxDepth  ?? constraints.depth.max;
  const heightMin = product?.constraints.minHeight ?? constraints.height.min;
  const heightMax = product?.constraints.maxHeight ?? constraints.height.max;

  return (
    <div className="space-y-4">
      {dim.width && (
        <SliderRow
          label={t('dim.width')}
          value={dimensions.width}
          min={widthMin}
          max={widthMax}
          step={constraints.width.step}
          unit="m"
          onChange={(v) => {
            const { width } = clampDimensions({ width: v }, product);
            updateBuildingDimensions(selectedBuildingId, { width: width ?? v });
          }}
        />
      )}

      {dim.depth && (
        <SliderRow
          label={t('dim.depth')}
          value={dimensions.depth}
          min={depthMin}
          max={depthMax}
          step={constraints.depth.step}
          unit="m"
          onChange={(v) => {
            const { depth } = clampDimensions({ depth: v }, product);
            updateBuildingDimensions(selectedBuildingId, { depth: depth ?? v });
          }}
        />
      )}

      {dim.height && (
        dim.heightSource === 'default' ? (
          // Scene-level: tweaking one structural building affects all sharing
          // the same defaultHeight. Acceptable while single-product scenes are
          // the common case.
          <SliderRow
            label={t('dim.height')}
            value={effectiveHeight}
            min={heightMin}
            max={heightMax}
            step={constraints.height.step}
            unit="m"
            onChange={(v) => {
              const { height } = clampDimensions({ height: v }, product);
              setDefaultHeight(height ?? v);
            }}
          />
        ) : (
          <SliderRow
            label={t('dim.height')}
            value={effectiveHeight}
            min={heightMin}
            max={heightMax}
            step={constraints.height.step}
            unit="m"
            onChange={(v) => {
              const { height } = clampDimensions({ height: v }, product);
              setHeightOverride(selectedBuildingId, height ?? v);
            }}
            badge={hasHeightOverride ? t('dim.height.override') : t('dim.height.default')}
            onReset={hasHeightOverride ? () => setHeightOverride(selectedBuildingId, null) : undefined}
          />
        )
      )}

      {dim.orientation && (
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

      {showRoofPitch && roofType === 'pitched' && (
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
