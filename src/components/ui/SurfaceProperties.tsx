'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, FINISHES, DOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import type { WallId } from '@/types/building';

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SurfaceProperties() {
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const config = useConfigStore((s) => s.config);
  const updateWall = useConfigStore((s) => s.updateWall);

  if (!selectedElement || selectedElement.type !== 'wall') {
    return (
      <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
        {t('wall.select')}
      </div>
    );
  }

  const wallId = selectedElement.id as WallId;
  const wallCfg = config.walls[wallId];
  if (!wallCfg) return null;

  const label = t(`wall.${wallId}`);

  function handleChange(field: string, value: unknown) {
    updateWall(wallId, { [field]: value });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-900">
        {label} — {t('surface.properties')}
      </h4>

      {/* Material & Finish row */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('surface.material')}</label>
          <select
            value={wallCfg.materialId}
            onChange={(e) => handleChange('materialId', e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {WALL_MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('surface.finish')}</label>
          <select
            value={wallCfg.finish}
            onChange={(e) => handleChange('finish', e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {FINISHES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Door */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={wallCfg.hasDoor}
            onChange={(e) => handleChange('hasDoor', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('surface.door')}
        </label>
        {wallCfg.hasDoor && (
          <div className="space-y-2.5 border-t border-gray-100 px-3 pb-3 pt-2.5">
            {/* Material */}
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-500">{t('surface.doorMaterial')}</span>
              <ToggleGroup
                options={DOOR_MATERIALS.map((m) => ({
                  value: m.id,
                  label: t(`surface.doorMaterial.${m.id}`),
                }))}
                value={wallCfg.doorMaterialId}
                onChange={(v) => handleChange('doorMaterialId', v)}
              />
            </div>
            {/* Size + Window row */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <span className="mb-1 block text-xs font-medium text-gray-500">{t('surface.doorSize')}</span>
                <ToggleGroup
                  options={[
                    { value: 'enkel', label: t('surface.doorSize.enkel') },
                    { value: 'dubbel', label: t('surface.doorSize.dubbel') },
                  ]}
                  value={wallCfg.doorSize}
                  onChange={(v) => handleChange('doorSize', v)}
                />
              </div>
              <label className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 select-none cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={wallCfg.doorHasWindow}
                  onChange={(e) => handleChange('doorHasWindow', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {t('surface.doorHasWindow')}
              </label>
            </div>
            {/* Position */}
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-500">{t('surface.doorPosition')}</span>
              <ToggleGroup
                options={[
                  { value: 'links', label: t('surface.doorPosition.links') },
                  { value: 'midden', label: t('surface.doorPosition.midden') },
                  { value: 'rechts', label: t('surface.doorPosition.rechts') },
                ]}
                value={wallCfg.doorPosition}
                onChange={(v) => handleChange('doorPosition', v)}
              />
            </div>
            {/* Swing */}
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-500">{t('surface.doorSwing')}</span>
              <ToggleGroup
                options={[
                  { value: 'dicht', label: t('surface.doorSwing.dicht') },
                  { value: 'naar_binnen', label: t('surface.doorSwing.naar_binnen') },
                  { value: 'naar_buiten', label: t('surface.doorSwing.naar_buiten') },
                ]}
                value={wallCfg.doorSwing}
                onChange={(v) => handleChange('doorSwing', v)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Windows */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={wallCfg.hasWindow}
            onChange={(e) => {
              handleChange('hasWindow', e.target.checked);
              if (!e.target.checked) handleChange('windowCount', 0);
              else if (wallCfg.windowCount === 0) handleChange('windowCount', 1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('surface.windows')}
        </label>
        {wallCfg.hasWindow && (
          <div className="border-t border-gray-100 px-3 pb-2.5 pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{t('surface.windowCount')}</span>
              <span className="font-medium text-gray-700 tabular-nums">{wallCfg.windowCount}</span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={wallCfg.windowCount}
              onChange={(e) => handleChange('windowCount', parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        )}
      </div>
    </div>
  );
}
